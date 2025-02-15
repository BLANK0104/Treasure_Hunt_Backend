import pool from '../db/db.js';

export const assignQuestion = async (req, res) => {
  try {
    const { username, team_member_name, question_id } = req.body;
    const result = await pool.query(
      'INSERT INTO team (username, team_member_name, question_id) VALUES ($1, $2, $3) RETURNING *',
      [username, team_member_name, question_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const submitAnswer = async (req, res) => {
  try {
    const { text_answer, image_answer_url } = req.body;
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE team SET text_answer = $1, image_answer_url = $2, time_of_completion = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [text_answer, image_answer_url, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const reviewAnswer = async (req, res) => {
  try {
    const { is_accepted } = req.body;
    const { id } = req.params;
    
    const team = await pool.query('SELECT * FROM team WHERE id = $1', [id]);
    const question = await pool.query('SELECT points FROM question_bank WHERE id = $1', [team.rows[0].question_id]);
    
    const points = is_accepted ? question.rows[0].points : 0;
    
    const result = await pool.query(
      'UPDATE team SET is_accepted = $1, points = $2 WHERE id = $3 RETURNING *',
      [is_accepted, points, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};