const db = require("../config/db");

exports.addReview = async (params) => {
  const { clientId, workerId, projectId, rating, comment } = params;

  if (!clientId) throw { message: "Client ID is required", statusCode: 400 };
  if (!workerId) throw { message: "Worker ID is required", statusCode: 400 };
  if (!projectId) throw { message: "Project ID is required", statusCode: 400 };
  if (!rating || rating < 1 || rating > 5) throw { message: "Rating must be between 1 and 5", statusCode: 400 };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if project exists and belongs to the client
    const [projects] = await connection.query(
      `SELECT id FROM projects 
       WHERE id = ? AND client_id = ? AND status = 'completed'`,
      [projectId, clientId]
    );

    if (projects.length === 0) {
      throw { message: "Project not found or not completed", statusCode: 404 };
    }

    // Check if review already exists
    const [existingReviews] = await connection.query(
      `SELECT id FROM worker_reviews 
       WHERE project_id = ? AND client_id = ?`,
      [projectId, clientId]
    );

    if (existingReviews.length > 0) {
      throw { message: "You have already reviewed this worker for this project", statusCode: 400 };
    }

    // Add the review
    const [result] = await connection.query(
      `INSERT INTO \`worker_reviews\` (\`client_id\`, \`worker_id\`, \`project_id\`, \`rating\`, \`comment\`, \`created_at\`) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [clientId, workerId, projectId, rating, comment || null]
    );

    await connection.commit();
    return {
      statusCode: 201,
      message: "Review added successfully",
      reviewId: result.insertId
    };

  } catch (err) {
    await connection.rollback();
    throw { 
      message: err.message || "Failed to add review", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.getWorkerReviews = async (params) => {
  const { workerId } = params;

  if (!workerId) throw { message: "Worker ID is required", statusCode: 400 };

  try {
    const [reviews] = await db.query(
      `SELECT wr.*, 
              u.fullname as client_name,
              u.profile_picture as client_picture,
              p.title as project_title
       FROM worker_reviews wr
       JOIN users u ON wr.client_id = u.id
       JOIN projects p ON wr.project_id = p.id
       WHERE wr.worker_id = ?
       ORDER BY wr.created_at DESC`,
      [workerId]
    );

    return {
      statusCode: 200,
      data: reviews
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get worker reviews", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getProjectReview = async (params) => {
  const { projectId } = params;

  if (!projectId) throw { message: "Project ID is required", statusCode: 400 };

  try {
    const [reviews] = await db.query(
      `SELECT wr.*, 
              u.fullname as client_name,
              u.profile_picture as client_picture
       FROM worker_reviews wr
       JOIN users u ON wr.client_id = u.id
       WHERE wr.project_id = ?`,
      [projectId]
    );

    return {
      statusCode: 200,
      data: reviews[0] || null
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get project review", 
      statusCode: err.statusCode || 500 
    };
  }
}; 