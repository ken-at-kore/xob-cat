#!/usr/bin/env tsx

/**
 * Generate Mock Analysis Data
 * 
 * This script creates mock analyzed session data for testing the Auto-Analyze
 * reporting UI without needing to perform real OpenAI analysis.
 * 
 * Usage: npx tsx scripts/generate-mock-analysis.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { SessionWithTranscript, SessionWithFacts, AnalysisResult } from '../shared/types';

// Sample realistic analysis data for different session types
const SAMPLE_INTENTS = [
  'Claim Status',
  'Billing',
  'Eligibility',
  'Live Agent', 
  'Provider Enrollment',
  'Portal Access',
  'Authorization',
  'Policy Information',
  'Technical Support',
  'Account Update'
];

const TRANSFER_REASONS = [
  'Invalid Provider ID',
  'Invalid Member ID', 
  'Invalid Claim Number',
  'No Provider ID',
  'Inactive Provider ID',
  'Authentication Failed',
  'Technical Issue',
  'Policy Not Found',
  'Can\'t Capture Policy Number',
  'Complex Billing Issue'
];

const DROP_OFF_LOCATIONS = [
  'Policy Number Prompt',
  'Authentication',
  'Claim Details',
  'Member Information',
  'Provider ID',
  'Date of Service',
  'User Name',
  'Payment Information',
  'Contact Verification'
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomBool(probability = 0.5): boolean {
  return Math.random() < probability;
}

/**
 * Generate realistic analysis facts for a session
 */
function generateMockFacts(session: SessionWithTranscript): AnalysisResult {
  const isTransfer = randomBool(0.3); // 30% transfer rate
  const intent = randomChoice(SAMPLE_INTENTS);
  
  let transferReason = '';
  let dropOffLocation = '';
  
  if (isTransfer) {
    transferReason = randomChoice(TRANSFER_REASONS);
    dropOffLocation = randomChoice(DROP_OFF_LOCATIONS);
  }
  
  // Generate realistic notes based on the intent and outcome
  let notes = '';
  if (isTransfer) {
    notes = `User attempted ${intent.toLowerCase()} but encountered ${transferReason.toLowerCase()}, transferred to live agent.`;
  } else {
    notes = `User successfully completed ${intent.toLowerCase()} inquiry through self-service flow.`;
  }
  
  return {
    generalIntent: intent,
    sessionOutcome: isTransfer ? 'Transfer' : 'Contained',
    transferReason,
    dropOffLocation,
    notes
  };
}

/**
 * Generate mock analysis metadata for a session
 */
function generateMockAnalysisMetadata() {
  return {
    tokensUsed: Math.floor(Math.random() * 400) + 400, // 400-800 tokens
    processingTime: Math.floor(Math.random() * 3000) + 1000, // 1-4 seconds
    batchNumber: Math.floor(Math.random() * 10) + 1, // Batch 1-10
    timestamp: new Date().toISOString(),
    cost: (Math.random() * 0.03 + 0.01) // $0.01-$0.04
  };
}

/**
 * Load session data from the data directory
 */
async function loadSessionData(): Promise<SessionWithTranscript[]> {
  const dataDir = path.join(__dirname, '../data');
  const files = await fs.readdir(dataDir);
  
  // Look for session files (not message files)
  const sessionFiles = files.filter(f => 
    f.includes('sessions') && 
    f.endsWith('.json') && 
    !f.includes('messages')
  );
  
  console.log(`Found ${sessionFiles.length} session data files`);
  
  const allSessions: SessionWithTranscript[] = [];
  
  for (const file of sessionFiles) {
    try {
      const filePath = path.join(dataDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.success && data.data && Array.isArray(data.data)) {
        const sessions = data.data as SessionWithTranscript[];
        console.log(`Loaded ${sessions.length} sessions from ${file}`);
        allSessions.push(...sessions);
      }
    } catch (error) {
      console.warn(`Failed to load ${file}:`, error);
    }
  }
  
  return allSessions;
}

/**
 * Generate mock messages for sessions that don't have transcripts
 */
