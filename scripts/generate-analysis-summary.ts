#!/usr/bin/env tsx

/**
 * Generate Analysis Summary Reports
 * 
 * This script processes mock analysis results and generates comprehensive
 * markdown reports using GPT-4o-mini for use in the analysis report page.
 * 
 * Usage: npx tsx scripts/generate-analysis-summary.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { SessionWithFacts } from '../shared/types';
import { LLMInferenceService } from '../shared/services/llmInferenceService';

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });


/**
 * Main function to generate analysis summaries
 */
async function generateAnalysisSummary() {
  try {
    console.log('🔍 Loading mock analysis data...');
    
    // Load mock analysis results
    const dataPath = path.join(__dirname, '../data/mock-analysis-results.json');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    const sessions: SessionWithFacts[] = JSON.parse(fileContent);
    
    if (!sessions || sessions.length === 0) {
      throw new Error('No sessions found in mock analysis data');
    }

    console.log(`📊 Processing ${sessions.length} analyzed sessions...`);
    
    // Initialize LLM service
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not found in environment variables');
    }
    
    const llmService = new LLMInferenceService(apiKey);
    
    console.log('📝 Sending analysis request to GPT-4o-mini...');
    
    // Generate summaries using shared LLM service
    const llmResponse = await llmService.generateAnalysisSummary(sessions);
    const analysisSummary = llmService.createAnalysisSummary(llmResponse, sessions);
    
    console.log(`✅ Generated analysis summaries (${llmResponse.tokensUsed} tokens used, $${llmResponse.cost?.toFixed(4)} cost)`);
    
    // Save the generated summaries
    const outputData = {
      generatedAt: analysisSummary.generatedAt,
      sessionsAnalyzed: analysisSummary.sessionsAnalyzed,
      overview: analysisSummary.overview,
      summary: analysisSummary.summary,
      containmentSuggestion: analysisSummary.containmentSuggestion,
      statistics: analysisSummary.statistics,
      tokensUsed: llmResponse.tokensUsed,
      cost: llmResponse.cost
    };
    
    const outputPath = path.join(__dirname, '../data/analysis-summary.json');
    await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    
    console.log('✅ Analysis summaries generated successfully!');
    console.log(`📄 Saved to: ${outputPath}`);
    
    // Display preview of generated content
    console.log('\n📖 Generated Content Preview:');
    console.log('\n--- OVERVIEW ---');
    console.log(analysisSummary.overview.substring(0, 200) + '...');
    console.log('\n--- SUMMARY ---');
    console.log(analysisSummary.summary.substring(0, 300) + '...');
    console.log('\n--- CONTAINMENT SUGGESTION ---');
    console.log(analysisSummary.containmentSuggestion);
    
  } catch (error) {
    console.error('❌ Error generating analysis summary:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  generateAnalysisSummary();
}

export { generateAnalysisSummary };