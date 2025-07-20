// Simple demonstration of session and conversation history retrieval
console.log('🔍 XOB CAT Session and Conversation History Retrieval Demo\n');

// Import the mock data service directly
const { generateMockSessions } = require('./src/services/mockDataService');

// Generate sample sessions
const filters = {
  start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  end_date: new Date().toISOString(),
  limit: 3
};

console.log('📋 Generating sessions with conversation history...\n');

try {
  const sessions = generateMockSessions(filters);

  console.log(`✅ Generated ${sessions.length} sessions with full conversation history\n`);

  // Demonstrate each session
  sessions.forEach((session, index) => {
    console.log(`📊 Session ${index + 1}:`);
    console.log(`   Session ID: ${session.session_id}`);
    console.log(`   User ID: ${session.user_id}`);
    console.log(`   Start Time: ${session.start_time}`);
    console.log(`   End Time: ${session.end_time}`);
    console.log(`   Duration: ${session.duration_seconds} seconds`);
    console.log(`   Containment Type: ${session.containment_type}`);
    console.log(`   Total Messages: ${session.message_count}`);
    console.log(`   User Messages: ${session.user_message_count}`);
    console.log(`   Bot Messages: ${session.bot_message_count}`);
    console.log(`   Tags: ${session.tags.join(', ')}`);
    
    console.log('\n💬 Conversation History:');
    session.messages.forEach((message, msgIndex) => {
      const timestamp = new Date(message.timestamp).toLocaleTimeString();
      const speaker = message.message_type === 'user' ? '👤 USER' : '🤖 BOT';
      console.log(`   ${msgIndex + 1}. [${timestamp}] ${speaker}: ${message.message}`);
    });
    
    console.log('\n' + '─'.repeat(80) + '\n');
  });

  console.log('🎯 Key Features Demonstrated:');
  console.log('✅ Session metadata (ID, user, timestamps, duration)');
  console.log('✅ Conversation transcripts with full message history');
  console.log('✅ Message metrics (total, user, bot counts)');
  console.log('✅ Session classification (containment type, tags)');
  console.log('✅ Timestamped conversation flow');
  console.log('✅ Multiple conversation templates (Claim Status, Billing, Eligibility)');
  console.log('✅ Realistic conversation patterns and outcomes');

  console.log('\n🚀 The system can retrieve:');
  console.log('   • Complete session history with metadata');
  console.log('   • Full conversation transcripts with timestamps');
  console.log('   • Message-by-message conversation flow');
  console.log('   • Session metrics and analytics');
  console.log('   • Filtering by date range and containment type');
  console.log('   • Pagination for large datasets');
  console.log('   • Real Kore.ai API integration (when configured)');
  console.log('   • Mock data fallback for development/testing');

} catch (error) {
  console.error('Error running demo:', error);
} 