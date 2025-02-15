import pool from './db.js';

export const initializeTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('admin', 'participant')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS question_bank (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        points INTEGER NOT NULL,
        image_url VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS team (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        team_member_name VARCHAR(255) NOT NULL,
        question_id INTEGER,
        time_of_completion TIMESTAMP,
        text_answer TEXT,
        image_answer_url VARCHAR(255),
        is_accepted BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (username) REFERENCES users(username),
        FOREIGN KEY (question_id) REFERENCES question_bank(id)
      );
    `);
    console.log('Tables initialized successfully');
  } catch (error) {
    console.error('Error initializing tables:', error);
  }
};