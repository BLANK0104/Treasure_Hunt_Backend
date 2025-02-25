import { parse } from 'csv-parse';
import fs from 'fs';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'treasure_hunt',
  password: 'blank@0104',
  port: 5432,
});

const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/Answer:?\s*.*$/gm, '')
    .replace(/\(\)|\(Answer:[^)]*\)/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/—/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/["""]/g, '"')
    .trim();
};

const importQuestionsFromCSV = async () => {
    try {
      const csvPath = path.join(__dirname, 'questions.csv');
      console.log('Reading CSV file from:', csvPath);
  
      const records = [];
      const parser = fs
        .createReadStream(csvPath)
        .pipe(parse({  // Changed from csv.parse to parse
          skip_empty_lines: true,
          from_line: 6
        }));
  

    for await (const record of parser) {
      records.push(record);
    }

    const questions = records
      .filter(row => {
        const srNo = Number(row[0]);
        const hasValidSrNo = !isNaN(srNo);
        const hasValidClue = row[1] && typeof row[1] === 'string';
        
        if (!hasValidSrNo || !hasValidClue) {
          console.log('Debug - Invalid row:', {
            srNo: row[0],
            clue: row[1]?.substring(0, 50)
          });
        }
        return hasValidSrNo && hasValidClue;
      })
      .map(row => {
        const srNo = Number(row[0]);
        return {
          question: cleanText(row[1]),
          points: 10,
          requires_image: srNo > 60 ? true : row[3]?.toLowerCase() === 'yes',
          is_bonus: false
        };
      })
      .filter(q => q.question.length > 0);

    if (questions.length === 0) {
      console.error('No valid questions found after processing.');
      console.error('Please check the CSV file format.');
      return;
    }

    console.log(`Found ${questions.length} valid questions to import`);

    // Begin database transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO question_bank (question, points, requires_image, is_bonus)
        VALUES ($1, $2, $3, $4)
      `;

      // Process in smaller batches
      const batchSize = 10;
      for (let i = 0; i < questions.length; i += batchSize) {
        const batch = questions.slice(i, i + batchSize);
        await Promise.all(
          batch.map(q => 
            client.query(insertQuery, [
              q.question,
              q.points,
              q.requires_image,
              q.is_bonus
            ])
          )
        );
        console.log(`Processed ${Math.min(i + batchSize, questions.length)} of ${questions.length} questions`);
      }

      await client.query('COMMIT');
      console.log('Successfully imported questions!');
      console.log(`Total questions imported: ${questions.length}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', err);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error importing questions:', error);
  } finally {
    await pool.end();
  }
};

importQuestionsFromCSV();