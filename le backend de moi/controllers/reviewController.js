const reviewService = require("../services/reviewService");

exports.addReview = async (req, res, next) => {
  try {
    const { clientId, workerId, projectId, rating, comment } = req.body;

    const result = await reviewService.addReview({
      clientId,
      workerId,
      projectId,
      rating,
      comment
    });

    res.status(result.statusCode).send({ ...result });
  } catch (err) {
    const { statusCode = 400, message } = err;
    res.status(statusCode).send({ message }) && next(err);
  }
};

exports.getWorkerReviews = async (req, res, next) => {
  try {
    const { workerId } = req.params;

    const result = await reviewService.getWorkerReviews({ workerId });
    res.status(result.statusCode).send({ ...result });
  } catch (err) {
    const { statusCode = 400, message } = err;
    res.status(statusCode).send({ message }) && next(err);
  }
};

exports.getProjectReview = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const result = await reviewService.getProjectReview({ projectId });
    res.status(result.statusCode).send({ ...result });
  } catch (err) {
    const { statusCode = 400, message } = err;
    res.status(statusCode).send({ message }) && next(err);
  }
}; 