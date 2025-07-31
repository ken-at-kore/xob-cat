#!/usr/bin/env npx tsx
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function testOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('🔑 OpenAI API Key found:', `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  
  try {
    const openai = new OpenAI({ apiKey });
    
    console.log('🚀 Testing connection to OpenAI API with gpt-4o-mini...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Say "Hello from XOB CAT!" in exactly 5 words.'
        }
      ],
      max_tokens: 20,
      temperature: 0
    });

    const response = completion.choices[0]?.message?.content || 'No response';
    const usage = completion.usage;
    
    console.log('✅ API Key is valid and working!');
    console.log('📝 Response:', response);
    console.log('📊 Token usage:', {
      prompt: usage?.prompt_tokens,
      completion: usage?.completion_tokens,
      total: usage?.total_tokens
    });
    console.log('💰 Estimated cost:', `$${((usage?.total_tokens || 0) * 0.00015 / 1000).toFixed(6)}`);
    
  } catch (error: any) {
    console.error('❌ Error testing OpenAI API:');
    
    if (error?.status === 401) {
      console.error('   Invalid API key. Please check that your key is correct.');
    } else if (error?.status === 429) {
      console.error('   Rate limit or quota exceeded.');
      console.error('   Please check your OpenAI account billing at: https://platform.openai.com/usage');
    } else if (error?.status === 404) {
      console.error('   Model not found. The gpt-4o-mini model may not be available for your account.');
    } else if (error instanceof Error) {
      console.error('  ', error.message);
    }
    
    if (error?.status) {
      console.error('   HTTP Status:', error.status);
    }
    
    console.log('\n💡 Common solutions:');
    console.log('   1. Check your billing at https://platform.openai.com/usage');
    console.log('   2. Verify API key at https://platform.openai.com/api-keys');
    console.log('   3. Ensure you have credits or valid payment method');
    
    process.exit(1);
  }
}

// Run the test
testOpenAIKey();