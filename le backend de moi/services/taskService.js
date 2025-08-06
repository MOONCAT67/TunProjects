const db = require("../config/db");
const notificationService = require("../services/notificationService");
const emailService = require("../services/emailService");

// Helper Functions
const updateMainTaskProgress = async (mainTaskId) => {
  const [subtasks] = await db.query(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM sub_tasks 
     WHERE main_task_id = ?`,
    [mainTaskId]
  );

  const progress = subtasks[0].total > 0 
    ? Math.round((subtasks[0].completed / subtasks[0].total) * 100)
    : 0;

  await db.query(
    `UPDATE main_tasks 
     SET progress_percentage = ?
     WHERE id = ?`,
    [progress, mainTaskId]
  );

  return progress;
};

const checkPhaseCompletion = async (projectId, targetPhase) => {
  const [incompletePhases] = await db.query(
    `SELECT COUNT(*) as count 
     FROM main_tasks mt
     LEFT JOIN (
       SELECT main_task_id, COUNT(*) as total, 
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM sub_tasks 
       GROUP BY main_task_id
     ) st ON mt.id = st.main_task_id
     WHERE mt.project_id = ? 
     AND mt.sequence_order < ?
     AND (
       (mt.status != 'completed') OR
       (st.total > 0 AND st.completed < st.total)
     )`,
    [projectId, targetPhase]
  );
  return incompletePhases[0].count === 0;
};

// Main Exported Functions
exports.createMainTask = async (params) => {
  const { projectId, workerId, title, description, deadline, sequence_order } = params;

  if (!projectId) throw { message: "projectId was not provided", statusCode: 400 };
  if (!workerId) throw { message: "workerId was not provided", statusCode: 400 };
  if (!title) throw { message: "title was not provided", statusCode: 400 };

  try {
    const [result] = await db.query(
      `INSERT INTO main_tasks (
        project_id, title, description, status,
        deadline, progress_percentage, assigned_to, 
        assigned_type, sequence_order
      ) VALUES (?, ?, ?, 'not started', ?, 0, ?, 'individual', ?)`,
      [
        projectId,
        title,
        description || '',
        deadline || null,
        workerId,
        sequence_order || 1
      ]
    );

    return {
      statusCode: 201,
      message: "Main task created successfully",
      taskId: result.insertId
    };
  } catch (err) {
    throw { message: err, statusCode: 500 };
  }
};

exports.addSubTask = async (params) => {
  const { mainTaskId, workerId, title, assignedTo, deadline } = params;

  if (!mainTaskId) throw { message: "mainTaskId was not provided", statusCode: 400 };
  if (!workerId) throw { message: "workerId was not provided", statusCode: 400 };
  if (!title) throw { message: "title was not provided", statusCode: 400 };

  return new Promise((resolve, reject) => {
    db.beginTransaction(async (err) => {
      try {
        // Verify main task exists and get phase
        const [mainTask] = await db.query(
          `SELECT project_id, sequence_order FROM main_tasks WHERE id = ?`,
          [mainTaskId]
        );

        if (mainTask.length === 0) {
          throw { message: "Main task not found", statusCode: 404 };
        }

        // Create subtask
        const [result] = await db.query(
          `INSERT INTO sub_tasks (
            main_task_id, title, status,
            assigned_to, deadline, progress_percentage
          ) VALUES (?, ?, 'not started', ?, ?, 0)`,
          [
            mainTaskId,
            title,
            assignedTo || workerId,
            deadline || null
          ]
        );

        await db.commit();
        resolve({
          statusCode: 201,
          message: "Subtask created successfully",
          subTaskId: result.insertId,
          currentPhase: mainTask[0].sequence_order
        });

      } catch (err) {
        await db.rollback();
        reject({ 
          message: err.message || "Failed to create subtask", 
          statusCode: err.statusCode || 500 
        });
      }
    });
  });
};

exports.updateSubTaskStatus = async (params) => {
  const { subTaskId, workerId, status } = params;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get subtask and its phase info, including team info
    const [subtask] = await connection.query(
      `SELECT st.*, mt.sequence_order, mt.project_id, mt.id as main_task_id,
              p.title as project_title, p.project_type, p.main_tasks_number,
              p.client_id, u.fullname as worker_name,
              pt.team_id, t.leader_id,
              l.fullname as leader_name, l.email as leader_email
           FROM sub_tasks st
           JOIN main_tasks mt ON st.main_task_id = mt.id
       JOIN projects p ON mt.project_id = p.id
           JOIN users u ON st.assigned_to = u.id
       LEFT JOIN project_teams pt ON p.id = pt.project_id
       LEFT JOIN teams t ON pt.team_id = t.id
       LEFT JOIN users l ON t.leader_id = l.id
           WHERE st.id = ?`,
          [subTaskId]
        );

        if (subtask.length === 0) {
          throw { message: "Subtask not found", statusCode: 404 };
        }

        // 2. Phase progression check
        const currentPhase = subtask[0].sequence_order;
        const isPhaseReady = await checkPhaseCompletion(
          subtask[0].project_id, 
          currentPhase
        );
        
        if (!isPhaseReady && status !== 'not started') {
          throw { 
            message: `Complete all tasks in Phase ${currentPhase-1} first`, 
            statusCode: 403 
          };
        }

    // 3. Calculate progress percentage based on status
    let progressPercentage = 0;
    if (status === 'in progress') {
      progressPercentage = 50;
    } else if (status === 'completed') {
      progressPercentage = 100;
    }

    // 4. Update subtask
    await connection.query(
          `UPDATE sub_tasks 
           SET status = ?, 
               progress_percentage = ?,
               completed_at = ${status === 'completed' ? 'NOW()' : 'NULL'}
           WHERE id = ? AND assigned_to = ?`,
          [
            status, 
        progressPercentage,
            subTaskId, 
            workerId
          ]
        );

    // 5. If this is a team project and the worker is not the leader, notify the leader
    if (subtask[0].project_type === 'team' && 
        subtask[0].team_id && 
        subtask[0].leader_id && 
        subtask[0].leader_id !== workerId) {
      
      // Create in-app notification
      await notificationService.notifyTaskStatusUpdate({
        leaderId: subtask[0].leader_id,
        workerName: subtask[0].worker_name,
        projectTitle: subtask[0].project_title,
        status: status,
        projectId: subtask[0].project_id,
        taskId: subTaskId
      });

      // Send email notification
      await emailService.sendTaskStatusUpdateEmail({
        recipientEmail: subtask[0].leader_email,
        recipientName: subtask[0].leader_name,
        workerName: subtask[0].worker_name,
        projectTitle: subtask[0].project_title,
        status: status,
        projectId: subtask[0].project_id
      });
    }

    // 6. If subtask is completed, check if all subtasks in main task are completed
        if (status === 'completed') {
      // Check if there are any incomplete subtasks in the main task
      const [incompleteSubtasks] = await connection.query(
            `SELECT COUNT(*) as count 
         FROM sub_tasks 
         WHERE main_task_id = ? 
         AND status != 'completed'`,
        [subtask[0].main_task_id]
      );

      // If all subtasks are completed, update main task and project phase
      if (incompleteSubtasks[0].count === 0) {
        // Update main task to completed
        await connection.query(
          `UPDATE main_tasks 
           SET status = 'completed',
               progress_percentage = 100,
               completed_at = NOW()
           WHERE id = ?`,
          [subtask[0].main_task_id]
        );

        // Send notification to client about main task completion
        await notificationService.createNotification({
          userId: subtask[0].client_id,
          title: 'Main Task Completed',
          message: `${subtask[0].worker_name} has completed all subtasks in the main task of project "${subtask[0].project_title}"`,
          type: 'task',
          referenceId: subtask[0].main_task_id
        });

        // Check if this is the last main task in the project
        const isLastMainTask = subtask[0].sequence_order === subtask[0].main_tasks_number;

        if (isLastMainTask) {
          // If this is the last main task, update project status to completed
          await connection.query(
            `UPDATE projects 
             SET status = 'completed',
                 current_phase = ?
             WHERE id = ?`,
            [currentPhase, subtask[0].project_id]
          );
        } else {
        // Get the next main task in sequence
        const [nextMainTask] = await connection.query(
          `SELECT id 
           FROM main_tasks 
           WHERE project_id = ? 
           AND sequence_order = ?`,
          [subtask[0].project_id, currentPhase + 1]
          );

        // If there is a next main task, set it to in progress
        if (nextMainTask.length > 0) {
          await connection.query(
            `UPDATE main_tasks 
             SET status = 'in progress',
                 progress_percentage = 0
             WHERE id = ?`,
            [nextMainTask[0].id]
          );
        }

        // Update project's current phase
        await connection.query(
              `UPDATE projects 
               SET current_phase = ?
               WHERE id = ?`,
              [currentPhase + 1, subtask[0].project_id]
            );
        }
          }
        }

    await connection.commit();

    return {
          statusCode: 200,
      message: "Subtask status updated successfully",
      data: {
        status,
        progress_percentage: progressPercentage
      }
    };

      } catch (err) {
    await connection.rollback();
    throw { 
          message: err.message || "Update failed", 
          statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
      }
};

exports.deleteSubTask = async (params) => {
  const { subTaskId, workerId } = params;

  return new Promise((resolve, reject) => {
    db.beginTransaction(async (err) => {
      try {
        // Verify worker has permission
        const [subtask] = await db.query(
          `SELECT st.main_task_id, mt.assigned_to 
           FROM sub_tasks st
           JOIN main_tasks mt ON st.main_task_id = mt.id
           WHERE st.id = ?`,
          [subTaskId]
        );

        if (subtask.length === 0) {
          throw { message: "Subtask not found", statusCode: 404 };
        }

        if (subtask[0].assigned_to !== workerId) {
          throw { message: "Not authorized to delete this subtask", statusCode: 403 };
        }

        // Delete subtask
        await db.query(
          `DELETE FROM sub_tasks WHERE id = ?`,
          [subTaskId]
        );

        // Update main task progress
        await updateMainTaskProgress(subtask[0].main_task_id);

        await db.commit();
        resolve({
          statusCode: 200,
          message: "Subtask deleted successfully"
        });

      } catch (err) {
        await db.rollback();
        reject({ 
          message: err.message || "Deletion failed", 
          statusCode: err.statusCode || 500 
        });
      }
    });
  });
};

exports.getTaskProgress = async (params) => {
  const { projectId } = params;

  if (!projectId) throw { message: "projectId was not provided", statusCode: 400 };

  try {
    const [results] = await db.query(
      `SELECT 
        mt.id as main_task_id,
        mt.title as main_task_title,
        mt.sequence_order,
        mt.progress_percentage,
        COUNT(st.id) as total_subtasks,
        SUM(CASE WHEN st.status = 'completed' THEN 1 ELSE 0 END) as completed_subtasks
       FROM main_tasks mt
       LEFT JOIN sub_tasks st ON mt.id = st.main_task_id
       WHERE mt.project_id = ?
       GROUP BY mt.id
       ORDER BY mt.sequence_order`,
      [projectId]
    );

    const [project] = await db.query(
      `SELECT current_phase FROM projects WHERE id = ?`,
      [projectId]
    );

    return {
      statusCode: 200,
      data: {
        currentPhase: project[0]?.current_phase || 1,
        tasks: results
      }
    };
  } catch (err) {
    throw { message: err, statusCode: 500 };
  }
};

exports.getProjectTasks = async (projectId) => {
  if (!projectId) throw { message: "projectId was not provided", statusCode: 400 };

  try {
    // Get all main tasks for the project
    const [mainTasks] = await db.query(
      `SELECT mt.*, 
              u.fullname as assigned_to_name,
              t.name as team_name
       FROM main_tasks mt
       LEFT JOIN users u ON mt.assigned_to = u.id AND mt.assigned_type = 'individual'
       LEFT JOIN teams t ON mt.assigned_to = t.id AND mt.assigned_type = 'team'
       WHERE mt.project_id = ?
       ORDER BY mt.sequence_order ASC`,
      [projectId]
    );

    // For each main task, get its subtasks
    const tasksWithSubtasks = await Promise.all(
      mainTasks.map(async (mainTask) => {
        const [subTasks] = await db.query(
          `SELECT st.*, 
                  u.fullname as assigned_to_name,
                  t.name as team_name
           FROM sub_tasks st
           LEFT JOIN users u ON st.assigned_to = u.id AND st.assigned_type = 'individual'
           LEFT JOIN teams t ON st.assigned_to = t.id AND st.assigned_type = 'team'
           WHERE st.main_task_id = ?
           ORDER BY st.created_at ASC`,
          [mainTask.id]
        );

        // Get attachments for main task
        const [mainTaskAttachments] = await db.query(
          `SELECT * FROM task_attachments 
           WHERE task_id = ? AND task_type = 'main'`,
          [mainTask.id]
        );

        // Get attachments for each subtask
        const subtasksWithAttachments = await Promise.all(
          subTasks.map(async (subTask) => {
            const [subTaskAttachments] = await db.query(
              `SELECT * FROM task_attachments 
               WHERE task_id = ? AND task_type = 'sub'`,
              [subTask.id]
            );
            return {
              ...subTask,
              attachments: subTaskAttachments
            };
          })
        );

        return {
          ...mainTask,
          subtasks: subtasksWithAttachments,
          attachments: mainTaskAttachments
        };
      })
    );

    return {
      statusCode: 200,
      message: "Tasks retrieved successfully",
      data: tasksWithSubtasks
    };

  } catch (err) {
    throw { 
      message: err.message || "Failed to get project tasks", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.createBulkTasks = async (projectId, tasks) => {
  if (!projectId) throw { message: "projectId was not provided", statusCode: 400 };
  if (!tasks || !Array.isArray(tasks)) throw { message: "Invalid tasks data", statusCode: 400 };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Get current highest sequence order for the project
    const [currentSequence] = await connection.query(
      `SELECT COALESCE(MAX(sequence_order), 0) as max_sequence 
       FROM main_tasks 
       WHERE project_id = ?`,
      [projectId]
    );
    let nextSequence = currentSequence[0].max_sequence + 1;

    const createdTasks = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const isFirstTask = i === 0;

      // Insert main task with incremented sequence order
      const [mainTaskResult] = await connection.query(
        `INSERT INTO main_tasks (
          project_id, title, description, status, progress_percentage,
          deadline, assigned_to, assigned_type, sequence_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          task.title,
          task.description,
          isFirstTask ? 'in progress' : 'not started',
          task.progress_percentage || 0,
          task.deadline,
          task.assigned_to,
          task.assigned_type,
          nextSequence++
        ]
      );

      const mainTaskId = mainTaskResult.insertId;
      const createdMainTask = {
        id: mainTaskId,
        ...task,
        sequence_order: nextSequence - 1,
        status: isFirstTask ? 'in progress' : 'not started',
        subtasks: []
      };

      // Insert subtasks if they exist
      if (task.subtasks && Array.isArray(task.subtasks)) {
        for (const subtask of task.subtasks) {
          const [subTaskResult] = await connection.query(
            `INSERT INTO sub_tasks (
              main_task_id, title, description, status, progress_percentage,
              deadline, assigned_to, assigned_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              mainTaskId,
              subtask.title,
              subtask.description,
              'not started',
              subtask.progress_percentage || 0,
              subtask.deadline,
              subtask.assigned_to,
              subtask.assigned_type
            ]
          );

          createdMainTask.subtasks.push({
            id: subTaskResult.insertId,
            ...subtask,
            status: 'not started'
          });
        }
      }

      createdTasks.push(createdMainTask);
    }

    // Update project's main_tasks_number and current_phase
    await connection.query(
      `UPDATE projects 
       SET main_tasks_number = (
         SELECT COUNT(*) 
         FROM main_tasks 
         WHERE project_id = ?
       ),
       current_phase = 1
       WHERE id = ?`,
      [projectId, projectId]
    );

    await connection.commit();
    return {
      statusCode: 201,
      message: "Tasks created successfully",
      data: {
        tasks: createdTasks,
        firstTaskInProgress: true
      }
    };

  } catch (err) {
    await connection.rollback();
    throw { 
      message: err.message || "Failed to create tasks", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.getTeamMembers = async (userId) => {
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    // First get the team ID for this user
    const [userTeam] = await db.query(
      `SELECT t.id as team_id, t.name as team_name, t.description as team_description
       FROM teams t
       JOIN team_memberships tm ON t.id = tm.team_id
       WHERE tm.worker_id = ? AND t.is_active = 1`,
      [userId]
    );

    if (userTeam.length === 0) {
      return {
        statusCode: 200,
        message: "User is not a member of any team",
        data: {
          team: null,
          members: []
        }
      };
    }

    const teamId = userTeam[0].team_id;

    // Then get all members of this team
    const [members] = await db.query(
      `SELECT 
        u.id,
        u.fullname,
        u.email,
        u.profile_picture,
        tm.role,
        tm.joined_at,
        CASE WHEN t.leader_id = u.id THEN true ELSE false END as is_leader
       FROM team_memberships tm
       JOIN users u ON tm.worker_id = u.id
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.team_id = ?`,
      [teamId]
    );

    return {
      statusCode: 200,
      message: `${members.length} team members found`,
      data: {
        team: {
          id: teamId,
          name: userTeam[0].team_name,
          description: userTeam[0].team_description
        },
        members: members
      }
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get team members", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getUserProfile = async (userId) => {
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    // Get basic user information
    const [users] = await db.query(
      `SELECT 
        u.id,
        u.fullname,
        u.email,
        u.role,
        u.profile_picture,
        u.created_at,
        u.is_worker,
        u.is_verified
       FROM users u
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      throw { message: "User not found", statusCode: 404 };
    }

    const user = users[0];

    // Get team information if user is in a team
    const [teamInfo] = await db.query(
      `SELECT 
        t.id as team_id,
        t.name as team_name,
        t.description as team_description,
        tm.role as team_role,
        tm.joined_at as team_joined_at,
        CASE WHEN t.leader_id = ? THEN true ELSE false END as is_team_leader
       FROM teams t
       JOIN team_memberships tm ON t.id = tm.team_id
       WHERE tm.worker_id = ? AND t.is_active = 1`,
      [userId, userId]
    );

    // Get user's jobs/categories
    const [jobs] = await db.query(
      `SELECT 
        wj.id as job_id,
        wj.years_experience,
        wj.verification_date,
        jc.id as category_id,
        jc.name as category_name,
        jc.description as category_description,
        jc.icon as category_icon
       FROM worker_jobs wj
       JOIN job_categories jc ON wj.job_category_id = jc.id
       WHERE wj.worker_id = ? AND jc.is_active = 1`,
      [userId]
    );

    // Get task statistics
    const [taskStats] = await db.query(
      `SELECT 
        COUNT(DISTINCT st.id) as total_subtasks,
        SUM(CASE WHEN st.status = 'completed' THEN 1 ELSE 0 END) as completed_subtasks,
        SUM(CASE WHEN st.status = 'in progress' THEN 1 ELSE 0 END) as in_progress_subtasks,
        SUM(CASE WHEN st.status = 'not started' THEN 1 ELSE 0 END) as not_started_subtasks
       FROM sub_tasks st
       WHERE st.assigned_to = ?`,
      [userId]
    );

    // Get project statistics
    const [projectStats] = await db.query(
      `SELECT 
        COUNT(DISTINCT p.id) as total_projects,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed_projects,
        SUM(CASE WHEN p.status = 'in progress' THEN 1 ELSE 0 END) as in_progress_projects
       FROM projects p
       JOIN project_teams pt ON p.id = pt.project_id
       JOIN teams t ON pt.team_id = t.id
       JOIN team_memberships tm ON t.id = tm.team_id
       WHERE tm.worker_id = ?`,
      [userId]
    );

    return {
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        profile_picture: user.profile_picture,
        created_at: user.created_at,
        is_worker: user.is_worker,
        is_verified: user.is_verified
      },
      team: teamInfo.length > 0 ? {
        id: teamInfo[0].team_id,
        name: teamInfo[0].team_name,
        description: teamInfo[0].team_description,
        role: teamInfo[0].team_role,
        joined_at: teamInfo[0].team_joined_at,
        is_leader: teamInfo[0].is_team_leader
      } : null,
      jobs: jobs.map(job => ({
        id: job.job_id,
        years_experience: job.years_experience,
        verification_date: job.verification_date,
        category: {
          id: job.category_id,
          name: job.category_name,
          description: job.category_description,
          icon: job.category_icon
        }
      })),
      statistics: {
        tasks: {
          total: taskStats[0].total_subtasks || 0,
          completed: taskStats[0].completed_subtasks || 0,
          in_progress: taskStats[0].in_progress_subtasks || 0,
          not_started: taskStats[0].not_started_subtasks || 0
        },
        projects: {
          total: projectStats[0].total_projects || 0,
          completed: projectStats[0].completed_projects || 0,
          in_progress: projectStats[0].in_progress_projects || 0
        }
      }
    };

  } catch (err) {
    throw { 
      message: err.message || "Failed to get user profile", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getCurrentPhaseTasks = async (projectId) => {
  if (!projectId) throw { message: "projectId was not provided", statusCode: 400 };

  try {
    // Get current phase tasks with their subtasks
    const [mainTasks] = await db.query(
      `SELECT mt.*, 
              u.fullname as assigned_to_name,
              t.name as team_name
       FROM main_tasks mt
       LEFT JOIN users u ON mt.assigned_to = u.id AND mt.assigned_type = 'individual'
       LEFT JOIN teams t ON mt.assigned_to = t.id AND mt.assigned_type = 'team'
       WHERE mt.project_id = ? 
       AND mt.sequence_order = (
         SELECT current_phase 
         FROM projects 
         WHERE id = ?
       )
       ORDER BY mt.created_at ASC`,
      [projectId, projectId]
    );

    // For each main task, get its subtasks
    const tasksWithSubtasks = await Promise.all(
      mainTasks.map(async (mainTask) => {
        const [subTasks] = await db.query(
          `SELECT st.*, 
                  u.fullname as assigned_to_name,
                  t.name as team_name
           FROM sub_tasks st
           LEFT JOIN users u ON st.assigned_to = u.id AND st.assigned_type = 'individual'
           LEFT JOIN teams t ON st.assigned_to = t.id AND st.assigned_type = 'team'
           WHERE st.main_task_id = ?
           ORDER BY st.created_at ASC`,
          [mainTask.id]
        );

        // Get attachments for main task
        const [mainTaskAttachments] = await db.query(
          `SELECT * FROM task_attachments 
           WHERE task_id = ? AND task_type = 'main'`,
          [mainTask.id]
        );

        // Get attachments for each subtask
        const subtasksWithAttachments = await Promise.all(
          subTasks.map(async (subTask) => {
            const [subTaskAttachments] = await db.query(
              `SELECT * FROM task_attachments 
               WHERE task_id = ? AND task_type = 'sub'`,
              [subTask.id]
            );
            return {
              ...subTask,
              attachments: subTaskAttachments
            };
          })
        );

        return {
          ...mainTask,
          subtasks: subtasksWithAttachments,
          attachments: mainTaskAttachments
        };
      })
    );

    return {
      statusCode: 200,
      message: "Current phase tasks retrieved successfully",
      data: tasksWithSubtasks
    };

  } catch (err) {
    throw { 
      message: err.message || "Failed to get current phase tasks", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.createMainTaskWithSubtasks = async (projectId, userId, taskData) => {
  const connection = await db.getConnection();

  try {
    const { title, description, subtasks = [] } = taskData;

    await connection.beginTransaction();

    // Get the current highest sequence order and main_tasks_number for this project
    const [projectInfo] = await connection.query(
      `SELECT 
        COALESCE(MAX(sequence_order), 0) as max_sequence,
        p.main_tasks_number
       FROM main_tasks mt
       JOIN projects p ON mt.project_id = p.id
       WHERE mt.project_id = ?
       GROUP BY p.main_tasks_number`,
      [projectId]
    );

    const nextSequenceOrder = (projectInfo[0].max_sequence || 0) + 1;
    const currentMainTasksNumber = projectInfo[0].main_tasks_number || 0;

    // Create the main task with 'not started' status
    const [mainTaskResult] = await connection.query(
      `INSERT INTO main_tasks (
        project_id, title, description, sequence_order, status, 
        assigned_to, assigned_type, created_at, progress_percentage
      ) VALUES (?, ?, ?, ?, 'not started', ?, 'individual', NOW(), 0)`,
      [projectId, title, description, nextSequenceOrder, userId]
    );

    const mainTaskId = mainTaskResult.insertId;

    // Create subtasks only if they exist
    if (subtasks && subtasks.length > 0) {
      for (const subtask of subtasks) {
        if (!subtask.title) {
          throw {
            message: "Each subtask must have a title",
            statusCode: 400
          };
        }

        await connection.query(
          `INSERT INTO sub_tasks (
            main_task_id, title, description, assigned_to, 
            assigned_type, status, created_at, progress_percentage
          ) VALUES (?, ?, ?, ?, 'individual', 'not started', NOW(), 0)`,
          [
            mainTaskId,
            subtask.title,
            subtask.description || null,
            userId
          ]
        );
      }
    }

    // Update project's main_tasks_number by incrementing the current value
    await connection.query(
      `UPDATE projects 
       SET main_tasks_number = ? 
       WHERE id = ?`,
      [currentMainTasksNumber + 1, projectId]
    );

    await connection.commit();

    return {
      statusCode: 201,
      message: "Main task created successfully" + (subtasks.length > 0 ? " with subtasks" : ""),
      data: {
        mainTaskId,
        sequenceOrder: nextSequenceOrder,
        title,
        description,
        status: 'not started',
        assignedTo: userId,
        mainTasksNumber: currentMainTasksNumber + 1,
        subtasks: subtasks.map(subtask => ({
          ...subtask,
          status: 'not started',
          assignedTo: userId
        }))
      }
    };

  } catch (err) {
    await connection.rollback();
    throw {
      message: err.message || "Failed to create main task with subtasks",
      statusCode: err.statusCode || 500
    };
  } finally {
    connection.release();
  }
};

exports.completeMainTask = async (mainTaskId, workerId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get current main task and project info
    const [mainTask] = await connection.query(
      `SELECT mt.*, p.id as project_id, p.current_phase, p.status as project_status,
              p.title as project_title, p.client_id, u.fullname as worker_name
       FROM main_tasks mt
       JOIN projects p ON mt.project_id = p.id
       JOIN users u ON mt.assigned_to = u.id
       WHERE mt.id = ? AND mt.assigned_to = ?`,
      [mainTaskId, workerId]
    );

    if (mainTask.length === 0) {
      throw {
        message: "Main task not found or unauthorized",
        statusCode: 404
      };
    }

    const currentTask = mainTask[0];
    const projectId = currentTask.project_id;
    const currentSequence = currentTask.sequence_order;

    // Update current main task to completed
    await connection.query(
      `UPDATE main_tasks 
       SET status = 'completed'
       WHERE id = ?`,
      [mainTaskId]
    );

    // Get the next main task
    const [nextMainTask] = await connection.query(
      `SELECT id 
       FROM main_tasks 
       WHERE project_id = ? 
       AND sequence_order = ?`,
      [projectId, currentSequence + 1]
    );

    // If there is a next main task, set it to in progress
    if (nextMainTask.length > 0) {
      await connection.query(
        `UPDATE main_tasks 
         SET status = 'in progress'
         WHERE id = ?`,
        [nextMainTask[0].id]
      );
    }

    // Update project's current phase
    await connection.query(
      `UPDATE projects 
       SET current_phase = ?
       WHERE id = ?`,
      [currentSequence + 1, projectId]
    );

    // Check if all main tasks are completed
    const [incompleteTasks] = await connection.query(
      `SELECT COUNT(*) as count 
       FROM main_tasks 
       WHERE project_id = ? 
       AND status != 'completed'`,
      [projectId]
    );

    // If all tasks are completed, update project status
    if (incompleteTasks[0].count === 0) {
      await connection.query(
        `UPDATE projects 
         SET status = 'completed'
         WHERE id = ?`,
        [projectId]
      );
    }

    // Send notification to client about task completion
    await notificationService.createNotification({
      userId: currentTask.client_id,
      title: 'Main Task Completed',
      message: `${currentTask.worker_name} has completed the task "${currentTask.title}" in project "${currentTask.project_title}"`,
      type: 'task',
      referenceId: mainTaskId
    });

    await connection.commit();

    return {
      statusCode: 200,
      message: "Main task completed successfully",
      data: {
        mainTaskId,
        projectId,
        newPhase: currentSequence + 1,
        projectCompleted: incompleteTasks[0].count === 0
      }
    };

  } catch (err) {
    await connection.rollback();
    throw {
      message: err.message || "Failed to complete main task",
      statusCode: err.statusCode || 500
    };
  } finally {
    connection.release();
  }
};

exports.addSubtaskToMainTask = async (mainTaskId, workerId, subtaskData) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify the main task exists and worker has access
    const [mainTask] = await connection.query(
      `SELECT mt.*, p.employer_id 
       FROM main_tasks mt
       JOIN projects p ON mt.project_id = p.id
       WHERE mt.id = ? AND p.employer_id = ?`,
      [mainTaskId, workerId]
    );

    if (!mainTask || mainTask.length === 0) {
      throw {
        statusCode: 404,
        message: "Main task not found or worker doesn't have access"
      };
    }

    // Insert the new subtask with status 'not started'
    const [result] = await connection.query(
      `INSERT INTO sub_tasks (
        main_task_id,
        title,
        description,
        status,
        created_at,
        deadline,
        progress_percentage,
        assigned_to,
        assigned_type
      ) VALUES (?, ?, ?, 'not started', NOW(), ?, 0, ?, 'individual')`,
      [
        mainTaskId,
        subtaskData.title,
        subtaskData.description,
        subtaskData.deadline,
        workerId
      ]
    );

    await connection.commit();

    return {
      statusCode: 201,
      message: "Subtask added successfully",
      data: {
        id: result.insertId,
        main_task_id: mainTaskId,
        title: subtaskData.title,
        description: subtaskData.description,
        status: 'not started',
        created_at: new Date(),
        deadline: subtaskData.deadline,
        progress_percentage: 0,
        assigned_to: workerId,
        assigned_type: 'individual'
      }
    };

  } catch (err) {
    await connection.rollback();
    throw {
      message: err.message || "Failed to add subtask",
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.createMainTaskWithSequence = async (params) => {
  const { projectId, title, description, deadline, assigned_to, subtasks = [] } = params;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get the current maximum sequence order for the project
    const [maxSequence] = await connection.query(
      `SELECT MAX(sequence_order) as max_sequence 
       FROM main_tasks 
       WHERE project_id = ?`,
      [projectId]
    );

    const nextSequence = (maxSequence[0].max_sequence || 0) + 1;

    // Create the main task with the next sequence order and fixed assigned_type as 'team'
    const [result] = await connection.query(
      `INSERT INTO main_tasks 
       (project_id, title, description, deadline, sequence_order, assigned_to, assigned_type) 
       VALUES (?, ?, ?, ?, ?, ?, 'team')`,
      [projectId, title, description, deadline, nextSequence, assigned_to]
    );

    const mainTaskId = result.insertId;

    // Create subtasks if they exist
    if (subtasks && subtasks.length > 0) {
      for (const subtask of subtasks) {
        if (!subtask.title) {
          throw {
            message: "Each subtask must have a title",
            statusCode: 400
          };
        }

        await connection.query(
          `INSERT INTO sub_tasks (
            main_task_id, title, description, assigned_to, assigned_type, status, created_at
          ) VALUES (?, ?, ?, ?, 'individual', 'not_started', NOW())`,
          [
            mainTaskId,
            subtask.title,
            subtask.description || null,
            subtask.assigned_to
          ]
        );
      }
    }

    // Get the created task with its subtasks
    const [task] = await connection.query(
      `SELECT * FROM main_tasks WHERE id = ?`,
      [mainTaskId]
    );

    const [subTasks] = await connection.query(
      `SELECT * FROM sub_tasks WHERE main_task_id = ?`,
      [mainTaskId]
    );

    await connection.commit();

    return {
      statusCode: 201,
      success: true,
      message: "Main task created successfully with subtasks",
      data: {
        ...task[0],
        subtasks: subTasks
      }
    };

  } catch (err) {
    await connection.rollback();
    throw {
      statusCode: 500,
      message: err.message || "Failed to create main task"
    };
  } finally {
    connection.release();
  }
};

exports.addSubtaskWithAssignee = async (mainTaskId, subtaskData) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify the main task exists
    const [mainTask] = await connection.query(
      `SELECT id FROM main_tasks WHERE id = ?`,
      [mainTaskId]
    );

    if (!mainTask || mainTask.length === 0) {
      throw {
        statusCode: 404,
        message: "Main task not found"
      };
    }

    // Insert the new subtask with status 'not started' and assigned_type as 'team'
    const [result] = await connection.query(
      `INSERT INTO sub_tasks (
        main_task_id,
        title,
        description,
        status,
        created_at,
        progress_percentage,
        assigned_to,
        assigned_type
      ) VALUES (?, ?, ?, 'not started', NOW(), 0, ?, 'team')`,
      [
        mainTaskId,
        subtaskData.title,
        subtaskData.description,
        subtaskData.assigned_to
      ]
    );

    // Get the created subtask
    const [subtask] = await connection.query(
      `SELECT * FROM sub_tasks WHERE id = ?`,
      [result.insertId]
    );

    await connection.commit();

    return {
      statusCode: 201,
      success: true,
      message: "Subtask added successfully",
      data: subtask[0]
    };

  } catch (err) {
    await connection.rollback();
    throw {
      message: err.message || "Failed to add subtask",
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};