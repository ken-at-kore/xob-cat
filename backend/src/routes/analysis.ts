import { Router, Request, Response } from 'express';
import { AnalysisResult, AnalysisResponse, ANALYSIS_FUNCTION_SCHEMA } from '../../../shared/types';
import { analyzeSessionWithOpenAI } from '../services/openaiService';
import { getSessions } from '../services/mockDataService';
import { successResponse, validationErrorResponse, internalServerErrorResponse } from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/analysis/sessions - Get sessions (with mock data fallback)
router.get('/sessions', asyncHandler(async (req: Request, res: Response) => {
  const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = req.query.dateTo as string || new Date().toISOString();
  const limit = parseInt(req.query.limit as string) || 100;
  
  const filters = {
    start_date: dateFrom,
    end_date: dateTo,
    limit
  };
  
  console.log(`Fetching sessions with filters:`, filters);
  const sessions = await getSessions(filters);
  
  successResponse(
    res,
    sessions,
    `Found ${sessions.length} sessions`,
    {
      total_count: sessions.length,
      date_range: { dateFrom, dateTo }
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

export { router as analysisRouter }; 