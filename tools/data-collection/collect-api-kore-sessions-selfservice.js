const http = require('http');
const fs = require('fs');
const path = require('path');

async function collectKoreSessionsSelfService() {
  console.log('Collecting /api/kore/sessions data with containment_type=selfService for July 7, 2025 (12-1 PM ET)...');
  
  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/kore/sessions?dateFrom=2025-07-07T17:00:00.000Z&dateTo=2025-07-07T18:00:00.000Z&limit=1000',
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
            // Filter for selfService containment type
            const selfServiceSessions = response.data.filter(session => 
              session.containment_type === 'selfService'
            );
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `api-kore-sessions-selfservice-${timestamp}.json`;
            const filepath = path.join(dataDir, filename);
            
            // Save the raw API response with only selfService sessions
            fs.writeFileSync(filepath, JSON.stringify({
              success: response.success,
              data: selfServiceSessions,
              message: `Found ${selfServiceSessions.length} selfService sessions`,
              timestamp: response.timestamp,
              meta: {
                ...response.meta,
                total_count: selfServiceSessions.length,
                containment_type_filter: 'selfService',
                date_range: {
                  from: '2025-07-07T17:00:00.000Z',
                  to: '2025-07-07T18:00:00.000Z'
                }
              }
            }, null, 2));
            
            console.log(`✅ Kore sessions (selfService) saved to: ${filepath}`);
            console.log(`📊 Total selfService sessions: ${selfServiceSessions.length}`);
            
            if (selfServiceSessions.length > 0) {
              const sampleSession = selfServiceSessions[0];
              console.log(`📝 Sample session: ${sampleSession.session_id} (${sampleSession.containment_type})`);
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

collectKoreSessionsSelfService().catch(console.error);