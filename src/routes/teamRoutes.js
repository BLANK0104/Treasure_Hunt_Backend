import express from 'express';
import { getSubmissions, reviewAnswer, getResults } from '../controllers/teamController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/submissions', authenticateToken, isAdmin, getSubmissions);
router.post('/review/:id', authenticateToken, isAdmin, reviewAnswer);
router.get('/results', authenticateToken, isAdmin, getResults);

export default router;