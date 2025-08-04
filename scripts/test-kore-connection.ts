#!/usr/bin/env npx tsx

/**
 * Kore.ai Connection Test Utility
 * 
 * This script replicates the functionality of the /api/kore/test endpoint
 * for standalone testing of Kore.ai API credentials.
 * 
 * Usage:
 * npm run test-kore-connection -- --bot-id <BOT_ID> --client-id <CLIENT_ID> --client-secret <CLIENT_SECRET>
 * 
 * Or set environment variables:
 * KORE_BOT_ID=<BOT_ID> KORE_CLIENT_ID=<CLIENT_ID> KORE_CLIENT_SECRET=<CLIENT_SECRET> npm run test-kore-connection
 */

import { createKoreApiService, KoreApiConfig } from '../backend/src/services/koreApiService';
import { program } from 'commander';

interface TestResult {
  success: boolean;
  data?: {
    bot_name: string;
    sessions_count: number;
    sample_session: any;
    date_range: {
      dateFrom: string;
      dateTo: string;
    };
  };
  error?: string;
  message?: string;
  timestamp: string;
}

async function testKoreConnection(config: KoreApiConfig): Promise<TestResult> {
  const timestamp = new Date().toISOString();
  
  try {
    console.log('🔗 Testing Kore.ai API connectivity...');
    console.log(`📍 Bot ID: ${config.botId}`);
    console.log(`📍 Base URL: ${config.baseUrl || 'https://bots.kore.ai'}`);
    
    const koreService = createKoreApiService(config);
    
    // Test with a small date range (last hour) - same as the API endpoint
    const dateFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dateTo = new Date().toISOString();
    
    console.log(`📅 Date range: ${dateFrom} to ${dateTo}`);
    
    // Use the same method as the API endpoint
    const sessionMetadata = await koreService.getSessionsMetadata({
      dateFrom,
      dateTo,
      skip: 0,
      limit: 10
    });
    
    const botName = `Bot ${config.botId.substring(0, 8)}...`;
    
    return {
      success: true,
      data: {
        bot_name: botName,
        sessions_count: sessionMetadata.length,
        sample_session: sessionMetadata.length > 0 ? sessionMetadata[0] : null,
        date_range: { dateFrom, dateTo }
      },
      message: `Kore.ai API connection successful for ${botName}`,
      timestamp
    };
    
  } catch (error: any) {
    console.error('❌ Kore.ai API connection test failed:', error.message);
    
    // Handle authentication errors (401)
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      if (axiosError.response?.status === 401) {
        return {
          success: false,
          error: 'Invalid Kore.ai credentials',
          message: 'The provided Bot ID, Client ID, or Client Secret is invalid.',
          timestamp
        };
      }
    }
    
    return {
      success: false,
      error: 'Failed to connect to Kore.ai API',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    };
  }
}

function parseCredentials(): KoreApiConfig | null {
  // Parse command line arguments
  program
    .option('--bot-id <botId>', 'Bot ID')
    .option('--client-id <clientId>', 'Client ID')
    .option('--client-secret <clientSecret>', 'Client Secret')
    .option('--base-url <baseUrl>', 'Base URL (optional)', 'https://bots.kore.ai')
    .parse();

  const options = program.opts();
  
  // Try command line args first
  if (options.botId && options.clientId && options.clientSecret) {
    return {
      botId: options.botId,
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      baseUrl: options.baseUrl
    };
  }
  
  // Fall back to environment variables
  const botId = process.env.KORE_BOT_ID;
  const clientId = process.env.KORE_CLIENT_ID;
  const clientSecret = process.env.KORE_CLIENT_SECRET;
  const baseUrl = process.env.KORE_BASE_URL || 'https://bots.kore.ai';
  
  if (botId && clientId && clientSecret) {
    return {
      botId,
      clientId,
      clientSecret,
      baseUrl
    };
  }
  
  return null;
}

async function main() {
  console.log('🚀 Kore.ai Connection Test Utility\n');
  
  const config = parseCredentials();
  
  if (!config) {
    console.error('❌ Missing credentials. Please provide credentials via:');
    console.error('');
    console.error('Command line arguments:');
    console.error('  npm run test-kore-connection -- --bot-id <BOT_ID> --client-id <CLIENT_ID> --client-secret <CLIENT_SECRET>');
    console.error('');
    console.error('Environment variables:');
    console.error('  KORE_BOT_ID=<BOT_ID> KORE_CLIENT_ID=<CLIENT_ID> KORE_CLIENT_SECRET=<CLIENT_SECRET> npm run test-kore-connection');
    console.error('');
    process.exit(1);
  }
  
  const result = await testKoreConnection(config);
  
  console.log('\n📊 Test Result:');
  console.log('================\n');
  console.log(JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log('\n✅ Connection test successful!');
    process.exit(0);
  } else {
    console.log('\n❌ Connection test failed!');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}