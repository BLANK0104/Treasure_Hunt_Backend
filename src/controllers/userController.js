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
      // Get 10 random questions
      const questions = await pool.query(
        'SELECT id FROM question_bank ORDER BY RANDOM() LIMIT 10'
      );

      // Assign questions to user
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
    const { username, password } = req.body;

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

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // If participant, check if questions are assigned
    if (user.role === 'participant') {
      const assignedQuestions = await pool.query(
        'SELECT COUNT(*) FROM question_assignments WHERE user_id = $1',
        [user.id]
      );

      if (assignedQuestions.rows[0].count === 0) {
        // Get 10 random questions
        const questions = await pool.query(
          'SELECT id FROM question_bank ORDER BY RANDOM() LIMIT 10'
        );

        // Assign questions to user
        for (const question of questions.rows) {
          await pool.query(
            'INSERT INTO question_assignments (user_id, question_id) VALUES ($1, $2)',
            [user.id, question.id]
          );
        }
      }
    }

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