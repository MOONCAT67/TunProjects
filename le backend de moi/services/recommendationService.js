const db = require("../config/db");

// Calculate distance between two coordinates (in kilometers)
const calculateDistance = (coord1, coord2) => {
  if (!coord1 || !coord2) return Infinity;
  
  try {
    // Parse coordinates in format "@lat,long"
    const parseCoord = (coord) => {
      const match = coord.match(/@([\d.-]+),([\d.-]+)/);
      if (!match) return null;
      return {
        lat: parseFloat(match[1]),
        long: parseFloat(match[2])
      };
    };

    const point1 = parseCoord(coord1);
    const point2 = parseCoord(coord2);

    if (!point1 || !point2) {
      console.error('Invalid coordinate format:', { coord1, coord2 });
      return Infinity;
    }

    // Haversine formula to calculate distance between two points on Earth
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLong = (point2.long - point1.long) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
      Math.sin(dLong/2) * Math.sin(dLong/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  } catch (error) {
    console.error('Error calculating distance:', error);
    return Infinity;
  }
};

// Get worker's location preferences
const getLocationPreferences = async (workerId) => {
  try {
    // Get worker's recent project views with locations
    const [views] = await db.query(
      `SELECT 
        p.address,
        COUNT(*) as view_count,
        AVG(pv.view_duration) as avg_duration,
        MAX(pv.viewed_at) as last_viewed
       FROM project_views pv
       JOIN projects p ON pv.project_id = p.id
       WHERE pv.worker_id = ?
       AND pv.viewed_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY p.address
       HAVING view_count >= 2
       ORDER BY view_count DESC, last_viewed DESC
       LIMIT 5`,
      [workerId]
    );

    return views;
  } catch (error) {
    console.error('Error in getLocationPreferences:', error);
    return [];
  }
};

// Get worker's job preferences
const getJobPreferences = async (workerId) => {
  try {
    // Get worker's job categories
    const [workerJobs] = await db.query(
      `SELECT job_category_id 
       FROM worker_jobs 
       WHERE worker_id = ?`,
      [workerId]
    );

    // Get most filtered job categories with view counts
    const [filteredJobs] = await db.query(
      `SELECT 
        jcf.job_category_id,
        jcf.filter_count,
        jcf.last_filtered_at,
        COUNT(DISTINCT pv.project_id) as viewed_projects,
        AVG(pv.view_duration) as avg_view_duration,
        COUNT(CASE WHEN pv.is_detail_view = 1 THEN 1 END) as detail_views
       FROM job_category_filters jcf
       LEFT JOIN project_views pv ON jcf.worker_id = pv.worker_id
       LEFT JOIN project_required_jobs prj ON pv.project_id = prj.project_id 
         AND prj.job_category_id = jcf.job_category_id
       WHERE jcf.worker_id = ?
       AND jcf.last_filtered_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY jcf.job_category_id
       ORDER BY jcf.filter_count DESC, detail_views DESC
       LIMIT 5`,
      [workerId]
    );

    // Get most viewed job categories
    const [viewedJobs] = await db.query(
      `SELECT 
        prj.job_category_id,
        COUNT(*) as view_count,
        AVG(pv.view_duration) as avg_duration,
        COUNT(CASE WHEN pv.is_detail_view = 1 THEN 1 END) as detail_views,
        MAX(pv.viewed_at) as last_viewed
       FROM project_views pv
       JOIN project_required_jobs prj ON pv.project_id = prj.project_id
       WHERE pv.worker_id = ?
       AND pv.viewed_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY prj.job_category_id
       ORDER BY view_count DESC, detail_views DESC
       LIMIT 5`,
      [workerId]
    );

    console.log('Job preferences:', {
      workerJobs: workerJobs.map(j => j.job_category_id),
      filteredJobs: filteredJobs.map(j => ({
        id: j.job_category_id,
        filter_count: j.filter_count,
        viewed_projects: j.viewed_projects,
        detail_views: j.detail_views
      })),
      viewedJobs: viewedJobs.map(j => ({
        id: j.job_category_id,
        view_count: j.view_count,
        detail_views: j.detail_views
      }))
    });

    return {
      workerJobs: workerJobs.map(j => j.job_category_id),
      filteredJobs: filteredJobs.map(j => j.job_category_id),
      viewedJobs: viewedJobs.map(j => j.job_category_id)
    };
  } catch (error) {
    console.error('Error in getJobPreferences:', error);
    return {
      workerJobs: [],
      filteredJobs: [],
      viewedJobs: []
    };
  }
};

// Get worker's budget preferences
const getBudgetPreferences = async (workerId) => {
  try {
    // Get worker's recent project views with budgets
    const [views] = await db.query(
      `SELECT 
        CAST(p.budget AS DECIMAL(10,2)) as budget,
        COUNT(*) as view_count,
        AVG(pv.view_duration) as avg_duration,
        MAX(pv.viewed_at) as last_viewed
       FROM project_views pv
       JOIN projects p ON pv.project_id = p.id
       WHERE pv.worker_id = ?
       AND pv.viewed_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY p.budget
       HAVING view_count >= 2
       ORDER BY view_count DESC, last_viewed DESC
       LIMIT 5`,
      [workerId]
    );

    if (!views.length) {
      return {
        preferredBudgets: [],
        avgBudget: 0,
        stdDev: 0,
        minBudget: 0,
        maxBudget: 0
      };
    }

    // Calculate average budget and standard deviation
    const budgets = views.map(v => parseFloat(v.budget));
    const avgBudget = budgets.reduce((a, b) => a + b, 0) / budgets.length;
    const stdDev = Math.sqrt(
      budgets.reduce((sq, n) => sq + Math.pow(n - avgBudget, 2), 0) / budgets.length
    );

    return {
      preferredBudgets: views,
      avgBudget,
      stdDev,
      minBudget: Math.min(...budgets),
      maxBudget: Math.max(...budgets)
    };
  } catch (error) {
    console.error('Error in getBudgetPreferences:', error);
    return {
      preferredBudgets: [],
      avgBudget: 0,
      stdDev: 0,
      minBudget: 0,
      maxBudget: 0
    };
  }
};

// Get job category patterns from worker's viewing history
const getJobCategoryPatterns = async (workerId) => {
  try {
    // Get job categories from viewed projects with detailed metrics
    const [jobPatterns] = await db.query(
      `SELECT 
        prj.job_category_id,
        COUNT(DISTINCT pv.project_id) as total_projects,
        COUNT(CASE WHEN pv.is_detail_view = 1 THEN 1 END) as detail_views,
        AVG(pv.view_duration) as avg_view_duration,
        MAX(pv.viewed_at) as last_viewed,
        COUNT(DISTINCT CASE WHEN pv.is_detail_view = 1 THEN pv.project_id END) as unique_detail_projects
       FROM project_views pv
       JOIN project_required_jobs prj ON pv.project_id = prj.project_id
       WHERE pv.worker_id = ?
       AND pv.viewed_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY prj.job_category_id
       HAVING total_projects > 0`,
      [workerId]
    );

    // Calculate pattern scores
    const patterns = jobPatterns.map(pattern => {
      // Base score from view frequency
      const viewScore = pattern.total_projects / 10; // Normalize to 0-1 scale
      
      // Detail view ratio (0-1)
      const detailRatio = pattern.detail_views / pattern.total_projects;
      
      // View duration score (0-1)
      const durationScore = Math.min(pattern.avg_view_duration / 300, 1); // Cap at 5 minutes
      
      // Recency score (0-1)
      const daysSinceLastView = (new Date() - new Date(pattern.last_viewed)) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - (daysSinceLastView / 30));
      
      // Project variety score (0-1)
      const varietyScore = pattern.unique_detail_projects / pattern.total_projects;
      
      // Calculate final pattern score
      const patternScore = (
        viewScore * 0.3 +          // View frequency weight
        detailRatio * 0.25 +       // Detail view weight
        durationScore * 0.25 +     // View duration weight
        recencyScore * 0.1 +       // Recency weight
        varietyScore * 0.1         // Project variety weight
      );

      return {
        jobCategoryId: pattern.job_category_id,
        score: patternScore,
        metrics: {
          totalProjects: pattern.total_projects,
          detailViews: pattern.detail_views,
          avgDuration: pattern.avg_view_duration,
          lastViewed: pattern.last_viewed,
          uniqueDetailProjects: pattern.unique_detail_projects
        }
      };
    });

    // Sort patterns by score and get top categories
    const topCategories = patterns
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => p.jobCategoryId);

    console.log('Job category patterns:', {
      workerId,
      patterns: patterns.map(p => ({
        jobCategoryId: p.jobCategoryId,
        score: p.score,
        metrics: p.metrics
      })),
      topCategories
    });

    return {
      patterns,
      topCategories
    };
  } catch (error) {
    console.error('Error in getJobCategoryPatterns:', error);
    return {
      patterns: [],
      topCategories: []
    };
  }
};

