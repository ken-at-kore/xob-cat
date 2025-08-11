#!/usr/bin/env npx tsx

/**
 * Production Data Collection Script
 * 
 * Collects raw API response data from Kore.ai for the specified date range.
 * This data will be used to build realistic mock services that reproduce
 * real-world edge cases and bugs.
 * 
 * Usage: 
 *   npx tsx scripts/collect-production-data.ts
 *   npx tsx scripts/collect-production-data.ts --start "2025-08-07T09:00:00" --end "2025-08-07T09:30:00" --output "kore-api-compsych-swts"
 *   npx tsx scripts/collect-production-data.ts --start "2025-08-07T13:00:00Z" --end "2025-08-07T13:30:00Z" --output "custom-name"
 * 
 * Options:
 *   --start   Start datetime in ISO format (defaults to July 7, 2025 00:00 ET)
 *   --end     End datetime in ISO format (defaults to July 8, 2025 23:59:59 ET)
 *   --output  Output filename prefix (defaults to "kore-api-responses")
 */

import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import { parseArgs } from 'util';
import dotenv from 'dotenv';
import { DataSanitizer, SanitizationOptions } from './lib/data-sanitizer';

interface ProductionDataCollection {
  collectionInfo: {
    dateRange: {
      from: string;
      to: string;
    };
    collectedAt: string;
    totalSessions: number;
    totalMessages: number;
    containmentTypeBreakdown: Record<string, number>;
  };
  sessionHistory: {
    agent: any[];
    selfService: any[];
    dropOff: any[];
  };
  conversationMessages: any[];
}

// Helper function to sanitize data if requested
function sanitizeDataIfRequested(data: any, shouldSanitize: boolean): any {
  if (!shouldSanitize) {
    return data;
  }
  
  const sanitizer = new DataSanitizer({
    preserveStructure: true,
    preserveInternalIds: true
  });
  
  return sanitizer.sanitizeObject(data);
}

