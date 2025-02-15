import express from 'express';
import { createQuestion, getAllQuestions } from '../controllers/questionController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, isAdmin, upload.single('image'), createQuestion);
router.get('/', authenticateToken, getAllQuestions);

export default router;