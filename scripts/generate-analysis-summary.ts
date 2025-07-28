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
import OpenAI from 'openai';
import { SessionWithFacts } from '../shared/types';

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

interface AnalysisAggregation {
  totalSessions: number;
  transferCount: number;
  containedCount: number;
  transferRate: number;
  containmentRate: number;
  averageSessionLength: number;
  totalMessages: number;
  averageMessagesPerSession: number;
  
  // Breakdowns
  intentBreakdown: { [key: string]: number };
  transferReasonBreakdown: { [key: string]: number };
  dropOffLocationBreakdown: { [key: string]: number };
  
  // Sample data
  allSessionNotes: string[];
  sampleTranscripts: Array<{
    sessionId: string;
    intent: string;
    outcome: string;
    messages: Array<{ message: string; message_type: string; timestamp: string }>;
  }>;
}

/**
 * Aggregate analysis data for LLM context
 */
function aggregateAnalysisData(sessions: SessionWithFacts[]): AnalysisAggregation {
  const totalSessions = sessions.length;
  const transferCount = sessions.filter(s => s.facts.sessionOutcome === 'Transfer').length;
  const containedCount = sessions.filter(s => s.facts.sessionOutcome === 'Contained').length;
  
  // Calculate session lengths in minutes
  const sessionLengths = sessions.map(s => {
    if (s.duration_seconds && s.duration_seconds > 0) {
      return s.duration_seconds / 60;
    }
    // Calculate from start/end time if duration not available
    const start = new Date(s.start_time).getTime();
    const end = new Date(s.end_time).getTime();
    return (end - start) / (1000 * 60);
  });
  
  const averageSessionLength = sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length;
  const totalMessages = sessions.reduce((sum, s) => sum + (s.message_count || 0), 0);
  
  // Create breakdowns
  const intentBreakdown: { [key: string]: number } = {};
  const transferReasonBreakdown: { [key: string]: number } = {};
  const dropOffLocationBreakdown: { [key: string]: number } = {};
  
  sessions.forEach(session => {
    // Intent breakdown
    intentBreakdown[session.facts.generalIntent] = (intentBreakdown[session.facts.generalIntent] || 0) + 1;
    
    // Transfer reason breakdown (only for transfers)
    if (session.facts.sessionOutcome === 'Transfer' && session.facts.transferReason) {
      transferReasonBreakdown[session.facts.transferReason] = (transferReasonBreakdown[session.facts.transferReason] || 0) + 1;
    }
    
    // Drop-off location breakdown (only for transfers)
    if (session.facts.sessionOutcome === 'Transfer' && session.facts.dropOffLocation) {
      dropOffLocationBreakdown[session.facts.dropOffLocation] = (dropOffLocationBreakdown[session.facts.dropOffLocation] || 0) + 1;
    }
  });
  
  // Collect all session notes
  const allSessionNotes = sessions.map(s => s.facts.notes);
  
  // Select 5 random sessions for transcript samples
  const shuffled = [...sessions].sort(() => 0.5 - Math.random());
  const sampleTranscripts = shuffled.slice(0, 5).map(session => ({
    sessionId: session.session_id,
    intent: session.facts.generalIntent,
    outcome: session.facts.sessionOutcome,
    messages: (session.messages || []).map(m => ({
      message: m.message,
      message_type: m.message_type,
      timestamp: m.timestamp
    }))
  }));
  
  return {
    totalSessions,
    transferCount,
    containedCount,
    transferRate: (transferCount / totalSessions) * 100,
    containmentRate: (containedCount / totalSessions) * 100,
    averageSessionLength,
    totalMessages,
    averageMessagesPerSession: totalMessages / totalSessions,
    intentBreakdown,
    transferReasonBreakdown,
    dropOffLocationBreakdown,
    allSessionNotes,
    sampleTranscripts
  };
}

/**
 * Calculate analysis period from session data
 */
function calculateAnalysisPeriod(sessions: SessionWithFacts[]): string {
  if (sessions.length === 0) return 'No sessions available';
  
  const dates = sessions.map(s => new Date(s.start_time)).sort((a, b) => a.getTime() - b.getTime());
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
  
  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDate(startDate);
  } else {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }
}

