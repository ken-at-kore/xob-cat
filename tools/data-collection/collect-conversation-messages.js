const http = require('http');
const fs = require('fs');
const path = require('path');

// Helper function to get messages for a batch of sessions
function getBatchMessages(sessionIds, batchNum, totalBatches) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/kore/messages?dateFrom=2025-07-07T17:00:00.000Z&dateTo=2025-07-07T18:00:00.000Z&sessionIds=${sessionIds.join(',')}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.success && response.data) {
            console.log(`   ✅ Batch ${batchNum}/${totalBatches}: Retrieved ${response.data.length} messages`);
            resolve(response.data);
          } else {
            console.log(`   ❌ Batch ${batchNum}/${totalBatches}: No data in response`);
            resolve([]);
          }
        } catch (error) {
          console.log(`   ❌ Batch ${batchNum}/${totalBatches}: Parse error -`, error.message);
          resolve([]);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Batch ${batchNum}/${totalBatches}: Request error -`, error.message);
      resolve([]);
    });

    req.end();
  });
}

async function collectConversationMessages() {
  console.log('Collecting conversation messages for July 7, 2025 1-hour sessions...');
  
  // Read the session history data to get session IDs
  const dataDir = '/Users/kengrafals/workspace/XOB CAT/data';
  const sessionHistoryFile = path.join(dataDir, 'session-history-july-7-1hour-2025-07-23T14-23-56.json');
  
  console.log('📖 Reading session history data...');
  const sessionHistoryData = JSON.parse(fs.readFileSync(sessionHistoryFile, 'utf8'));
  const sessions = sessionHistoryData.sessions;
  
  console.log(`📊 Found ${sessions.length} sessions to get conversation messages for`);
  
  // Extract session IDs and batch them (URL length limit)
  const sessionIds = sessions.map(s => s.session_id);
  console.log(`🔍 Extracted ${sessionIds.length} session IDs`);
  
  // Split into smaller batches to avoid URL length limits
  const batchSize = 100; // Process 100 sessions at a time
  const batches = [];
  for (let i = 0; i < sessionIds.length; i += batchSize) {
    batches.push(sessionIds.slice(i, i + batchSize));
  }
  
  console.log(`📦 Split into ${batches.length} batches of up to ${batchSize} sessions each`);
  
  const allMessages = [];
  
  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} sessions)...`);
    
    const batchMessages = await getBatchMessages(batch, batchIndex + 1, batches.length);
    allMessages.push(...batchMessages);
    
    // Add small delay between batches to avoid overwhelming the API
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`📨 Retrieved ${allMessages.length} total conversation messages from all batches`);

  // Process all the collected messages
  if (allMessages.length > 0) {
    const messages = allMessages;
    
    // Group messages by session ID for easier analysis
    const messagesBySession = {};
    messages.forEach(message => {
      const sessionId = message.sessionId || message.session_id;
      if (sessionId) {
        if (!messagesBySession[sessionId]) {
          messagesBySession[sessionId] = [];
        }
        messagesBySession[sessionId].push(message);
      }
    });
    
    console.log(`📋 Messages grouped into ${Object.keys(messagesBySession).length} sessions`);
    
    // Save the conversation messages data
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `conversation-messages-july-7-1hour-${timestamp}.json`;
    const filepath = path.join(dataDir, filename);
    
    const conversationData = {
      collectionInfo: {
        dateRange: {
          from: '2025-07-07T17:00:00.000Z',
          to: '2025-07-07T18:00:00.000Z'
        },
        collectedAt: new Date().toISOString(),
        totalMessages: messages.length,
        totalSessions: Object.keys(messagesBySession).length,
        averageMessagesPerSession: Math.round(messages.length / Object.keys(messagesBySession).length),
        sourceSessionIds: sessionIds.length
      },
      messagesBySession: messagesBySession,
      allMessages: messages
    };
    
    fs.writeFileSync(filepath, JSON.stringify(conversationData, null, 2));
    
    console.log(`✅ Conversation messages saved to: ${filepath}`);
    console.log(`📊 Total messages: ${messages.length}`);
    console.log(`📋 Sessions with messages: ${Object.keys(messagesBySession).length}`);
    console.log(`📈 Average messages per session: ${conversationData.collectionInfo.averageMessagesPerSession}`);
    
    // Show sample message if available
    if (messages.length > 0) {
      const sampleMessage = messages[0];
      console.log(`📝 Sample message: "${sampleMessage.message || sampleMessage.data?.text || 'N/A'}" (${sampleMessage.type || sampleMessage.message_type})`);
    }
  } else {
    console.log('❌ No conversation messages were retrieved from any batch');
  }
}

collectConversationMessages().catch(console.error);