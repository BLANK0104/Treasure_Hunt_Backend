import pool from '../db/db.js';
import { calculateTeamPoints } from '../utils/pointsCalculator.js';

export const getTeams = async (req, res) => {
  try {
    const { lastUpdated } = req.query;
    let query = 'SELECT id, username FROM users WHERE role = $1';
    const params = ['participant'];
    
    // Add timestamp filtering if lastUpdated parameter is provided
    if (lastUpdated) {
      // Convert to JavaScript Date object and then to ISO string
      const lastUpdatedDate = new Date(parseInt(lastUpdated));
      
      query = `
        SELECT u.id, u.username 
        FROM users u
        LEFT JOIN (
          SELECT user_id, MAX(reviewed_at) as last_review
          FROM team_activity_log
          GROUP BY user_id
        ) tal ON u.id = tal.user_id
        WHERE u.role = $1 AND (tal.last_review > $2 OR tal.last_review IS NULL)
      `;
      params.push(lastUpdatedDate.toISOString());
    }
    
    const { rows } = await pool.query(query, params);
    
    const teamsWithPoints = await Promise.all(
      rows.map(async (user) => ({
        ...user,
        total_points: await calculateTeamPoints(user.username),
        answers_count: await getTeamAnswersCount(user.username)
      }))
    );

    res.json({
      success: true,
      teams: teamsWithPoints,
      timestamp: Date.now()
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

// Helper function to get team answers count
async function getTeamAnswersCount(username) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM user_answers_${username}`
    );
    return parseInt(rows[0].count);
  } catch (error) {
    console.error(`Error getting answer count for ${username}:`, error);
    return 0;
  }
}

export const getTeamAnswers = async (req, res) => {
  try {
    const { username } = req.params;
    const { lastUpdated } = req.query;

    // First check if user exists
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Base query
    let query = `
      SELECT 
        ua.id,
        ua.question_id,
        qb.question as question_text,
        qb.points,
        qb.is_bonus,
        ua.text_answer,
        ua.image_answer_url,
        ua.is_reviewed,
        ua.is_accepted,
        ua.submitted_at,
        ua.reviewed_at,
        ROW_NUMBER() OVER (ORDER BY ua.submitted_at) as question_number
      FROM user_answers_${username} ua
      JOIN question_bank qb ON ua.question_id = qb.id
    `;
    
    // Add timestamp filtering if lastUpdated parameter is provided
    const params = [];
    if (lastUpdated) {
      const lastUpdatedDate = new Date(parseInt(lastUpdated));
      query += ` WHERE ua.submitted_at > $1 OR (ua.is_reviewed = true AND ua.reviewed_at > $1)`;
      params.push(lastUpdatedDate.toISOString());
    }

    query += ` ORDER BY ua.submitted_at ASC`;

    const { rows } = await pool.query(query, params);

    res.json({
      success: true,
      answers: rows.map(row => ({
        ...row,
        submitted_at: row.submitted_at?.toISOString(),
        reviewed_at: row.reviewed_at?.toISOString()
      })),
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error in getTeamAnswers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team answers',
      error: error.message
    });
  }
};

// Add a team activity logging function to track changes
export const logTeamActivity = async (userId, activityType, data) => {
  try {
    await pool.query(
      'INSERT INTO team_activity_log (user_id, activity_type, data, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [userId, activityType, JSON.stringify(data)]
    );
  } catch (error) {
    console.error('Error logging team activity:', error);
  }
};

export const reviewAnswer = async (req, res) => {
  try {
    const { username, answerId } = req.params;
    const { isAccepted } = req.body;
    const reviewerId = req.user.id;

    console.log('Review params:', { username, answerId, isAccepted, reviewerId }); // Debug log

    // Get user ID for activity logging
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    const userId = userResult.rows[0]?.id;

    const updateQuery = `
      UPDATE user_answers_${username}
      SET 
        is_reviewed = true,
        is_accepted = $1,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = $2
      WHERE id = $3
      RETURNING *;
    `;

    const { rows } = await pool.query(updateQuery, [isAccepted, reviewerId, answerId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Answer not found'
      });
    }

    // Log the activity for real-time updates
    if (userId) {
      await logTeamActivity(userId, 'answer_reviewed', {
        answerId,
        isAccepted,
        reviewerId
      });
    }

    res.json({
      success: true,
      message: `Answer ${isAccepted ? 'accepted' : 'rejected'} successfully`,
      answer: rows[0],
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error in reviewAnswer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review answer',
      error: error.message
    });
  }
};

export const createTeam = async (req, res) => {
  try {
    const { username } = req.body;
    
    // Get all normal questions
    const normalQuestionsQuery = await pool.query(
      'SELECT id FROM question_bank WHERE is_bonus = false'
    );
    const normalQuestions = normalQuestionsQuery.rows;

    // Get all bonus questions
    const bonusQuestionsQuery = await pool.query(
      'SELECT id FROM question_bank WHERE is_bonus = true ORDER BY id ASC'
    );
    const bonusQuestions = bonusQuestionsQuery.rows;

    // Get user id
    const userQuery = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    const userId = userQuery.rows[0].id;

    // Shuffle normal questions
    function shuffleArray(array) {
      const shuffled = [...array]; // Create a copy to avoid modifying the original
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
      }
      return shuffled;
    }
    
    // Then use it like this:
    const shuffledNormal = shuffleArray(normalQuestions);
    
    // Use bonus questions in their original order (ORDER BY id ASC)
    const orderedBonus = bonusQuestions;

    // Assign normal questions with order
    for (let i = 0; i < shuffledNormal.length; i++) {
      // Implementation details omitted
    }

    // Assign bonus questions with order (continuing from normal questions order)
    for (let i = 0; i < orderedBonus.length; i++) {
      // Implementation details omitted
    }

    res.status(201).json({
      success: true,
      message: 'Team created successfully'
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
    const { username } = req.user;
    const { is_bonus } = req.query;
    const isBonus = is_bonus === 'true';

    // Get next unanswered question based on randomized order
    const questionQuery = `
      SELECT qb.*, qa.question_order,
             (SELECT COUNT(*) FROM user_answers_${username} ua 
              JOIN question_bank qb2 ON ua.question_id = qb2.id 
              WHERE qb2.is_bonus = false) as answered_normal,
             (SELECT COUNT(*) FROM user_answers_${username} ua 
              JOIN question_bank qb2 ON ua.question_id = qb2.id 
              WHERE qb2.is_bonus = true) as answered_bonus
      FROM question_bank qb
      JOIN question_assignments qa ON qb.id = qa.question_id
      JOIN users u ON qa.user_id = u.id
      WHERE u.username = $1
      AND qb.id NOT IN (
        SELECT question_id 
        FROM user_answers_${username}
      )
      AND qb.is_bonus = $2
      ORDER BY qa.question_order ASC
      LIMIT 1;
    `;

    const { rows } = await pool.query(questionQuery, [username, isBonus]);

    if (rows.length === 0) {
      // Handle no questions found case
    }

    const answeredNormal = parseInt(rows[0].answered_normal);
    const answeredBonus = parseInt(rows[0].answered_bonus);
    const currentMilestone = Math.floor((answeredNormal + 1) / 10);
    const canTakeBonus = (answeredNormal + 1) % 10 === 0 && answeredBonus < currentMilestone;

    res.json({
      success: true,
      question: {
        id: rows[0].id,
        text: rows[0].question,
        points: rows[0].points,
        requires_image: rows[0].requires_image,
        image_url: rows[0].image_url,
        is_bonus: rows[0].is_bonus
      },
      question_number: answeredNormal + 1,
      completed_bonus: answeredBonus,
      can_take_bonus: canTakeBonus
    });

  } catch (error) {
    console.error('Error in getCurrentQuestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current question',
      error: error.message
    });
  }
};

export const submitAnswer = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { username } = req.user;
    const { text_answer } = req.body;
    
    // First check if question exists and if it requires an image
    const questionCheck = await pool.query(
      'SELECT requires_image FROM question_bank WHERE id = $1',
      [questionId]
    );

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const { requires_image } = questionCheck.rows[0];
    const image_answer_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate image requirement
    if (requires_image && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'This question requires an image submission'
      });
    }

    // Rest of the validation
    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'Question ID is required'
      });
    }

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
    // Get all participants
    const participants = await pool.query(
      "SELECT username FROM users WHERE role = 'participant'"
    );

    const results = [];
    for (const participant of participants.rows) {
      const { username } = participant;

      // Get score and time details
      const query = `
        WITH first_submission AS (
          SELECT MIN(submitted_at) as start_time
          FROM user_answers_${username}
          WHERE is_accepted = true
        ),
        last_submission AS (
          SELECT MAX(submitted_at) as end_time
          FROM user_answers_${username}
          WHERE is_accepted = true
        ),
        score_details AS (
          SELECT 
            COUNT(*) FILTER (WHERE qb.is_bonus = false AND ua.is_accepted = true) as normal_solved,
            COUNT(*) FILTER (WHERE qb.is_bonus = true AND ua.is_accepted = true) as bonus_solved,
            SUM(qb.points) FILTER (WHERE ua.is_accepted = true) as total_points
          FROM user_answers_${username} ua
          JOIN question_bank qb ON ua.question_id = qb.id
        )
        SELECT 
          sd.*,
          fs.start_time,
          ls.end_time,
          EXTRACT(EPOCH FROM (ls.end_time - fs.start_time))/60 as total_minutes,
          TO_CHAR(ls.end_time, 'DD-MM-YYYY HH24:MI:SS') as last_submission_time
        FROM score_details sd, first_submission fs, last_submission ls;
      `;

      const { rows } = await pool.query(query);
      
      if (rows.length > 0) {
        const result = rows[0];
        results.push({
          username,
          normal_solved: parseInt(result.normal_solved),
          bonus_solved: parseInt(result.bonus_solved),
          total_points: parseInt(result.total_points),
          total_time: Math.round(parseFloat(result.total_minutes)),
          last_submission_time: result.last_submission_time
        });
      }
    }

    results.sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return a.total_time - b.total_time;
    });

    res.json({
      success: true,
      results,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error getting team results:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};