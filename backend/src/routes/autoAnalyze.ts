import { Router, Request, Response } from 'express';
import { AutoAnalyzeService } from '../services/autoAnalyzeService';
import { AnalysisExportService } from '../services/analysisExportService';
import { AnalysisConfig, GPT_MODELS } from '../../../shared/types';
import { ApiResponse } from '../../../shared/types';

export const autoAnalyzeRouter = Router();

// Validation helpers
function validateAnalysisConfig(config: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!config.startDate) errors.push('startDate is required');
  if (!config.startTime) errors.push('startTime is required');
  if (config.sessionCount === undefined) errors.push('sessionCount is required');
  if (!config.openaiApiKey) errors.push('OpenAI API key is required');
  if (!config.modelId) errors.push('modelId is required');

  // Validate session count
  if (typeof config.sessionCount === 'number') {
    if (config.sessionCount < 5 || config.sessionCount > 1000) {
      errors.push('sessionCount must be between 5 and 1000');
    }
  } else if (config.sessionCount !== undefined) {
    errors.push('sessionCount must be a number');
  }

  // Validate date format (YYYY-MM-DD)
  if (config.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(config.startDate)) {
    errors.push('Invalid date format. Use YYYY-MM-DD');
  }

  // Validate time format (HH:MM)
  if (config.startTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(config.startTime)) {
    errors.push('Invalid time format. Use HH:MM (24-hour format)');
  }

  // Validate OpenAI API key format
  if (config.openaiApiKey && !config.openaiApiKey.startsWith('sk-')) {
    errors.push('Invalid OpenAI API key format');
  }

  // Validate date is in the past
  if (config.startDate) {
    const startDate = new Date(config.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only
    
    if (startDate >= today) {
      errors.push('Date must be in the past');
    }
  }

  // Validate model ID
  if (config.modelId) {
    const validModelIds = GPT_MODELS.map(model => model.id);
    if (!validModelIds.includes(config.modelId)) {
      errors.push(`Invalid modelId. Must be one of: ${validModelIds.join(', ')}`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

function sanitizeError(error: string): string {
  // Remove any potential sensitive information from error messages
  return error
    .replace(/sk-[a-zA-Z0-9]+/g, '[API_KEY]') // Hide API keys
    .replace(/Bearer [a-zA-Z0-9]+/g, '[TOKEN]') // Hide tokens
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .trim();
}

// Start new analysis
autoAnalyzeRouter.post('/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const config = req.body as AnalysisConfig;
    
    // Validate configuration
    const validation = validateAnalysisConfig(config);
    if (!validation.isValid) {
      const response: ApiResponse<never> = {
        success: false,
        error: validation.errors.join('; ')
      };
      res.status(400).json(response);
      return;
    }

    // Get bot credentials from session/middleware (simplified for now)
    // In a real app, this would come from authenticated session
    const botId = req.headers['x-bot-id'] as string || 'default-bot';
    const clientId = req.headers['x-client-id'] as string;
    const clientSecret = req.headers['x-client-secret'] as string;
    const jwtToken = req.headers['x-jwt-token'] as string || 'default-token';

    // Pass full credentials to service
    const credentials = clientId && clientSecret ? { clientId, clientSecret } : undefined;
    const autoAnalyzeService = AutoAnalyzeService.create(botId, jwtToken, credentials);
    const analysisId = await autoAnalyzeService.startAnalysis(config);

    const response: ApiResponse<{ analysisId: string }> = {
      success: true,
      data: { analysisId }
    };

    res.json(response);

  } catch (error: any) {
    console.error('Failed to start analysis:', error);
    
    const response: ApiResponse<never> = {
      success: false,
      error: sanitizeError(error.message || 'Failed to start analysis')
    };

    res.status(500).json(response);
  }
});

// Get analysis progress
autoAnalyzeRouter.get('/progress/:analysisId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { analysisId } = req.params;

    if (!analysisId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Analysis ID is required'
      };
      res.status(400).json(response);
      return;
    }

    // Get bot credentials (simplified)
    const botId = req.headers['x-bot-id'] as string || 'default-bot';
    const clientId = req.headers['x-client-id'] as string;
    const clientSecret = req.headers['x-client-secret'] as string;
    const jwtToken = req.headers['x-jwt-token'] as string || 'default-token';

    const credentials = clientId && clientSecret ? { clientId, clientSecret } : undefined;
    const autoAnalyzeService = AutoAnalyzeService.create(botId, jwtToken, credentials);
    const progress = await autoAnalyzeService.getProgress(analysisId);

    const response: ApiResponse<typeof progress> = {
      success: true,
      data: progress
    };

    res.json(response);

  } catch (error: any) {
    console.error(`Failed to get progress for ${req.params.analysisId}:`, error);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    const response: ApiResponse<never> = {
      success: false,
      error: sanitizeError(error.message || 'Failed to get analysis progress')
    };

    res.status(statusCode).json(response);
  }
});

