#!/usr/bin/env npx tsx

/**
 * Fetch Call Recording Script
 * 
 * Retrieves call recording for a specific session from Kore.ai API
 * 
 * NOTE: This requires the "SmartAssist Recordings" API scope to be enabled for your bot.
 * If you get a 401 error with "Scope is incorrect", contact your Kore.ai administrator
 * to enable the recordings API scope for your bot.
 * 
 * Usage:
 *   npx tsx scripts/fetch-call-recording.ts
 *   npx tsx scripts/fetch-call-recording.ts --session-id <id> --user-id <id>
 *   npx tsx scripts/fetch-call-recording.ts --bot-id <id> --client-id <id> --client-secret <secret>
 *   
 * The script will automatically try multiple endpoint variations:
 * - XO Platform v2 and v1 endpoints (standard)
 * - SmartAssist-specific endpoints (various path structures)
 * - Direct media stream endpoints
 * 
 * FINDINGS:
 * - Most endpoints return "Scope is incorrect" (401), indicating the bot needs the recordings scope
 * - SmartAssist Media endpoint (getMediaStream) returns different errors (403/429), suggesting it might
 *   be the correct endpoint but needs different authentication or is rate-limited
 * - Standard JWT authentication works for session history but not for recordings
 */

import { promises as fs } from 'fs';
import path from 'path';
import axios, { AxiosResponse } from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { parseArgs } from 'util';

interface CallRecordingResponse {
  status: string;
  recording?: Array<{
    fileName: string;
    fileUrl: string;
  }>;
  message?: string;
}

interface Config {
  botId: string;
  clientId: string;
  clientSecret: string;
  sessionId: string;
  userId: string;
  baseUrl: string;
}

/**
 * Generate JWT token for Kore.ai API authentication
 * Using the same format as KoreApiService in the backend
 */
function generateJwtToken(clientId: string, clientSecret: string, botId: string): string {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: clientId,  // Issuer claim - client identification
    sub: botId,     // Subject claim - bot ID
    iat: now,
    exp: now + 3600, // 1 hour expiration
    aud: 'https://bots.kore.ai'
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  return jwt.sign(payload, clientSecret, { 
    algorithm: 'HS256',
    header 
  });
}

/**
 * Test JWT authentication with session history endpoint
 */
