const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/analysis/sessions?start_date=2025-07-07T04:00:00.000Z&end_date=2025-07-09T03:59:59.999Z&limit=3',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Testing message retrieval from updated backend...');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      console.log('\n=== API Response Summary ===');
      console.log('Status Code:', res.statusCode);
      console.log('Total Sessions:', response.sessions ? response.sessions.length : 0);
      
      if (response.sessions && response.sessions.length > 0) {
        const firstSession = response.sessions[0];
        console.log('\n=== First Session ===');
        console.log('Session ID:', firstSession.session_id);
        console.log('Messages Count:', firstSession.messages ? firstSession.messages.length : 0);
        
        if (firstSession.messages && firstSession.messages.length > 0) {
          console.log('\n=== SUCCESS! Messages Retrieved ===');
          console.log('First Message:', firstSession.messages[0]);
        } else {
          console.log('\n=== ISSUE: No messages in session ===');
          console.log('Session has empty messages array');
        }
      }
      
    } catch (error) {
      console.error('Error parsing response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.end();