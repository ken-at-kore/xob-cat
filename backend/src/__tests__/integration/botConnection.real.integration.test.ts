/**
 * Bot Connection Real API Integration Test
 * 
 * Tests the bot connection process using real Kore.ai API credentials.
 * This simulates the user workflow of entering credentials and connecting to the bot.
 * 
 * Prerequisites:
 * - TEST_BOT_ID, TEST_CLIENT_ID, TEST_CLIENT_SECRET must be set in .env.local
 * - The test credentials must be valid for the Kore.ai platform
 * 
 * Run with: npm test -- --testPathPattern="botConnection.real"
 */

import request from 'supertest';
import express from 'express';
import { config as dotenv } from 'dotenv';
import path from 'path';
import { koreRouter } from '../../routes/kore';

// Load environment variables from .env.local
dotenv({ path: path.resolve(process.cwd(), '../.env.local') });

describe('Bot Connection Real API Integration', () => {
  let app: express.Application;
  let hasCredentials: boolean = false;
  let testBotId: string;
  let testClientId: string;
  let testClientSecret: string;

  beforeAll(() => {
    // Check for test credentials
    testBotId = process.env.TEST_BOT_ID || '';
    testClientId = process.env.TEST_CLIENT_ID || '';
    testClientSecret = process.env.TEST_CLIENT_SECRET || '';

    if (!testBotId || !testClientId || !testClientSecret) {
      console.warn('⚠️  Test credentials not found in .env.local');
      console.warn('   Please set TEST_BOT_ID, TEST_CLIENT_ID, and TEST_CLIENT_SECRET');
      console.warn('   Skipping real API bot connection tests.');
      return;
    }

    hasCredentials = true;
    console.log('✅ Bot connection test credentials found');
    console.log(`🤖 Testing with bot ID: ${testBotId.substring(0, 10)}...`);

    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/kore', koreRouter);

    // Add error handling middleware
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('Test server error:', err);
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    });
  });

  describe('Connection Workflow', () => {
    it('should successfully connect with valid credentials', async () => {
      if (!hasCredentials) {
        console.log('⏭️  Skipping test - no credentials available');
        return;
      }

      // Step 1: Simulate user entering credentials and clicking "Connect"
      const response = await request(app)
        .get('/api/kore/test')
        .set('x-bot-id', testBotId)
        .set('x-client-id', testClientId)
        .set('x-client-secret', testClientSecret)
        .expect('Content-Type', /json/);

      // Step 2: Validate successful connection response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      const connectionData = response.body.data;
      expect(connectionData).toHaveProperty('bot_name');
      expect(connectionData).toHaveProperty('sessions_count');
      expect(connectionData).toHaveProperty('date_range');
      
      // Bot name should be a non-empty string
      expect(typeof connectionData.bot_name).toBe('string');
      expect(connectionData.bot_name.length).toBeGreaterThan(0);
      
      // Sessions count should be a non-negative number
      expect(typeof connectionData.sessions_count).toBe('number');
      expect(connectionData.sessions_count).toBeGreaterThanOrEqual(0);
      
      // Date range should have valid dates
      expect(connectionData.date_range).toHaveProperty('dateFrom');
      expect(connectionData.date_range).toHaveProperty('dateTo');
      
      console.log(`✅ Successfully connected to bot: ${connectionData.bot_name}`);
      console.log(`📊 Found ${connectionData.sessions_count} sessions in test range`);
    }, 30000); // 30 second timeout for real API call

    it('should reject connection with invalid bot ID', async () => {
      if (!hasCredentials) {
        console.log('⏭️  Skipping test - no credentials available');
        return;
      }

      const invalidBotId = 'st-invalid-bot-id-12345';
      
      const response = await request(app)
        .get('/api/kore/test')
        .set('x-bot-id', invalidBotId)
        .set('x-client-id', testClientId)
        .set('x-client-secret', testClientSecret);

      // Should return 401 Unauthorized
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid Kore.ai credentials');
      
      console.log('✅ Correctly rejected invalid bot ID');
    }, 30000);

    it('should reject connection with invalid client credentials', async () => {
      if (!hasCredentials) {
        console.log('⏭️  Skipping test - no credentials available');
        return;
      }

      const invalidClientSecret = 'invalid-secret-12345';
      
      const response = await request(app)
        .get('/api/kore/test')
        .set('x-bot-id', testBotId)
        .set('x-client-id', testClientId)
        .set('x-client-secret', invalidClientSecret);

      // Should return 401 Unauthorized
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid Kore.ai credentials');
      
      console.log('✅ Correctly rejected invalid client secret');
    }, 30000);

    it('should reject connection with missing credentials', async () => {
      if (!hasCredentials) {
        console.log('⏭️  Skipping test - no credentials available');
        return;
      }

      // Test missing bot ID
      let response = await request(app)
        .get('/api/kore/test')
        .set('x-client-id', testClientId)
        .set('x-client-secret', testClientSecret);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Missing Kore.ai credentials');

      // Test missing client ID
      response = await request(app)
        .get('/api/kore/test')
        .set('x-bot-id', testBotId)
        .set('x-client-secret', testClientSecret);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Missing Kore.ai credentials');

      // Test missing client secret
      response = await request(app)
        .get('/api/kore/test')
        .set('x-bot-id', testBotId)
        .set('x-client-id', testClientId);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Missing Kore.ai credentials');
      
      console.log('✅ Correctly rejected requests with missing credentials');
    });
  });

  describe('Connection Data Validation', () => {
    it('should return valid session metadata on successful connection', async () => {
      if (!hasCredentials) {
        console.log('⏭️  Skipping test - no credentials available');
        return;
      }

      const response = await request(app)
        .get('/api/kore/test')
        .set('x-bot-id', testBotId)
        .set('x-client-id', testClientId)
        .set('x-client-secret', testClientSecret);

      expect(response.status).toBe(200);
      const { data } = response.body;
      
      // If there's a sample session, validate its structure
      if (data.sample_session) {
        const session = data.sample_session;
        
        // Validate required session fields
        expect(session).toHaveProperty('sessionId');
        expect(session).toHaveProperty('userId');
        
        // Validate field types
        expect(typeof session.sessionId).toBe('string');
        expect(typeof session.userId).toBe('string');
        
        // Check optional fields if they exist
        if (session.containment_type) {
          expect(['agent', 'selfService', 'dropOff']).toContain(session.containment_type);
        }
        
        console.log(`✅ Sample session validated: ${session.sessionId}`);
        console.log(`   Containment Type: ${session.containment_type || 'N/A'}`);
      } else {
        console.log('ℹ️  No sessions found in test time range (last hour)');
      }
    }, 30000);

    it('should handle rate limiting gracefully', async () => {
      if (!hasCredentials) {
        console.log('⏭️  Skipping test - no credentials available');
        return;
      }

      // Make multiple rapid requests to test rate limiting handling
      const requests = Array(5).fill(null).map(() => 
        request(app)
          .get('/api/kore/test')
          .set('x-bot-id', testBotId)
          .set('x-client-id', testClientId)
          .set('x-client-secret', testClientSecret)
      );

      const responses = await Promise.all(requests);
      
      // All requests should either succeed or fail with rate limiting
      responses.forEach((response, index) => {
        expect([200, 429]).toContain(response.status);
        if (response.status === 429) {
          console.log(`⚠️  Request ${index + 1} was rate limited (expected behavior)`);
        } else {
          console.log(`✅ Request ${index + 1} succeeded`);
        }
      });
      
      // At least one request should succeed
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(0);
      
      console.log(`✅ Rate limiting test completed: ${successfulRequests.length}/5 requests succeeded`);
    }, 60000); // 60 second timeout for multiple requests
  });

  describe('Production-like Connection Flow', () => {
    it('should simulate complete user connection workflow', async () => {
      if (!hasCredentials) {
        console.log('⏭️  Skipping test - no credentials available');
        return;
      }

      // Step 1: User enters credentials (simulated by having them in headers)
      console.log('📝 Step 1: User enters credentials');

      // Step 2: User clicks "Connect" - app calls test endpoint
      console.log('🔌 Step 2: User clicks Connect - testing connection...');
      const connectionResponse = await request(app)
        .get('/api/kore/test')
        .set('x-bot-id', testBotId)
        .set('x-client-id', testClientId)
        .set('x-client-secret', testClientSecret);

      expect(connectionResponse.status).toBe(200);
      expect(connectionResponse.body.success).toBe(true);
      
      const botName = connectionResponse.body.data.bot_name;
      console.log(`✅ Step 2 Complete: Connected to "${botName}"`);

      // Step 3: On successful connection, app should be able to fetch sessions
      console.log('📊 Step 3: Verifying ability to fetch sessions...');
      const sessionsResponse = await request(app)
        .get('/api/kore/sessions')
        .query({
          dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          dateTo: new Date().toISOString(),
          skip: 0,
          limit: 10
        })
        .set('x-bot-id', testBotId)
        .set('x-client-id', testClientId)
        .set('x-client-secret', testClientSecret);

      // Even if no sessions exist, the request should succeed
      expect([200, 404]).toContain(sessionsResponse.status);
      
      if (sessionsResponse.status === 200) {
        const sessions = sessionsResponse.body.data;
        console.log(`✅ Step 3 Complete: Can fetch sessions (found ${sessions.length})`);
      } else {
        console.log('✅ Step 3 Complete: Can fetch sessions (none found in date range)');
      }

      console.log('🎉 Complete connection workflow validated successfully!');
    }, 45000); // 45 second timeout for complete workflow
  });
});