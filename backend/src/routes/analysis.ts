import { Router, Request, Response } from 'express';
import { AnalysisResult, AnalysisResponse, ANALYSIS_FUNCTION_SCHEMA } from '../../../shared/types';
import { analyzeSessionWithOpenAI } from '../services/openaiService';
import { getSessions } from '../services/mockDataService';
import { successResponse, validationErrorResponse, internalServerErrorResponse } from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { autoAnalyzeRouter } from './autoAnalyze';

const router = Router();

// GET /api/analysis/sessions - Get sessions (with mock data fallback)
router.get('/sessions', asyncHandler(async (req: Request, res: Response) => {
  // Fix parameter mapping - use the correct query parameter names that frontend sends
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  const startTime = req.query.start_time as string;
  const endTime = req.query.end_time as string;
  const containmentType = req.query.containment_type as string;
  const botId = req.query.bot_id as string;
  const limit = parseInt(req.query.limit as string) || 100;
  const skip = parseInt(req.query.skip as string) || 0;
  
  // Build filters object with all supported parameters
  const filters: any = {
    limit,
    skip
  };
  
  if (startDate) filters.start_date = startDate;
  if (endDate) filters.end_date = endDate;
  if (startTime) filters.start_time = startTime;
  if (endTime) filters.end_time = endTime;
  if (containmentType) filters.containment_type = containmentType;
  if (botId) filters.bot_id = botId;
  
  console.log(`Fetching sessions with filters:`, filters);
  const sessions = await getSessions(filters);
  
  successResponse(
    res,
    sessions,
    `Found ${sessions.length} sessions`,
    {
      total_count: sessions.length,
      filters_applied: filters
    }
  );
}));

// POST /api/analysis/session - Analyze a single session
router.post('/session', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { session_id, messages } = req.body;
  
  if (!session_id || !messages || !Array.isArray(messages)) {
    validationErrorResponse(res, 'session_id and messages array are required');
    return;
  }
  
  const analysis = await analyzeSessionWithOpenAI(session_id, messages);
  
  const responseData = {
    analyses: [analysis],
    ...(analysis.token_usage && {
      token_usage: {
        ...analysis.token_usage,
        timestamp: new Date().toISOString()
      }
    })
  };
  
  successResponse(res, responseData, 'Session analysis completed');
}));

// POST /api/analysis/batch - Analyze multiple sessions
router.post('/batch', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessions } = req.body;
  
  if (!sessions || !Array.isArray(sessions)) {
    validationErrorResponse(res, 'sessions array is required');
    return;
  }
  
  const analyses: AnalysisResult[] = [];
  let totalTokenUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost: 0,
    timestamp: new Date().toISOString()
  };
  
  // Analyze each session
  for (const session of sessions) {
    try {
      const analysis = await analyzeSessionWithOpenAI(session.session_id, session.messages);
      analyses.push(analysis);
      
      if (analysis.token_usage) {
        totalTokenUsage.prompt_tokens += analysis.token_usage.prompt_tokens;
        totalTokenUsage.completion_tokens += analysis.token_usage.completion_tokens;
        totalTokenUsage.total_tokens += analysis.token_usage.total_tokens;
        totalTokenUsage.cost += analysis.token_usage.cost;
      }
    } catch (error) {
      console.error(`Error analyzing session ${session.session_id}:`, error);
      // Continue with other sessions even if one fails
    }
  }
  
  const responseData = {
    analyses,
    token_usage: totalTokenUsage
  };
  
  successResponse(res, responseData, `Analyzed ${analyses.length} sessions`);
}));

// Mount auto-analyze routes
router.use('/auto-analyze', autoAnalyzeRouter);

export { router as analysisRouter }; 