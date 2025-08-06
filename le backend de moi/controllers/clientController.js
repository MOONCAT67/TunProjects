const {
    createProject,
    getClientProjects,
    getProjectApplications,
    acceptApplication,
    getAllWorkers,
    getClientProfile,
    updateProfilePicture,
    updateFullName,
    updatePhoneNumber
  } = require("../services/clientService");
  
  exports.create_project = async (req, res, next) => {
    try {
      const client_id = req.body.user.id; // Get client ID from frontend data
      const projectData = { ...req.body, client_id };
      
      const result = await createProject(projectData);
      res.status(result.statusCode).send({ ...result });
    } catch (err) {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message });
      next(err);
    }
  };
  
  exports.get_client_projects = async (req, res, next) => {
    try {
      const clientId = req.query.userId;
      
      if (!clientId) {
        return res.status(400).send({ 
          message: "userId is required" 
        });
      }

      const result = await getClientProjects({ clientId });
      res.status(result.statusCode).send(result);
    } catch (err) {
      console.error('Error in get_client_projects:', err);
      const statusCode = err.statusCode || 500;
      const message = err.message || "Internal server error";
      res.status(statusCode).send({ message });
      next(err);
    }
  };
  
  exports.get_project_applications = async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const clientId = req.query.userId; // Get from query params
      
      const result = await getProjectApplications({ projectId, clientId });
      res.status(200).send(result);
    } catch (err) {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message });
      next(err);
    }
  };
  
  exports.accept_application = async (req, res, next) => {
    try {
      const { projectId, applicationId } = req.params;
      const clientId = req.body.user.id; // Get from request body
      
      const result = await acceptApplication({ projectId, applicationId, clientId });
      res.status(result.statusCode).send({ ...result });
    } catch (err) {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message });
      next(err);
    }
  };

  // Get all workers
  exports.get_all_workers = async (req, res) => {
    try {
      const result = await getAllWorkers();
      res.status(result.statusCode).json(result);
    } catch (error) {
      res.status(error.statusCode || 500).json(error);
    }
  };

  exports.getClientProfile = async (req, res, next) => {
    try {
      const { userId } = req.params;

      const result = await getClientProfile({ userId });
      res.status(result.statusCode).send({ ...result });
    } catch (err) {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    }
  };

  exports.updateProfilePicture = async (req, res) => {
    try {
      const userId = req.params.userId;
      const { profilePicture } = req.body;

      const result = await updateProfilePicture({
        userId,
        profilePicture
      });

      res.status(result.statusCode).json(result);
    } catch (error) {
      console.error('Error in updateProfilePicture controller:', error);
      res.status(error.statusCode || 500).json({
        message: error.message || 'Internal server error'
      });
    }
  };

  exports.updateFullName = async (req, res) => {
    try {
      const userId = req.params.userId;
      const { fullname } = req.body;

      const result = await updateFullName({
        userId,
        fullname
      });

      res.status(result.statusCode).json(result);
    } catch (error) {
      console.error('Error in updateFullName controller:', error);
      res.status(error.statusCode || 500).json({
        message: error.message || 'Internal server error'
      });
    }
  };

  exports.updatePhoneNumber = async (req, res) => {
    try {
      const userId = req.params.userId;
      const { phoneNumber } = req.body;

      const result = await updatePhoneNumber({
        userId,
        phoneNumber
      });

      res.status(result.statusCode).json(result);
    } catch (error) {
      console.error('Error in updatePhoneNumber controller:', error);
      res.status(error.statusCode || 500).json({
        message: error.message || 'Internal server error'
      });
    }
  };