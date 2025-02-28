import express from 'express';
import { createQuestion, getAllQuestions, updateQuestion, deleteQuestion } from '../controllers/questionController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, isAdmin, upload.single('image'), createQuestion);
router.get('/', authenticateToken, getAllQuestions);
router.put('/:id', authenticateToken, isAdmin, upload.single('image'), updateQuestion);
router.delete('/:id', authenticateToken, isAdmin, deleteQuestion);

export default router;