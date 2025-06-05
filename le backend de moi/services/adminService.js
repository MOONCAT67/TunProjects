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
      `SELECT u.id, u.fullname, u.email, u.created_at,
              COUNT(DISTINCT p.id) as projects_posted
       FROM users u
       LEFT JOIN projects p ON u.id = p.client_id
       WHERE u.role = 'client'
       GROUP BY u.id`
    );
    return {
      statusCode: 200,
      data: results
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to fetch clients: " + err.message
    };
  }
};

exports.getAllProjects = async (categoryId) => {
  try {
    let query = `
      SELECT p.*, 
             u.fullname as client_name,
             COUNT(DISTINCT pa.id) as applications,
             GROUP_CONCAT(DISTINCT jc.name) as categories
      FROM projects p
      JOIN users u ON p.client_id = u.id
      LEFT JOIN project_required_jobs prj ON p.id = prj.project_id
      LEFT JOIN job_categories jc ON prj.job_category_id = jc.id
      LEFT JOIN project_applications pa ON p.id = pa.project_id
    `;

    const params = [];
    
    if (categoryId) {
      query += ` WHERE prj.job_category_id = ?`;
      params.push(categoryId);
    }

    query += ` GROUP BY p.id ORDER BY p.created_at DESC`;

    const [results] = await db.query(query, params);
    return {
      statusCode: 200,
      data: results
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

    // Check if user exists
    const [user] = await connection.query(
      `SELECT id, role FROM users WHERE id = ?`,
      [userId]
    );

    if (user.length === 0) {
      throw { message: "User not found", statusCode: 404 };
    }

    // Delete user's data from related tables
    await connection.query(`DELETE FROM worker_certificates WHERE worker_id = ?`, [userId]);
    await connection.query(`DELETE FROM worker_jobs WHERE worker_id = ?`, [userId]);
    await connection.query(`DELETE FROM worker_past_projects WHERE worker_id = ?`, [userId]);
    await connection.query(`DELETE FROM worker_reviews WHERE worker_id = ? OR client_id = ?`, [userId, userId]);
    await connection.query(`DELETE FROM worker_verification_requests WHERE user_id = ?`, [userId]);
    await connection.query(`DELETE FROM notifications WHERE user_id = ?`, [userId]);
    await connection.query(`DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?`, [userId, userId]);
    await connection.query(`DELETE FROM project_applications WHERE worker_id = ?`, [userId]);
    await connection.query(`DELETE FROM team_memberships WHERE worker_id = ?`, [userId]);
    await connection.query(`DELETE FROM team_request WHERE sender_id = ? OR user_id = ?`, [userId, userId]);

    // Finally delete the user
    await connection.query(`DELETE FROM users WHERE id = ?`, [userId]);

    await connection.commit();

    return {
      statusCode: 200,
      message: "User deleted successfully"
    };

  } catch (err) {
    await connection.rollback();
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