// Calculate location score with radius
const calculateLocationScore = (workerLocation, projectLocation, preferredLocations) => {
  if (!workerLocation || !projectLocation) return 0;
  
  // If no preferred locations yet, use worker's location with 40km radius
  if (!preferredLocations || preferredLocations.length === 0) {
    const distance = calculateDistance(workerLocation, projectLocation);
    return distance <= 40 ? 1 : 0;
  }
  
  // Check if project is within any preferred location's radius
  for (const location of preferredLocations) {
    const distance = calculateDistance(location.address, projectLocation);
    if (distance <= 40) {
      // Weight by view count and recency
      const recencyScore = new Date(location.last_viewed) > new Date(Date.now() - 24 * 60 * 60 * 1000) ? 1 : 0.7;
      return (location.view_count / 5) * recencyScore; // Normalize view count
    }
  }
  
  return 0;
};

// Calculate job score based on preferences and patterns
const calculateJobScore = (projectJobs, jobPreferences, topCategories = []) => {
  try {
    if (!projectJobs || projectJobs.length === 0) return 0;

    // Parse project jobs if it's a string
    const jobs = typeof projectJobs === 'string' 
      ? projectJobs.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      : projectJobs;

    if (jobs.length === 0) return 0;

    // Calculate base match score
    const baseScore = jobs.reduce((score, jobId) => {
      if (jobPreferences.workerJobs.includes(jobId)) {
        return score + 1;
      }
      return score;
    }, 0) / jobs.length;

    // Calculate pattern match score
    const patternScore = jobs.reduce((score, jobId) => {
      if (topCategories.includes(jobId)) {
        return score + 1;
      }
      return score;
    }, 0) / jobs.length;

    // Combine scores with weights
    const finalScore = (baseScore * 0.4) + (patternScore * 0.6);

    console.log('Job score calculation:', {
      projectJobs: jobs,
      baseScore,
      patternScore,
      finalScore,
      topCategories
    });

    return finalScore;
  } catch (error) {
    console.error('Error in calculateJobScore:', error);
    return 0;
  }
};

