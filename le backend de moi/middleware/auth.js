const jwt = require('jsonwebtoken');
const db = require('../config/db');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).send({ message: 'Authentication required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const [users] = await db.query(
      `SELECT id, fullname, email, role, is_worker, is_verified 
       FROM users 
       WHERE id = ?`,
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).send({ message: 'User not found' });
    }

    const user = users[0];

    // Add user to request
    req.user = user;
    next();
  } catch (err) {
    res.status(401).send({ message: 'Please authenticate' });
  }
};

module.exports = auth; 