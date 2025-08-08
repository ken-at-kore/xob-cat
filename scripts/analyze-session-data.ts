#!/usr/bin/env tsx

/**
 * PER-SESSION ANALYSIS SCRIPT - HYBRID MODE
 * 
 * Analyzes sessions from collected production data using:
 * - Mock Kore.ai services (no API calls)  
 * - Real OpenAI API (incurs costs)
 * 
 * Input: Production session data files (JSON)
 * Output: Original session data + OpenAI analysis results
 * 
 * Usage:
 *   npx tsx scripts/analyze-session-data.ts <input-file> [options]
 *   npx tsx scripts/analyze-session-data.ts data/kore-api-compsych-swts-2025-08-08.json --limit 10
 * 
 * Options:
 *   --limit, -l      Maximum sessions to analyze (default: all)
 *   --model, -m      OpenAI model ID (default: gpt-4.1-nano)
 *   --output, -o     Output filename prefix (default: derived from input)
 *   --batch-size     Sessions per batch (default: 5)
 * 
 * Environment Variables:
 *   TEST_OPENAI_API_KEY=sk-...  Required for OpenAI analysis
 * 
 * ⚠️  WARNING: This script makes real OpenAI API calls and incurs costs!
 */

import fs from 'fs';
import path from 'path';
import { ServiceFactory } from '../backend/src/factories/serviceFactory';
import { BatchAnalysisService } from '../backend/src/services/batchAnalysisService';
import { createOpenAIService } from '../backend/src/factories/serviceFactory';
import { SessionWithTranscript, SessionWithFacts, ExistingClassifications } from '../shared/types';

interface CollectedSessionData {
  collectionInfo: {
    dateRange: {
      from: string;
      to: string;
    };
    collectedAt: string;
    totalSessions: number;
    totalMessages: number;
    containmentTypeBreakdown: {
      agent: number;
      selfService: number;
      dropOff: number;
    };
  };
  sessionHistory: {
    agent: SessionWithTranscript[];
    selfService: SessionWithTranscript[];
    dropOff: SessionWithTranscript[];
  };
}

interface AnalyzedSessionData {
  analysisInfo: {
    analyzedAt: string;
    inputFile: string;
    totalSessionsAnalyzed: number;
    modelUsed: string;
    totalCost: number;
    totalTokens: number;
  };
  originalCollectionInfo: CollectedSessionData['collectionInfo'];
  analyzedSessions: SessionWithFacts[];
}

interface ScriptOptions {
  inputFile: string;
  limit?: number;
  model: string;
  output?: string;
  batchSize: number;
}

class SessionAnalysisScript {
  private options: ScriptOptions;
  private openaiApiKey: string;
  private batchAnalysisService: BatchAnalysisService;

  constructor(options: ScriptOptions) {
    this.options = options;
    
    // Validate OpenAI API key
    this.openaiApiKey = process.env.TEST_OPENAI_API_KEY || '';
    if (!this.openaiApiKey || !this.openaiApiKey.startsWith('sk-')) {
      throw new Error(
        'TEST_OPENAI_API_KEY environment variable is required and must start with "sk-"'
      );
    }

    // Configure hybrid services (mock Kore + real OpenAI)
    ServiceFactory.useHybridServices();
    
    // Create batch analysis service with real OpenAI
    const openaiService = createOpenAIService();
    this.batchAnalysisService = new BatchAnalysisService(openaiService);
  }

