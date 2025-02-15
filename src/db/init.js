import pool from './db.js';

export const initializeTables = async () => {
  try {
    await pool.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('admin', 'participant')) NOT NULL
      );

      -- Question bank
      CREATE TABLE IF NOT EXISTS question_bank (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        points INTEGER NOT NULL,
        requires_image BOOLEAN DEFAULT FALSE,
        image_url VARCHAR(255)
      );

      -- Question assignments
      CREATE TABLE IF NOT EXISTS question_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (question_id) REFERENCES question_bank(id),
        UNIQUE(user_id, question_id)
      );

      -- Function to create user answers table
      CREATE OR REPLACE FUNCTION create_user_answers_table(username TEXT) 
RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS user_answers_%I (
      id SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL,
      text_answer TEXT,
      image_answer_url VARCHAR(255),
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_reviewed BOOLEAN DEFAULT FALSE,
      is_accepted BOOLEAN DEFAULT FALSE,
      reviewed_at TIMESTAMP,
      reviewed_by INTEGER REFERENCES users(id),
      admin_feedback TEXT,
      FOREIGN KEY (question_id) REFERENCES question_bank(id)
    )', username);
      END;
      $$ LANGUAGE plpgsql;

      -- Trigger to create user answers table on user creation
      CREATE OR REPLACE FUNCTION create_user_table_trigger()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.role = 'participant' THEN
          PERFORM create_user_answers_table(NEW.username);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE TRIGGER user_creation_trigger
      AFTER INSERT ON users
      FOR EACH ROW
      EXECUTE FUNCTION create_user_table_trigger();
    `);
    console.log('Tables initialized successfully');
  } catch (error) {
    console.error('Error initializing tables:', error);
  }
};