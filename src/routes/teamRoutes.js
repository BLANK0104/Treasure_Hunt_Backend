import express from 'express';
import { 
  createTeam,
  getCurrentQuestion,
  submitAnswer,
  getTeams,
  getTeamAnswers,
  reviewAnswer,
  getTeamResults
} from '../controllers/teamController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Admin routes
router.get('/teams', authenticateToken, isAdmin, getTeams);
router.get('/teams/results', authenticateToken, isAdmin, getTeamResults);
router.get('/teams/:username/answers', authenticateToken, isAdmin, getTeamAnswers);
router.post('/teams/:username/answers/:answerId/review', authenticateToken, isAdmin, reviewAnswer);

// Participant routes
router.get('/current-question', authenticateToken, getCurrentQuestion);
router.post('/submit/:questionId', authenticateToken, upload.single('image'), submitAnswer);

export default router;