// Calculate budget score
const calculateBudgetScore = (projectBudget, budgetPreferences) => {
  if (!projectBudget || !budgetPreferences.preferredBudgets.length) return 0.5; // Neutral score if no preferences

  const { avgBudget, stdDev, minBudget, maxBudget } = budgetPreferences;
  
  // If project budget is within preferred range
  if (projectBudget >= minBudget && projectBudget <= maxBudget) {
    // Calculate how close to average preferred budget
    const distanceFromAvg = Math.abs(projectBudget - avgBudget);
    const normalizedDistance = distanceFromAvg / stdDev;
    
    // Score decreases as distance from average increases
    return Math.max(0, 1 - (normalizedDistance / 2));
  }
  
  // If outside preferred range, score based on how far outside
  const distanceFromRange = Math.min(
    Math.abs(projectBudget - minBudget),
    Math.abs(projectBudget - maxBudget)
  );
  return Math.max(0, 0.5 - (distanceFromRange / (avgBudget * 2)));
};

// Get recommended projects for a worker
exports.getRecommendedProjects = async (workerId, limit = 10) => {
  try {
    console.log('Getting recommendations for worker:', workerId);
    
    // Get worker's location
    const [worker] = await db.query(
      `SELECT location FROM users WHERE id = ?`,
      [workerId]
    );
    
    if (!worker.length) {
      throw { message: "Worker not found", statusCode: 404 };
    }
    
    const workerLocation = worker[0].location;
    console.log('Worker location:', workerLocation);
    
    // Get worker's preferences and patterns
    const locationPreferences = await getLocationPreferences(workerId);
    const jobPreferences = await getJobPreferences(workerId);
    const budgetPreferences = await getBudgetPreferences(workerId);
    const jobPatterns = await getJobCategoryPatterns(workerId);
    
    console.log('Location preferences:', locationPreferences);
    console.log('Job preferences:', jobPreferences);
    console.log('Budget preferences:', budgetPreferences);
    console.log('Job patterns:', jobPatterns);
    
    // Get projects with their required jobs
    const [projects] = await db.query(
      `SELECT 
        p.*,
        COUNT(DISTINCT pa.id) as application_count,
        c.id as contract_id,
        c.status as contract_status,
        GROUP_CONCAT(
          JSON_OBJECT(
            'id', jc.id,
            'name', jc.name,
            'description', jc.description,
            'icon', jc.icon,
            'workers_needed', prj.workers_needed
          )
        ) as required_jobs,
        (
          SELECT COUNT(*) 
          FROM project_views pv 
          WHERE pv.project_id = p.id 
          AND pv.worker_id = ? 
          AND pv.viewed_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_views,
        (
          SELECT AVG(view_duration) 
          FROM project_views pv 
          WHERE pv.project_id = p.id 
          AND pv.worker_id = ?
        ) as avg_view_duration,
        (
          SELECT COUNT(*) 
          FROM project_views pv 
          WHERE pv.project_id = p.id 
          AND pv.worker_id = ?
          AND pv.is_detail_view = 1
        ) as detail_views
       FROM projects p
       LEFT JOIN project_applications pa ON p.id = pa.project_id
       LEFT JOIN contracts c ON p.id = c.project_id
       LEFT JOIN project_required_jobs prj ON p.id = prj.project_id
       LEFT JOIN job_categories jc ON prj.job_category_id = jc.id
       WHERE p.status = 'open'
       AND p.client_id != ?
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [workerId, workerId, workerId, workerId]
    );

    console.log('Found projects:', projects.length);

    // Calculate ML scores for each project
    const scoredProjects = projects.map(project => {
      let projectJobs = [];
      try {
        projectJobs = project.required_jobs ? 
          JSON.parse(`[${project.required_jobs}]`) : [];
      } catch (error) {
        console.error('Error parsing required_jobs:', error);
        console.log('Raw required_jobs:', project.required_jobs);
      }
      
      const locationScore = calculateLocationScore(
        workerLocation,
        project.address,
        locationPreferences
      );
      
      // Calculate job score considering patterns
      const jobScore = calculateJobScore(
        projectJobs,
        jobPreferences,
        jobPatterns.topCategories
      );

      const budgetScore = calculateBudgetScore(
        parseFloat(project.budget),
        budgetPreferences
      );

      // Calculate engagement score based on recent views and duration
      const engagementScore = Math.min(
        (project.recent_views || 0) / 3, // Normalize to max 3 views
        (project.avg_view_duration || 0) / 180 // Normalize to max 3 minutes
      ) * 0.7 + // Weight for view metrics
      (project.detail_views > 0 ? 0.3 : 0); // Bonus for detailed views
      
      // Calculate final ML score with weights
      const mlScore = (
        locationScore * 0.25 +    // Location
        jobScore * 0.35 +         // Job match (increased weight)
        budgetScore * 0.2 +       // Budget match
        engagementScore * 0.2     // Engagement
      );

      console.log('Project scores:', {
        projectId: project.id,
        locationScore,
        jobScore,
        budgetScore,
        engagementScore,
        mlScore,
        required_jobs: projectJobs.map(j => j.job_category_id)
      });

      return {
        ...project,
        required_jobs: projectJobs,
        ml_score: mlScore,
        score_breakdown: {
          location_score: locationScore,
          job_score: jobScore,
          budget_score: budgetScore,
          engagement_score: engagementScore
        }
      };
    });

    // Sort by ML score and return top N projects
    const recommendedProjects = scoredProjects
      .sort((a, b) => {
        // If either score is NaN, put it at the end
        if (isNaN(a.ml_score)) return 1;
        if (isNaN(b.ml_score)) return -1;
        return b.ml_score - a.ml_score;
      })
      .slice(0, limit);

    console.log('Recommended projects:', recommendedProjects.map(p => ({
      id: p.id,
      ml_score: p.ml_score,
      score_breakdown: p.score_breakdown
    })));

    return recommendedProjects;

  } catch (error) {
    console.error('Error in getRecommendedProjects:', error);
    throw error;
  }
};

// Track project view for ML training
exports.trackProjectView = async (workerId, projectId, viewDuration = null) => {
  try {
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

    // Record the view with enhanced metrics
    await db.query(
      `INSERT INTO project_views 
       (worker_id, project_id, view_duration, location_match, 
        job_match, is_clicked, viewed_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW())`,
      [workerId, projectId, viewDuration, locationMatch, jobMatch]
    );

    return {
      statusCode: 200,
      message: "Project view tracked successfully"
    };
  } catch (error) {
    console.error('Error in trackProjectView:', error);
    throw error;
  }
};

// Track project application for ML training
exports.trackProjectApplication = async (workerId, projectId) => {
  try {
    await db.query(
      `UPDATE project_views 
       SET is_applied = 1 
       WHERE worker_id = ? AND project_id = ?`,
      [workerId, projectId]
    );

    return {
      statusCode: 200,
      message: "Project application tracked successfully"
    };
  } catch (error) {
    console.error('Error in trackProjectApplication:', error);
    throw error;
  }
}; 