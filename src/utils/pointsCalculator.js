import pool from '../db/db.js';

export const calculateTeamPoints = async (username) => {
  try {
    const query = `
      SELECT COALESCE(SUM(qb.points), 0) as total_points
      FROM user_answers_${username} ua
      JOIN question_bank qb ON ua.question_id = qb.id
      WHERE ua.is_accepted = true
    `;
    
    const { rows } = await pool.query(query);
    return rows[0]?.total_points || 0;
  } catch (error) {
    console.error(`Error calculating points for ${username}:`, error);
    return 0;
  }
};