// Get analysis results
autoAnalyzeRouter.get('/results/:analysisId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { analysisId } = req.params;

    if (!analysisId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Analysis ID is required'
      };
      res.status(400).json(response);
      return;
    }

    // Get bot credentials (simplified)
    const botId = req.headers['x-bot-id'] as string || 'default-bot';
    const clientId = req.headers['x-client-id'] as string;
    const clientSecret = req.headers['x-client-secret'] as string;
    const jwtToken = req.headers['x-jwt-token'] as string || 'default-token';

    const credentials = clientId && clientSecret ? { clientId, clientSecret } : undefined;
    const autoAnalyzeService = AutoAnalyzeService.create(botId, jwtToken, credentials);
    const results = await autoAnalyzeService.getResults(analysisId);

    const response: ApiResponse<typeof results> = {
      success: true,
      data: results
    };

    res.json(response);

  } catch (error: any) {
    console.error(`Failed to get results for ${req.params.analysisId}:`, error);
    
    let statusCode = 500;
    if (error.message.includes('not found')) {
      statusCode = 404;
    } else if (error.message.includes('not complete')) {
      statusCode = 400;
    }

    const response: ApiResponse<never> = {
      success: false,
      error: sanitizeError(error.message || 'Failed to get analysis results')
    };

    res.status(statusCode).json(response);
  }
});

// Cancel analysis
autoAnalyzeRouter.delete('/:analysisId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { analysisId } = req.params;

    if (!analysisId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Analysis ID is required'
      };
      res.status(400).json(response);
      return;
    }

    // Get bot credentials (simplified)
    const botId = req.headers['x-bot-id'] as string || 'default-bot';
    const clientId = req.headers['x-client-id'] as string;
    const clientSecret = req.headers['x-client-secret'] as string;
    const jwtToken = req.headers['x-jwt-token'] as string || 'default-token';

    const credentials = clientId && clientSecret ? { clientId, clientSecret } : undefined;
    const autoAnalyzeService = AutoAnalyzeService.create(botId, jwtToken, credentials);
    const cancelled = await autoAnalyzeService.cancelAnalysis(analysisId);

    const response: ApiResponse<{ cancelled: boolean }> = {
      success: true,
      data: { cancelled }
    };

    res.json(response);

  } catch (error: any) {
    console.error(`Failed to cancel analysis ${req.params.analysisId}:`, error);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    const response: ApiResponse<never> = {
      success: false,
      error: sanitizeError(error.message || 'Failed to cancel analysis')
    };

    res.status(statusCode).json(response);
  }
});

// Export analysis results
autoAnalyzeRouter.get('/export/:analysisId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { analysisId } = req.params;

    if (!analysisId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Analysis ID is required'
      };
      res.status(400).json(response);
      return;
    }

    // Get bot credentials (simplified)
    const botId = req.headers['x-bot-id'] as string || 'default-bot';
    const jwtToken = req.headers['x-jwt-token'] as string || 'default-token';

    let exportFile;
    
    // Handle mock analysis IDs
    if (analysisId.startsWith('mock-analysis-')) {
      // Load mock data from the same endpoints the frontend uses
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      // Load mock sessions (data files are in the root project directory)
      const mockSessionsPath = path.join(process.cwd(), '..', 'data', 'mock-analysis-results.json');
      
      // Check if file exists first
      try {
        await fs.access(mockSessionsPath);
      } catch (error) {
        throw new Error(`Mock data file not found: ${mockSessionsPath}`);
      }
      
      const sessionsData = await fs.readFile(mockSessionsPath, 'utf-8');
      const sessions = JSON.parse(sessionsData);
      
      // Load mock summary
      let analysisSummary = undefined;
      try {
        const mockSummaryPath = path.join(process.cwd(), '..', 'data', 'analysis-summary.json');
        const summaryData = await fs.readFile(mockSummaryPath, 'utf-8');
        analysisSummary = JSON.parse(summaryData);
      } catch (error) {
        console.warn('Failed to load mock analysis summary:', error);
      }
      
      const mockConfig: AnalysisConfig = {
        startDate: '2025-07-07',
        startTime: '09:00',
        sessionCount: sessions.length,
        openaiApiKey: '', // Already excluded
        modelId: 'gpt-4o-mini'
      };
      
      const mockResults = {
        sessions,
        analysisSummary,
        botId // Include the actual botId from request headers
      };
      
      const now = new Date().toISOString();
      exportFile = AnalysisExportService.createExportFile(
        mockResults,
        mockConfig,
        now,
        now
      );
    } else {
      // Handle real analysis IDs
      const autoAnalyzeService = AutoAnalyzeService.create(botId, jwtToken);
      
      // Get the analysis results
      const results = await autoAnalyzeService.getResults(analysisId);
      
      // Get the progress to get request timestamps
      const progress = await autoAnalyzeService.getProgress(analysisId);
      
      // Get the original analysis config
      const config = await autoAnalyzeService.getConfig(analysisId);
      
      // Remove sensitive data from config for export
      const exportConfig: AnalysisConfig = {
        ...config,
        openaiApiKey: '' // Don't include API key in export
      };

      // Create the export file
      exportFile = AnalysisExportService.createExportFile(
        results,
        exportConfig,
        progress.startTime,
        progress.endTime || new Date().toISOString()
      );
    }

    // Generate filename
    const filename = AnalysisExportService.generateFileName();

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    res.json(exportFile);

  } catch (error: any) {
    console.error(`Failed to export analysis ${req.params.analysisId}:`, error);
    
    let statusCode = 500;
    if (error.message.includes('not found')) {
      statusCode = 404;
    } else if (error.message.includes('not complete')) {
      statusCode = 400;
    }

    const response: ApiResponse<never> = {
      success: false,
      error: sanitizeError(error.message || 'Failed to export analysis')
    };

    res.status(statusCode).json(response);
  }
});

export default autoAnalyzeRouter;