import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeTables } from './db/init.js';
import userRoutes from './routes/userRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

// Configure CORS
const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
}, express.static(join(__dirname, '../uploads')));

// Initialize database tables
initializeTables();

// Routes
app.use('/api/users', userRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api', teamRoutes); // Single route definition for team routes

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});