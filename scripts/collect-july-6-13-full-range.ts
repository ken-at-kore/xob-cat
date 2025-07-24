import {
  initializeKoreApiService,
  ensureDataDirectory,
  writeJsonFile,
  logScriptStart,
  logScriptComplete,
  handleScriptError
} from './common/scriptUtils';

async function collectFullJuly6to13Data() {
  logScriptStart('collect-july-6-13-full-range', 'Collecting conversation history data for FULL July 6-13, 2025');
  
  try {
    // Initialize Kore API service with real credentials
    const koreApiService = initializeKoreApiService();
    
    // Create array of daily date ranges
    const dailyRanges = [
      { from: '2025-07-06T00:00:00.000Z', to: '2025-07-06T23:59:59.999Z', day: 'July 6' },
      { from: '2025-07-07T00:00:00.000Z', to: '2025-07-07T23:59:59.999Z', day: 'July 7' },
      { from: '2025-07-08T00:00:00.000Z', to: '2025-07-08T23:59:59.999Z', day: 'July 8' },
      { from: '2025-07-09T00:00:00.000Z', to: '2025-07-09T23:59:59.999Z', day: 'July 9' },
      { from: '2025-07-10T00:00:00.000Z', to: '2025-07-10T23:59:59.999Z', day: 'July 10' },
      { from: '2025-07-11T00:00:00.000Z', to: '2025-07-11T23:59:59.999Z', day: 'July 11' },
      { from: '2025-07-12T00:00:00.000Z', to: '2025-07-12T23:59:59.999Z', day: 'July 12' },
      { from: '2025-07-13T00:00:00.000Z', to: '2025-07-13T23:59:59.999Z', day: 'July 13' }
    ];
    
    let allSessions: any[] = [];
    let allMessages: any[] = [];
    let dailyBreakdown: any[] = [];
    
    // Collect data for each day
    for (const range of dailyRanges) {
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
    
    // Save the complete dataset
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `conversation-history-july-6-13-FULL-2025-${timestamp}.json`;
    const filepath = path.join(dataDir, filename);
    
    const outputData = {
      collectionInfo: {
        dateRange: {
          from: '2025-07-06T00:00:00.000Z',
          to: '2025-07-13T23:59:59.999Z'
        },
        collectedAt: new Date().toISOString(),
        totalSessions: allSessions.length,
        totalMessages: allMessages.length,
        sessionsWithMessages: allSessions.filter((s: any) => s.messages && s.messages.length > 0).length,
        dailyBreakdown: dailyBreakdown
      },
      sessions: allSessions,
      rawMessages: allMessages
    };
    
    fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));
    
    console.log('\n🎉 ✅ SUCCESS! FULL July 6-13 data collection complete:');
    console.log(`📁 File saved: ${filepath}`);
    console.log(`📊 Total sessions: ${allSessions.length}`);
    console.log(`💬 Total messages: ${allMessages.length}`);
    console.log(`🔗 Sessions with messages: ${outputData.collectionInfo.sessionsWithMessages}`);
    
    console.log('\n📅 Daily breakdown:');
    dailyBreakdown.forEach(day => {
      if (day.error) {
        console.log(`   ${day.date}: ERROR - ${day.error}`);
      } else {
        console.log(`   ${day.date}: ${day.sessions} sessions, ${day.messages} messages`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error collecting full range data:', error);
  }
}

collectFullJuly6to13Data();