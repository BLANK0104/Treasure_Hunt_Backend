import pool from '../db/db.js';

export const createQuestion = async (req, res) => {
  try {
    const { question, points } = req.body;
    const requires_image = req.body.requires_image === 'true';
    const is_bonus = req.body.is_bonus === 'true';
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!question || !points) {
      return res.status(400).json({
        success: false,
        message: 'Question text and points are required'
      });
    }

    const result = await pool.query(
      'INSERT INTO question_bank (question, points, requires_image, image_url, is_bonus) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [question, points, requires_image, image_url, is_bonus]
    );

    res.status(201).json({
      success: true,
      question: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllQuestions = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM question_bank ORDER BY id DESC'
    );

    res.json({
      success: true,
      questions: result.rows
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getCurrentQuestion = async (req, res) => {
  try {
    const { id: userId, username } = req.user;

    const questionResult = await pool.query(
      `SELECT qb.*, qa.id as assignment_id
       FROM question_assignments qa
       JOIN question_bank qb ON qa.question_id = qb.id
       WHERE qa.user_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM user_answers_${username} ua
         WHERE ua.question_id = qa.question_id
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
    const image_answer_url = req.file ? `/uploads/${req.file.filename}` : null;

    await pool.query(
      `INSERT INTO user_answers_${username} 
       (question_id, text_answer, image_answer_url) 
       VALUES ($1, $2, $3)`,
      [questionId, text_answer, image_answer_url]
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

export const reviewAnswer = async (req, res) => {
  try {
    const { username, questionId } = req.params;
    const { is_accepted, admin_feedback } = req.body;

    await pool.query(
      `UPDATE user_answers_${username}
       SET is_accepted = $1, admin_feedback = $2
       WHERE question_id = $3`,
      [is_accepted, admin_feedback, questionId]
    );

    res.json({
      success: true,
      message: 'Answer reviewed successfully'
    });
  } catch (error) {
    console.error('Error reviewing answer:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, points } = req.body;
    const requires_image = req.body.requires_image === 'true';
    const is_bonus = req.body.is_bonus === 'true';
    let image_url = null;

    // Check if question exists
    const questionCheck = await pool.query(
      'SELECT * FROM question_bank WHERE id = $1',
      [id]
    );

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Handle image updates
    if (req.file) {
      // New image uploaded
      image_url = `/uploads/${req.file.filename}`;
    } else if (req.body.remove_image === 'true') {
      // Image removed
      image_url = null;
    } else {
      // Keep existing image
      image_url = questionCheck.rows[0].image_url;
    }

    const result = await pool.query(
      `UPDATE question_bank 
       SET question = $1, points = $2, requires_image = $3, image_url = $4, is_bonus = $5
       WHERE id = $6
       RETURNING *`,
      [question, points, requires_image, image_url, is_bonus, id]
    );

    res.json({
      success: true,
      question: result.rows[0],
      message: 'Question updated successfully'
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if question exists
    const questionCheck = await pool.query(
      'SELECT * FROM question_bank WHERE id = $1',
      [id]
    );

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Delete the question
    await pool.query(
      'DELETE FROM question_bank WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};