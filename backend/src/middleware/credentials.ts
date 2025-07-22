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
      console.log(`🔗 Loaded Kore.ai config from file: ${botName}`);
    } catch (configError) {
      // Fall back to environment variables
      const botId = process.env.KORE_BOT_ID;
      const clientId = process.env.KORE_CLIENT_ID;
      const clientSecret = process.env.KORE_CLIENT_SECRET;
      const baseUrl = process.env.KORE_BASE_URL;

      if (!botId || !clientId || !clientSecret) {
        const credentialError: KoreCredentialsError = {
          status: 400,
          error: 'Missing Kore.ai credentials',
          message: 'Please set up credentials in backend/config/optum-bot.yaml or set KORE_BOT_ID, KORE_CLIENT_ID, and KORE_CLIENT_SECRET environment variables'
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