const teamService = require("../services/teamService");
const db = require("../config/db");

exports.createTeam = async (req, res, next) => {
  try {
    const { userId, name, description } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }
    if (!name) {
      return res.status(400).send({ message: "Team name is required" });
    }

    // Verify user is a worker
    const [users] = await db.query(
      `SELECT id, role, is_worker 
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const user = users[0];
    if (user.role !== 'worker' || !user.is_worker) {
      return res.status(403).send({ message: "Only verified workers can create teams" });
    }

    // Check if user already has a team
    const [existingTeam] = await db.query(
      `SELECT t.id 
       FROM teams t 
       JOIN team_memberships tm ON t.id = tm.team_id 
       WHERE tm.worker_id = ? AND t.is_active = 1`,
      [userId]
    );

    if (existingTeam.length > 0) {
      return res.status(400).send({ message: "You are already a member of a team" });
    }

    // Create the team
    const result = await teamService.createTeam({ 
      workerId: userId, 
      name, 
      description 
    });

    res.status(result.statusCode).send({ ...result });
  } catch (err) {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
  }
};

exports.sendTeamRequest = async (req, res, next) => {
  const { senderId, userEmail } = req.body;

  teamService.sendTeamRequest({ senderId, userEmail })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.acceptTeamRequest = async (req, res, next) => {
  const { userId } = req.body;
  const { requestId } = req.params;

  teamService.acceptTeamRequest({ requestId, userId })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.rejectTeamRequest = async (req, res, next) => {
  const { userId } = req.body;
  const { requestId } = req.params;

  teamService.rejectTeamRequest({ requestId, userId })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.getAllTeamMembers = async (req, res, next) => {
  const { userId } = req.params;

  teamService.getAllTeamMembers({ userId })
    .then(result => {
      const { message, data } = result;
      res.status(200).send({ message, data });
    })
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.getTeamRequests = async (req, res, next) => {
  const { userId } = req.body;

  teamService.getTeamRequests({ userId })
    .then(result => {
      const { data } = result;
      res.status(200).send({ data });
    })
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.checkTeamRole = async (req, res, next) => {
  const { userId } = req.body;
  const { teamId } = req.params;

  teamService.checkTeamRole({ userId, teamId })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.changeTeamLeader = async (req, res, next) => {
  const { currentLeaderId, newLeaderId } = req.body;
  const { teamId } = req.params;

  teamService.changeTeamLeader({ currentLeaderId, newLeaderId, teamId })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.deleteTeam = async (req, res, next) => {
  const { leaderId } = req.body;
  const { teamId } = req.params;

  teamService.deleteTeam({ teamId, leaderId })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.kickTeamMember = async (req, res, next) => {
  const { leaderId } = req.body;
  const { teamId, memberId } = req.params;

  teamService.kickTeamMember({ teamId, leaderId, memberId })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.leaveTeam = async (req, res, next) => {
  const { userId } = req.body;
  const { teamId } = req.params;

  teamService.leaveTeam({ teamId, userId })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.getUserTeams = async (req, res, next) => {
  const { userId } = req.params;

  teamService.getUserTeams({ userId })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.getWorkerJobs = async (req, res, next) => {
  const { workerId } = req.params;

  teamService.getWorkerJobs({ workerId })
    .then(result => {
      const { message, data } = result;
      res.status(200).send({ message, data });
    })
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.getAllTeams = async (req, res, next) => {
  teamService.getAllTeams()
    .then(result => {
      const { message, data } = result;
      res.status(200).send({ message, data });
    })
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.getTeamInfo = async (req, res, next) => {
  const { teamId } = req.params;

  teamService.getTeamInfo({ teamId })
    .then(result => {
      const { message, data } = result;
      res.status(200).send({ message, data });
    })
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.getTeamLeaderEmail = async (req, res, next) => {
  const { teamId } = req.params;

  teamService.getTeamLeaderEmail({ teamId })
    .then(result => {
      const { message, data } = result;
      res.status(200).send({ message, data });
    })
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.getUserTeamRequests = async (req, res, next) => {
  const { userId } = req.params;

  teamService.getUserTeamRequests({ userId })
    .then(result => {
      const { message, data } = result;
      res.status(200).send({ message, data });
    })
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.checkTeamLeader = async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: "workerId is required"
      });
    }

    const result = await teamService.isTeamLeader(workerId);
    res.status(result.statusCode).json({
      success: true,
      message: result.message,
      isLeader: result.isLeader,
      teams: result.teams
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to check team leader status"
    });
  }
};

exports.getUserAssignedSubTasks = async (req, res) => {
  try {
    const { teamId, userId } = req.params;

    if (!teamId || !userId) {
      return res.status(400).json({
        statusCode: 400,
        message: "teamId and userId are required"
      });
    }

    const subtasks = await teamService.getUserAssignedSubTasks(userId, teamId);

    return res.status(200).json({
      statusCode: 200,
      message: "Subtasks retrieved successfully",
      data: subtasks
    });

  } catch (err) {
    console.error('Error in getUserAssignedSubTasks:', err);
    return res.status(err.statusCode || 500).json({
      statusCode: err.statusCode || 500,
      message: err.message || "Failed to get user assigned subtasks"
    });
  }
};

exports.getTeamProjects = async (req, res) => {
  try {
    const { teamId } = req.params;

    // Get all projects for the team with their details
    const [projects] = await db.query(
      `SELECT 
        p.*,
        u.fullname as client_name,
        u.email as client_email,
        u.phone_number as client_phone,
        pt.team_id,
        t.name as team_name
       FROM projects p
       JOIN project_teams pt ON p.id = pt.project_id
       JOIN teams t ON pt.team_id = t.id
       JOIN users u ON p.client_id = u.id
       WHERE pt.team_id = ?`,
      [teamId]
    );

    // For each project, get its main tasks
    for (let project of projects) {
      // Get main tasks
      const [mainTasks] = await db.query(
        `SELECT 
          mt.*,
          u.fullname as assigned_to_name
         FROM main_tasks mt
         LEFT JOIN users u ON mt.assigned_to = u.id
         WHERE mt.project_id = ?`,
        [project.id]
      );

      // For each main task, get its subtasks
      for (let mainTask of mainTasks) {
        const [subTasks] = await db.query(
          `SELECT 
            st.*,
            u.fullname as assigned_to_name
           FROM sub_tasks st
           LEFT JOIN users u ON st.assigned_to = u.id
           WHERE st.main_task_id = ?`,
          [mainTask.id]
        );
        mainTask.sub_tasks = subTasks;
      }

      project.main_tasks = mainTasks;
    }

    return res.status(200).json({
      statusCode: 200,
      message: "Team projects retrieved successfully",
      data: projects
    });

  } catch (err) {
    console.error('Error in getTeamProjects:', err);
    return res.status(err.statusCode || 500).json({
      statusCode: err.statusCode || 500,
      message: err.message || "Failed to get team projects"
    });
  }
};