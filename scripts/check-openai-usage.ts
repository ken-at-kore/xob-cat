#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv';
import * as path from 'path';
import https from 'https';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function checkUsageAndLimits() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('🔑 Checking usage for API Key:', `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log('\n📊 Key Information:');
  
  // Decode the key pattern
  const keyParts = apiKey.split('-');
  if (keyParts[1] === 'proj') {
    console.log('   Type: Project API Key');
    console.log('   Project ID fragment:', keyParts[2]?.substring(0, 8) + '...');
  } else {
    console.log('   Type: User API Key');
  }
  
  // Check when the key was created (approximate from the pattern)
  console.log('\n💭 Possible explanations for "exceeded quota" on a new key:');
  console.log('   1. The project/organization has hit its monthly spending limit');
  console.log('   2. Rate limits were hit (requests per minute/day)');
  console.log('   3. The organization has multiple projects sharing the same quota');
  console.log('   4. Free tier credits were exhausted (if on free tier)');
  console.log('   5. The key belongs to a project with restricted limits');
  
  console.log('\n🔍 To diagnose further:');
  console.log('   1. Check your organization\'s usage: https://platform.openai.com/usage');
  console.log('   2. Check rate limits: https://platform.openai.com/settings/organization/limits');
  console.log('   3. Check project settings if using project keys');
  console.log('   4. Try creating a key in a different project or organization');
  
  console.log('\n📝 Note: OpenAI\'s usage dashboard updates can be delayed by several hours');
  
  // Try to make a basic API call to get more specific error details
  console.log('\n🧪 Making test request for detailed error info...');
  
  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };

  const data = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'test' }],
    max_tokens: 1
  });

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          if (response.error) {
            console.log('\n🔴 Error details from API:');
            console.log('   Type:', response.error.type);
            console.log('   Code:', response.error.code);
            if (response.error.param) {
              console.log('   Param:', response.error.param);
            }
            console.log('   Message:', response.error.message);
          }
        } catch (e) {
          console.log('Raw response:', responseData);
        }
        resolve(null);
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve(null);
    });

    req.write(data);
    req.end();
  });
}

checkUsageAndLimits();