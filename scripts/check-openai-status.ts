#!/usr/bin/env npx tsx
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import https from 'https';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Check OpenAI status page
async function checkOpenAIStatus() {
  return new Promise((resolve) => {
    console.log('🔍 Checking OpenAI API status...');
    
    https.get('https://status.openai.com/api/v2/status.json', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const status = JSON.parse(data);
          console.log('📊 OpenAI Status:', status.status.description);
          console.log('   Indicator:', status.status.indicator);
          resolve(status);
        } catch (e) {
          console.log('⚠️  Could not fetch OpenAI status');
          resolve(null);
        }
      });
    }).on('error', () => {
      console.log('⚠️  Could not fetch OpenAI status');
      resolve(null);
    });
  });
}

async function testMinimalRequest() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('\n🔑 Testing with API Key:', `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  
  try {
    const openai = new OpenAI({ apiKey });
    
    // Test 1: List models (doesn't consume tokens)
    console.log('\n📋 Test 1: Listing available models...');
    const models = await openai.models.list();
    const gpt4oMini = Array.from(models).find(m => m.id === 'gpt-4o-mini');
    
    if (gpt4oMini) {
      console.log('✅ Found gpt-4o-mini model');
    } else {
      console.log('❌ gpt-4o-mini not found in available models');
    }
    
    // Test 2: Minimal completion
    console.log('\n💬 Test 2: Minimal chat completion...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1,
      temperature: 0
    });
    
    console.log('✅ API call succeeded!');
    console.log('   Response:', completion.choices[0]?.message?.content);
    
  } catch (error: any) {
    console.error('\n❌ Error details:');
    console.error('   Message:', error.message);
    
    if (error?.status) {
      console.error('   Status:', error.status);
      console.error('   Type:', error.type);
      console.error('   Code:', error.code);
    }
    
    if (error?.error?.message) {
      console.error('   API Message:', error.error.message);
    }
    
    // Check if it's a quota error
    if (error?.status === 429 && error?.code === 'insufficient_quota') {
      console.log('\n📝 This appears to be a quota issue, not a service interruption.');
      console.log('   Even brand new keys need an active billing setup.');
    }
  }
}

async function main() {
  await checkOpenAIStatus();
  await testMinimalRequest();
  
  console.log('\n🔗 Useful links:');
  console.log('   - OpenAI Status: https://status.openai.com');
  console.log('   - API Usage: https://platform.openai.com/usage');
  console.log('   - Billing: https://platform.openai.com/settings/organization/billing');
}

main();