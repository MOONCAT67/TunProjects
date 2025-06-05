const db = require("../config/db");
const jwt = require("jsonwebtoken");
const md5 = require("md5");
const { loginValidation, registerValidation } = require("../middleware/validation");

// Login User
exports.loginUser = async (params) => {
  const { error } = loginValidation(params);
  if (error) throw { message: error.details[0].message, statusCode: 400 };

  const { email, password } = params;
  const hashedPassword = md5(password.toString());

  try {
    // First get user without online status
    const [rows] = await db.query(
      "SELECT id, fullname, email, phone_number, role, is_verified, profile_picture, location FROM users WHERE email = ? AND password = ?",
      [email, hashedPassword]
    );

    if (rows.length === 0) {
      throw {
        message: "Wrong credentials, please try again",
        statusCode: 401,
      };
    }

    const user = rows[0];

    // Update user's online status
    await db.query(
      "UPDATE users SET is_online = 1, last_activity = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );

    // Get updated user data including online status
    const [updatedUser] = await db.query(
      "SELECT id, fullname, email, phone_number, role, is_verified, profile_picture, location, is_online, last_activity FROM users WHERE id = ?",
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "30d" }
    );

    return {
      message: "Logged in successfully",
      data: updatedUser[0],
      token,
      statusCode: 200,
    };
  } catch (err) {
    throw {
      data: err,
      message: "Login failed. Please try again.",
      statusCode: 500,
    };
  }
};

// Register User
exports.registerUser = async (params) => {
  const { error } = registerValidation(params);
  if (error) throw { message: error.details[0].message, statusCode: 400 };

  const { fullname, email, password, phone_number, location, profile_picture } = params;
  const hashedPassword = md5(password.toString());

  try {
    const [existingUsers] = await db.query(
      "SELECT email FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      throw {
        message: "Email address is in use, please try a different one",
        statusCode: 400,
      };
    }

    const [insertResult] = await db.query(
      "INSERT INTO users (fullname, email, password, phone_number, location, profile_picture, is_online, last_activity) VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)",
      [fullname, email, hashedPassword, phone_number, location, profile_picture || null]
    );

    const [userRows] = await db.query(
      "SELECT id, fullname, email, phone_number, role, is_verified, location, profile_picture FROM users WHERE id = ?",
      [insertResult.insertId]
    );

    if (userRows.length === 0) {
      throw {
        message: "Registration complete but failed to retrieve user data",
        statusCode: 500,
      };
    }

    const user = userRows[0];
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "30d" }
    );

    return {
      data: user,
      message: "You have successfully registered.",
      token: token,
      statusCode: 201,
    };
  } catch (err) {
    throw {
      data: err,
      message: "Registration failed. Please try again.",
      statusCode: 500,
    };
  }
};

// Get user role by email
exports.getUserRoleByEmail = async (email) => {
  try {
    const [rows] = await db.query(
      "SELECT role FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      throw {
        message: "User not found",
        statusCode: 404,
      };
    }

    return {
      message: "User role retrieved successfully",
      role: rows[0].role,
      statusCode: 200,
    };
  } catch (err) {
    throw {
      message: "Database error",
      data: err,
      statusCode: 500,
    };
  }
};

exports.logoutUser = async (userId) => {
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    // First check if user exists
    const [user] = await db.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );

    if (user.length === 0) {
      throw { message: "User not found", statusCode: 404 };
    }

    // Update user's online status
    await db.query(
      "UPDATE users SET is_online = 0, last_activity = CURRENT_TIMESTAMP WHERE id = ?",
      [userId]
    );

    return {
      message: "Logged out successfully",
      statusCode: 200,
    };
  } catch (err) {
    throw {
      message: err.message || "Logout failed. Please try again.",
      statusCode: err.statusCode || 500,
    };
  }
};
