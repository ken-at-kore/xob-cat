import { createKoreApiService, KoreApiConfig } from '../backend/src/services/koreApiService';
import { configManager } from '../backend/src/utils/configManager';
import * as fs from 'fs';
import * as path from 'path';

async function collectMissingJulyDays() {
  console.log('🚀 Collecting missing July days: 6, 9, 10...');
  
  try {
    // Initialize Kore API service
    const koreConfig = configManager.getKoreConfig();
    const config: KoreApiConfig = {
      botId: koreConfig.bot_id,
      clientId: koreConfig.client_id,
      clientSecret: koreConfig.client_secret,
      baseUrl: koreConfig.base_url
    };
    
    const koreApiService = createKoreApiService(config);
    
    // Missing days to collect
    const missingDays = [
      { from: '2025-07-06T00:00:00.000Z', to: '2025-07-06T23:59:59.999Z', day: 'July 6' },
      { from: '2025-07-09T00:00:00.000Z', to: '2025-07-09T23:59:59.999Z', day: 'July 9' },
      { from: '2025-07-10T00:00:00.000Z', to: '2025-07-10T23:59:59.999Z', day: 'July 10' }
    ];
    
    let allSessions: any[] = [];
    let allMessages: any[] = [];
    let dailyBreakdown: any[] = [];
    
    // Collect data for missing days
    for (const range of missingDays) {
      console.log(`\n📅 Collecting data for ${range.day}...`);
      
      try {
        // Get sessions for this day
        const daySessions = await koreApiService.getSessions(range.from, range.to, 0, 10000);
        console.log(`   📊 Sessions: ${daySessions.length}`);
        
        let dayMessages: any[] = [];
        if (daySessions.length > 0) {
          // Get messages for this day's sessions
          const sessionIds = daySessions.map((session: any) => session.session_id).filter(Boolean);
          dayMessages = await koreApiService.getMessages(range.from, range.to, sessionIds);
          console.log(`   💬 Messages: ${dayMessages.length}`);
          
          // Group messages by session ID and add to sessions
          const messagesBySession: Record<string, any[]> = {};
          dayMessages.forEach((message: any) => {
            const sessionId = message.sessionId || message.session_id;
            if (sessionId) {
              if (!messagesBySession[sessionId]) {
                messagesBySession[sessionId] = [];
              }
              messagesBySession[sessionId].push(message);
            }
          });
          
          // Add messages to sessions
          daySessions.forEach((session: any) => {
            session.messages = messagesBySession[session.session_id] || [];
          });
        }
        
        // Add to totals
        allSessions.push(...daySessions);
        allMessages.push(...dayMessages);
        
        dailyBreakdown.push({
          date: range.day,
          dateRange: { from: range.from, to: range.to },
          sessions: daySessions.length,
          messages: dayMessages.length,
          sessionsWithMessages: daySessions.filter((s: any) => s.messages && s.messages.length > 0).length
        });
        
        console.log(`   ✅ ${range.day}: ${daySessions.length} sessions, ${dayMessages.length} messages`);
        
      } catch (error) {
        console.log(`   ❌ ${range.day}: Error - ${error.message}`);
        dailyBreakdown.push({
          date: range.day,
          dateRange: { from: range.from, to: range.to },
          sessions: 0,
          messages: 0,
          sessionsWithMessages: 0,
          error: error.message
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save the missing days data
    const dataDir = path.join(__dirname, '../data');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `conversation-history-july-6-9-10-MISSING-2025-${timestamp}.json`;
    const filepath = path.join(dataDir, filename);
    
    const outputData = {
      collectionInfo: {
        dateRange: {
          from: '2025-07-06T00:00:00.000Z',
          to: '2025-07-10T23:59:59.999Z'
        },
        collectedAt: new Date().toISOString(),
        totalSessions: allSessions.length,
        totalMessages: allMessages.length,
        sessionsWithMessages: allSessions.filter((s: any) => s.messages && s.messages.length > 0).length,
        dailyBreakdown: dailyBreakdown,
        note: 'This file contains the missing days: July 6, 9, 10'
      },
      sessions: allSessions,
      rawMessages: allMessages
    };
    
    fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));
    
    console.log('\n✅ SUCCESS! Missing days data collection complete:');
    console.log(`📁 File saved: ${filepath}`);
    console.log(`📊 Total sessions: ${allSessions.length}`);
    console.log(`💬 Total messages: ${allMessages.length}`);
    
    console.log('\n📅 Missing days breakdown:');
    dailyBreakdown.forEach(day => {
      if (day.error) {
        console.log(`   ${day.date}: ERROR - ${day.error}`);
      } else {
        console.log(`   ${day.date}: ${day.sessions} sessions, ${day.messages} messages`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error collecting missing days:', error);
  }
}

collectMissingJulyDays();