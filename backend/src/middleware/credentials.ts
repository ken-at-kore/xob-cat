import { Request, Response, NextFunction } from 'express';
import { KoreApiConfig } from '../services/koreApiService';
import { configManager } from '../utils/configManager';

// Extend Express Request to include Kore credentials
declare global {
  namespace Express {
    interface Request {
      koreCredentials?: {
        config: KoreApiConfig;
        botName: string;
      };
    }
  }
}

export interface KoreCredentialsError {
  status: number;
  error: string;
  message: string;
}

/**
 * Middleware to load Kore.ai credentials and attach to request
 * This eliminates the duplicate credential loading code across all routes
 */
export function loadKoreCredentials(req: Request, res: Response, next: NextFunction): void {
  try {
    let config: KoreApiConfig;
    let botName = 'Unknown';

    // First, try to get credentials from headers (user-provided from frontend)
    const headerBotId = req.headers['x-bot-id'] as string;
    const headerClientId = req.headers['x-client-id'] as string;
    const headerClientSecret = req.headers['x-client-secret'] as string;
    const headerBaseUrl = req.headers['x-base-url'] as string;

    if (headerBotId && headerClientId && headerClientSecret) {
      // Use credentials from headers (user-provided)
      config = {
        botId: headerBotId,
        clientId: headerClientId,
        clientSecret: headerClientSecret,
        baseUrl: headerBaseUrl || 'https://bots.kore.ai'
      };
      botName = `User Bot ${headerBotId.substring(0, 8)}...`;
      console.log(`🔗 Using user-provided Kore.ai credentials: ${botName}`);
    } else {
      // Fall back to config file or environment variables
      try {
        const koreConfig = configManager.getKoreConfig();
        config = {
          botId: koreConfig.bot_id,
          clientId: koreConfig.client_id,
          clientSecret: koreConfig.client_secret,
          baseUrl: koreConfig.base_url
        };
        botName = koreConfig.name;
        console.log(`🔗 Loaded Kore.ai config from file: ${botName}`);
      } catch (configError) {
        // Final fallback to environment variables
        const botId = process.env.KORE_BOT_ID;
        const clientId = process.env.KORE_CLIENT_ID;
        const clientSecret = process.env.KORE_CLIENT_SECRET;
        const baseUrl = process.env.KORE_BASE_URL;

        if (!botId || !clientId || !clientSecret) {
          const credentialError: KoreCredentialsError = {
            status: 400,
            error: 'Missing Kore.ai credentials',
            message: 'Please provide credentials via headers (x-bot-id, x-client-id, x-client-secret) or set up credentials in backend/config/optum-bot.yaml or environment variables'
          };
          
          res.status(credentialError.status).json({
            success: false,
            error: credentialError.error,
            message: credentialError.message
          });
          return;
        }

        config = {
          botId,
          clientId,
          clientSecret,
          ...(baseUrl && { baseUrl })
        };
        botName = `Bot ${botId.substring(0, 8)}...`;
        console.log('🔗 Loaded Kore.ai config from environment variables');
      }
    }

    // Attach credentials to request object
    req.koreCredentials = {
      config,
      botName
    };

    next();
  } catch (error) {
    console.error('Error loading Kore.ai credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load Kore.ai credentials',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Helper function to get credentials from request (with type safety)
 */
export function getKoreCredentials(req: Request): { config: KoreApiConfig; botName: string } {
  if (!req.koreCredentials) {
    throw new Error('Kore.ai credentials not loaded. Ensure loadKoreCredentials middleware is applied.');
  }
  return req.koreCredentials;
}