  async run(): Promise<void> {
    console.log('🔬 Starting per-session analysis...');
    console.log(`📁 Input file: ${this.options.inputFile}`);
    console.log(`🤖 Model: ${this.options.model}`);
    console.log(`📊 Batch size: ${this.options.batchSize}`);
    if (this.options.limit) {
      console.log(`🔢 Session limit: ${this.options.limit}`);
    }
    console.log('💰 WARNING: This will incur OpenAI API costs!');
    console.log('');

    try {
      // Load and parse input data
      const inputData = this.loadInputData();
      console.log(`📈 Loaded ${inputData.collectionInfo.totalSessions} sessions from input file`);
      
      // Extract all sessions from all containment types
      const allSessions = this.extractAllSessions(inputData);
      console.log(`📋 Extracted ${allSessions.length} sessions for analysis`);
      
      // Apply session limit if specified
      const sessionsToAnalyze = this.options.limit 
        ? allSessions.slice(0, this.options.limit)
        : allSessions;
      
      console.log(`🎯 Analyzing ${sessionsToAnalyze.length} sessions...`);
      console.log('');

      // Analyze sessions in batches
      const analyzedSessions = await this.analyzeSessionsInBatches(sessionsToAnalyze);
      
      // Generate output data
      const outputData = this.createOutputData(inputData, analyzedSessions);
      
      // Save results
      const outputFile = this.saveResults(outputData);
      
      console.log('');
      console.log('✅ Analysis complete!');
      console.log(`📄 Output saved to: ${outputFile}`);
      console.log(`💰 Total cost: $${outputData.analysisInfo.totalCost.toFixed(4)}`);
      console.log(`🔢 Total tokens: ${outputData.analysisInfo.totalTokens.toLocaleString()}`);
      console.log(`📊 Sessions analyzed: ${outputData.analysisInfo.totalSessionsAnalyzed}`);

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  }

  private loadInputData(): CollectedSessionData {
    if (!fs.existsSync(this.options.inputFile)) {
      throw new Error(`Input file not found: ${this.options.inputFile}`);
    }

    try {
      const rawData = fs.readFileSync(this.options.inputFile, 'utf8');
      const data = JSON.parse(rawData) as CollectedSessionData;
      
      // Validate data structure
      if (!data.collectionInfo || !data.sessionHistory) {
        throw new Error('Invalid input data structure - missing collectionInfo or sessionHistory');
      }
      
      return data;
    } catch (error) {
      throw new Error(`Failed to load input data: ${error}`);
    }
  }

  private extractAllSessions(data: CollectedSessionData): SessionWithTranscript[] {
    const allSessions: SessionWithTranscript[] = [];
    
    // Combine sessions from all containment types
    if (data.sessionHistory.agent) {
      allSessions.push(...data.sessionHistory.agent);
    }
    if (data.sessionHistory.selfService) {
      allSessions.push(...data.sessionHistory.selfService);
    }
    if (data.sessionHistory.dropOff) {
      allSessions.push(...data.sessionHistory.dropOff);
    }
    
    // Filter out sessions with insufficient data
    return allSessions.filter(session => 
      session.messages && 
      session.messages.length >= 2 && // At least 2 messages
      session.messages.some(msg => msg.message_type === 'user') // At least one user message
    );
  }

  private async analyzeSessionsInBatches(sessions: SessionWithTranscript[]): Promise<SessionWithFacts[]> {
    const analyzedSessions: SessionWithFacts[] = [];
    const totalBatches = Math.ceil(sessions.length / this.options.batchSize);
    let existingClassifications: ExistingClassifications = {
      generalIntent: new Set(),
      transferReason: new Set(),
      dropOffLocation: new Set()
    };

    console.log(`🔄 Processing ${totalBatches} batches...`);

    for (let i = 0; i < sessions.length; i += this.options.batchSize) {
      const batchNumber = Math.floor(i / this.options.batchSize) + 1;
      const batch = sessions.slice(i, i + this.options.batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} sessions)...`);

      try {
        const batchResult = await this.batchAnalysisService.processSessionsBatch(
          batch,
          existingClassifications,
          this.openaiApiKey,
          this.options.model
        );

        analyzedSessions.push(...batchResult.results);
        existingClassifications = batchResult.updatedClassifications;
        
        console.log(`   ✅ Batch ${batchNumber} complete - Cost: $${batchResult.tokenUsage.cost.toFixed(4)}, Tokens: ${batchResult.tokenUsage.totalTokens}`);
        
        // Add delay between batches to be respectful to OpenAI API
        if (i + this.options.batchSize < sessions.length) {
          console.log(`   ⏳ Waiting 2 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`   ❌ Batch ${batchNumber} failed:`, error);
        // Continue with remaining batches
      }
    }

    return analyzedSessions;
  }

  private createOutputData(inputData: CollectedSessionData, analyzedSessions: SessionWithFacts[]): AnalyzedSessionData {
    const totalCost = analyzedSessions.reduce((sum, session) => 
      sum + (session.analysisMetadata?.cost || 0), 0
    );
    
    const totalTokens = analyzedSessions.reduce((sum, session) => 
      sum + (session.analysisMetadata?.tokensUsed || 0), 0
    );

    return {
      analysisInfo: {
        analyzedAt: new Date().toISOString(),
        inputFile: path.basename(this.options.inputFile),
        totalSessionsAnalyzed: analyzedSessions.length,
        modelUsed: this.options.model,
        totalCost,
        totalTokens
      },
      originalCollectionInfo: inputData.collectionInfo,
      analyzedSessions
    };
  }

  private saveResults(data: AnalyzedSessionData): string {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];
    
    const inputBasename = path.basename(this.options.inputFile, '.json');
    const outputFilename = this.options.output 
      ? `${this.options.output}-${timestamp}.json`
      : `${inputBasename}-analysis-${timestamp}.json`;
    
    const outputPath = path.join(process.cwd(), 'data', outputFilename);
    
    // Ensure data directory exists
    const dataDir = path.dirname(outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    return outputPath;
  }
}

// CLI argument parsing
function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx scripts/analyze-session-data.ts <input-file> [options]

Options:
  --limit, -l <number>     Maximum sessions to analyze (default: all)
  --model, -m <model-id>   OpenAI model ID (default: gpt-4.1-nano)
  --output, -o <prefix>    Output filename prefix (default: derived from input)
  --batch-size <number>    Sessions per batch (default: 5)
  --help, -h              Show this help message

Environment Variables:
  TEST_OPENAI_API_KEY     Required OpenAI API key (must start with 'sk-')

Examples:
  npx tsx scripts/analyze-session-data.ts data/kore-api-compsych-swts-2025-08-08.json
  npx tsx scripts/analyze-session-data.ts data/sessions.json --limit 20 --model gpt-4o-mini
    `);
    process.exit(0);
  }
  
  const inputFile = args[0];
  if (!inputFile) {
    throw new Error('Input file is required');
  }
  
  const options: ScriptOptions = {
    inputFile,
    model: 'gpt-4.1-nano',
    batchSize: 5
  };
  
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--limit':
      case '-l':
        options.limit = parseInt(value);
        if (isNaN(options.limit) || options.limit <= 0) {
          throw new Error('Limit must be a positive number');
        }
        break;
        
      case '--model':
      case '-m':
        options.model = value;
        break;
        
      case '--output':
      case '-o':
        options.output = value;
        break;
        
      case '--batch-size':
        options.batchSize = parseInt(value);
        if (isNaN(options.batchSize) || options.batchSize <= 0) {
          throw new Error('Batch size must be a positive number');
        }
        break;
        
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }
  
  return options;
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      const options = parseArgs();
      const script = new SessionAnalysisScript(options);
      await script.run();
    } catch (error) {
      console.error('❌ Script failed:', (error as Error).message);
      process.exit(1);
    }
  })();
}

export { SessionAnalysisScript, ScriptOptions };