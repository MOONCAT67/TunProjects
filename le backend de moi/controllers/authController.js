const {
  registerUser,
  loginUser,
  getUserRoleByEmail,
  logoutUser,
} = require("../services/authService");

const {
  registerValidation,
  loginValidation,
} = require("../middleware/validation");

// Login Controller
exports.login_user = async (req, res) => {
  const { error } = loginValidation(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const result = await loginUser(req.body);
    const { statusCode = 200, message, data, token } = result;
    return res.status(statusCode).json({ message, data, token });
  } catch (err) {
    const { statusCode = 400, message, data } = err;
    return res.status(statusCode).json({ message, data });
  }
};

// Register Controller
exports.register_user = async (req, res) => {
  const { error } = registerValidation(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const result = await registerUser(req.body);
    const { statusCode = 201, message, data, token } = result;
    return res.status(statusCode).json({ message, data, token });
  } catch (err) {
    const { statusCode = 400, message, data } = err;
    return res.status(statusCode).json({ message, data });
  }
};

// Get Role by Email Controller
exports.getUserRole = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const result = await getUserRoleByEmail(email);
    return res.status(result.statusCode).json({
      message: result.message,
      role: result.role,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: err.message,
    });
  }
};

exports.logoutUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    const result = await logoutUser(userId);
    res.status(result.statusCode).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to logout"
    });
  }
};
