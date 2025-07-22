import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { analysisRouter } from './routes/analysis';
import { koreRouter } from './routes/kore';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { successResponse } from './utils/apiResponse';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint with standardized response
app.get('/health', (req, res) => {
  successResponse(res, {
    status: 'ok',
    service: 'XOB CAT Backend API',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  }, 'Service is healthy');
});

// API routes
app.use('/api/analysis', analysisRouter);
app.use('/api/kore', koreRouter);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handling middleware (must be last)
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`🚀 XOB CAT Backend API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
}); 