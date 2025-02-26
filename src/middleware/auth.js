import jwt from 'jsonwebtoken';
import pool from '../db/db.js';

export const validateDeviceToken = async (req, res, next) => {
  try {
    // Skip validation for login and register routes
    if (req.path === '/users/login' || req.path === '/users/register') {
      return next();
    }

    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // For logout requests, only verify the token is valid
    if (req.path === '/users/logout') {
      req.user = { id: decoded.id };
      return next();
    }

    // Check if user exists and device matches current device
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.id]
    );

    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // If the device ID in the token doesn't match the current one in the database,
    // it means the user has logged in from another device
    if (user.current_device_id !== decoded.deviceId) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again',
        sessionExpired: true
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};