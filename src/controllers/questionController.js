import pool from '../db/db.js';

export const createQuestion = async (req, res) => {
  try {
    const { question, points, image_url } = req.body;
    const result = await pool.query(
      'INSERT INTO question_bank (question, points, image_url) VALUES ($1, $2, $3) RETURNING *',
      [question, points, image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllQuestions = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM question_bank');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};