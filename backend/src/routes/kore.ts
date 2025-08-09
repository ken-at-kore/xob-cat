import { Router, Request, Response } from 'express';
import { createKoreApiService } from '../services/koreApiService';
import { createSWTService } from '../services/swtService';
import { ServiceFactory } from '../factories/serviceFactory';
import { loadKoreCredentials, getKoreCredentials } from '../middleware/credentials';
import { successResponse, errorResponse, notFoundResponse, validationErrorResponse } from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Apply credential loading middleware to all routes
router.use(loadKoreCredentials);

// GET /api/kore/test - Test Kore.ai API connectivity
router.get('/test', asyncHandler(async (req: Request, res: Response) => {
  const { config, botName } = getKoreCredentials(req);
  const koreService = createKoreApiService(config);
  
  // OPTIMIZED: Test with 1 minute window (was 60 minutes)
  const dateFrom = new Date(Date.now() - 60 * 1000).toISOString();
  const dateTo = new Date().toISOString();

  console.log('Testing Kore.ai API connectivity with optimized connection test...');
  
  try {
    // OPTIMIZED: Use single API call with timeout for fastest connection testing
    // This will throw an error if authentication fails
    const sessionMetadata = await koreService.getSessionsMetadataForConnectionTest({
      dateFrom,
      dateTo,
      limit: 1,        // OPTIMIZED: Only need 1 session for connection test (was 10)
      timeout: 10000   // OPTIMIZED: 10-second timeout for fast failure
    });

    // If we get here, authentication worked
    return successResponse(res, {
      bot_name: botName,
      sessions_count: sessionMetadata.length,
      sample_session: sessionMetadata.length > 0 ? sessionMetadata[0] : null,
      date_range: { dateFrom, dateTo }
    }, `Kore.ai API connection successful for ${botName}`);
  } catch (error) {
    console.error('Kore.ai API connection test failed:', error);
    
    // Check if it's an authentication error (401)
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      if (axiosError.response?.status === 401) {
        return errorResponse(res, 'Invalid Kore.ai credentials', 'The provided Bot ID, Client ID, or Client Secret is invalid.', 401, {
          details: 'The provided Bot ID, Client ID, or Client Secret is invalid.',
          code: 'INVALID_CREDENTIALS'
        });
      }
    }
    
    // Other errors
    return errorResponse(res, 'Failed to connect to Kore.ai API', 'Unable to establish connection with Kore.ai API', 500, {
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'CONNECTION_FAILED'
    });
  }
}));

// GET /api/kore/sessions - Get sessions from Kore.ai API directly
router.get('/sessions', asyncHandler(async (req: Request, res: Response) => {
  const { config, botName } = getKoreCredentials(req);
  const koreService = createKoreApiService(config);
  
  const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = req.query.dateTo as string || new Date().toISOString();
  const skip = parseInt(req.query.skip as string) || 0;
  const limit = parseInt(req.query.limit as string) || 50;

  console.log(`Fetching Kore.ai sessions with messages from ${dateFrom} to ${dateTo} for ${botName}`);
  // Use the optimized layered architecture: fetch metadata first, then messages
  const sessionData = await koreService.getSessionsWithMessages({
    dateFrom,
    dateTo,
    skip,
    limit
  });
  
  // Convert KoreSessionComplete[] to the expected format for the route
  const sessions = sessionData.map(session => ({
    session_id: session.sessionId,
    user_id: session.userId,
    start_time: session.start_time,
    end_time: session.end_time,
    containment_type: session.containment_type,
    tags: session.tags || [],
    messages: session.messages?.map(msg => ({
      timestamp: msg.createdOn,
      message_type: msg.type === 'incoming' ? 'user' : 'bot',
      message: msg.components?.[0]?.data?.text || ''
    })) || [],
    duration_seconds: Math.floor((new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 1000),
    message_count: session.message_count,
    user_message_count: session.user_message_count,
    bot_message_count: session.bot_message_count
  }));

  successResponse(
    res,
    sessions,
    `Found ${sessions.length} sessions`,
    {
      total_count: sessions.length,
      has_more: false,
      date_range: { dateFrom, dateTo },
      bot_name: botName
    }
  );
}));

// GET /api/kore/sessions/:sessionId - Get specific session from Kore.ai API
router.get('/sessions/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    validationErrorResponse(res, 'Session ID is required');
    return;
  }
  
  const { config, botName } = getKoreCredentials(req);
  const koreService = createKoreApiService(config);
  
  console.log(`Fetching Kore.ai session: ${sessionId} for ${botName}`);
  const session = await koreService.getSessionById(sessionId);

  if (!session) {
    notFoundResponse(res, 'Session', sessionId);
    return;
  }

  successResponse(
    res,
    session,
    `Session found in ${botName}`,
    { bot_name: botName }
  );
}));

