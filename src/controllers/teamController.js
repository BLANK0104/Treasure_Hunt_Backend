import pool from '../db/db.js';

export const createTeam = async (req, res) => {
  try {
    const { username } = req.user;
    
    // Check if user already has questions assigned
    const existingAssignments = await pool.query(
      'SELECT COUNT(*) FROM question_assignments WHERE user_id = (SELECT id FROM users WHERE username = $1)',
      [username]
    );

    if (existingAssignments.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Questions already assigned to this user'
      });
    }

    // Get user ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    const userId = userResult.rows[0].id;

    // Get 10 random questions
    const questions = await pool.query(
      'SELECT id FROM question_bank ORDER BY RANDOM() LIMIT 10'
    );

    // Assign questions to user
    for (const question of questions.rows) {
      await pool.query(
        'INSERT INTO question_assignments (user_id, question_id) VALUES ($1, $2)',
        [userId, question.id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Questions assigned successfully'
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getCurrentQuestion = async (req, res) => {
  try {
    const { id: userId, username } = req.user;

    // Get the first unanswered question from assigned questions
    const questionResult = await pool.query(
      `SELECT qa.id as assignment_id, qb.* 
       FROM question_assignments qa
       JOIN question_bank qb ON qa.question_id = qb.id
       WHERE qa.user_id = $1
       AND NOT EXISTS (
         SELECT 1 
         FROM user_answers_${username} ua 
         WHERE ua.question_id = qb.id
       )
       ORDER BY qa.id
       LIMIT 1`,
      [userId]
    );

    if (questionResult.rows.length === 0) {
      return res.json({
        success: true,
        completed: true
      });
    }

    res.json({
      success: true,
      question: questionResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const submitAnswer = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { username } = req.user;
    const { text_answer } = req.body;
    
    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'Question ID is required'
      });
    }

    const image_answer_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Verify the question belongs to user's assignments
    const assignmentCheck = await pool.query(
      `SELECT qa.* FROM question_assignments qa
       JOIN users u ON qa.user_id = u.id
       WHERE u.username = $1 AND qa.question_id = $2`,
      [username, questionId]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Question not assigned to user'
      });
    }

    // Insert answer into user's answer table
    await pool.query(
      `INSERT INTO user_answers_${username} 
       (question_id, text_answer, image_answer_url) 
       VALUES ($1, $2, $3)`,
      [questionId, text_answer || null, image_answer_url]
    );

    res.json({
      success: true,
      message: 'Answer submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getParticipantAnswers = async (req, res) => {
  try {
    const { username } = req.params;

    const answers = await pool.query(
      `SELECT ua.*, qb.question, qb.points
       FROM user_answers_${username} ua
       JOIN question_bank qb ON ua.question_id = qb.id
       ORDER BY ua.submitted_at DESC`
    );

    res.json({
      success: true,
      answers: answers.rows
    });
  } catch (error) {
    console.error('Error fetching answers:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};