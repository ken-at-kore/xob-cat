#!/usr/bin/env node

/**
 * XOB CAT Data Retrieval CLI
 * 
 * Retrieves session history and conversation history from Kore.ai API
 * and saves the data to output files for review.
 * 
 * Usage:
 *   node cli-retrieve-data.js --help
 *   node cli-retrieve-data.js --sessions --messages --output-dir ./output
 *   node cli-retrieve-data.js --sessions --limit 5 --output-dir ./output
 *   node cli-retrieve-data.js --messages --date-from "2025-07-20T00:00:00Z" --date-to "2025-07-20T23:59:59Z" --output-dir ./output
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3001/api';
const DEFAULT_OUTPUT_DIR = './output';

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    sessions: false,
    messages: false,
    transcript: false,
    limit: 10,
    'date-from': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    'date-to': new Date().toISOString(),
    'output-dir': DEFAULT_OUTPUT_DIR,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--sessions') {
      options.sessions = true;
    } else if (arg === '--messages') {
      options.messages = true;
    } else if (arg === '--transcript') {
      options.transcript = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--date-from' && args[i + 1]) {
      options['date-from'] = args[i + 1];
      i++;
    } else if (arg === '--date-to' && args[i + 1]) {
      options['date-to'] = args[i + 1];
      i++;
    } else if (arg === '--output-dir' && args[i + 1]) {
      options['output-dir'] = args[i + 1];
      i++;
    }
  }

  return options;
}

// Display help information
function showHelp() {
  console.log(`
XOB CAT Data Retrieval CLI

Retrieves session history and conversation history from Kore.ai API
and saves the data to output files for review.

Usage:
  node cli-retrieve-data.js [options]

Options:
  --sessions              Retrieve session history
  --messages              Retrieve conversation messages
  --transcript            Retrieve complete transcript with session context
  --limit <number>        Limit number of records (default: 10)
  --date-from <iso-date>  Start date for data retrieval (default: 7 days ago)
  --date-to <iso-date>    End date for data retrieval (default: now)
  --output-dir <path>     Output directory for files (default: ./output)
  --help, -h              Show this help message

Examples:
  # Retrieve both sessions and messages (default: last 7 days, limit 10)
  node cli-retrieve-data.js --sessions --messages

  # Retrieve only sessions with custom limit
  node cli-retrieve-data.js --sessions --limit 5

  # Retrieve messages for specific date range
  node cli-retrieve-data.js --messages --date-from "2025-07-20T00:00:00Z" --date-to "2025-07-20T23:59:59Z"

  # Retrieve complete transcript
  node cli-retrieve-data.js --transcript --limit 3

  # Custom output directory
  node cli-retrieve-data.js --sessions --messages --output-dir ./my-data

Output Files:
  - sessions.json: Session history data
  - messages.json: Conversation messages data
  - transcript.json: Complete transcript with session context
  - summary.txt: Summary of retrieved data
`);
}

// Ensure output directory exists
function ensureOutputDir(outputDir) {
  if (!outputDir) {
    outputDir = DEFAULT_OUTPUT_DIR;
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  }
}

// Make API request with error handling
async function makeApiRequest(endpoint, params = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    
    console.log(`Making request to: ${fullUrl}`);
    
    const response = await axios.get(fullUrl);
    
    if (response.data.success === false) {
      throw new Error(`API Error: ${response.data.message || response.data.error}`);
    }
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to backend API. Make sure the backend is running on port 3001.');
    } else {
      throw error;
    }
  }
}

// Retrieve session history
async function retrieveSessions(options) {
  console.log('\n📊 Retrieving session history...');
  
  const params = {
    dateFrom: options['date-from'],
    dateTo: options['date-to'],
    limit: options.limit
  };
  
  const data = await makeApiRequest('/kore/sessions', params);
  
  console.log(`✅ Retrieved ${data.data.length} sessions`);
  console.log(`📅 Date range: ${params.dateFrom} to ${params.dateTo}`);
  console.log(`🤖 Bot: ${data.bot_name}`);
  
  return data;
}

// Retrieve conversation messages
async function retrieveMessages(options) {
  console.log('\n💬 Retrieving conversation messages...');
  
  const params = {
    dateFrom: options['date-from'],
    dateTo: options['date-to']
  };
  
  const data = await makeApiRequest('/kore/messages', params);
  
  console.log(`✅ Retrieved ${data.data.length} messages`);
  console.log(`📅 Date range: ${params.dateFrom} to ${params.dateTo}`);
  console.log(`🤖 Bot: ${data.bot_name}`);
  
  return data;
}

// Retrieve complete transcript
async function retrieveTranscript(options) {
  console.log('\n📝 Retrieving complete transcript...');
  
  const params = {
    dateFrom: options['date-from'],
    dateTo: options['date-to']
  };
  
  const data = await makeApiRequest('/kore/transcript', params);
  
  console.log(`✅ Retrieved ${data.data.length} sessions with transcript`);
  console.log(`📅 Date range: ${params.dateFrom} to ${params.dateTo}`);
  console.log(`🤖 Bot: ${data.bot_name}`);
  console.log(`💬 Total messages: ${data.total_messages}`);
  
  return data;
}

// Save data to file
function saveToFile(data, filename, outputDir) {
  if (!outputDir) {
    outputDir = DEFAULT_OUTPUT_DIR;
  }
  const filepath = path.join(outputDir, filename);
  const jsonData = JSON.stringify(data, null, 2);
  
  fs.writeFileSync(filepath, jsonData);
  console.log(`💾 Saved to: ${filepath}`);
  
  return filepath;
}

// Generate summary
function generateSummary(results, options) {
  const summary = {
    timestamp: new Date().toISOString(),
    retrieval_options: options,
    summary: {}
  };
  
  if (results.sessions) {
    summary.summary.sessions = {
      count: results.sessions.data.length,
      date_range: results.sessions.date_range,
      bot_name: results.sessions.bot_name
    };
  }
  
  if (results.messages) {
    summary.summary.messages = {
      count: results.messages.data.length,
      date_range: results.messages.date_range,
      bot_name: results.messages.bot_name
    };
  }
  
  if (results.transcript) {
    summary.summary.transcript = {
      sessions_count: results.transcript.data.length,
      total_messages: results.transcript.total_messages,
      date_range: results.transcript.date_range,
      bot_name: results.transcript.bot_name
    };
  }
  
  return summary;
}

// Save summary to text file
function saveSummary(summary, outputDir) {
  if (!outputDir) {
    outputDir = DEFAULT_OUTPUT_DIR;
  }
  const filepath = path.join(outputDir, 'summary.txt');
  let content = `XOB CAT Data Retrieval Summary
Generated: ${summary.timestamp}

Retrieval Options:
- Sessions: ${summary.retrieval_options.sessions ? 'Yes' : 'No'}
- Messages: ${summary.retrieval_options.messages ? 'Yes' : 'No'}
- Transcript: ${summary.retrieval_options.transcript ? 'Yes' : 'No'}
- Limit: ${summary.retrieval_options.limit}
- Date From: ${summary.retrieval_options['date-from']}
- Date To: ${summary.retrieval_options['date-to']}

Results:
`;

  if (summary.summary.sessions) {
    content += `
Sessions:
- Count: ${summary.summary.sessions.count}
- Date Range: ${summary.summary.sessions.date_range.dateFrom} to ${summary.summary.sessions.date_range.dateTo}
- Bot: ${summary.summary.sessions.bot_name}
`;
  }
  
  if (summary.summary.messages) {
    content += `
Messages:
- Count: ${summary.summary.messages.count}
- Date Range: ${summary.summary.messages.date_range.dateFrom} to ${summary.summary.messages.date_range.dateTo}
- Bot: ${summary.summary.messages.bot_name}
`;
  }
  
  if (summary.summary.transcript) {
    content += `
Transcript:
- Sessions: ${summary.summary.transcript.sessions_count}
- Total Messages: ${summary.summary.transcript.total_messages}
- Date Range: ${summary.summary.transcript.date_range.dateFrom} to ${summary.summary.transcript.date_range.dateTo}
- Bot: ${summary.summary.transcript.bot_name}
`;
  }
  
  content += `
Output Files:
- sessions.json: Session history data
- messages.json: Conversation messages data  
- transcript.json: Complete transcript with session context
- summary.txt: This summary file

API Endpoints Used:
- /api/kore/sessions: Session history retrieval
- /api/kore/messages: Conversation messages retrieval
- /api/kore/transcript: Complete transcript retrieval
`;
  
  fs.writeFileSync(filepath, content);
  console.log(`📋 Summary saved to: ${filepath}`);
  
  return filepath;
}

// Main execution function
async function main() {
  try {
    const options = parseArgs();
    
    if (options.help) {
      showHelp();
      return;
    }
    
    // Validate options
    if (!options.sessions && !options.messages && !options.transcript) {
      console.error('❌ Error: Please specify at least one data type to retrieve (--sessions, --messages, or --transcript)');
      console.log('\nUse --help for usage information.');
      process.exit(1);
    }
    
    console.log('🚀 XOB CAT Data Retrieval CLI');
    console.log('==============================');
    
    // Ensure output directory exists
    ensureOutputDir(options.outputDir);
    
    const results = {};
    
    // Retrieve requested data
    if (options.sessions) {
      results.sessions = await retrieveSessions(options);
      saveToFile(results.sessions, 'sessions.json', options.outputDir);
    }
    
    if (options.messages) {
      results.messages = await retrieveMessages(options);
      saveToFile(results.messages, 'messages.json', options.outputDir);
    }
    
    if (options.transcript) {
      results.transcript = await retrieveTranscript(options);
      saveToFile(results.transcript, 'transcript.json', options.outputDir);
    }
    
    // Generate and save summary
    const summary = generateSummary(results, options);
    saveSummary(summary, options.outputDir);
    
    console.log('\n✅ Data retrieval completed successfully!');
    console.log(`📁 Output directory: ${path.resolve(options.outputDir)}`);
    
    // Show sample data
    if (results.sessions && results.sessions.data.length > 0) {
      console.log('\n📊 Sample Session:');
      const sampleSession = results.sessions.data[0];
      console.log(`  Session ID: ${sampleSession.session_id}`);
      console.log(`  User ID: ${sampleSession.user_id}`);
      console.log(`  Start Time: ${sampleSession.start_time}`);
      console.log(`  Duration: ${sampleSession.duration_seconds}s`);
      console.log(`  Messages: ${sampleSession.message_count}`);
    }
    
    if (results.messages && results.messages.data.length > 0) {
      console.log('\n💬 Sample Messages:');
      const sampleMessages = results.messages.data.slice(0, 3);
      sampleMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. [${msg.message_type.toUpperCase()}] ${msg.timestamp}: ${msg.message.substring(0, 50)}${msg.message.length > 50 ? '...' : ''}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main();
}

module.exports = { main, parseArgs, showHelp }; 