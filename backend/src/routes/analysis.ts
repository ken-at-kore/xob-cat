import { Router, Request, Response } from 'express';
import { AnalysisResult, AnalysisResponse, ANALYSIS_FUNCTION_SCHEMA } from '../../../shared/types';
import { analyzeSessionWithOpenAI } from '../services/openaiService';
import { createSWTService } from '../services/swtService'; 
import { ServiceFactory } from '../factories/serviceFactory';
import { loadKoreCredentials, getKoreCredentials } from '../middleware/credentials';
import { successResponse, validationErrorResponse, internalServerErrorResponse } from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { autoAnalyzeRouter } from './autoAnalyze';

const router = Router();

// Helper function to parse ET date/time to UTC
function parseETDateTime(dateString: string, timeString: string): Date {
  // Parse date and time in ET timezone
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);

  // Create date assuming it's already in ET, then convert to UTC
  const etOffset = getETOffset(new Date(year!, (month! - 1), day!));
  
  // Create date in UTC by directly adjusting for ET offset
  // ET time + offset = UTC time
  const utcHours = (hours! + etOffset) % 24;
  const date = new Date(Date.UTC(year!, (month! - 1), day!, utcHours, minutes!));
  
  // Handle day rollover if needed
  if (hours! + etOffset >= 24) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
}

function getETOffset(date: Date): number {
  // Simplified ET offset calculation
  const month = date.getMonth();
  
  // Rough DST calculation (March through October)
  const isDST = month > 2 && month < 10;
  
  return isDST ? 4 : 5; // EDT is UTC-4, EST is UTC-5
}

// Apply credential loading middleware to all routes that need Kore.ai access
router.use('/sessions', loadKoreCredentials);

// GET /api/analysis/sessions - Get sessions from real Kore.ai API
router.get('/sessions', asyncHandler(async (req: Request, res: Response) => {
  const { config, botName } = getKoreCredentials(req);
  const koreApiService = ServiceFactory.createKoreApiService(config);
  const swtService = createSWTService(koreApiService);
  
  // Fix parameter mapping - use the correct query parameter names that frontend sends
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  const startTime = req.query.start_time as string;
  const endTime = req.query.end_time as string;
  const containmentType = req.query.containment_type as string;
  const limit = parseInt(req.query.limit as string) || 100;
  
  // Combine date and time parameters properly
  let dateFrom: string;
  let dateTo: string;
  
  if (startDate && startTime) {
    // Convert ET time to UTC for Kore API
    const startDateTime = parseETDateTime(startDate, startTime);
    dateFrom = startDateTime.toISOString();
  } else if (startDate) {
    // Handle both ISO string and date-only formats
    dateFrom = startDate.includes('T') ? startDate : new Date(startDate + 'T00:00:00').toISOString();
  } else {
    // Use default (last 7 days) if no start date provided  
    dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  
  if (endDate && endTime) {
    // Convert ET time to UTC for Kore API
    const endDateTime = parseETDateTime(endDate, endTime);
    dateTo = endDateTime.toISOString();
  } else if (endDate) {
    // Handle both ISO string and date-only formats
    dateTo = endDate.includes('T') ? endDate : new Date(endDate + 'T23:59:59').toISOString();
  } else {
    // Use default (current time) if no end date provided
    dateTo = new Date().toISOString();
  }
  
  console.log(`[Direct API] Fetching real Kore.ai sessions from ${dateFrom} to ${dateTo} for ${botName} (limit=${limit})`);
  console.log(`[Direct API] Using bot ID: ${config.botId}`);
  console.log(`[Direct API] Using credentials: clientId=${config.clientId?.substring(0, 8)}..., clientSecret=${config.clientSecret?.substring(0, 8)}...`);
  
  const result = await swtService.generateSWTs({
    dateFrom,
    dateTo, 
    limit
  });
  
  successResponse(
    res,
    result.swts,
    `Found ${result.swts.length} sessions from ${botName}`,
    {
      total_count: result.swts.length,
      bot_name: botName,
      date_range: { dateFrom, dateTo },
      generation_stats: {
        total_sessions: result.totalSessions,
        total_messages: result.totalMessages,
        sessions_with_messages: result.sessionsWithMessages,
        generation_time: result.generationTime
      }
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


// Debug endpoint to test service creation differences
router.get('/debug/service-comparison', loadKoreCredentials, asyncHandler(async (req: Request, res: Response) => {
  const { config, botName } = getKoreCredentials(req);
  
  console.log('\n=== DEBUG: Service Comparison ===');
  console.log('Session Viewer Service Creation:');
  console.log(`  Config: ${JSON.stringify(config, null, 2)}`);
  console.log(`  Bot Name: ${botName}`);
  
  // Create session viewer service (same as used by /sessions endpoint)
  const sessionViewerKoreService = ServiceFactory.createKoreApiService(config);
  console.log(`  Created service: ${sessionViewerKoreService.constructor.name}`);
  console.log(`  isMockCredentials: ${(sessionViewerKoreService as any).isMockCredentials?.()}`);
  
  // Simulate auto-analyze service creation
  console.log('\nAuto-Analyze Service Creation:');
  const credentials = config.clientId && config.clientSecret ? { 
    clientId: config.clientId, 
    clientSecret: config.clientSecret 
  } : undefined;
  
  const autoAnalyzeKoreConfig = {
    botId: config.botId,
    clientId: credentials?.clientId || 'mock-client-id',
    clientSecret: credentials?.clientSecret || 'mock-client-secret',
    baseUrl: 'https://bots.kore.ai'
  };
  
  console.log(`  AutoAnalyze Config: ${JSON.stringify(autoAnalyzeKoreConfig, null, 2)}`);
  console.log(`  Has credentials: ${!!credentials}`);
  
  const autoAnalyzeService = ServiceFactory.createKoreApiService(autoAnalyzeKoreConfig);
  console.log(`  Created service: ${autoAnalyzeService.constructor.name}`);
  console.log(`  isMockCredentials: ${(autoAnalyzeService as any).isMockCredentials?.()}`);
  
  // Test getSessionsMetadata with both services
  const testOptions = {
    dateFrom: '2025-08-01T13:00:00.000Z',  
    dateTo: '2025-08-01T16:00:00.000Z',
    limit: 10
  };
  
  console.log('\nTesting getSessionsMetadata with both services:');
  
  try {
    console.log('Session Viewer Service:');
    const sessionViewerResult = await sessionViewerKoreService.getSessionsMetadata(testOptions);
    console.log(`  Found ${sessionViewerResult.length} sessions`);
    
    console.log('Auto-Analyze Service:');
    const autoAnalyzeResult = await autoAnalyzeService.getSessionsMetadata(testOptions);
    console.log(`  Found ${autoAnalyzeResult.length} sessions`);
    
    res.json({
      success: true,
      data: {
        sessionViewerSessions: sessionViewerResult.length,
        autoAnalyzeSessions: autoAnalyzeResult.length,
        serviceTypes: {
          sessionViewer: sessionViewerKoreService.constructor.name,
          autoAnalyze: autoAnalyzeService.constructor.name
        }
      }
    });
    
  } catch (error) {
    console.error('Error in service comparison:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
}));

// Mount auto-analyze routes
router.use('/auto-analyze', autoAnalyzeRouter);

export { router as analysisRouter }; 