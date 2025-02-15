import pool from '../db/db.js';

export const createQuestion = async (req, res) => {
  try {
    const { question, points } = req.body;
    const image = req.file;

    if (!question || !points) {
      return res.status(400).json({
        success: false,
        message: 'Question text and points are required'
      });
    }

    const image_url = image ? `/uploads/${image.filename}` : null;

    const result = await pool.query(
      'INSERT INTO question_bank (question, points, image_url) VALUES ($1, $2, $3) RETURNING *',
      [question, points, image_url]
    );

    res.status(201).json({
      success: true,
      question: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create question'
    });
  }
};

export const getAllQuestions = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM question_bank ORDER BY id DESC');
    res.json({
      success: true,
      questions: result.rows
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questions'
    });
  }
};