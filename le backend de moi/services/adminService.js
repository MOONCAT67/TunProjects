const db = require("../config/db");
const notificationService = require("./notificationService");
const emailService = require("./emailService");

exports.getVerificationRequests = async () => {
  try {
    const [results] = await db.query(
      `SELECT wvr.*, u.fullname, u.email 
       FROM worker_verification_requests wvr
       JOIN users u ON wvr.user_id = u.id
       WHERE wvr.status = 'pending'`
    );
    return {
      statusCode: 200,
      data: results
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to fetch verification requests: " + err.message
    };
  }
};

exports.getRequestDetails = async (requestId) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Get basic request info
    const [request] = await connection.query(
      `SELECT * FROM worker_verification_requests WHERE id = ?`,
      [requestId]
    );

    if (request.length === 0) {
      throw { message: "Request not found", statusCode: 404 };
    }

    const userId = request[0].user_id;

    // Get all related data in parallel
    const [jobs, certificates, projects] = await Promise.all([
      connection.query(
        `SELECT wj.*, jc.name as category_name 
         FROM worker_jobs wj
         JOIN job_categories jc ON wj.job_category_id = jc.id
         WHERE wj.worker_id = ?`,
        [userId]
      ),
      connection.query(
        `SELECT * FROM worker_certificates WHERE worker_id = ?`,
        [userId]
      ),
      connection.query(
        `SELECT * FROM worker_past_projects WHERE worker_id = ?`,
        [userId]
      )
    ]);

    await connection.commit();
    
    return {
      statusCode: 200,
      data: {
        request: request[0],
        jobs: jobs[0],
        certificates: certificates[0],
        projects: projects[0]
      }
    };
  } catch (err) {
    await connection.rollback();
    throw { 
      message: err.message || "Failed to get request details", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.processVerificationRequest = async (requestId, action, adminId, notes) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get request and user details first
    const [request] = await connection.query(
      `SELECT wvr.*, u.fullname, u.email, u.role 
       FROM worker_verification_requests wvr
       JOIN users u ON wvr.user_id = u.id
       WHERE wvr.id = ?`,
      [requestId]
    );

    if (request.length === 0) {
      throw { message: "Request not found", statusCode: 404 };
    }

    const userId = request[0].user_id;
    const userEmail = request[0].email;
    const userName = request[0].fullname;

    // 2. Update request status
    await connection.query(
      `UPDATE worker_verification_requests 
       SET status = ?, admin_notes = ?, processed_at = NOW(), processed_by = ?
       WHERE id = ?`,
      [action, notes, adminId, requestId]
    );

    // 3. If approved, update user role
    if (action === 'approved') {
      await connection.query(
        `UPDATE users 
         SET is_worker = 1, worker_verified_at = NOW(), role = 'worker'
         WHERE id = ?`,
        [userId]
      );
    }

    // 4. Create notification for the user
    const notificationTitle = action === 'approved' 
      ? "Verification Approved" 
      : "Verification Rejected";
      
    const notificationMessage = action === 'approved'
      ? "Your worker verification request has been approved. You can now apply to projects as a worker."
      : `Your worker verification request was rejected. Reason: ${notes || 'No reason provided'}`;

    await notificationService.createNotification({
      userId,
      title: notificationTitle,
      message: notificationMessage,
      type: "system",
      referenceId: requestId
    });

    // 5. Send appropriate email notification
    const emailParams = {
      recipientEmail: userEmail,
      recipientName: userName,
      notes: notes || 'No additional notes'
    };

    if (action === 'approved') {
      await emailService.sendVerificationApprovedEmail(emailParams);
    } else {
      await emailService.sendVerificationRejectedEmail(emailParams);
    }

    await connection.commit();
    return {
      statusCode: 200,
      message: `Request ${action} successfully`,
      userId,
      userEmail
    };

  } catch (err) {
    await connection.rollback();
    console.error("Verification processing error:", {
      error: err.message,
      stack: err.stack,
      requestId,
      action
    });
    throw { 
      message: err.message || "Failed to process request", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    if (connection) connection.release();
  }
};

exports.getAllClients = async () => {
  try {
    const [results] = await db.query(
      `SELECT 
        u.id, 
        u.fullname, 
        u.email, 
        u.created_at,
        u.profile_picture, 
        u.is_online, 
        u.last_activity,
        u.role,
        u.phone_number,
        u.is_verified,
        u.profile_description,
        u.location,
        CASE 
          WHEN u.role = 'client' THEN COUNT(DISTINCT p.id)
          ELSE 0
        END as projects_posted,
        CASE 
          WHEN u.role = 'worker' THEN COUNT(DISTINCT wj.id)
          ELSE 0
        END as jobs_count
       FROM users u
       LEFT JOIN projects p ON u.id = p.client_id
       LEFT JOIN worker_jobs wj ON u.id = wj.worker_id
       WHERE u.role != 'admin'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    return {
      statusCode: 200,
      data: results
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to fetch users: " + err.message
    };
  }
};

exports.getAllProjects = async (categoryId) => {
  try {
    let query = `
      SELECT 
        p.*,
             u.fullname as client_name,
             COUNT(DISTINCT pa.id) as applications,
        GROUP_CONCAT(DISTINCT jc.name) as categories,
        c.id as contract_id,
        c.status as contract_status,
        c.created_at as contract_created_at,
        mt.id as current_task_id,
        mt.title as current_task_title,
        mt.description as current_task_description,
        mt.status as current_task_status,
        mt.deadline as current_task_deadline,
        accepted_pa.labor_price,
        accepted_pa.materials_price
      FROM projects p
      JOIN users u ON p.client_id = u.id
      LEFT JOIN project_required_jobs prj ON p.id = prj.project_id
      LEFT JOIN job_categories jc ON prj.job_category_id = jc.id
      LEFT JOIN project_applications pa ON p.id = pa.project_id
      LEFT JOIN contracts c ON p.id = c.project_id
      LEFT JOIN main_tasks mt ON p.id = mt.project_id AND mt.sequence_order = p.current_phase
      LEFT JOIN project_applications accepted_pa ON p.id = accepted_pa.project_id AND accepted_pa.status = 'accepted'
    `;

    const params = [];
    
    if (categoryId) {
      query += ` WHERE prj.job_category_id = ?`;
      params.push(categoryId);
    }

    query += ` GROUP BY p.id ORDER BY p.created_at DESC`;

    const [results] = await db.query(query, params);

    // Format the results to include nested objects
    const formattedResults = results.map(project => ({
      id: project.id,
      title: project.title,
      description: project.description,
      budget: project.budget,
      status: project.status,
      current_phase: project.current_phase,
      created_at: project.created_at,
      client_name: project.client_name,
      applications_count: project.applications,
      categories: project.categories ? project.categories.split(',') : [],
      contract: project.contract_id ? {
        id: project.contract_id,
        status: project.contract_status,
        created_at: project.contract_created_at
      } : null,
      current_task: project.current_task_id ? {
        id: project.current_task_id,
        title: project.current_task_title,
        description: project.current_task_description,
        status: project.current_task_status,
        deadline: project.current_task_deadline
      } : null,
      accepted_application: {
        labor_price: project.labor_price,
        materials_price: project.materials_price
      }
    }));

    return {
      statusCode: 200,
      data: formattedResults
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to fetch projects: " + err.message
    };
  }
};

exports.deleteUser = async (userId) => {
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if user exists and get their role
    const [user] = await connection.query(
      `SELECT id, role FROM users WHERE id = ?`,
      [userId]
    );

    if (user.length === 0) {
      throw { message: "User not found", statusCode: 404 };
    }

    // Delete user's data from all related tables
    // 1. Delete worker-specific data if user is a worker
    if (user[0].role === 'worker') {
    await connection.query(`DELETE FROM worker_certificates WHERE worker_id = ?`, [userId]);
    await connection.query(`DELETE FROM worker_jobs WHERE worker_id = ?`, [userId]);
    await connection.query(`DELETE FROM worker_past_projects WHERE worker_id = ?`, [userId]);
      await connection.query(`DELETE FROM worker_verification_requests WHERE user_id = ?`, [userId]);
      await connection.query(`DELETE FROM team_memberships WHERE worker_id = ?`, [userId]);
      await connection.query(`DELETE FROM team_request WHERE sender_id = ? OR user_id = ?`, [userId, userId]);
    }

    // 2. Delete project-specific data if user is a client
    if (user[0].role === 'client') {
      // Get all projects by this client
      const [projects] = await connection.query(
        `SELECT id FROM projects WHERE client_id = ?`,
        [userId]
      );

      const projectIds = projects.map(p => p.id);

      if (projectIds.length > 0) {
        // Delete all related project data
        await connection.query(`DELETE FROM project_applications WHERE project_id IN (?)`, [projectIds]);
        await connection.query(`DELETE FROM project_required_jobs WHERE project_id IN (?)`, [projectIds]);
        await connection.query(`DELETE FROM project_tasks WHERE project_id IN (?)`, [projectIds]);
        await connection.query(`DELETE FROM project_teams WHERE project_id IN (?)`, [projectIds]);
        await connection.query(`DELETE FROM project_reviews WHERE project_id IN (?)`, [projectIds]);
        await connection.query(`DELETE FROM project_materials WHERE project_id IN (?)`, [projectIds]);
        await connection.query(`DELETE FROM project_payments WHERE project_id IN (?)`, [projectIds]);
        await connection.query(`DELETE FROM project_invoices WHERE project_id IN (?)`, [projectIds]);
        await connection.query(`DELETE FROM projects WHERE id IN (?)`, [projectIds]);
      }
    }

    // 3. Delete common data for all users
    await connection.query(`DELETE FROM worker_reviews WHERE worker_id = ? OR client_id = ?`, [userId, userId]);
    await connection.query(`DELETE FROM notifications WHERE user_id = ?`, [userId]);
    await connection.query(`DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?`, [userId, userId]);
    await connection.query(`DELETE FROM project_applications WHERE worker_id = ?`, [userId]);
    await connection.query(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
    await connection.query(`DELETE FROM user_settings WHERE user_id = ?`, [userId]);
    await connection.query(`DELETE FROM user_activity_logs WHERE user_id = ?`, [userId]);

    // 4. Finally delete the user
    await connection.query(`DELETE FROM users WHERE id = ?`, [userId]);

    await connection.commit();

    return {
      success: true,
      message: "User and all associated data deleted successfully"
    };

  } catch (err) {
    await connection.rollback();
    console.error("Delete user error:", err);
    throw { 
      message: err.message || "Failed to delete user", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.addJobCategory = async (jobData) => {
  const { name, description, icon } = jobData;

  if (!name) throw { message: "Job category name is required", statusCode: 400 };

  try {
    // Check if job category already exists
    const [existing] = await db.query(
      `SELECT id FROM job_categories WHERE name = ?`,
      [name]
    );

    if (existing.length > 0) {
      throw { message: "Job category with this name already exists", statusCode: 400 };
    }

    // Insert new job category
    const [result] = await db.query(
      `INSERT INTO job_categories (name, description, icon) 
       VALUES (?, ?, ?)`,
      [name, description || null, icon || null]
    );

    return {
      statusCode: 201,
      message: "Job category added successfully",
      data: {
        id: result.insertId,
        name,
        description,
        icon
      }
    };

  } catch (err) {
    throw { 
      message: err.message || "Failed to add job category", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getAllUsers = async () => {
  try {
    const [users] = await db.query(
      `SELECT id, fullname, email, phone_number, role, 
              profile_description, skills, location, 
              profile_picture, is_verified, created_at, 
              is_worker, worker_verified_at
       FROM users
       ORDER BY created_at DESC`
    );

    return {
      statusCode: 200,
      message: "Users retrieved successfully",
      data: users
    };
  } catch (err) {
    console.error("Get all users error:", err);
    throw {
      message: err.message || "Failed to get users",
      statusCode: err.statusCode || 500
    };
  }
};

exports.getWeeklyUserStats = async () => {
  try {
    // Get the last 6 weeks of user registration data
    const [stats] = await db.query(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as week,
        COUNT(*) as users
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 WEEK)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
       ORDER BY week ASC
       LIMIT 6`
    );

    // Format the response
    const formattedStats = stats.map(stat => ({
      week: stat.week,
      users: parseInt(stat.users)
    }));

    return {
      success: true,
      data: formattedStats
    };

  } catch (error) {
    console.error('Error in getWeeklyUserStats:', error);
    throw {
      message: error.message || 'Failed to get weekly user stats',
      statusCode: error.statusCode || 500
    };
  }
};

exports.getUserDistribution = async () => {
  try {
    // Get counts of workers and clients
    const [stats] = await db.query(
      `SELECT 
        SUM(CASE WHEN role = 'worker' THEN 1 ELSE 0 END) as workers,
        SUM(CASE WHEN role = 'client' THEN 1 ELSE 0 END) as clients
       FROM users`
    );

    return {
      success: true,
      data: {
        workers: parseInt(stats[0].workers) || 0,
        clients: parseInt(stats[0].clients) || 0
      }
    };

  } catch (error) {
    console.error('Error in getUserDistribution:', error);
    throw {
      message: error.message || 'Failed to get user distribution stats',
      statusCode: error.statusCode || 500
    };
  }
};

exports.getTodayStats = async () => {
  try {
    // Get all stats in a single query
    const [stats] = await db.query(
      `SELECT 
        (SELECT COUNT(*) 
         FROM users 
         WHERE role = 'worker' 
         AND DATE(created_at) = CURDATE()) as newWorkers,
        
        (SELECT COUNT(*) 
         FROM projects 
         WHERE DATE(created_at) = CURDATE()) as newProjects,
        
        (SELECT COUNT(*) 
         FROM projects) as totalProjects,
        
        (SELECT COUNT(*) 
         FROM users) as totalUsers`
    );

    return {
      success: true,
      data: {
        newWorkers: parseInt(stats[0].newWorkers) || 0,
        newProjects: parseInt(stats[0].newProjects) || 0,
        totalProjects: parseInt(stats[0].totalProjects) || 0,
        totalUsers: parseInt(stats[0].totalUsers) || 0
      }
    };

  } catch (error) {
    console.error('Error in getTodayStats:', error);
    throw {
      message: error.message || 'Failed to get today\'s stats',
      statusCode: error.statusCode || 500
    };
  }
};

exports.getAllJobCategories = async () => {
  try {
    const [categories] = await db.query(
      `SELECT 
        id,
        name,
        description,
        icon,
        is_active,
        (SELECT COUNT(*) FROM worker_jobs WHERE job_category_id = jc.id) as workers_count,
        (SELECT COUNT(*) FROM project_required_jobs WHERE job_category_id = jc.id) as projects_count
       FROM job_categories jc
       ORDER BY name ASC`
    );

    return {
      statusCode: 200,
      success: true,
      message: "Job categories retrieved successfully",
      data: categories
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to fetch job categories: " + err.message
    };
  }
};