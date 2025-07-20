import { Router, Request, Response } from 'express';
import { createKoreApiService, KoreApiConfig } from '../services/koreApiService';
import { configManager } from '../utils/configManager';

const router = Router();

// GET /api/kore/test - Test Kore.ai API connectivity
router.get('/test', async (req: Request, res: Response) => {
  try {
    let config: KoreApiConfig;
    let botName = 'Unknown';

    try {
      // First try to load from config file
      const koreConfig = configManager.getKoreConfig();
      config = {
        botId: koreConfig.bot_id,
        clientId: koreConfig.client_id,
        clientSecret: koreConfig.client_secret,
        baseUrl: koreConfig.base_url
      };
      botName = koreConfig.name;
    } catch (error) {
      // Fall back to environment variables
      const botId = process.env.KORE_BOT_ID;
      const clientId = process.env.KORE_CLIENT_ID;
      const clientSecret = process.env.KORE_CLIENT_SECRET;
      const baseUrl = process.env.KORE_BASE_URL;

      if (!botId || !clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          error: 'Missing Kore.ai credentials',
          message: 'Please set up credentials in backend/config/optum-bot.yaml or set KORE_BOT_ID, KORE_CLIENT_ID, and KORE_CLIENT_SECRET environment variables'
        });
      }

      config = {
        botId,
        clientId,
        clientSecret,
        ...(baseUrl && { baseUrl })
      };
    }

    const koreService = createKoreApiService(config);
    
    // Test with a small date range (last hour)
    const dateFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dateTo = new Date().toISOString();

    console.log('Testing Kore.ai API connectivity...');
    const sessions = await koreService.getSessions(dateFrom, dateTo, 0, 10);

    res.json({
      success: true,
      message: `Kore.ai API connection successful for ${botName}`,
      data: {
        bot_name: botName,
        sessions_count: sessions.length,
        sample_session: sessions.length > 0 ? sessions[0] : null,
        date_range: { dateFrom, dateTo }
      }
    });
  } catch (error) {
    console.error('Kore.ai API test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Kore.ai API test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/kore/sessions - Get sessions from Kore.ai API directly
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    let config: KoreApiConfig;
    let botName = 'Unknown';

    try {
      // First try to load from config file
      const koreConfig = configManager.getKoreConfig();
      config = {
        botId: koreConfig.bot_id,
        clientId: koreConfig.client_id,
        clientSecret: koreConfig.client_secret,
        baseUrl: koreConfig.base_url
      };
      botName = koreConfig.name;
    } catch (error) {
      // Fall back to environment variables
      const botId = process.env.KORE_BOT_ID;
      const clientId = process.env.KORE_CLIENT_ID;
      const clientSecret = process.env.KORE_CLIENT_SECRET;
      const baseUrl = process.env.KORE_BASE_URL;

      if (!botId || !clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          error: 'Missing Kore.ai credentials',
          message: 'Please set up credentials in backend/config/optum-bot.yaml or set KORE_BOT_ID, KORE_CLIENT_ID, and KORE_CLIENT_SECRET environment variables'
        });
      }

      config = {
        botId,
        clientId,
        clientSecret,
        ...(baseUrl && { baseUrl })
      };
    }

    const koreService = createKoreApiService(config);
    
    const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = req.query.dateTo as string || new Date().toISOString();
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 50;

    console.log(`Fetching Kore.ai sessions from ${dateFrom} to ${dateTo} for ${botName}`);
    const sessions = await koreService.getSessions(dateFrom, dateTo, skip, limit);

    res.json({
      success: true,
      data: sessions,
      total_count: sessions.length,
      has_more: false,
      date_range: { dateFrom, dateTo },
      bot_name: botName
    });
  } catch (error) {
    console.error('Error fetching Kore.ai sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Kore.ai sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/kore/sessions/:sessionId - Get specific session from Kore.ai API
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    let config: KoreApiConfig;
    let botName = 'Unknown';

    try {
      // First try to load from config file
      const koreConfig = configManager.getKoreConfig();
      config = {
        botId: koreConfig.bot_id,
        clientId: koreConfig.client_id,
        clientSecret: koreConfig.client_secret,
        baseUrl: koreConfig.base_url
      };
      botName = koreConfig.name;
    } catch (error) {
      // Fall back to environment variables
      const botId = process.env.KORE_BOT_ID;
      const clientId = process.env.KORE_CLIENT_ID;
      const clientSecret = process.env.KORE_CLIENT_SECRET;
      const baseUrl = process.env.KORE_BASE_URL;

      if (!botId || !clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          error: 'Missing Kore.ai credentials',
          message: 'Please set up credentials in backend/config/optum-bot.yaml or set KORE_BOT_ID, KORE_CLIENT_ID, and KORE_CLIENT_SECRET environment variables'
        });
      }

      config = {
        botId,
        clientId,
        clientSecret,
        ...(baseUrl && { baseUrl })
      };
    }

    const koreService = createKoreApiService(config);
    
    console.log(`Fetching Kore.ai session: ${sessionId} for ${botName}`);
    const session = await koreService.getSessionById(sessionId as string);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        message: `Session with ID ${sessionId} not found in ${botName}`
      });
    }

    res.json({
      success: true,
      data: session,
      bot_name: botName
    });
  } catch (error) {
    console.error('Error fetching Kore.ai session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Kore.ai session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/kore/messages - Get conversation messages from Kore.ai API
router.get('/messages', async (req: Request, res: Response) => {
  try {
    let config: KoreApiConfig;
    let botName = 'Unknown';

    try {
      // First try to load from config file
      const koreConfig = configManager.getKoreConfig();
      config = {
        botId: koreConfig.bot_id,
        clientId: koreConfig.client_id,
        clientSecret: koreConfig.client_secret,
        baseUrl: koreConfig.base_url
      };
      botName = koreConfig.name;
    } catch (error) {
      // Fall back to environment variables
      const botId = process.env.KORE_BOT_ID;
      const clientId = process.env.KORE_CLIENT_ID;
      const clientSecret = process.env.KORE_CLIENT_SECRET;
      const baseUrl = process.env.KORE_BASE_URL;

      if (!botId || !clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          error: 'Missing Kore.ai credentials',
          message: 'Please set up credentials in backend/config/optum-bot.yaml or set KORE_BOT_ID, KORE_CLIENT_ID, and KORE_CLIENT_SECRET environment variables'
        });
      }

      config = {
        botId,
        clientId,
        clientSecret,
        ...(baseUrl && { baseUrl })
      };
    }

    const koreService = createKoreApiService(config);
    
    const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = req.query.dateTo as string || new Date().toISOString();
    const sessionIds = req.query.sessionIds as string ? (req.query.sessionIds as string).split(',') : undefined;

    console.log(`Fetching Kore.ai conversation messages from ${dateFrom} to ${dateTo} for ${botName}`);
    if (sessionIds) {
      console.log(`Filtering by ${sessionIds.length} session IDs: ${sessionIds.join(', ')}`);
    }

    const messages = await koreService.getMessages(dateFrom, dateTo, sessionIds);

    res.json({
      success: true,
      data: messages,
      total_count: messages.length,
      date_range: { dateFrom, dateTo },
      session_ids: sessionIds,
      bot_name: botName
    });
  } catch (error) {
    console.error('Error fetching Kore.ai conversation messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Kore.ai conversation messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/kore/sessions/:sessionId/messages - Get conversation messages for specific session
router.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    let config: KoreApiConfig;
    let botName = 'Unknown';

    try {
      // First try to load from config file
      const koreConfig = configManager.getKoreConfig();
      config = {
        botId: koreConfig.bot_id,
        clientId: koreConfig.client_id,
        clientSecret: koreConfig.client_secret,
        baseUrl: koreConfig.base_url
      };
      botName = koreConfig.name;
    } catch (error) {
      // Fall back to environment variables
      const botId = process.env.KORE_BOT_ID;
      const clientId = process.env.KORE_CLIENT_ID;
      const clientSecret = process.env.KORE_CLIENT_SECRET;
      const baseUrl = process.env.KORE_BASE_URL;

      if (!botId || !clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          error: 'Missing Kore.ai credentials',
          message: 'Please set up credentials in backend/config/optum-bot.yaml or set KORE_BOT_ID, KORE_CLIENT_ID, and KORE_CLIENT_SECRET environment variables'
        });
      }

      config = {
        botId,
        clientId,
        clientSecret,
        ...(baseUrl && { baseUrl })
      };
    }

    const koreService = createKoreApiService(config);
    
    console.log(`Fetching conversation messages for session: ${sessionId} in ${botName}`);
    const messages = await koreService.getSessionMessages(sessionId as string);

    res.json({
      success: true,
      data: messages,
      total_count: messages.length,
      session_id: sessionId,
      bot_name: botName
    });
  } catch (error) {
    console.error('Error fetching session conversation messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session conversation messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/kore/transcript - Get conversation transcript with session context
router.get('/transcript', async (req: Request, res: Response) => {
  try {
    let config: KoreApiConfig;
    let botName = 'Unknown';

    try {
      // First try to load from config file
      const koreConfig = configManager.getKoreConfig();
      config = {
        botId: koreConfig.bot_id,
        clientId: koreConfig.client_id,
        clientSecret: koreConfig.client_secret,
        baseUrl: koreConfig.base_url
      };
      botName = koreConfig.name;
    } catch (error) {
      // Fall back to environment variables
      const botId = process.env.KORE_BOT_ID;
      const clientId = process.env.KORE_CLIENT_ID;
      const clientSecret = process.env.KORE_CLIENT_SECRET;
      const baseUrl = process.env.KORE_BASE_URL;

      if (!botId || !clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          error: 'Missing Kore.ai credentials',
          message: 'Please set up credentials in backend/config/optum-bot.yaml or set KORE_BOT_ID, KORE_CLIENT_ID, and KORE_CLIENT_SECRET environment variables'
        });
      }

      config = {
        botId,
        clientId,
        clientSecret,
        ...(baseUrl && { baseUrl })
      };
    }

    const koreService = createKoreApiService(config);
    
    const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = req.query.dateTo as string || new Date().toISOString();
    const sessionIds = req.query.sessionIds as string ? (req.query.sessionIds as string).split(',') : undefined;

    console.log(`Fetching conversation transcript from ${dateFrom} to ${dateTo} for ${botName}`);
    if (sessionIds) {
      console.log(`Filtering by ${sessionIds.length} session IDs: ${sessionIds.join(', ')}`);
    }

    // Get both sessions and messages
    const [sessions, messages] = await Promise.all([
      koreService.getSessions(dateFrom, dateTo, 0, 1000),
      koreService.getMessages(dateFrom, dateTo, sessionIds)
    ]);

    // Group messages by session
    const messagesBySession = messages.reduce((acc: any, message: any) => {
      // For now, we'll group all messages together since we don't have sessionId in converted messages
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
      messages: messagesBySession['all'] || [] // All messages for now
    }));

    res.json({
      success: true,
      data: transcript,
      total_sessions: transcript.length,
      total_messages: messages.length,
      date_range: { dateFrom, dateTo },
      session_ids: sessionIds,
      bot_name: botName
    });
  } catch (error) {
    console.error('Error fetching conversation transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation transcript',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as koreRouter }; 