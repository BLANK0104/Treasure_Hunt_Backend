import xlsx from 'xlsx';
import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

const importQuestions = async () => {
  try {
    const excelPath = path.join(__dirname, 'questions.xlsx');
    console.log('Reading Excel file from:', excelPath);
    
    const workbook = xlsx.readFile(excelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Skip the header rows and empty rows
    const rawData = xlsx.utils.sheet_to_json(worksheet, {
      range: 5,  // Skip first 5 rows
      header: ['srNo', 'clue', 'answer'],
      defval: '',
      blankrows: false
    });

    console.log('First few rows:', rawData.slice(0, 2));

    const questions = rawData
      .filter(row => {
        // Check if row is valid and srNo is a number
        const srNoNum = Number(row.srNo);
        const isValid = !isNaN(srNoNum) && row.clue && typeof row.clue === 'string';
        
        if (!isValid) {
          console.log('Debug - Invalid row:', {
            srNo: row.srNo,
            srNoType: typeof row.srNo,
            clue: row.clue?.substring(0, 50),
            isNumber: !isNaN(srNoNum)
          });
        }
        return isValid;
      })
      .map(row => ({
        question: cleanText(row.clue),
        points: 10,
        requires_image: false
      }))
      .filter(q => q.question.length > 0);

    if (questions.length === 0) {
      console.error('No valid questions found after processing.');
      console.error('Please check the Excel file format.');
      return;
    }

    console.log(`Found ${questions.length} valid questions to import`);

    // Begin database transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Optional: Clear existing questions
      // await client.query('TRUNCATE question_bank RESTART IDENTITY CASCADE');

      const insertQuery = `
        INSERT INTO question_bank (question, points, requires_image)
        VALUES ($1, $2, $3)
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
              q.requires_image
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

importQuestions();