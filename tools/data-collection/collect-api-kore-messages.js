const http = require('http');
const fs = require('fs');
const path = require('path');

async function collectKoreMessages() {
  console.log('Collecting /api/kore/messages data for July 7, 2025 (12-1 PM ET)...');
  
  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/kore/messages?dateFrom=2025-07-07T17:00:00.000Z&dateTo=2025-07-07T18:00:00.000Z',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.success && response.data) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `api-kore-messages-${timestamp}.json`;
            const filepath = path.join(dataDir, filename);
            
            // Save the raw API response exactly as returned
            fs.writeFileSync(filepath, JSON.stringify(response, null, 2));
            
            console.log(`✅ Kore messages saved to: ${filepath}`);
            console.log(`📊 Total messages: ${response.data.length}`);
            
            // Group messages by session for summary
            const messagesBySession = {};
            response.data.forEach(message => {
              const sessionId = message.sessionId || message.session_id;
              if (sessionId) {
                if (!messagesBySession[sessionId]) {
                  messagesBySession[sessionId] = [];
                }
                messagesBySession[sessionId].push(message);
              }
            });
            
            console.log(`🗂️ Messages grouped into ${Object.keys(messagesBySession).length} sessions`);
            console.log(`📈 Average messages per session: ${Math.round(response.data.length / Object.keys(messagesBySession).length)}`);
            
            if (response.data.length > 0) {
              const sampleMessage = response.data[0];
              console.log(`📝 Sample message: "${sampleMessage.message || sampleMessage.data?.text || 'N/A'}" (${sampleMessage.message_type || sampleMessage.type})`);
            }
            
            resolve(filepath);
          } else {
            reject(new Error('No data in response: ' + JSON.stringify(response)));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

collectKoreMessages().catch(console.error);