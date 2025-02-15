import pool from '../db/db.js';
import { calculateTeamPoints } from '../utils/pointsCalculator.js';

export const getTeams = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, username FROM users WHERE role = $1', ['participant']);
    
    const teamsWithPoints = await Promise.all(
      rows.map(async (user) => ({
        ...user,
        total_points: await calculateTeamPoints(user.username)
      }))
    );

    res.json({
      success: true,
      teams: teamsWithPoints
    });
  } catch (error) {
    console.error('Error in getTeams:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams',
      error: error.message
    });
  }
};

export const getTeamAnswers = async (req, res) => {
  try {
    const { username } = req.params;

    // Get all answers for the team with question details
    const answersQuery = `
      SELECT 
        ua.*,
        qb.question as question_text,
        qb.points,
        qb.requires_image,
        u.username as reviewed_by_username
      FROM user_answers_${username} ua
      JOIN question_bank qb ON ua.question_id = qb.id
      LEFT JOIN users u ON ua.reviewed_by = u.id
      ORDER BY ua.submitted_at DESC
    `;
    
    const { rows } = await pool.query(answersQuery);
    res.json({
      success: true,
      answers: rows
    });
  } catch (error) {
    console.error('Error fetching team answers:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const reviewAnswer = async (req, res) => {
  try {
    const { username, answerId } = req.params;
    const { is_accepted, feedback } = req.body;
    
    const updateQuery = `
      UPDATE user_answers_${username}
      SET 
        is_reviewed = true,
        is_accepted = $1,
        admin_feedback = $2,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = $3
      WHERE id = $4
      RETURNING *
    `;
    
    const { rows } = await pool.query(updateQuery, [
      is_accepted, 
      feedback,
      req.user.id,
      answerId
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Answer not found'
      });
    }

    res.json({
      success: true,
      message: `Answer ${is_accepted ? 'accepted' : 'rejected'} successfully`,
      answer: rows[0]
    });
  } catch (error) {
    console.error('Error reviewing answer:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ...existing code...

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

export const getTeamResults = async (req, res) => {
  try {
    // Get all participants first
    const usersQuery = 'SELECT id, username FROM users WHERE role = $1';
    const { rows: users } = await pool.query(usersQuery, ['participant']);

    // Calculate results for each user
    const results = await Promise.all(users.map(async (user) => {
      const pointsQuery = `
        SELECT 
          u.id,
          u.username,
          COALESCE(
            (SELECT COUNT(*)
             FROM user_answers_${user.username} ua
             WHERE ua.is_accepted = true), 0
          ) as questions_solved,
          COALESCE(
            (SELECT SUM(qb.points)
             FROM user_answers_${user.username} ua
             JOIN question_bank qb ON ua.question_id = qb.id
             WHERE ua.is_accepted = true), 0
          ) as total_points
        FROM users u
        WHERE u.id = $1
      `;

      const { rows } = await pool.query(pointsQuery, [user.id]);
      return rows[0];
    }));

    // Sort by points and questions solved
    const sortedResults = results.sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return b.questions_solved - a.questions_solved;
    });

    res.json({
      success: true,
      results: sortedResults
    });
  } catch (error) {
    console.error('Error getting team results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team results',
      error: error.message
    });
  }
};