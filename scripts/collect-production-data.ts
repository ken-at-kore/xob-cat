#!/usr/bin/env npx tsx

/**
 * Production Data Collection Script
 * 
 * Collects raw API response data from Kore.ai for the specified date range.
 * This data will be used to build realistic mock services that reproduce
 * real-world edge cases and bugs.
 * 
 * Usage: npx tsx scripts/collect-production-data.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';

interface ProductionDataCollection {
  collectionInfo: {
    dateRange: {
      from: string;
      to: string;
    };
    collectedAt: string;
    totalSessions: number;
    totalMessages: number;
    containmentTypeBreakdown: Record<string, number>;
  };
  sessionHistory: {
    agent: any[];
    selfService: any[];
    dropOff: any[];
  };
  conversationMessages: any[];
}

async function collectProductionData(): Promise<void> {
  console.log('🚀 Starting production data collection...');
  
  // July 7-8, 2025 as requested
  const startDate = new Date('2025-07-07T04:00:00.000Z'); // July 7th midnight ET (UTC-4 for EDT)
  const endDate = new Date('2025-07-09T03:59:59.999Z');   // July 8th 23:59:59 ET

  const dateFrom = startDate.toISOString();
  const dateTo = endDate.toISOString();
  
  console.log(`📅 Collection period: ${dateFrom} to ${dateTo}`);
  console.log(`📅 Human readable: July 7-8, 2025`);

  // Use the same backend API endpoint that the working app uses
  const BACKEND_URL = 'http://localhost:3001';
  
  console.log(`🔗 Using backend API at: ${BACKEND_URL}`);
  console.log(`📡 This will use the same Kore.ai credentials that the app uses`);
  
  // Test backend connection
  try {
    const healthResponse = await axios.get(`${BACKEND_URL}/health`);
    console.log(`✅ Backend health check passed:`, healthResponse.data.service);
  } catch (error) {
    console.error('❌ Backend is not running. Please start with: npm run dev:backend');
    console.log('💡 The collection script needs the backend to be running to access Kore.ai credentials');
    process.exit(1);
  }

  const dataCollection: ProductionDataCollection = {
    collectionInfo: {
      dateRange: { from: dateFrom, to: dateTo },
      collectedAt: new Date().toISOString(),
      totalSessions: 0,
      totalMessages: 0,
      containmentTypeBreakdown: {}
    },
    sessionHistory: {
      agent: [],
      selfService: [],
      dropOff: []
    },
    conversationMessages: []
  };

  // Step 1: Collect session history using the same endpoint the app uses
  console.log('\n📊 Step 1: Collecting session history...');
  
  let allSessions: any[] = [];
  const allSessionIds: string[] = [];

  try {
    console.log(`🔍 Calling backend /api/analysis/sessions endpoint...`);
    
    // Convert dates to the format the backend expects (YYYY-MM-DD)
    const startDateStr = startDate.toISOString().split('T')[0]; // 2025-07-06
    const endDateStr = endDate.toISOString().split('T')[0];     // 2025-07-13
    
    console.log(`📡 Date filters: start_date=${startDateStr}, end_date=${endDateStr}`);
    
    // Use the same API call that the frontend makes
    const params = new URLSearchParams();
    params.append('start_date', startDateStr);
    params.append('end_date', endDateStr);
    params.append('limit', '10000'); // Get lots of data for the week
    
    const url = `${BACKEND_URL}/api/analysis/sessions?${params.toString()}`;
    console.log(`📡 Making API call: ${url}`);
    
    const response = await axios.get(url);
    
    // Debug: Check if we're getting mock or real data
    console.log(`📊 Response metadata:`, response.data.meta);
    console.log(`📊 Response success:`, response.data.success);
    if (response.data.data && response.data.data.length > 0) {
      const firstSession = response.data.data[0];
      console.log(`🔍 First session ID pattern:`, firstSession.session_id);
      console.log(`🔍 Session has real API characteristics?:`, 
        firstSession.session_id.includes('session_') && firstSession.session_id.includes('_') ? 'MOCK DATA DETECTED' : 'REAL API DATA'
      );
    }
    
    if (response.data.success) {
      allSessions = response.data.data || [];
      console.log(`✅ Total sessions retrieved: ${allSessions.length}`);
      
      // Group sessions by containment type for storage  
      const sessionsByContainmentType = {
        agent: [] as any[],
        selfService: [] as any[],
        dropOff: [] as any[]
      };
      
      for (const session of allSessions) {
        const containmentType = session.containment_type;
        if (containmentType && sessionsByContainmentType[containmentType as keyof typeof sessionsByContainmentType]) {
          sessionsByContainmentType[containmentType as keyof typeof sessionsByContainmentType].push(session);
        }
        
        // Collect session ID for potential message retrieval
        if (session.session_id) {
          allSessionIds.push(session.session_id);
        }
      }
      
      // Store the raw sessions data (this is what we want for mocks)
      dataCollection.sessionHistory.agent = sessionsByContainmentType.agent;
      dataCollection.sessionHistory.selfService = sessionsByContainmentType.selfService;
      dataCollection.sessionHistory.dropOff = sessionsByContainmentType.dropOff;
      
      // Update collection info
      dataCollection.collectionInfo.containmentTypeBreakdown = {
        agent: sessionsByContainmentType.agent.length,
        selfService: sessionsByContainmentType.selfService.length,
        dropOff: sessionsByContainmentType.dropOff.length
      };
      dataCollection.collectionInfo.totalSessions = allSessions.length;
      
      // Log sample session structure for debugging
      if (allSessions.length > 0) {
        console.log(`📋 Sample session structure:`, Object.keys(allSessions[0]));
        console.log(`📋 Sample session data:`, JSON.stringify(allSessions[0], null, 2));
      }
      
      console.log(`📊 Breakdown:`);
      console.log(`   - agent: ${sessionsByContainmentType.agent.length} sessions`);
      console.log(`   - selfService: ${sessionsByContainmentType.selfService.length} sessions`);
      console.log(`   - dropOff: ${sessionsByContainmentType.dropOff.length} sessions`);
      
    } else {
      throw new Error(`Backend API returned error: ${response.data.error || 'Unknown error'}`);
    }
    
  } catch (error: any) {
    console.error(`❌ Error collecting sessions:`, error.message);
    
    // Try to extract API error details
    if (error.response && error.response.data) {
      console.error(`🔍 Backend API Error Details:`, error.response.data);
      console.error(`🔍 HTTP Status:`, error.response.status);
    }
  }

  console.log(`\n📊 Total sessions collected: ${dataCollection.collectionInfo.totalSessions}`);
  console.log(`📊 Unique session IDs: ${[...new Set(allSessionIds)].length}`);

  // Step 2: Messages are already included in the session data from /api/analysis/sessions
  console.log('\n💬 Step 2: Analyzing message data...');
  
  let totalMessages = 0;
  const allMessages: any[] = [];
  
  // Extract messages from sessions (they're already included in the SessionWithTranscript objects)
  for (const session of allSessions) {
    if (session.messages && Array.isArray(session.messages)) {
      totalMessages += session.messages.length;
      allMessages.push(...session.messages.map((msg: any) => ({
        ...msg,
        session_id: session.session_id // Add session context
      })));
    }
  }
  
  dataCollection.conversationMessages = allMessages;
  dataCollection.collectionInfo.totalMessages = totalMessages;
  
  console.log(`✅ Message analysis complete: ${totalMessages} messages total`);
  
  // Log sample message structure for debugging
  if (allMessages.length > 0) {
    console.log(`📋 Sample message structure:`, Object.keys(allMessages[0]));
    console.log(`📋 Sample message:`, JSON.stringify(allMessages[0], null, 2));
    
    // Look for messages that might cause the "No messages" bug
    const messagesWithoutText = allMessages.filter((msg: any) => !msg.message || msg.message.trim() === '');
    const messagesWithInvalidType = allMessages.filter((msg: any) => !msg.message_type || (msg.message_type !== 'user' && msg.message_type !== 'bot'));
    const messagesWithInvalidTimestamp = allMessages.filter((msg: any) => !msg.timestamp);
    
    console.log(`🔍 Message quality analysis:`);
    console.log(`   - Messages without text: ${messagesWithoutText.length}`);
    console.log(`   - Messages with invalid type: ${messagesWithInvalidType.length}`);
    console.log(`   - Messages with invalid timestamp: ${messagesWithInvalidTimestamp.length}`);
    
    if (messagesWithoutText.length > 0) {
      console.log(`📋 Sample message without text:`, JSON.stringify(messagesWithoutText[0], null, 2));
    }
  }

  // Step 3: Save collected data
  console.log('\n💾 Step 3: Saving collected data...');
  
  const outputDir = path.join(__dirname, '../data/production-api-responses');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Save complete collection  
  const outputFile = path.join(outputDir, `kore-api-responses-${new Date().toISOString().split('T')[0]}.json`);
  await fs.writeFile(outputFile, JSON.stringify(dataCollection, null, 2));
  
  // Save individual parts for easier access
  await fs.writeFile(
    path.join(outputDir, 'session-history-agent.json'),
    JSON.stringify(dataCollection.sessionHistory.agent, null, 2)
  );
  await fs.writeFile(
    path.join(outputDir, 'session-history-selfService.json'),
    JSON.stringify(dataCollection.sessionHistory.selfService, null, 2)
  );
  await fs.writeFile(
    path.join(outputDir, 'session-history-dropOff.json'),
    JSON.stringify(dataCollection.sessionHistory.dropOff, null, 2)
  );
  await fs.writeFile(
    path.join(outputDir, 'conversation-messages.json'),
    JSON.stringify(dataCollection.conversationMessages, null, 2)
  );
  
  // Save collection summary
  const summary = {
    ...dataCollection.collectionInfo,
    sampleSession: dataCollection.sessionHistory.agent[0] || 
                   dataCollection.sessionHistory.selfService[0] || 
                   dataCollection.sessionHistory.dropOff[0] || null,
    sampleMessage: dataCollection.conversationMessages[0] || null,
    messageStructureTypes: [...new Set(
      dataCollection.conversationMessages
        .flatMap((msg: any) => (msg.components || []).map((comp: any) => comp.cT))
        .filter(Boolean)
    )],
    sessionIdSample: [...new Set(allSessionIds)].slice(0, 10)
  };
  
  await fs.writeFile(
    path.join(outputDir, 'collection-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  // Final report
  console.log('\n✅ Data collection complete!');
  console.log(`📁 Data saved to: ${outputDir}`);
  console.log('\n📊 Collection Summary:');
  console.log(`   📅 Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
  console.log(`   🎯 Total sessions: ${dataCollection.collectionInfo.totalSessions}`);
  console.log(`   💬 Total messages: ${dataCollection.collectionInfo.totalMessages}`);
  console.log(`   📊 Breakdown:`);
  for (const [type, count] of Object.entries(dataCollection.collectionInfo.containmentTypeBreakdown)) {
    console.log(`      - ${type}: ${count} sessions`);
  }
  console.log('\n📁 Files created:');
  console.log(`   - kore-api-responses-july-6-13-2024.json (complete dataset)`);
  console.log(`   - session-history-*.json (individual containment types)`);
  console.log(`   - conversation-messages.json (all messages)`);
  console.log(`   - collection-summary.json (analysis summary)`);
  console.log('\n🔧 Next steps:');
  console.log('   1. Review the data structure in collection-summary.json');
  console.log('   2. Sanitize sensitive data if needed');
  console.log('   3. Update mock services to use this real data');
  console.log('   4. Test against edge cases found in the data');
}

// Run the collection
if (require.main === module) {
  collectProductionData().catch(error => {
    console.error('❌ Data collection failed:', error);
    process.exit(1);
  });
}

export { collectProductionData };