async function testAuthentication(config: Config): Promise<boolean> {
  const token = generateJwtToken(config.clientId, config.clientSecret, config.botId);
  
  // Test with getSessions endpoint (we know this works from the backend code)
  const testUrl = `https://bots.kore.ai/api/public/bot/${config.botId}/getSessions?containmentType=agent`;
  const testPayload = {
    dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
    dateTo: new Date().toISOString(),
    skip: 0,
    limit: 1
  };
  
  try {
    const response = await axios.post(testUrl, testPayload, {
      headers: {
        'auth': token,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Authentication test successful - credentials are valid');
    return true;
  } catch (error: any) {
    console.error('❌ Authentication test failed:', error.response?.status || error.message);
    if (error.response?.data) {
      console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Fetch call recording from Kore.ai API
 */
async function fetchCallRecording(config: Config): Promise<void> {
  console.log('🎙️  Fetching call recording...');
  console.log(`📞 Session ID: ${config.sessionId}`);
  console.log(`👤 User ID: ${config.userId}`);
  console.log(`🤖 Bot ID: ${config.botId.substring(0, 12)}...`);
  console.log(`🌐 Base URL: ${config.baseUrl}`);
  
  // Test authentication first
  console.log('\n🔐 Testing authentication with session history endpoint...');
  const authValid = await testAuthentication(config);
  if (!authValid) {
    console.error('\n❌ Authentication test failed. Please check your credentials.');
    return;
  }
  
  // Generate JWT token
  const token = generateJwtToken(config.clientId, config.clientSecret, config.botId);
  console.log('\n🔐 JWT token generated for recordings endpoint');
  
  // Try different endpoint variations
  const endpoints = [
    // Standard XO Platform endpoints
    { name: 'XO v2', url: `${config.baseUrl}/api/public/bot/${config.botId}/v2/recordings` },
    { name: 'XO v1', url: `${config.baseUrl}/api/public/bot/${config.botId}/recordings` },
    
    // SmartAssist-specific endpoints (different path structure)
    { name: 'SmartAssist v2 (bot path)', url: `https://smartassist.kore.ai/api/public/bot/${config.botId}/v2/recordings` },
    { name: 'SmartAssist v2 (account path)', url: `https://smartassist.kore.ai/api/v2/recordings` },
    { name: 'SmartAssist v2 (stream path)', url: `https://smartassist.kore.ai/api/public/stream/${config.botId}/v2/recordings` },
    
    // Platform variations
    { name: 'Platform v2', url: `https://platform.kore.ai/api/public/bot/${config.botId}/v2/recordings` },
    
    // Alternative SmartAssist formats based on common patterns
    { name: 'SmartAssist Media', url: `https://smartassist.kore.ai/api/getMediaStream/${config.sessionId}` }
  ];
  
  const params = new URLSearchParams({
    sessionId: config.sessionId,
    userId: config.userId
  });
  
  let response: AxiosResponse<CallRecordingResponse> | null = null;
  let lastError: any = null;
  
  // Try each endpoint with both GET and POST methods
  for (const endpoint of endpoints) {
    // Some endpoints might not need query params (like getMediaStream)
    const isMediaStream = endpoint.name.includes('Media');
    const fullUrl = isMediaStream ? endpoint.url : `${endpoint.url}?${params.toString()}`;
    
    // Try GET first
    console.log(`\n📡 Trying ${endpoint.name}: GET ${fullUrl}`);
    
    try {
      // SmartAssist Media endpoint might need different auth header format
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      if (endpoint.name.includes('SmartAssist Media')) {
        // Try Authorization Bearer format for SmartAssist Media
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        // Standard auth header for other endpoints
        headers['auth'] = token;
      }
      
      response = await axios.get(fullUrl, {
        headers,
        timeout: 30000
      });
      
      console.log(`✅ ${endpoint.name} (GET) succeeded!`);
      break; // Success, exit loop
      
    } catch (error: any) {
      lastError = error;
      
      // Check error type
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.log(`⚠️  ${endpoint.name} - Host not reachable`);
      } else if (error.response?.status === 405) {
        // Method not allowed, try POST
        console.log(`⚠️  ${endpoint.name} (GET) - Method not allowed, trying POST...`);
        
        try {
          const postData = {
            sessionId: config.sessionId,
            userId: config.userId
          };
          
          response = await axios.post(endpoint.url, postData, {
            headers: {
              'auth': token,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });
          
          console.log(`✅ ${endpoint.name} (POST) succeeded!`);
          break;
          
        } catch (postError: any) {
          lastError = postError;
          if (postError.response?.status === 401) {
            console.log(`⚠️  ${endpoint.name} (POST) - Authentication/scope error`);
          } else {
            console.log(`⚠️  ${endpoint.name} (POST) - Failed: ${postError.message}`);
          }
        }
      } else if (error.response?.status === 401) {
        console.log(`⚠️  ${endpoint.name} - Authentication/scope error`);
      } else if (error.response?.status === 404) {
        console.log(`⚠️  ${endpoint.name} - Endpoint not found`);
      } else {
        console.log(`⚠️  ${endpoint.name} - Failed: ${error.message}`);
      }
    }
  }
  
  if (response) {
    console.log(`\n✅ Response Status: ${response.status}`);
    console.log(`📊 Response Data:`, JSON.stringify(response.data, null, 2));
    
    // Handle response
    if (response.data.status === 'success' && response.data.recording && response.data.recording.length > 0) {
      console.log('\n🎉 Recording(s) found!');
      
      for (const recording of response.data.recording) {
        console.log(`\n📼 Recording Details:`);
        console.log(`   File Name: ${recording.fileName}`);
        console.log(`   File URL: ${recording.fileUrl}`);
        
        // Ask if user wants to download
        console.log('\n💾 To download the recording, use:');
        console.log(`   curl -o "${recording.fileName}" "${recording.fileUrl}"`);
        console.log(`   or`);
        console.log(`   wget -O "${recording.fileName}" "${recording.fileUrl}"`);
      }
      
      // Save response to file for reference
      const outputDir = path.join(__dirname, '../data/recordings');
      await fs.mkdir(outputDir, { recursive: true });
      
      const outputFile = path.join(outputDir, `recording-${config.sessionId}.json`);
      await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
      console.log(`\n📁 Response saved to: ${outputFile}`);
      
    } else if (response.data.status === 'media_unavailable') {
      console.log('\n⚠️  Recording not available');
      console.log(`   Message: ${response.data.message || 'Media unavailable for this session'}`);
    } else {
      console.log('\n❌ Unexpected response status:', response.data.status);
      if (response.data.message) {
        console.log(`   Message: ${response.data.message}`);
      }
    }
  } else if (lastError) {
    // Both v2 and v1 failed
    console.error('\n❌ Error fetching recording:', lastError.message);
    
    if (lastError.response) {
      console.error('📊 Response Status:', lastError.response.status);
      console.error('📊 Response Data:', JSON.stringify(lastError.response.data, null, 2));
      
      if (lastError.response.status === 401) {
        console.error('\n🔐 Authentication failed. The SmartAssist Recordings scope may not be enabled for this bot.');
        console.error('   Contact your Kore.ai administrator to enable the recordings API scope.');
      } else if (lastError.response.status === 403) {
        console.error('\n🔐 Forbidden. The signature or authentication format may be incorrect.');
        console.error('   This might require a different JWT format or API key.');
      } else if (lastError.response.status === 404) {
        console.error('\n🔍 Session or recording not found.');
      } else if (lastError.response.status === 429) {
        console.error('\n⏱️  Rate limit exceeded. Please wait and try again.');
        console.error('   Note: The SmartAssist Media endpoint responded, suggesting it might be the correct endpoint.');
        console.error('   Try again later or with different authentication.');
      }
    } else if (lastError.request) {
      console.error('\n🌐 No response received. Check network connection and base URL.');
    }
  }
}

async function main(): Promise<void> {
  console.log('🎙️  Kore.ai Call Recording Fetcher');
  console.log('=====================================\n');
  
  // Load environment variables from .env.local
  const envPath = path.join(__dirname, '../.env.local');
  dotenv.config({ path: envPath });
  
  // Parse command line arguments
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'session-id': { type: 'string' },
      'user-id': { type: 'string' },
      'bot-id': { type: 'string' },
      'client-id': { type: 'string' },
      'client-secret': { type: 'string' },
      'base-url': { type: 'string' },
      'help': { type: 'boolean', short: 'h' }
    }
  });
  
  if (values.help) {
    console.log(`
Usage: npx tsx scripts/fetch-call-recording.ts [options]

Options:
  --session-id     Session ID to fetch recording for
  --user-id        User ID associated with the session
  --bot-id         Bot ID (defaults to TEST_BOT_ID from .env.local)
  --client-id      Client ID (defaults to TEST_CLIENT_ID from .env.local)
  --client-secret  Client Secret (defaults to TEST_CLIENT_SECRET from .env.local)
  --base-url       API Base URL (defaults to https://bots.kore.ai)
  --help, -h       Show this help message

Examples:
  # Using default CompSych session
  npx tsx scripts/fetch-call-recording.ts
  
  # Custom session
  npx tsx scripts/fetch-call-recording.ts --session-id "abc123" --user-id "u-456"
  
  # Override credentials
  npx tsx scripts/fetch-call-recording.ts --bot-id "st-xxx" --client-id "cs-xxx" --client-secret "xxx"
`);
    process.exit(0);
  }
  
  // Build configuration with defaults
  const config: Config = {
    // Use provided values or defaults
    sessionId: values['session-id'] || '689cb68d3d161a676172f47c',
    userId: values['user-id'] || 'u-652e324f-99b0-58fd-b0eb-bfd5e8a06c39',
    botId: values['bot-id'] || process.env.TEST_BOT_ID || '',
    clientId: values['client-id'] || process.env.TEST_CLIENT_ID || '',
    clientSecret: values['client-secret'] || process.env.TEST_CLIENT_SECRET || '',
    baseUrl: values['base-url'] || 'https://bots.kore.ai'  // Use bots.kore.ai like existing code
  };
  
  // Validate required fields
  if (!config.botId || !config.clientId || !config.clientSecret) {
    console.error('❌ Missing credentials!');
    console.error('   Please provide bot-id, client-id, and client-secret via arguments');
    console.error('   or set TEST_BOT_ID, TEST_CLIENT_ID, and TEST_CLIENT_SECRET in .env.local');
    process.exit(1);
  }
  
  if (!config.sessionId || !config.userId) {
    console.error('❌ Missing session information!');
    console.error('   Please provide --session-id and --user-id');
    process.exit(1);
  }
  
  // Fetch the recording
  await fetchCallRecording(config);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { fetchCallRecording, generateJwtToken };