//workerService.js
const db = require("../config/db");
const notificationService = require("./notificationService");
const emailService = require("./emailService");
const recommendationService = require("./recommendationService");

// Calculate distance between two coordinates (in kilometers)
const calculateDistance = (coord1, coord2) => {
  if (!coord1 || !coord2) return Infinity;
  
  const coords1 = coord1.match(/@(\d+)\s+(\d+)\s+(\d+)/);
  const coords2 = coord2.match(/@(\d+)\s+(\d+)\s+(\d+)/);
  
  if (!coords1 || !coords2) return Infinity;
  
  // Convert coordinates to numbers
  const x1 = parseInt(coords1[1]);
  const y1 = parseInt(coords1[2]);
  const z1 = parseInt(coords1[3]);
  const x2 = parseInt(coords2[1]);
  const y2 = parseInt(coords2[2]);
  const z2 = parseInt(coords2[3]);
  
  // Calculate Euclidean distance
  const distance = Math.sqrt(
    Math.pow(x2 - x1, 2) +
    Math.pow(y2 - y1, 2) +
    Math.pow(z2 - z1, 2)
  );
  
  // Convert to kilometers (assuming 1 unit = 1km)
  return distance;
};

// Worker Verification
exports.submitVerificationRequest = async ({ userId, requestDescription, jobs, certificates, pastProjects }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get worker details (optional, for notifications)
    const [[worker]] = await connection.query(
      `SELECT u.fullname, u.email 
       FROM users u 
       WHERE u.id = ?`,
      [userId]
    );

    if (!worker) {
      throw { statusCode: 404, message: "Worker not found" };
    }

    // 2. Create verification request
    const [verificationResult] = await connection.query(
      `INSERT INTO worker_verification_requests 
       (user_id, request_description, status) 
       VALUES (?, ?, 'pending')`,
      [userId, requestDescription]
    );
    const verificationId = verificationResult.insertId;

    // 3. Insert jobs
    for (const job of jobs) {
    await connection.query(
        `INSERT INTO worker_jobs 
         (worker_id, job_category_id, years_experience) 
         VALUES (?, ?, ?)`,
        [userId, job.jobCategoryId, job.experienceYears]
    );
    }

    // 4. Insert certificates
    for (const cert of certificates) {
      await connection.query(
        `INSERT INTO worker_certificates 
         (worker_id, certificate_name, issuing_organization, issue_date) 
         VALUES (?, ?, ?, ?)`,
        [userId, cert.name, cert.issuer, cert.year ? new Date(cert.year, 0, 1) : null]
      );
    }

    // 5. Insert past projects
    for (const project of pastProjects) {
      await connection.query(
        `INSERT INTO worker_past_projects 
         (worker_id, project_name, project_description, completion_date) 
         VALUES (?, ?, ?, ?)`,
        [userId, project.title, project.description, project.year ? new Date(project.year, 0, 1) : null]
      );
    }

    // 6. Notify admins (your existing notification code)
    const admins = await notificationService.notifyAdminsOfVerificationRequest(
      userId,
      worker.fullname
    );

    for (const admin of admins) {
      await emailService.sendVerificationRequestEmail({
        adminEmail: admin.email,
        workerName: worker.fullname,
        workerId: userId
      });
    }

    await connection.commit();

    return {
      statusCode: 200,
      success: true,
      verificationId: verificationId,
      message: "Verification request submitted successfully"
    };

  } catch (err) {
    await connection.rollback();
    console.error("Verification request error:", err);
    throw {
      statusCode: err.statusCode || 500,
      message: err.message || "Failed to submit verification request"
    };
  } finally {
    connection.release();
  }
};

