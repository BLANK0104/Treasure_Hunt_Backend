import pool from '../db/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const registerUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hashedPassword, role]
    );

    if (role === 'participant') {
      // Get ALL questions in random order
      const questions = await pool.query(
        'SELECT id FROM question_bank ORDER BY RANDOM()'
      );

      // Assign all questions to user
      for (const question of questions.rows) {
        await pool.query(
          'INSERT INTO question_assignments (user_id, question_id) VALUES ($1, $2)',
          [userResult.rows[0].id, question.id]
        );
      }
    }

    res.status(201).json({
      success: true,
      user: userResult.rows[0]
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { username, password, deviceId } = req.body;

    // Check if user exists
    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Simply update to the new device ID - this automatically logs out any other device
    await pool.query(
      'UPDATE users SET current_device_id = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2',
      [deviceId, user.id]
    );

    // Record device session
    await pool.query(
      'INSERT INTO device_sessions (user_id, device_id) VALUES ($1, $2) ON CONFLICT (user_id, device_id) DO UPDATE SET last_active = CURRENT_TIMESTAMP',
      [user.id, deviceId]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        deviceId 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const logoutUser = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user?.id;

    if (userId) {
      // Clear device ID from user record
      await pool.query(
        'UPDATE users SET current_device_id = NULL WHERE id = $1',
        [userId]
      );

      // Update device session
      await pool.query(
        'UPDATE device_sessions SET last_active = CURRENT_TIMESTAMP WHERE user_id = $1 AND device_id = $2',
        [userId, deviceId]
      );
    }

    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error during logout' 
    });
  }
};