import express from 'express';
import { createQuestion, getAllQuestions } from '../controllers/questionController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, isAdmin, createQuestion);
router.get('/', authenticateToken, getAllQuestions);

export default router;