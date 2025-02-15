import express from 'express';
import { 
  createTeam,
  getCurrentQuestion, 
  submitAnswer,
  getParticipantAnswers 
} from '../controllers/teamController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Initial team setup (assigns questions)
router.post('/setup', authenticateToken, createTeam);

// Question handling
router.get('/current-question', authenticateToken, getCurrentQuestion);
router.post('/submit/:questionId', authenticateToken, upload.single('image'), submitAnswer);

// Admin routes
router.get('/answers/:username', authenticateToken, isAdmin, getParticipantAnswers);

export default router;