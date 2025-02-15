import express from 'express';
import { assignQuestion, submitAnswer, reviewAnswer } from '../controllers/teamController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/assign', authenticateToken, isAdmin, assignQuestion);
router.post('/submit/:id', authenticateToken, submitAnswer);
router.post('/review/:id', authenticateToken, isAdmin, reviewAnswer);

export default router;