/**
 * Create comprehensive prompt for analysis summary generation
 */
function createAnalysisPrompt(aggregation: AnalysisAggregation, sessions: SessionWithFacts[]): string {
  // Format breakdowns for the prompt
  const formatBreakdown = (breakdown: { [key: string]: number }) => {
    return Object.entries(breakdown)
      .sort(([,a], [,b]) => b - a)
      .map(([key, count]) => `  - ${key}: ${count} sessions (${((count / aggregation.totalSessions) * 100).toFixed(1)}%)`)
      .join('\n');
  };

  const analysisPeriod = calculateAnalysisPeriod(sessions);

  const prompt = `# XOB CAT Bot Analysis Context

You are analyzing conversation data for a chatbot to understand performance patterns and identify improvement opportunities. This analysis is conducted using the XOB CAT (XO Bot Conversation Analysis Tools) platform by Kore.ai Expert Services teams.

## Analysis Dataset Overview

**Total Sessions Analyzed:** ${aggregation.totalSessions}
**Analysis Period:** ${analysisPeriod}
**Transfer Rate:** ${aggregation.transferRate.toFixed(1)}% (${aggregation.transferCount} transferred, ${aggregation.containedCount} contained)
**Average Session Length:** ${aggregation.averageSessionLength.toFixed(1)} minutes
**Average Messages per Session:** ${aggregation.averageMessagesPerSession.toFixed(1)} messages

## Intent Distribution
${formatBreakdown(aggregation.intentBreakdown)}

## Transfer Reason Analysis (for transferred sessions)
${formatBreakdown(aggregation.transferReasonBreakdown)}

## Drop-off Location Analysis (where users left before transfer)
${formatBreakdown(aggregation.dropOffLocationBreakdown)}

## Session Summary Notes
Here are AI-generated notes for each session analyzed:

${aggregation.allSessionNotes.map((note, index) => `${index + 1}. ${note}`).join('\n')}

## Sample Conversation Transcripts

Below are 5 randomly selected complete conversation transcripts to give you context on actual user interactions:

${aggregation.sampleTranscripts.map((transcript, index) => `
### Sample ${index + 1}: ${transcript.intent} (${transcript.outcome})
**Session ID:** ${transcript.sessionId}

${transcript.messages.map(msg => 
  `**${msg.message_type === 'user' ? 'User' : 'Bot'}**: ${msg.message}`
).join('\n')}
`).join('\n')}

---

# Your Task

Generate two distinct markdown sections for a bot performance analysis report:

## 1. Analysis Overview (~200 words)
Create a concise executive summary that would appear at the top of the analysis report page. This should:
- Briefly describe the analysis scope and methodology based on the data provided
- Highlight key performance metrics (containment rate, top intents, etc.)
- Summarize the most important findings from the session data
- Use a professional tone appropriate for bot analysis teams
- Include relevant statistics and percentages from the actual data
- Be formatted in clean markdown

## 2. Analysis Summary (~400-600 words)
Create a detailed analysis that would appear at the bottom of the report page. This should:
- Provide deeper insights into bot performance patterns based on the session data
- Focus on containment improvement opportunities derived from transfer patterns
- Identify specific pain points causing transfers to live agents based on transfer reasons and drop-off locations
- Suggest actionable improvements for UX, task completion, and bot training based on the conversation patterns observed
- Reference specific data from the analysis (transfer reasons, drop-off locations, intent patterns)
- Maintain a consultative, expert tone appropriate for bot optimization
- Use structured markdown with headers, bullet points, and emphasis
- Include data-driven recommendations based on the session patterns and user behavior observed

## 3. Containment Improvement Suggestion (1 sentence)
Create a single, actionable sentence that explains the most impactful change that could be made to improve bot containment based on the analysis data. This should:
- Be specific and actionable, not generic advice
- Reference the actual data patterns observed (top transfer reasons, drop-off locations, etc.)
- Focus on the highest-impact improvement opportunity
- Be concise and fit nicely in a card display
- Use engaging, professional language appropriate for stakeholders
- Include a specific metric or percentage when relevant

Examples of good containment suggestions:
- "Improve account verification flow to reduce 34% of transfers caused by authentication issues"
- "Add proactive clarification prompts during billing inquiries to contain 28% more sessions"
- "Expand knowledge base for technical issues to handle the 19% of sessions that transfer due to connectivity problems"

All three sections should be written from the perspective of a bot performance analyst providing insights to improve bot effectiveness and user experience based on the conversation data analyzed.

Format your response as:

# ANALYSIS_OVERVIEW
[overview markdown content]

# ANALYSIS_SUMMARY  
[detailed analysis markdown content]

# CONTAINMENT_SUGGESTION
[single actionable sentence for improving containment]`;

  return prompt;
}

