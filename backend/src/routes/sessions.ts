import { Router, Request, Response } from 'express';
import { SessionWithTranscript, SessionsResponse, SessionFilters } from '../../../shared/types';
import { generateMockSessions } from '../services/mockDataService';

const router = Router();

// GET /api/sessions - Get sessions with optional filtering
router.get('/', async (req: Request, res: Response<SessionsResponse>) => {
  try {
    const filters: SessionFilters = {
      start_date: req.query.start_date as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: req.query.end_date as string || new Date().toISOString(),
      bot_id: req.query.bot_id as string,
      containment_type: req.query.containment_type as string,
      limit: parseInt(req.query.limit as string) || 50,
      skip: parseInt(req.query.skip as string) || 0
    };

    // Generate mock sessions for now
    const sessions = generateMockSessions(filters);
    
    res.json({
      success: true,
      data: sessions,
      total_count: sessions.length,
      has_more: false
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sessions/:sessionId - Get specific session details
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Generate mock sessions and find the specific one
    const sessions = generateMockSessions({});
    const session = sessions.find(s => s.session_id === sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        message: `Session with ID ${sessionId} not found`
      });
    }
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as sessionsRouter }; 