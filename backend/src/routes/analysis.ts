import { Router, Request, Response } from 'express';
import { AnalysisResult, AnalysisResponse, ANALYSIS_FUNCTION_SCHEMA } from '../../../shared/types';
import { analyzeSessionWithOpenAI } from '../services/openaiService';

const router = Router();

// POST /api/analysis/session - Analyze a single session
router.post('/session', async (req: Request, res: Response<AnalysisResponse>) => {
  try {
    const { session_id, messages } = req.body;
    
    if (!session_id || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'session_id and messages array are required'
      });
    }
    
    const analysis = await analyzeSessionWithOpenAI(session_id, messages);
    
    res.json({
      success: true,
      data: [analysis],
      token_usage: analysis.token_usage
    });
  } catch (error) {
    console.error('Error analyzing session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/analysis/batch - Analyze multiple sessions
router.post('/batch', async (req: Request, res: Response<AnalysisResponse>) => {
  try {
    const { sessions } = req.body;
    
    if (!sessions || !Array.isArray(sessions)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'sessions array is required'
      });
    }
    
    const analyses: AnalysisResult[] = [];
    let totalTokenUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cost: 0
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
    
    res.json({
      success: true,
      data: analyses,
      token_usage: totalTokenUsage
    });
  } catch (error) {
    console.error('Error analyzing sessions batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as analysisRouter }; 