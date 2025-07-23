import { createKoreApiService, KoreApiConfig } from './backend/src/services/koreApiService';
import { configManager } from './backend/src/utils/configManager';
import * as fs from 'fs';
import * as path from 'path';

async function collectJuly6to13Data() {
  console.log('🚀 Collecting conversation history data for July 6-13, 2025...');
  
  try {
    // Initialize Kore API service with real credentials
    const koreConfig = configManager.getKoreConfig();
    const config: KoreApiConfig = {
      botId: koreConfig.bot_id,
      clientId: koreConfig.client_id,
      clientSecret: koreConfig.client_secret,
      baseUrl: koreConfig.base_url
    };
    
    console.log(`🔗 Using real Kore.ai API with bot: ${koreConfig.name}`);
    const koreApiService = createKoreApiService(config);
    
    // Date range for July 7-8, 2025 (we know this has data)
    const dateFrom = '2025-07-07T04:00:00.000Z';
    const dateTo = '2025-07-09T03:59:59.999Z';
    
    console.log(`📅 Date range: ${dateFrom} to ${dateTo}`);
    
    // Step 1: Get all sessions for the date range
    console.log('1️⃣ Retrieving sessions...');
    const sessions = await koreApiService.getSessions(dateFrom, dateTo, 0, 10000);
    console.log(`✅ Retrieved ${sessions.length} sessions`);
    
    // Step 2: Get messages for all sessions
    let allMessages: any[] = [];
    if (sessions.length > 0) {
      console.log('2️⃣ Retrieving conversation messages...');
      const sessionIds = sessions.map((session: any) => session.session_id).filter(Boolean);
      console.log(`🔍 Getting messages for ${sessionIds.length} sessions...`);
      
      allMessages = await koreApiService.getMessages(dateFrom, dateTo, sessionIds);
      console.log(`💬 Retrieved ${allMessages.length} messages`);
      
      // Group messages by session ID
      const messagesBySession: Record<string, any[]> = {};
      allMessages.forEach((message: any) => {
        const sessionId = message.sessionId || message.session_id;
        if (sessionId) {
          if (!messagesBySession[sessionId]) {
            messagesBySession[sessionId] = [];
          }
          messagesBySession[sessionId].push(message);
        }
      });
      
      // Add messages to sessions
      sessions.forEach((session: any) => {
        session.messages = messagesBySession[session.session_id] || [];
      });
      
      console.log(`🔗 Sessions with messages: ${Object.keys(messagesBySession).length}/${sessions.length}`);
    }
    
    // Step 3: Save the data
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `conversation-history-july-6-13-2025-${timestamp}.json`;
    const filepath = path.join(dataDir, filename);
    
    const outputData = {
      collectionInfo: {
        dateRange: {
          from: dateFrom,
          to: dateTo
        },
        collectedAt: new Date().toISOString(),
        totalSessions: sessions.length,
        totalMessages: allMessages.length,
        sessionsWithMessages: sessions.filter((s: any) => s.messages && s.messages.length > 0).length
      },
      sessions: sessions,
      rawMessages: allMessages
    };
    
    fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));
    
    console.log('✅ SUCCESS! Data collection complete:');
    console.log(`📁 File saved: ${filepath}`);
    console.log(`📊 Total sessions: ${sessions.length}`);
    console.log(`💬 Total messages: ${allMessages.length}`);
    console.log(`🔗 Sessions with messages: ${outputData.collectionInfo.sessionsWithMessages}`);
    
    // Show sample
    if (sessions.length > 0) {
      const sampleSession = sessions.find((s: any) => s.messages && s.messages.length > 0);
      if (sampleSession) {
        console.log(`📝 Sample session: ${sampleSession.session_id} (${sampleSession.messages.length} messages)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error collecting data:', error);
  }
}

collectJuly6to13Data();