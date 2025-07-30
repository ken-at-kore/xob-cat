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

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-bot-id',
    'x-client-id', 
    'x-client-secret',
    'x-base-url'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  successResponse(res, {
    service: 'XOB CAT Backend API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development'
  }, 'XOB CAT Backend API is running');
});

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

export default app;