async function collectProductionData(): Promise<void> {
  console.log('🚀 Starting production data collection...');
  
  // Load environment variables from .env.local in project root
  const envPath = path.join(__dirname, '../.env.local');
  dotenv.config({ path: envPath });
  
  // Parse command line arguments
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      start: {
        type: 'string',
        short: 's',
      },
      end: {
        type: 'string', 
        short: 'e',
      },
      output: {
        type: 'string',
        short: 'o',
      },
      limit: {
        type: 'string',
        short: 'l',
      },
      files: {
        type: 'string',
        short: 'f',
      },
      containment: {
        type: 'string',
        short: 'c',
      },
      sanitize: {
        type: 'boolean',
        short: 'x',
      },
      help: {
        type: 'boolean',
        short: 'h',
      }
    }
  });

  if (values.help) {
    console.log(`
Usage: npx tsx scripts/collect-production-data.ts [options]

Options:
  --start, -s   Start datetime in ISO format or local time
                Examples: "2025-08-07T09:00:00" (local), "2025-08-07T13:00:00Z" (UTC)
                Default: July 7, 2025 00:00 ET
                
  --end, -e     End datetime in ISO format or local time  
                Examples: "2025-08-07T09:30:00" (local), "2025-08-07T13:30:00Z" (UTC)
                Default: July 8, 2025 23:59:59 ET
                
  --output, -o  Output filename prefix (will be saved in data/ directory)
                Default: "kore-api-responses"
                
  --limit, -l   Maximum number of sessions to output (applied after collection, across all containment types)
                Default: 100
                
  --files, -f   Comma-separated list of output files to generate
                Options: complete,agent,selfservice,dropoff,messages,summary
                Default: "complete" (just the complete dataset)
                Example: "complete,messages,summary" or "all" for all files
                
  --containment, -c  Filter by containment type (optional)
                Options: agent, selfService, dropOff
                Default: collect all types
                Example: --containment dropOff
                
  --sanitize, -x    Automatically sanitize sensitive data in the collected files
                Replaces names, phone numbers, addresses, etc. with consistent fake data
                Default: false (collect raw production data)
                
  --help, -h    Show this help message

Examples:
  # Collect 20 sessions, complete dataset only
  npx tsx scripts/collect-production-data.ts --start "2025-08-07T09:00:00" --end "2025-08-07T09:30:00" --limit 20 --files complete
  
  # Collect only dropOff sessions
  npx tsx scripts/collect-production-data.ts --start "2025-08-07T09:00:00" --end "2025-08-07T09:30:00" --containment dropOff --limit 20
  
  # Collect all output files
  npx tsx scripts/collect-production-data.ts --start "2025-08-07T09:00:00" --end "2025-08-07T09:30:00" --files all
  
  # Collect specific files with containment filter
  npx tsx scripts/collect-production-data.ts --start "2025-08-07T09:00:00" --end "2025-08-07T09:30:00" --containment selfService --files "complete,messages,summary"
  
  # Collect and automatically sanitize sensitive data
  npx tsx scripts/collect-production-data.ts --start "2025-08-07T09:00:00" --end "2025-08-07T09:30:00" --limit 10 --sanitize
    `);
    process.exit(0);
  }

  // Parse dates from arguments or use defaults
  let startDate: Date;
  let endDate: Date;
  
  if (values.start) {
    // If the string doesn't contain 'Z' or timezone offset, treat as local time
    if (!values.start.includes('Z') && !values.start.match(/[+-]\d{2}:\d{2}$/)) {
      // Convert local time to ET (UTC-4 for EDT)
      startDate = new Date(values.start + '-04:00');
    } else {
      startDate = new Date(values.start);
    }
  } else {
    // Default: July 7, 2025 00:00 ET
    startDate = new Date('2025-07-07T04:00:00.000Z');
  }
  
  if (values.end) {
    // If the string doesn't contain 'Z' or timezone offset, treat as local time
    if (!values.end.includes('Z') && !values.end.match(/[+-]\d{2}:\d{2}$/)) {
      // Convert local time to ET (UTC-4 for EDT)
      endDate = new Date(values.end + '-04:00');
    } else {
      endDate = new Date(values.end);
    }
  } else {
    // Default: July 8, 2025 23:59:59 ET
    endDate = new Date('2025-07-09T03:59:59.999Z');
  }

  // Validate dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error('❌ Invalid date format. Please use ISO format like "2025-08-07T09:00:00"');
    process.exit(1);
  }
  
  if (startDate >= endDate) {
    console.error('❌ Start date must be before end date');
    process.exit(1);
  }
  
  const outputPrefix = values.output || 'kore-api-responses';
  const sessionLimit = parseInt(values.limit || '100', 10);
  const filesParam = values.files || 'complete';
  const shouldSanitize = values.sanitize || false;
  
  // Parse which files to generate
  const filesToGenerate = {
    complete: filesParam === 'all' || filesParam.includes('complete'),
    agent: filesParam === 'all' || filesParam.includes('agent'),
    selfService: filesParam === 'all' || filesParam.includes('selfservice'),
    dropOff: filesParam === 'all' || filesParam.includes('dropoff'),
    messages: filesParam === 'all' || filesParam.includes('messages'),
    summary: filesParam === 'all' || filesParam.includes('summary'),
  };

  const dateFrom = startDate.toISOString();
  const dateTo = endDate.toISOString();
  
  console.log(`📅 Collection period: ${dateFrom} to ${dateTo}`);
  console.log(`📅 Human readable: ${startDate.toLocaleString('en-US', { timeZone: 'America/New_York' })} to ${endDate.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
  console.log(`📁 Output prefix: ${outputPrefix}`);
  console.log(`🔢 Session limit: ${sessionLimit}`);
  console.log(`📄 Files to generate: ${Object.entries(filesToGenerate).filter(([_, v]) => v).map(([k]) => k).join(', ')}`);
  console.log(`🔒 Sanitize data: ${shouldSanitize ? 'Yes - will replace sensitive information' : 'No - raw production data'}`);

  // Use the same backend API endpoint that the working app uses
  const BACKEND_URL = 'http://localhost:3001';
  
  // Get credentials from .env.local
  const botId = process.env.TEST_BOT_ID;
  const clientId = process.env.TEST_CLIENT_ID;
  const clientSecret = process.env.TEST_CLIENT_SECRET;
  
  if (!botId || !clientId || !clientSecret) {
    console.error('❌ Missing Kore.ai credentials in .env.local');
    console.error('   Please ensure TEST_BOT_ID, TEST_CLIENT_ID, and TEST_CLIENT_SECRET are set');
    process.exit(1);
  }
  
  console.log(`🔗 Using backend API at: ${BACKEND_URL}`);
  console.log(`📡 Using CompSych bot credentials from .env.local`);
  console.log(`🤖 Bot ID: ${botId.substring(0, 12)}...`);
  
  // Test backend connection
  try {
    const healthResponse = await axios.get(`${BACKEND_URL}/health`);
    console.log(`✅ Backend health check passed:`, healthResponse.data.service);
  } catch (error) {
    console.error('❌ Backend is not running. Please start with: npm run dev:backend');
    console.log('💡 The collection script needs the backend to be running to access Kore.ai credentials');
    process.exit(1);
  }

  const dataCollection: ProductionDataCollection = {
    collectionInfo: {
      dateRange: { from: dateFrom, to: dateTo },
      collectedAt: new Date().toISOString(),
      totalSessions: 0,
      totalMessages: 0,
      containmentTypeBreakdown: {}
    },
    sessionHistory: {
      agent: [],
      selfService: [],
      dropOff: []
    },
    conversationMessages: []
  };

  // Step 1: Collect session history using the same endpoint the app uses
  console.log('\n📊 Step 1: Collecting session history...');
  
  let allSessions: any[] = [];
  const allSessionIds: string[] = [];

  try {
    console.log(`🔍 Calling backend /api/analysis/sessions endpoint...`);
    
    // Convert dates to the format the backend expects (YYYY-MM-DD)
    const startDateStr = startDate.toISOString().split('T')[0]; // 2025-07-06
    const endDateStr = endDate.toISOString().split('T')[0];     // 2025-07-13
    
    console.log(`📡 Date filters: start_date=${startDateStr}, end_date=${endDateStr}`);
    
    // Use the same API call that the frontend makes, with credentials in headers
    const params = new URLSearchParams();
    params.append('start_date', startDateStr);
    params.append('end_date', endDateStr);
    // Note: Don't apply limit here - we'll apply it after collecting all sessions
    
    const url = `${BACKEND_URL}/api/analysis/sessions?${params.toString()}`;
    console.log(`📡 Making API call: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'x-bot-id': botId,
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
      }
    });
    
    // Debug: Check if we're getting mock or real data
    console.log(`📊 Response metadata:`, response.data.meta);
    console.log(`📊 Response success:`, response.data.success);
    if (response.data.data && response.data.data.length > 0) {
      const firstSession = response.data.data[0];
      console.log(`🔍 First session ID pattern:`, firstSession.session_id);
      console.log(`🔍 Session has real API characteristics?:`, 
        firstSession.session_id.includes('session_') && firstSession.session_id.includes('_') ? 'MOCK DATA DETECTED' : 'REAL API DATA'
      );
    }
    
    if (response.data.success) {
      allSessions = response.data.data || [];
      console.log(`✅ Total sessions retrieved: ${allSessions.length}`);
      
      // Apply containment type filter if specified
      if (values.containment) {
        const containmentFilter = values.containment;
        const beforeFilter = allSessions.length;
        allSessions = allSessions.filter(session => session.containment_type === containmentFilter);
        console.log(`🔍 Filtering by containment type: ${containmentFilter}`);
        console.log(`🔍 Sessions after filter: ${allSessions.length} (was ${beforeFilter})`);
        
        if (allSessions.length === 0) {
          console.log(`❌ No sessions found with containment type: ${containmentFilter}`);
          console.log(`💡 Available types in this dataset: ${[...new Set(response.data.data.map((s: any) => s.containment_type))].join(', ')}`);
          process.exit(1);
        }
      }
      
      // Apply session limit here (across all containment types)
      if (sessionLimit && allSessions.length > sessionLimit) {
        console.log(`🔢 Applying session limit: ${sessionLimit} (was ${allSessions.length})`);
        allSessions = allSessions.slice(0, sessionLimit);
        console.log(`✂️ Sessions limited to: ${allSessions.length}`);
      }
      
      // Group sessions by containment type for storage  
      const sessionsByContainmentType = {
        agent: [] as any[],
        selfService: [] as any[],
        dropOff: [] as any[]
      };
      
      for (const session of allSessions) {
        const containmentType = session.containment_type;
        if (containmentType && sessionsByContainmentType[containmentType as keyof typeof sessionsByContainmentType]) {
          sessionsByContainmentType[containmentType as keyof typeof sessionsByContainmentType].push(session);
        }
        
        // Collect session ID for potential message retrieval
        if (session.session_id) {
          allSessionIds.push(session.session_id);
        }
      }
      
      // Store the raw sessions data (this is what we want for mocks)
      dataCollection.sessionHistory.agent = sessionsByContainmentType.agent;
      dataCollection.sessionHistory.selfService = sessionsByContainmentType.selfService;
      dataCollection.sessionHistory.dropOff = sessionsByContainmentType.dropOff;
      
      // Update collection info
      dataCollection.collectionInfo.containmentTypeBreakdown = {
        agent: sessionsByContainmentType.agent.length,
        selfService: sessionsByContainmentType.selfService.length,
        dropOff: sessionsByContainmentType.dropOff.length
      };
      dataCollection.collectionInfo.totalSessions = allSessions.length;
      
      // Log sample session structure for debugging
      if (allSessions.length > 0) {
        console.log(`📋 Sample session structure:`, Object.keys(allSessions[0]));
        console.log(`📋 Sample session data:`, JSON.stringify(allSessions[0], null, 2));
      }
      
      console.log(`📊 Breakdown:`);
      console.log(`   - agent: ${sessionsByContainmentType.agent.length} sessions`);
      console.log(`   - selfService: ${sessionsByContainmentType.selfService.length} sessions`);
      console.log(`   - dropOff: ${sessionsByContainmentType.dropOff.length} sessions`);
      
    } else {
      throw new Error(`Backend API returned error: ${response.data.error || 'Unknown error'}`);
    }
    
  } catch (error: any) {
    console.error(`❌ Error collecting sessions:`, error.message);
    
    // Try to extract API error details
    if (error.response && error.response.data) {
      console.error(`🔍 Backend API Error Details:`, error.response.data);
      console.error(`🔍 HTTP Status:`, error.response.status);
    }
  }

  console.log(`\n📊 Total sessions collected: ${dataCollection.collectionInfo.totalSessions}`);
  console.log(`📊 Unique session IDs: ${[...new Set(allSessionIds)].length}`);

  // Step 2: Messages are already included in the session data from /api/analysis/sessions
  console.log('\n💬 Step 2: Analyzing message data...');
  
  let totalMessages = 0;
  const allMessages: any[] = [];
  
  // Extract messages from sessions (they're already included in the SessionWithTranscript objects)
  for (const session of allSessions) {
    if (session.messages && Array.isArray(session.messages)) {
      totalMessages += session.messages.length;
      allMessages.push(...session.messages.map((msg: any) => ({
        ...msg,
        session_id: session.session_id // Add session context
      })));
    }
  }
  
  dataCollection.conversationMessages = allMessages;
  dataCollection.collectionInfo.totalMessages = totalMessages;
  
  console.log(`✅ Message analysis complete: ${totalMessages} messages total`);
  
  // Log sample message structure for debugging
  if (allMessages.length > 0) {
    console.log(`📋 Sample message structure:`, Object.keys(allMessages[0]));
    console.log(`📋 Sample message:`, JSON.stringify(allMessages[0], null, 2));
    
    // Look for messages that might cause the "No messages" bug
    const messagesWithoutText = allMessages.filter((msg: any) => !msg.message || msg.message.trim() === '');
    const messagesWithInvalidType = allMessages.filter((msg: any) => !msg.message_type || (msg.message_type !== 'user' && msg.message_type !== 'bot'));
    const messagesWithInvalidTimestamp = allMessages.filter((msg: any) => !msg.timestamp);
    
    console.log(`🔍 Message quality analysis:`);
    console.log(`   - Messages without text: ${messagesWithoutText.length}`);
    console.log(`   - Messages with invalid type: ${messagesWithInvalidType.length}`);
    console.log(`   - Messages with invalid timestamp: ${messagesWithInvalidTimestamp.length}`);
    
    if (messagesWithoutText.length > 0) {
      console.log(`📋 Sample message without text:`, JSON.stringify(messagesWithoutText[0], null, 2));
    }
  }

  // Step 3: Save collected data
  console.log('\n💾 Step 3: Saving collected data...');
  
  if (shouldSanitize) {
    console.log('🔒 Applying data sanitization...');
  }
  
  const outputDir = path.join(__dirname, '../data');
  await fs.mkdir(outputDir, { recursive: true });
  
  const filesCreated: string[] = [];
  let sanitizationStats: any = null;
  
  // Save complete collection  
  if (filesToGenerate.complete) {
    const outputFile = path.join(outputDir, `${outputPrefix}-${new Date().toISOString().split('T')[0]}.json`);
    const dataToSave = sanitizeDataIfRequested(dataCollection, shouldSanitize);
    await fs.writeFile(outputFile, JSON.stringify(dataToSave, null, 2));
    filesCreated.push(`${outputPrefix}-${new Date().toISOString().split('T')[0]}.json (complete dataset)`);
    
    // Capture sanitization stats from the first sanitization
    if (shouldSanitize && !sanitizationStats) {
      const tempSanitizer = new DataSanitizer({ preserveStructure: true, preserveInternalIds: true });
      tempSanitizer.sanitizeObject(dataCollection);
      sanitizationStats = tempSanitizer.getSanitizationStats();
    }
  }
  
  // Save individual parts for easier access (with prefix)
  if (filesToGenerate.agent) {
    const dataToSave = sanitizeDataIfRequested(dataCollection.sessionHistory.agent, shouldSanitize);
    await fs.writeFile(
      path.join(outputDir, `${outputPrefix}-agent.json`),
      JSON.stringify(dataToSave, null, 2)
    );
    filesCreated.push(`${outputPrefix}-agent.json (agent sessions)`);
  }
  
  if (filesToGenerate.selfService) {
    const dataToSave = sanitizeDataIfRequested(dataCollection.sessionHistory.selfService, shouldSanitize);
    await fs.writeFile(
      path.join(outputDir, `${outputPrefix}-selfService.json`),
      JSON.stringify(dataToSave, null, 2)
    );
    filesCreated.push(`${outputPrefix}-selfService.json (self-service sessions)`);
  }
  
  if (filesToGenerate.dropOff) {
    const dataToSave = sanitizeDataIfRequested(dataCollection.sessionHistory.dropOff, shouldSanitize);
    await fs.writeFile(
      path.join(outputDir, `${outputPrefix}-dropOff.json`),
      JSON.stringify(dataToSave, null, 2)
    );
    filesCreated.push(`${outputPrefix}-dropOff.json (drop-off sessions)`);
  }
  
  if (filesToGenerate.messages) {
    const dataToSave = sanitizeDataIfRequested(dataCollection.conversationMessages, shouldSanitize);
    await fs.writeFile(
      path.join(outputDir, `${outputPrefix}-messages.json`),
      JSON.stringify(dataToSave, null, 2)
    );
    filesCreated.push(`${outputPrefix}-messages.json (all messages)`);
  }
  
  // Save collection summary
  if (filesToGenerate.summary) {
    const summary = {
      ...dataCollection.collectionInfo,
      sampleSession: dataCollection.sessionHistory.agent[0] || 
                     dataCollection.sessionHistory.selfService[0] || 
                     dataCollection.sessionHistory.dropOff[0] || null,
      sampleMessage: dataCollection.conversationMessages[0] || null,
      messageStructureTypes: [...new Set(
        dataCollection.conversationMessages
          .flatMap((msg: any) => (msg.components || []).map((comp: any) => comp.cT))
          .filter(Boolean)
      )],
      sessionIdSample: [...new Set(allSessionIds)].slice(0, 10)
    };
    
    const summaryToSave = sanitizeDataIfRequested(summary, shouldSanitize);
    await fs.writeFile(
      path.join(outputDir, `${outputPrefix}-summary.json`),
      JSON.stringify(summaryToSave, null, 2)
    );
    filesCreated.push(`${outputPrefix}-summary.json (analysis summary)`);
  }

  // Final report
  console.log('\n✅ Data collection complete!');
  console.log(`📁 Data saved to: ${outputDir}`);
  console.log('\n📊 Collection Summary:');
  console.log(`   📅 Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
  console.log(`   🎯 Total sessions: ${dataCollection.collectionInfo.totalSessions}`);
  console.log(`   💬 Total messages: ${dataCollection.collectionInfo.totalMessages}`);
  console.log(`   📊 Breakdown:`);
  for (const [type, count] of Object.entries(dataCollection.collectionInfo.containmentTypeBreakdown)) {
    console.log(`      - ${type}: ${count} sessions`);
  }
  console.log('\n📁 Files created:');
  filesCreated.forEach(file => {
    console.log(`   - ${file}`);
  });
  
  if (shouldSanitize && sanitizationStats) {
    console.log('\n🔒 Data Sanitization Summary:');
    console.log(`   - Unique names replaced: ${sanitizationStats.byType.names}`);
    console.log(`   - Unique phone numbers replaced: ${sanitizationStats.byType.phones}`);
    console.log(`   - Unique email addresses replaced: ${sanitizationStats.byType.emails}`);
    console.log(`   - Unique addresses replaced: ${sanitizationStats.byType.addresses}`);
    console.log(`   - Unique policy IDs replaced: ${sanitizationStats.byType.policyIds}`);
    console.log(`   - Total replacements: ${sanitizationStats.totalReplacements}`);
    console.log('   ✅ All sensitive data has been replaced with consistent fake data');
  }
  
  console.log('\n🔧 Next steps:');
  console.log('   1. Review the data structure in collection-summary.json');
  if (!shouldSanitize) {
    console.log('   2. Sanitize sensitive data if needed (add --sanitize flag)');
  }
  console.log('   3. Update mock services to use this real data');
  console.log('   4. Test against edge cases found in the data');
}

// Run the collection
if (require.main === module) {
  collectProductionData().catch(error => {
    console.error('❌ Data collection failed:', error);
    process.exit(1);
  });
}

export { collectProductionData };