/**
 * Generate analysis summaries using OpenAI GPT-4o-mini
 */
async function generateAnalysisSummaries(aggregation: AnalysisAggregation, sessions: SessionWithFacts[]): Promise<{ overview: string; summary: string; containmentSuggestion: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }

  const openai = new OpenAI({
    apiKey: apiKey
  });

  const prompt = createAnalysisPrompt(aggregation, sessions);
  
  console.log('📝 Sending analysis request to GPT-4o-mini...');
  console.log(`📊 Prompt length: ${prompt.length} characters`);
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the response into overview, summary, and containment suggestion sections
    const overviewMatch = response.match(/# ANALYSIS_OVERVIEW\s*([\s\S]*?)(?=# ANALYSIS_SUMMARY|# CONTAINMENT_SUGGESTION|$)/);
    const summaryMatch = response.match(/# ANALYSIS_SUMMARY\s*([\s\S]*?)(?=# CONTAINMENT_SUGGESTION|$)/);
    const containmentMatch = response.match(/# CONTAINMENT_SUGGESTION\s*([\s\S]*?)$/);

    if (!overviewMatch || !summaryMatch || !containmentMatch) {
      throw new Error('Could not parse OpenAI response into required sections');
    }

    const overview = overviewMatch[1].trim();
    const summary = summaryMatch[1].trim();
    const containmentSuggestion = containmentMatch[1].trim();

    console.log(`✅ Generated analysis summaries (${completion.usage?.total_tokens} tokens used)`);
    
    return { overview, summary, containmentSuggestion };
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Save the full prompt to a file for review
 */
async function savePromptForReview(prompt: string): Promise<string> {
  const promptPath = path.join(__dirname, '../data/analysis-prompt.txt');
  await fs.writeFile(promptPath, prompt, 'utf-8');
  return promptPath;
}

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
    
    // Aggregate data for analysis
    const aggregation = aggregateAnalysisData(sessions);
    
    // Save the prompt for review
    const prompt = createAnalysisPrompt(aggregation, sessions);
    const promptPath = await savePromptForReview(prompt);
    console.log(`📄 Full prompt saved to: ${promptPath}`);
    
    // Generate summaries using OpenAI
    const { overview, summary, containmentSuggestion } = await generateAnalysisSummaries(aggregation, sessions);
    
    // Save the generated summaries
    const outputData = {
      generatedAt: new Date().toISOString(),
      sessionsAnalyzed: sessions.length,
      overview,
      summary,
      containmentSuggestion,
      statistics: {
        totalSessions: aggregation.totalSessions,
        transferRate: aggregation.transferRate,
        containmentRate: aggregation.containmentRate,
        averageSessionLength: aggregation.averageSessionLength,
        averageMessagesPerSession: aggregation.averageMessagesPerSession
      }
    };
    
    const outputPath = path.join(__dirname, '../data/analysis-summary.json');
    await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    
    console.log('✅ Analysis summaries generated successfully!');
    console.log(`📄 Saved to: ${outputPath}`);
    console.log(`📝 Prompt saved to: ${promptPath}`);
    
    // Display preview of generated content
    console.log('\n📖 Generated Content Preview:');
    console.log('\n--- OVERVIEW ---');
    console.log(overview.substring(0, 200) + '...');
    console.log('\n--- SUMMARY ---');
    console.log(summary.substring(0, 300) + '...');
    
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