function generateMockMessages(session: SessionWithTranscript): SessionWithTranscript {
  if (session.messages && session.messages.length > 0) {
    return session; // Already has messages
  }
  
  // Generate realistic conversation based on the intent
  const intents = ['claim status', 'billing', 'eligibility', 'portal access', 'authorization', 'provider enrollment'];
  const intent = randomChoice(intents);
  
  const mockMessages = [
    {
      message: 'Hello! How can I help you today?',
      message_type: 'bot' as const,
      timestamp: session.start_time
    },
    {
      message: `I need help with my ${intent}`,
      message_type: 'user' as const,
      timestamp: new Date(new Date(session.start_time).getTime() + 30000).toISOString()
    },
    {
      message: `I can help you with your ${intent}. Please provide your member ID to get started.`,
      message_type: 'bot' as const,
      timestamp: new Date(new Date(session.start_time).getTime() + 60000).toISOString()
    },
    {
      message: 'My member ID is 123456789',
      message_type: 'user' as const,
      timestamp: new Date(new Date(session.start_time).getTime() + 90000).toISOString()
    },
    {
      message: 'Thank you. Let me look up your information...',
      message_type: 'bot' as const,
      timestamp: new Date(new Date(session.start_time).getTime() + 120000).toISOString()
    }
  ];
  
  // Add 2-3 more messages to make it realistic
  const additionalMessages = Math.floor(Math.random() * 3) + 2; // 2-4 more messages
  for (let i = 0; i < additionalMessages; i++) {
    const isUserMessage = i % 2 === 0;
    const messageIndex = mockMessages.length + 1;
    const timeOffset = 150000 + (i * 30000); // 30 seconds apart
    
    let messageContent;
    if (isUserMessage) {
      messageContent = i === 0 ? 'What did you find?' : 
                      i === 1 ? 'Can you help me with that?' : 
                      'Thank you for your help';
    } else {
      messageContent = i === 0 ? `I found your ${intent} information. Everything looks good.` :
                      i === 1 ? 'Yes, I can assist you with that. Let me process this for you.' :
                      'You\'re welcome! Is there anything else I can help you with today?';
    }
    
    mockMessages.push({
      message: messageContent,
      message_type: isUserMessage ? 'user' as const : 'bot' as const,
      timestamp: new Date(new Date(session.start_time).getTime() + timeOffset).toISOString()
    });
  }
  
  return {
    ...session,
    messages: mockMessages
  };
}

/**
 * Main function to generate mock analysis data
 */
async function generateMockAnalysis() {
  try {
    console.log('Loading session data...');
    const rawSessions = await loadSessionData();
    
    if (rawSessions.length === 0) {
      console.error('No session data found in data directory');
      process.exit(1);
    }
    
    console.log(`Processing ${rawSessions.length} sessions...`);
    
    // Take up to 50 sessions for the mock analysis (reasonable sample size)
    const selectedSessions = rawSessions.slice(0, 50);
    
    const mockAnalyzedSessions: SessionWithFacts[] = selectedSessions.map(session => {
      // Ensure session has messages for realistic analysis
      const sessionWithMessages = generateMockMessages(session);
      
      // Calculate message counts from the messages array
      const messageCount = sessionWithMessages.messages?.length || 0;
      const userMessageCount = sessionWithMessages.messages?.filter(m => m.message_type === 'user').length || 0;
      const botMessageCount = sessionWithMessages.messages?.filter(m => m.message_type === 'bot').length || 0;
      
      // Generate mock analysis facts
      const facts = generateMockFacts(sessionWithMessages);
      
      // Generate mock analysis metadata
      const analysisMetadata = generateMockAnalysisMetadata();
      
      return {
        ...sessionWithMessages,
        message_count: messageCount,
        user_message_count: userMessageCount,
        bot_message_count: botMessageCount,
        facts,
        analysisMetadata
      };
    });
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '../data');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Write the mock analysis data
    const outputPath = path.join(outputDir, 'mock-analysis-results.json');
    await fs.writeFile(
      outputPath, 
      JSON.stringify(mockAnalyzedSessions, null, 2),
      'utf-8'
    );
    
    console.log(`✅ Generated mock analysis for ${mockAnalyzedSessions.length} sessions`);
    console.log(`📄 Saved to: ${outputPath}`);
    
    // Print summary statistics
    const transferCount = mockAnalyzedSessions.filter(s => s.facts.sessionOutcome === 'Transfer').length;
    const containedCount = mockAnalyzedSessions.filter(s => s.facts.sessionOutcome === 'Contained').length;
    const uniqueIntents = new Set(mockAnalyzedSessions.map(s => s.facts.generalIntent)).size;
    
    console.log('\n📊 Analysis Summary:');
    console.log(`   Total Sessions: ${mockAnalyzedSessions.length}`);
    console.log(`   Transferred: ${transferCount} (${Math.round(transferCount/mockAnalyzedSessions.length*100)}%)`);
    console.log(`   Contained: ${containedCount} (${Math.round(containedCount/mockAnalyzedSessions.length*100)}%)`);
    console.log(`   Unique Intents: ${uniqueIntents}`);
    
  } catch (error) {
    console.error('Error generating mock analysis:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  generateMockAnalysis();
}

export { generateMockAnalysis };