// GET /api/kore/messages - Get conversation messages from Kore.ai API
router.get('/messages', asyncHandler(async (req: Request, res: Response) => {
  const { config, botName } = getKoreCredentials(req);
  const koreService = createKoreApiService(config);
  
  const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = req.query.dateTo as string || new Date().toISOString();
  const sessionIds = req.query.sessionIds as string ? (req.query.sessionIds as string).split(',') : undefined;

  console.log(`Fetching Kore.ai conversation messages from ${dateFrom} to ${dateTo} for ${botName}`);
  const messages = await koreService.getMessages(dateFrom, dateTo, sessionIds);

  successResponse(
    res,
    messages,
    `Found ${messages.length} messages`,
    {
      total_count: messages.length,
      date_range: { dateFrom, dateTo },
      session_ids: sessionIds,
      bot_name: botName
    }
  );
}));

// GET /api/kore/sessions/:sessionId/messages - Get conversation messages for specific session
router.get('/sessions/:sessionId/messages', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    validationErrorResponse(res, 'Session ID is required');
    return;
  }
  
  const { config, botName } = getKoreCredentials(req);
  const koreService = createKoreApiService(config);
  
  console.log(`Fetching conversation messages for session: ${sessionId} in ${botName}`);
  const messages = await koreService.getSessionMessages(sessionId);

  successResponse(
    res,
    messages,
    `Found ${messages.length} messages for session`,
    {
      total_count: messages.length,
      session_id: sessionId,
      bot_name: botName
    }
  );
}));

// GET /api/kore/transcript - Get conversation transcript with session context
router.get('/transcript', asyncHandler(async (req: Request, res: Response) => {
  const { config, botName } = getKoreCredentials(req);
  const koreService = createKoreApiService(config);
  
  const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = req.query.dateTo as string || new Date().toISOString();
  const sessionIds = req.query.sessionIds as string ? (req.query.sessionIds as string).split(',') : undefined;

  console.log(`Fetching conversation transcript from ${dateFrom} to ${dateTo} for ${botName}`);

  // Get both sessions and messages
  const [sessions, messages] = await Promise.all([
    koreService.getSessions(dateFrom, dateTo, 0, 1000),
    koreService.getMessages(dateFrom, dateTo, sessionIds)
  ]);

  // Group messages by session
  const messagesBySession = messages.reduce((acc: any, message: any) => {
    const sessionId = 'all';
    if (!acc[sessionId]) {
      acc[sessionId] = [];
    }
    acc[sessionId].push(message);
    return acc;
  }, {});

  // Create transcript with session context
  const transcript = sessions.map(session => ({
    session_id: session.session_id,
    user_id: session.user_id,
    start_time: session.start_time,
    end_time: session.end_time,
    containment_type: session.containment_type,
    duration_seconds: session.duration_seconds,
    message_count: session.message_count,
    messages: messagesBySession['all'] || []
  }));

  successResponse(
    res,
    transcript,
    `Generated transcript with ${transcript.length} sessions`,
    {
      total_sessions: transcript.length,
      total_messages: messages.length,
      date_range: { dateFrom, dateTo },
      session_ids: sessionIds,
      bot_name: botName
    }
  );
}));

// GET /api/kore/swts - Generate Sessions With Transcripts (SWTs)
router.get('/swts', asyncHandler(async (req: Request, res: Response) => {
  const { config, botName } = getKoreCredentials(req);
  const koreApiService = ServiceFactory.createKoreApiService(config);
  const swtService = createSWTService(koreApiService);
  
  const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = req.query.dateTo as string || new Date().toISOString();
  const limit = parseInt(req.query.limit as string) || 100;
  const sessionIds = req.query.sessionIds as string ? (req.query.sessionIds as string).split(',') : undefined;

  console.log(`Generating SWTs from ${dateFrom} to ${dateTo} for ${botName} (limit=${limit})`);

  let result;
  if (sessionIds && sessionIds.length > 0) {
    result = await swtService.generateSWTsForSessions(sessionIds);
  } else {
    result = await swtService.generateSWTs({
      dateFrom,
      dateTo,
      limit
    });
  }

  const summary = swtService.getSWTSummary(result.swts);

  successResponse(
    res,
    {
      swts: result.swts,
      summary,
      generation_stats: {
        total_sessions: result.totalSessions,
        total_messages: result.totalMessages,
        sessions_with_messages: result.sessionsWithMessages,
        generation_time_ms: result.generationTime
      }
    },
    `Generated ${result.swts.length} SWTs`,
    {
      date_range: { dateFrom, dateTo },
      session_ids: sessionIds,
      bot_name: botName
    }
  );
}));

// GET /api/kore/swts/:sessionId - Generate SWT for specific session
router.get('/swts/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    validationErrorResponse(res, 'Session ID is required');
    return;
  }
  
  const { config, botName } = getKoreCredentials(req);
  const koreApiService = ServiceFactory.createKoreApiService(config);
  const swtService = createSWTService(koreApiService);
  
  console.log(`Generating SWT for session: ${sessionId} in ${botName}`);
  const swt = await swtService.generateSWTForSession(sessionId);

  if (!swt) {
    notFoundResponse(res, 'Session', sessionId);
    return;
  }

  const conversationSummary = swtService.getSWTSummary([swt]);

  successResponse(
    res,
    {
      swt,
      summary: conversationSummary
    },
    `Generated SWT for session in ${botName}`,
    {
      session_id: sessionId,
      bot_name: botName
    }
  );
}));

export { router as koreRouter };