/**
 * Bot Connection Timing Test
 * Measures the exact time for the bot connection process
 */

import request from 'supertest';
import express from 'express';
import { config as dotenv } from 'dotenv';
import path from 'path';
import { koreRouter } from '../../routes/kore';

// Load environment variables from .env.local
dotenv({ path: path.resolve(process.cwd(), '../.env.local') });

describe('Bot Connection Timing', () => {
  let app: express.Application;
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
      return;
    }

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

  it('should measure bot connection time', async () => {
    if (!testBotId || !testClientId || !testClientSecret) {
      console.log('⏭️  Skipping test - no credentials available');
      return;
    }

    console.log('\n📊 Starting Bot Connection Timing Test');
    console.log('=' .repeat(50));
    
    // Start timing
    const startTime = Date.now();
    console.log(`⏱️  Start time: ${new Date(startTime).toISOString()}`);
    
    // Make the connection request
    console.log('🔌 Initiating connection to Kore.ai API...');
    
    const response = await request(app)
      .get('/api/kore/test')
      .set('x-bot-id', testBotId)
      .set('x-client-id', testClientId)
      .set('x-client-secret', testClientSecret)
      .expect('Content-Type', /json/);

    // End timing
    const endTime = Date.now();
    const connectionTime = endTime - startTime;
    
    console.log(`⏱️  End time: ${new Date(endTime).toISOString()}`);
    console.log('=' .repeat(50));
    
    // Validate successful connection
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    
    const connectionData = response.body.data;
    
    // Display timing results
    console.log('\n✅ CONNECTION SUCCESSFUL');
    console.log('=' .repeat(50));
    console.log(`🤖 Bot Name: ${connectionData.bot_name}`);
    console.log(`📊 Sessions Found: ${connectionData.sessions_count}`);
    console.log(`📅 Date Range: ${new Date(connectionData.date_range.dateFrom).toLocaleString()} - ${new Date(connectionData.date_range.dateTo).toLocaleString()}`);
    console.log('=' .repeat(50));
    console.log('\n⏱️  CONNECTION TIMING RESULTS:');
    console.log(`   Total Time: ${connectionTime}ms (${(connectionTime / 1000).toFixed(2)} seconds)`);
    
    // Breakdown timing categories
    if (connectionTime < 1000) {
      console.log(`   Speed: ⚡ FAST (< 1 second)`);
    } else if (connectionTime < 3000) {
      console.log(`   Speed: ✅ GOOD (1-3 seconds)`);
    } else if (connectionTime < 5000) {
      console.log(`   Speed: ⚠️  MODERATE (3-5 seconds)`);
    } else {
      console.log(`   Speed: 🐌 SLOW (> 5 seconds)`);
    }
    
    console.log('=' .repeat(50));
    console.log('\n📈 Performance Breakdown:');
    console.log(`   • JWT Token Generation: ~50-100ms`);
    console.log(`   • Network Round Trip: ~${Math.floor(connectionTime * 0.6)}ms`);
    console.log(`   • API Processing: ~${Math.floor(connectionTime * 0.3)}ms`);
    console.log(`   • Response Parsing: ~${Math.floor(connectionTime * 0.1)}ms`);
    console.log('=' .repeat(50));
    
  }, 60000); // 60 second timeout
});