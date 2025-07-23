import * as fs from 'fs';
import * as path from 'path';

async function mergeJuly6to13Data() {
  console.log('🚀 Merging all July 6-13 data into complete dataset...');
  
  const dataDir = path.join(__dirname, '../data');
  
  // We have data in different files that need to be combined:
  // - July 7-8 data (2054 sessions, 35609 messages) from conversation-history-july-6-13-2025-2025-07-23T04-11-37.json
  // - July 11-13 data (1043 sessions, 18756 messages) from conversation-history-july-11-13-2025-2025-07-23T04-19-01.json
  // - July 6, 9, 10 data is missing from the first incomplete run
  
  console.log('📂 Reading existing data files...');
  
  // Read July 7-8 data
  const july78File = path.join(dataDir, 'conversation-history-july-6-13-2025-2025-07-23T04-11-37.json');
  const july78Data = JSON.parse(fs.readFileSync(july78File, 'utf8'));
  console.log(`✅ July 7-8: ${july78Data.sessions.length} sessions, ${july78Data.rawMessages?.length || 0} messages`);
  
  // Read July 11-13 data  
  const july1113File = path.join(dataDir, 'conversation-history-july-11-13-2025-2025-07-23T04-19-01.json');
  const july1113Data = JSON.parse(fs.readFileSync(july1113File, 'utf8'));
  console.log(`✅ July 11-13: ${july1113Data.sessions.length} sessions, ${july1113Data.rawMessages?.length || 0} messages`);
  
  // From the previous run output, we know:
  // July 6: 8 sessions, 141 messages
  // July 9: 1057 sessions, 18301 messages  
  // July 10: 1089 sessions, 19390 messages
  // But these weren't saved due to timeout. Let me collect just these missing days.
  
  console.log('🔄 Need to collect missing days: July 6, 9, 10...');
  
  // Since we have most of the data, let's create the combined dataset with what we have
  // and note that July 6, 9, 10 need to be collected separately
  
  const allSessions = [
    ...july78Data.sessions,
    ...july1113Data.sessions
  ];
  
  const allMessages = [
    ...(july78Data.rawMessages || []),
    ...(july1113Data.rawMessages || [])
  ];
  
  // Calculate daily breakdown from what we have
  const dailyBreakdown = [
    { date: 'July 6', status: 'MISSING - needs collection', sessions: 0, messages: 0 },
    { date: 'July 7', status: 'collected', sessions: 994, messages: 17488 },
    { date: 'July 8', status: 'collected', sessions: 1060, messages: 18121 }, // approximated from 2054 total
    { date: 'July 9', status: 'MISSING - needs collection', sessions: 0, messages: 0 },
    { date: 'July 10', status: 'MISSING - needs collection', sessions: 0, messages: 0 },
    { date: 'July 11', status: 'collected', sessions: 1021, messages: 18503 },
    { date: 'July 12', status: 'collected', sessions: 15, messages: 167 },
    { date: 'July 13', status: 'collected', sessions: 7, messages: 86 }
  ];
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `conversation-history-july-6-13-PARTIAL-2025-${timestamp}.json`;
  const filepath = path.join(dataDir, filename);
  
  const outputData = {
    collectionInfo: {
      dateRange: {
        from: '2025-07-06T00:00:00.000Z',
        to: '2025-07-13T23:59:59.999Z'
      },
      collectedAt: new Date().toISOString(),
      status: 'PARTIAL - Missing July 6, 9, 10',
      totalSessions: allSessions.length,
      totalMessages: allMessages.length,
      sessionsWithMessages: allSessions.filter((s: any) => s.messages && s.messages.length > 0).length,
      dailyBreakdown: dailyBreakdown,
      missingDays: ['July 6', 'July 9', 'July 10'],
      note: 'This dataset contains July 7-8 and July 11-13. July 6, 9, 10 still need to be collected.'
    },
    sessions: allSessions,
    rawMessages: allMessages
  };
  
  fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));
  
  console.log('\n📊 ✅ PARTIAL dataset created:');
  console.log(`📁 File saved: ${filepath}`);
  console.log(`📊 Total sessions: ${allSessions.length}`);
  console.log(`💬 Total messages: ${allMessages.length}`);
  console.log(`⚠️  Missing days: July 6, 9, 10`);
  
  console.log('\n📅 Current status:');
  dailyBreakdown.forEach(day => {
    if (day.status === 'MISSING - needs collection') {
      console.log(`   ${day.date}: ❌ MISSING - needs collection`);
    } else {
      console.log(`   ${day.date}: ✅ ${day.sessions} sessions, ${day.messages} messages`);
    }
  });
  
  console.log('\n🎯 To complete the full July 6-13 dataset, still need to collect:');
  console.log('   - July 6 (estimated: ~8 sessions, ~141 messages)');
  console.log('   - July 9 (estimated: ~1057 sessions, ~18301 messages)');
  console.log('   - July 10 (estimated: ~1089 sessions, ~19390 messages)');
}

mergeJuly6to13Data();