// Track job category filter
exports.trackJobCategoryFilter = async (workerId, jobCategoryId) => {
  try {
    console.log('Tracking filter for worker:', workerId, 'job category:', jobCategoryId);
    
    // Check if filter already exists
    const [existing] = await db.query(
      `SELECT * FROM job_category_filters 
       WHERE worker_id = ? AND job_category_id = ?`,
      [workerId, jobCategoryId]
    );

    if (existing.length > 0) {
      // Update existing filter count
      await db.query(
        `UPDATE job_category_filters 
         SET filter_count = filter_count + 1,
             last_filtered_at = CURRENT_TIMESTAMP
         WHERE worker_id = ? AND job_category_id = ?`,
        [workerId, jobCategoryId]
      );
      console.log('Updated existing filter count');
    } else {
      // Create new filter
      await db.query(
        `INSERT INTO job_category_filters 
         (worker_id, job_category_id, filter_count, last_filtered_at)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
        [workerId, jobCategoryId]
      );
      console.log('Created new filter');
    }

    return {
      statusCode: 200,
      message: 'Job category filter tracked successfully'
    };
  } catch (error) {
    console.error('Error in trackJobCategoryFilter:', error);
    throw {
      statusCode: 500,
      message: 'Failed to track job category filter'
    };
  }
};

// Get available projects with ML-based recommendations
exports.getAvailableProjects = async (params) => {
  try {
    const { workerId, filter } = params;
    console.log('Getting projects for worker:', workerId, 'filter:', filter);

    // Get recommended projects using ML
    const recommendedProjects = await recommendationService.getRecommendedProjects(workerId);
    console.log('Recommended projects before filtering:', recommendedProjects.map(p => ({
      id: p.id,
      ml_score: p.ml_score,
      score_breakdown: p.score_breakdown
    })));
    
    // If filter is provided, apply it
    let filteredProjects = recommendedProjects;
    if (filter) {
      console.log('Applying filter:', filter);
      filteredProjects = recommendedProjects.filter(project => {
        // Filter by job category if specified
        if (filter.jobCategoryId) {
          const hasJob = project.required_jobs.some(job => 
            job.job_category_id === filter.jobCategoryId
          );
          console.log(`Project ${project.id} has job ${filter.jobCategoryId}:`, hasJob);
          return hasJob;
        }
        return true;
      });
    }

    // Sort by ML score, handling NaN values
    filteredProjects.sort((a, b) => {
      // If either score is NaN, put it at the end
      if (isNaN(a.ml_score)) return 1;
      if (isNaN(b.ml_score)) return -1;
      return b.ml_score - a.ml_score;
    });

    console.log('Final filtered and sorted projects:', filteredProjects.map(p => ({
      id: p.id,
      ml_score: p.ml_score,
      score_breakdown: p.score_breakdown
    })));
      
    return {
      statusCode: 200,
      message: `${filteredProjects.length} projects found`,
      data: filteredProjects
    };
  } catch (error) {
    console.error('Error in getAvailableProjects:', error);
    throw {
      statusCode: 500,
      message: 'Failed to get available projects'
    };
  }
};

// Track project view for ML training
exports.trackProjectView = async (workerId, projectId, viewDuration = null) => {
  try {
    return await recommendationService.trackProjectView(workerId, projectId, viewDuration);
  } catch (error) {
    console.error('Error in trackProjectView:', error);
    throw {
      statusCode: 500,
      message: 'Failed to track project view'
    };
  }
};

// Project Applications
exports.submitProjectApplication = async (params) => {
  const { projectId, workerId, laborPrice, materialsPrice, estimatedDuration, workType, teamId } = params;

  if (!projectId) throw { message: "projectId was not provided", statusCode: 400 };
  if (!workerId) throw { message: "workerId was not provided", statusCode: 400 };
  if (workType === 'team' && !teamId) throw { message: "teamId is required for team applications", statusCode: 400 };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Get project and client details
    const [projectDetails] = await connection.query(
      `SELECT p.*, c.id as client_id, c.fullname as client_name, c.email as client_email, w.fullname as worker_name
       FROM projects p
       JOIN users c ON p.client_id = c.id
       JOIN users w ON w.id = ?
       WHERE p.id = ?`,
      [workerId, projectId]
    );

    if (projectDetails.length === 0) {
      throw { message: "Project not found", statusCode: 404 };
    }

    // Insert the application
    const [result] = await connection.query(
      `INSERT INTO project_applications (
        project_id, worker_id, team_id,
        labor_price, materials_price, estimated_duration, work_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, workerId, teamId || null, laborPrice, materialsPrice, estimatedDuration, workType || 'solo']
    );

    // Get total applications count for this project
    const [applicationCount] = await connection.query(
      `SELECT COUNT(*) as count FROM project_applications WHERE project_id = ?`,
      [projectId]
    );

    // Create notification for client
    await notificationService.createNotification({
      userId: projectDetails[0].client_id,
      title: 'New Project Application',
      message: `${projectDetails[0].worker_name} has applied to your project "${projectDetails[0].title}"`,
      type: 'project',
      referenceId: projectId
    });

    // If more than 4 applications, send email to client
    if (applicationCount[0].count > 4) {
      await emailService.sendApplicationAcceptedEmail({
        workerEmail: projectDetails[0].client_email,
        workerName: projectDetails[0].client_name,
        projectTitle: projectDetails[0].title,
        clientName: projectDetails[0].worker_name
      });
    }

    await connection.commit();
        
    return {
          statusCode: 201,
          message: "Application submitted successfully",
          applicationId: result.insertId
    };
  } catch (error) {
    await connection.rollback();
    console.error('Error in submitProjectApplication:', error);
    throw {
      statusCode: 500,
      message: error.message || "Failed to submit project application"
    };
  } finally {
    connection.release();
  }
};

exports.getAllJobs = async () => {
  try {
    const [jobs] = await db.query(
      `SELECT id, name, description, icon 
       FROM job_categories 
       WHERE is_active = 1 
       ORDER BY name ASC`
    );
    
    if (!jobs || jobs.length === 0) {
      return {
        statusCode: 404,
        message: 'No jobs found',
        data: []
      };
    }
    
    return {
      statusCode: 200,
      message: 'Jobs retrieved successfully',
      data: jobs
    };
  } catch (error) {
    console.error('Error in getAllJobs:', error);
    throw {
      statusCode: 500,
      message: 'Failed to retrieve jobs'
    };
  }
};

exports.getProjectDetails = async (projectId) => {
  try {
    // Get project basic details with client info
    const [projectDetails] = await db.query(
      `SELECT 
        p.*,
        u.fullname as client_name,
        u.email as client_email,
        u.phone_number as client_phone,
        COUNT(DISTINCT pa.id) as total_applications,
        COUNT(DISTINCT mt.id) as total_tasks
      FROM projects p
      LEFT JOIN users u ON p.client_id = u.id
      LEFT JOIN project_applications pa ON p.id = pa.project_id
      LEFT JOIN main_tasks mt ON p.id = mt.project_id
      WHERE p.id = ?
      GROUP BY p.id`,
      [projectId]
    );

    if (!projectDetails || projectDetails.length === 0) {
      throw {
        statusCode: 404,
        message: 'Project not found'
      };
    }

    // Get required jobs for this project
    const [requiredJobs] = await db.query(
      `SELECT 
        prj.*,
        jc.name as job_name,
        jc.description as job_description,
        jc.icon as job_icon
      FROM project_required_jobs prj
      JOIN job_categories jc ON prj.job_category_id = jc.id
      WHERE prj.project_id = ?`,
      [projectId]
    );

    // Get project attachments
    const [attachments] = await db.query(
      `SELECT 
        file_name,
        file_url,
        file_type,
        uploaded_at
      FROM project_attachments 
      WHERE project_id = ?`,
      [projectId]
    );

    // Get main tasks
    const [mainTasks] = await db.query(
      `SELECT 
        id,
        title,
        description,
        status,
        deadline,
        progress_percentage,
        assigned_to,
        assigned_type
      FROM main_tasks 
      WHERE project_id = ? 
      ORDER BY sequence_order ASC`,
      [projectId]
    );

    return {
      statusCode: 200,
      message: 'Project details retrieved successfully',
      data: {
        ...projectDetails[0],
        required_jobs: requiredJobs,
        attachments: attachments,
        main_tasks: mainTasks
      }
    };
  } catch (error) {
    console.error('Error in getProjectDetails:', error);
    throw {
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to get project details'
    };
  }
};

exports.getJobTitles = async () => {
  try {
    const [jobs] = await db.query(
      `SELECT name 
       FROM job_categories 
       WHERE is_active = 1 
       ORDER BY name ASC`
    );
    
    if (!jobs || jobs.length === 0) {
      return {
        statusCode: 404,
        message: 'No jobs found',
        data: []
      };
    }
    
    // Extract just the names into an array
    const jobTitles = jobs.map(job => job.name);
    
    return {
      statusCode: 200,
      message: 'Job titles retrieved successfully',
      data: jobTitles
    };
  } catch (error) {
    console.error('Error in getJobTitles:', error);
    throw {
      statusCode: 500,
      message: 'Failed to retrieve job titles'
    };
  }
};

exports.getWorkerProfile = async (workerId) => {
  if (!workerId) throw { message: "workerId was not provided", statusCode: 400 };

  try {
    // Get basic user info
    const [userInfo] = await db.query(
      `SELECT 
        id, fullname, email, phone_number, profile_description,
        skills, location, profile_picture, is_verified, worker_verified_at
      FROM users 
      WHERE id = ? AND role = 'worker'`,
      [workerId]
    );

    if (userInfo.length === 0) {
      throw { message: "Worker not found", statusCode: 404 };
    }

    // Get worker's job categories
    const [jobCategories] = await db.query(
      `SELECT 
        wj.id,
        wj.years_experience,
        jc.name as category_name,
        jc.description as category_description,
        jc.icon as category_icon
      FROM worker_jobs wj
      JOIN job_categories jc ON wj.job_category_id = jc.id
      WHERE wj.worker_id = ?`,
      [workerId]
    );

    // Get worker's certificates
    const [certificates] = await db.query(
      `SELECT * FROM worker_certificates WHERE worker_id = ?`,
      [workerId]
    );

    // Get worker's past projects
    const [pastProjects] = await db.query(
      `SELECT * FROM worker_past_projects WHERE worker_id = ?`,
      [workerId]
    );

    // Get current projects where worker is employer
    const [currentProjects] = await db.query(
      `SELECT 
        p.*,
        c.fullname as client_name,
        c.profile_picture as client_picture
      FROM projects p
      JOIN users c ON p.client_id = c.id
      WHERE p.employer_id = ? AND p.status != 'completed'`,
      [workerId]
    );

    // Get completed projects
    const [completedProjects] = await db.query(
      `SELECT 
        p.*,
        c.fullname as client_name,
        c.profile_picture as client_picture
      FROM projects p
      JOIN users c ON p.client_id = c.id
      WHERE p.employer_id = ? AND p.status = 'completed'`,
      [workerId]
    );

    // Get team information
    const [teamInfo] = await db.query(
      `SELECT 
        t.*,
        tm.role as team_role,
        u.fullname as leader_name,
        u.profile_picture as leader_picture
      FROM teams t
      JOIN team_memberships tm ON t.id = tm.team_id
      JOIN users u ON t.leader_id = u.id
      WHERE tm.worker_id = ? AND t.is_active = 1`,
      [workerId]
    );

    // Get worker's reviews
    const [reviews] = await db.query(
      `SELECT 
        wr.*,
        c.fullname as client_name,
        c.profile_picture as client_picture,
        jc.name as job_category_name
      FROM worker_reviews wr
      JOIN users c ON wr.client_id = c.id
      JOIN job_categories jc ON wr.job_category_id = jc.id
      WHERE wr.worker_id = ?`,
      [workerId]
    );

    return {
      statusCode: 200,
      message: "Worker profile retrieved successfully",
      data: {
        ...userInfo[0],
        jobCategories,
        certificates,
        pastProjects,
        currentProjects,
        completedProjects,
        teamInfo: teamInfo.length > 0 ? teamInfo[0] : "solo worker",
        reviews
      }
    };

  } catch (err) {
    throw { 
      message: err.message || "Failed to get worker profile", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getWorkerActiveProjects = async (workerId) => {
  if (!workerId) throw { message: "workerId was not provided", statusCode: 400 };

  try {
    const [projects] = await db.query(
      `SELECT p.*, 
              c.name as client_name,
              c.email as client_email,
              c.phone as client_phone,
              COUNT(DISTINCT mt.id) as total_tasks,
              SUM(CASE WHEN mt.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       LEFT JOIN main_tasks mt ON p.id = mt.project_id
       WHERE p.employer_id = ? 
       AND p.status = 'in progress'
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [workerId]
    );

    return {
      statusCode: 200,
      message: "Worker's active projects retrieved successfully",
      data: projects
    };

  } catch (err) {
    throw { 
      message: err.message || "Failed to get worker's active projects", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getAllWorkerAddresses = async () => {
  try {
    const [results] = await db.query(
      `SELECT id, fullname, location 
       FROM users 
       WHERE role = 'worker' AND location IS NOT NULL`
    );
    return {
      statusCode: 200,
      data: results
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to fetch worker addresses: " + err.message
    };
  }
};

exports.getAllWorkers = async () => {
  try {
    const [workers] = await db.query(
      `SELECT 
        u.id,
        u.fullname,
        u.email,
        u.phone_number,
        u.profile_description,
        u.skills,
        u.location,
        u.profile_picture,
        u.is_verified,
        u.is_online,
        u.last_activity,
        u.created_at,
        GROUP_CONCAT(DISTINCT jc.name) as job_categories,
        GROUP_CONCAT(DISTINCT wj.years_experience) as years_experience
       FROM users u
       LEFT JOIN worker_jobs wj ON u.id = wj.worker_id
       LEFT JOIN job_categories jc ON wj.job_category_id = jc.id
       WHERE u.role = 'worker' AND u.is_worker = 1
       GROUP BY u.id
       ORDER BY u.is_online DESC, u.last_activity DESC`
    );

    return {
      statusCode: 200,
      message: `${workers.length} workers found`,
      data: workers.map(worker => ({
        id: worker.id,
        fullname: worker.fullname,
        email: worker.email,
        phone_number: worker.phone_number,
        profile_description: worker.profile_description,
        skills: worker.skills,
        location: worker.location,
        profile_picture: worker.profile_picture,
        is_verified: worker.is_verified,
        is_online: worker.is_online,
        last_activity: worker.last_activity,
        created_at: worker.created_at,
        job_categories: worker.job_categories ? worker.job_categories.split(',') : [],
        years_experience: worker.years_experience ? worker.years_experience.split(',') : []
      }))
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get workers", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getWorkerInProgressSoloProjects = async (workerId) => {
  try {
    // Get all in-progress solo projects for the worker
    const [projects] = await db.query(
      `SELECT 
        p.*,
        c.fullname as client_name,
        c.email as client_email,
        c.phone_number as client_phone
       FROM projects p
       LEFT JOIN users c ON p.client_id = c.id
       WHERE p.employer_id = ? 
       AND p.status = 'in progress'
       AND p.project_type = 'solo'`,
      [workerId]
    );

    if (projects.length === 0) {
      return {
        statusCode: 200,
        message: "No in-progress solo projects found",
        data: []
      };
    }

    // Get tasks and subtasks for each project
    const projectsWithTasks = await Promise.all(projects.map(async (project) => {
      const [tasks] = await db.query(
        `SELECT 
          t.*,
          COALESCE(
            CONCAT(
              '[',
              GROUP_CONCAT(
                CASE 
                  WHEN st.id IS NOT NULL THEN
                    JSON_OBJECT(
                      'id', st.id,
                      'title', st.title,
                      'description', st.description,
                      'status', st.status,
                      'created_at', st.created_at,
                      'deadline', st.deadline,
                      'completed_at', st.completed_at,
                      'progress_percentage', st.progress_percentage,
                      'assigned_to', st.assigned_to,
                      'assigned_type', st.assigned_type
                    )
                  ELSE NULL
                END
              ),
              ']'
            ),
            '[]'
          ) as subtasks
         FROM main_tasks t
         LEFT JOIN sub_tasks st ON t.id = st.main_task_id
         WHERE t.project_id = ?
         GROUP BY t.id`,
        [project.id]
      );

      // Parse subtasks JSON string to array and filter out null values
      const tasksWithSubtasks = tasks.map(task => ({
        ...task,
        subtasks: task.subtasks ? 
          JSON.parse(task.subtasks).filter(subtask => subtask !== null) : 
          []
      }));

      return {
        ...project,
        tasks: tasksWithSubtasks
      };
    }));

    return {
      statusCode: 200,
      message: "Successfully retrieved in-progress solo projects",
      data: projectsWithTasks
    };

  } catch (err) {
    console.error('Error getting worker in-progress solo projects:', err);
    throw {
      message: err.message || "Failed to get worker's in-progress solo projects",
      statusCode: err.statusCode || 500 
    };
  }
};

// Track project detail view for ML
exports.trackProjectDetailView = async ({ workerId, projectId, viewDuration, jobCategories }) => {
  try {
    console.log('Tracking detail view:', { workerId, projectId, viewDuration, jobCategories });
    
    // Get project details
    const [project] = await db.query(
      `SELECT p.*, 
              GROUP_CONCAT(prj.job_category_id) as required_jobs
       FROM projects p
       LEFT JOIN project_required_jobs prj ON p.id = prj.project_id
       WHERE p.id = ?
       GROUP BY p.id`,
      [projectId]
    );

    if (!project.length) {
      throw { message: "Project not found", statusCode: 404 };
    }

    // Get worker's job categories
    const [workerJobs] = await db.query(
      `SELECT job_category_id 
       FROM worker_jobs 
       WHERE worker_id = ?`,
      [workerId]
    );

    const workerJobIds = workerJobs.map(j => j.job_category_id);
    const projectJobIds = project[0].required_jobs?.split(',') || [];

    // Calculate matches
    const locationMatch = calculateDistance(
      project[0].address,
      project[0].location
    ) <= 40 ? 1 : 0;

    const jobMatch = projectJobIds.some(id => 
      workerJobIds.includes(parseInt(id))
    ) ? 1 : 0;

    // Record the detailed view with enhanced metrics
    await db.query(
      `INSERT INTO project_views 
       (worker_id, project_id, view_duration, location_match, 
        job_match, is_clicked, viewed_at, is_detail_view)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), 1)`,
      [workerId, projectId, viewDuration, locationMatch, jobMatch]
    );

    // Track job categories from the project
    for (const jobId of projectJobIds) {
      if (jobId) {
        await db.query(
          `INSERT INTO job_category_filters 
           (worker_id, job_category_id, filter_count, last_filtered_at)
           VALUES (?, ?, 1, NOW())
           ON DUPLICATE KEY UPDATE 
           filter_count = filter_count + 1,
           last_filtered_at = NOW()`,
          [workerId, jobId]
        );
      }
    }

    // If additional job categories are provided, track them too
    if (jobCategories && jobCategories.length > 0) {
      for (const categoryId of jobCategories) {
        await db.query(
          `INSERT INTO job_category_filters 
           (worker_id, job_category_id, filter_count, last_filtered_at)
           VALUES (?, ?, 1, NOW())
           ON DUPLICATE KEY UPDATE 
           filter_count = filter_count + 1,
           last_filtered_at = NOW()`,
          [workerId, categoryId]
        );
      }
    }

    console.log('Successfully tracked detail view and job categories');

    return {
      statusCode: 200,
      message: "Project detail view tracked successfully"
    };
  } catch (error) {
    console.error('Error in trackProjectDetailView:', error);
    throw error;
  }
};
