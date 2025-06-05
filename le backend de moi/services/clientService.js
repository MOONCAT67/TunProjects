const db = require("../config/db");
const notificationService = require("./notificationService");
const emailService = require("./emailService");

exports.createProject = async (params) => {
  const { 
    title, 
    description, 
    budget, 
    client_id, 
    deadline, 
    address,
    project_type = 'solo',
    requiredJobs 
  } = params;

  if (!title) throw { message: "title was not provided", statusCode: 400 };
  if (!description) throw { message: "description was not provided", statusCode: 400 };
  if (!budget) throw { message: "budget was not provided", statusCode: 400 };
  if (!client_id) throw { message: "client_id was not provided", statusCode: 400 };
  if (!deadline) throw { message: "deadline was not provided", statusCode: 400 };
  if (!address) throw { message: "address was not provided", statusCode: 400 };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Create project
    const [result] = await connection.query(
      `INSERT INTO projects 
      (title, description, budget, client_id, deadline, address, project_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description, budget, client_id, deadline, address, project_type]
    );

    const projectId = result.insertId;

    // Add required jobs if any
    if (requiredJobs && requiredJobs.length > 0) {
      const values = requiredJobs.map(job => [
        projectId,
        job.job_category_id,
        job.workers_needed || 1
      ]);

      await connection.query(
        `INSERT INTO project_required_jobs 
        (project_id, job_category_id, workers_needed) 
        VALUES ?`,
        [values]
      );
    }

    await connection.commit();

    return {
      statusCode: 201,
      message: requiredJobs && requiredJobs.length > 0 
        ? "Project created successfully with required jobs" 
        : "Project created successfully",
      projectId: projectId
    };

  } catch (err) {
    await connection.rollback();
    throw { 
      message: err.message || "Project creation failed", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.getClientProjects = async (params) => {
  const { clientId } = params;

  if (!clientId) throw { message: "clientId was not provided", statusCode: 400 };

  try {
    // First verify if the user exists
    const [user] = await db.query(
      `SELECT id FROM users WHERE id = ?`,
      [clientId]
    );

    if (user.length === 0) {
      throw { message: "User not found", statusCode: 404 };
    }

    // Then get their projects
    const [results] = await db.query(
      `SELECT 
        p.*,
        COUNT(DISTINCT pa.id) AS application_count,
        u.fullname AS employer_name
      FROM projects p
      LEFT JOIN project_applications pa ON p.id = pa.project_id
      LEFT JOIN users u ON p.employer_id = u.id
      WHERE p.client_id = ?
      GROUP BY p.id, p.title, p.description, p.budget, p.client_id, 
               p.deadline, p.address, p.project_type, p.status, 
               p.created_at, p.employer_id, u.fullname`,
      [clientId]
    );

    return {
      statusCode: 200,
      message: results.length === 0 
        ? "No projects found" 
        : `${results.length} projects found`,
      data: results
    };
  } catch (err) {
    console.error('Error in getClientProjects:', err);
    throw { 
      message: err.message || "Failed to fetch projects", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getProjectApplications = async (params) => {
  const { projectId, clientId } = params;

  if (!projectId) throw { message: "projectId was not provided", statusCode: 400 };
  if (!clientId) throw { message: "clientId was not provided", statusCode: 400 };

  const connection = await db.getConnection();
  try {
    // First verify the project belongs to the client
    const [projectResults] = await connection.query(
      `SELECT id FROM projects WHERE id = ? AND client_id = ?`,
      [projectId, clientId]
    );

    if (projectResults.length === 0) {
      throw { 
        message: "Project not found or not owned by client", 
        statusCode: 403 
      };
    }

    // Then get the applications
    const [applications] = await connection.query(
      `SELECT 
        pa.*,
        u.fullname,
        u.profile_picture,
        u.profile_description,
        CASE 
          WHEN pa.worker_id = p.employer_id THEN 'accepted'
          ELSE pa.status
        END AS display_status
      FROM project_applications pa
      JOIN users u ON pa.worker_id = u.id
      JOIN projects p ON pa.project_id = p.id
      WHERE pa.project_id = ?`,
      [projectId]
    );

    return {
      statusCode: 200,
      message: applications.length > 0 
        ? `${applications.length} applications found` 
        : "No applications found",
      data: applications
    };

  } catch (err) {
    throw { 
      message: err.message || "Failed to get project applications", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.acceptApplication = async (params) => {
  const { projectId, applicationId, clientId } = params;

  if (!projectId) throw { message: "projectId was not provided", statusCode: 400 };
  if (!applicationId) throw { message: "applicationId was not provided", statusCode: 400 };
  if (!clientId) throw { message: "clientId was not provided", statusCode: 400 };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify project ownership first
    const [projectResults] = await connection.query(
      `SELECT p.*, c.fullname as client_name, c.email as client_email 
       FROM projects p 
       JOIN users c ON p.client_id = c.id 
       WHERE p.id = ? AND p.client_id = ?`,
      [projectId, clientId]
    );

    if (projectResults.length === 0) {
      throw { message: "Project not found or not owned by client", statusCode: 403 };
    }

    // Get application details with worker info
    const [applicationResults] = await connection.query(
      `SELECT pa.*, w.fullname as worker_name, w.email as worker_email 
       FROM project_applications pa
       JOIN users w ON pa.worker_id = w.id
       WHERE pa.id = ? AND pa.project_id = ?`,
      [applicationId, projectId]
    );

    if (applicationResults.length === 0) {
      throw { message: "Application not found", statusCode: 404 };
    }

    const { worker_id, worker_name, worker_email, work_type, team_id } = applicationResults[0];

    // If the application is for a team, insert into project_teams and update project type
    if (work_type === 'team' && team_id) {
      // Get the leader_id for the team
      const [teamRows] = await connection.query(
        `SELECT leader_id FROM teams WHERE id = ?`,
        [team_id]
      );
      if (teamRows.length === 0) {
        throw { message: "Team not found for this application", statusCode: 404 };
      }
      const leader_id = teamRows[0].leader_id;
      await connection.query(
        `INSERT INTO project_teams (project_id, team_id, leader_id) VALUES (?, ?, ?)`,
        [projectId, team_id, leader_id]
      );

      // Update project type to 'team'
      await connection.query(
        `UPDATE projects 
         SET project_type = 'team'
         WHERE id = ?`,
        [projectId]
      );
    } else {
      // Ensure project type is 'solo' for individual applications
      await connection.query(
        `UPDATE projects 
         SET project_type = 'solo'
         WHERE id = ?`,
        [projectId]
      );
    }

    // Update project with employer_id and status
    await connection.query(
      `UPDATE projects 
       SET employer_id = ?, 
           status = 'in progress',
           current_phase = 1
       WHERE id = ?`,
      [worker_id, projectId]
    );

    // Update application status to accepted
    await connection.query(
      `UPDATE project_applications 
       SET status = 'accepted' 
       WHERE id = ? AND project_id = ?`,
      [applicationId, projectId]
    );

    // Reject other applications for this project
    await connection.query(
      `UPDATE project_applications 
       SET status = 'rejected' 
       WHERE project_id = ? AND id != ?`,
      [projectId, applicationId]
    );

    // Get the contract ID for this project
    const [contractResult] = await connection.query(
      `SELECT id FROM contracts WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    // Send notification to worker
    await notificationService.notifyApplicationAccepted({
      workerId: worker_id,
      projectId: projectId,
      projectTitle: projectResults[0].title,
      contractId: contractResult[0]?.id || null
    });

    // Send email to worker
    await emailService.sendApplicationAcceptedEmail({
      workerEmail: worker_email,
      workerName: worker_name,
      projectTitle: projectResults[0].title,
      clientName: projectResults[0].client_name
    });

    await connection.commit();

    return {
      statusCode: 200,
      message: "Application accepted successfully",
      data: {
        applicationId: applicationId,
        contractId: contractResult[0]?.id || null
      }
    };

  } catch (err) {
    await connection.rollback();
    throw { 
      message: err.message || "Failed to accept application", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

// Get all workers
exports.getAllWorkers = async () => {
  try {
    const query = `
      SELECT 
        w.*,
        GROUP_CONCAT(
          JSON_OBJECT(
            'id', jc.id,
            'name', jc.name,
            'description', jc.description,
            'icon', jc.icon
          )
        ) as skills,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(DISTINCT r.id) as total_ratings
      FROM workers w
      LEFT JOIN worker_jobs wj ON w.id = wj.worker_id
      LEFT JOIN job_categories jc ON wj.job_category_id = jc.id
      LEFT JOIN reviews r ON w.id = r.worker_id
      WHERE w.status = 'active'
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `;

    const [workers] = await db.query(query);

    // Parse the skills JSON array for each worker
    const workersWithSkills = workers.map(worker => ({
      ...worker,
      skills: worker.skills ? JSON.parse(worker.skills) : []
    }));

    return {
      statusCode: 200,
      message: `${workersWithSkills.length} workers found`,
      data: workersWithSkills
    };
  } catch (error) {
    console.error('Error in getAllWorkers:', error);
    throw {
      statusCode: 500,
      message: 'Failed to get workers'
    };
  }
};