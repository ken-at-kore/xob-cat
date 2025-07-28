/**
 * Centralized Prompt Engineering for Analysis Features
 * 
 * This file contains all prompt templates for generating analysis summaries,
 * overviews, and containment suggestions. This ensures consistency between
 * the main application and utility scripts.
 */

export interface AnalysisAggregation {
  totalSessions: number;
  transferCount: number;
  containedCount: number;
  transferRate: number;
  containmentRate: number;
  averageSessionLength: number;
  totalMessages: number;
  averageMessagesPerSession: number;
  
  // Breakdowns
  intentBreakdown: Record<string, number>;
  transferReasonBreakdown: Record<string, number>;
  dropOffLocationBreakdown: Record<string, number>;
  
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
 * Enhanced Analysis Overview Prompt (richer formatting, reduced cognitive load)
 */
export const ANALYSIS_OVERVIEW_PROMPT = `
## 1. Analysis Overview (~150-200 words)
Create a **concise executive summary** that appears at the top of the analysis report. This should:

- **Scope & Methodology**: Briefly describe the XO bot analysis scope and AI-powered methodology
- **Key Performance Metrics**: Highlight containment rate, top intents, and critical statistics using **bold** formatting
- **Critical Findings**: Summarize the most important patterns from session data using bullet points where appropriate
- **Professional Tone**: Use language appropriate for bot analysis teams and stakeholders
- **Rich Formatting**: Use **bold**, *italics*, and bullet points to reduce cognitive effort and improve readability
- **Data Integration**: Include relevant statistics and percentages from the actual analysis data
- **Terminology**: Refer to the system as the "XO bot" or "bot" consistently

**Formatting Guidelines:**
- Use **bold** for key metrics and important findings
- Use *italics* for emphasis on critical insights
- Use bullet points (•) for lists of 3+ items to improve scannability
- Keep paragraphs short (2-3 sentences max)
- Lead with the most important finding or metric
`;

/**
 * Enhanced Detailed Analysis Prompt (concise recommendations, better structure)
 */
export const DETAILED_ANALYSIS_PROMPT = `
## 2. Detailed Analysis (~300-400 words, reduced from 400-600)
Create a **structured analysis** that appears at the bottom of the report. This should:

**Content Requirements:**
- **Performance Insights**: Deeper analysis of XO bot performance patterns based on session data
- **Containment Focus**: Identify improvement opportunities from transfer patterns
- **Pain Point Analysis**: Specific issues causing transfers based on transfer reasons and drop-off locations
- **Actionable Recommendations**: **Concise** suggestions for UX, task completion, and bot training (reduce text by ~50% from current)
- **Data-Driven**: Reference specific analysis data (transfer reasons, drop-off locations, intent patterns)
- **Expert Tone**: Consultative language appropriate for bot optimization teams

**Formatting Requirements:**
- Use structured markdown with headers (##, ###)
- Use bullet points for recommendations and findings
- Use **bold** for key insights and section headers
- Use *italics* for emphasis on critical data points
- Keep recommendations concise and actionable (1-2 sentences each)
- Reference "XO bot" or "bot" terminology consistently

**Structure Suggestion:**
### Key Performance Patterns
- Bullet point findings with data

### Transfer Analysis
- Top transfer reasons with percentages
- Critical drop-off locations

### Recommendations
- **Priority 1**: [Concise actionable item]
- **Priority 2**: [Concise actionable item]
- **Priority 3**: [Concise actionable item]
`;

/**
 * Containment Improvement Prompt (single actionable sentence)
 */
export const CONTAINMENT_SUGGESTION_PROMPT = `
## 3. Containment Improvement Suggestion (1 sentence)
Create a **single, actionable sentence** explaining the most impactful change to improve XO bot containment. This should:

- **Specific & Actionable**: Reference actual data patterns, not generic advice  
- **Data-Driven**: Reference top transfer reasons, drop-off locations, or percentages from analysis
- **High-Impact Focus**: Target the improvement opportunity with the greatest potential effect
- **Concise Format**: Fit nicely in a card display (under 100 characters ideal)
- **Professional Language**: Engaging tone appropriate for stakeholders
- **Metric Integration**: Include specific percentages or numbers when relevant
- **Terminology**: Use "XO bot" or "bot" terminology

**Examples of Strong Containment Suggestions:**
- "Enhance account verification flow to reduce the 34% of transfers caused by authentication failures"
- "Add proactive help prompts during billing inquiries to contain 28% more sessions before transfer"
- "Expand XO bot knowledge base for technical issues to handle 19% of sessions that currently transfer"
- "Optimize policy number capture flow to prevent 41% of authentication-related transfers"
`;

/**
 * Create the comprehensive analysis prompt
 */
export function createAnalysisPrompt(aggregation: AnalysisAggregation, sessions: Array<{ start_time: string }>): string {
  // Helper function to format breakdowns
  const formatBreakdown = (breakdown: Record<string, number>) => {
    return Object.entries(breakdown)
      .sort(([,a], [,b]) => b - a)
      .map(([key, count]) => `  - ${key}: ${count} sessions (${((count / aggregation.totalSessions) * 100).toFixed(1)}%)`)
      .join('\n');
  };

  // Calculate analysis period
  const calculateAnalysisPeriod = (sessions: Array<{ start_time: string }>): string => {
    if (sessions.length === 0) return 'No sessions available';
    
    const dates = sessions.map(s => new Date(s.start_time)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    if (!startDate || !endDate) return 'No sessions available';
    
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
  };

  const analysisPeriod = calculateAnalysisPeriod(sessions);

  return `# XOB CAT Bot Analysis Context

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
  `**${msg.message_type === 'user' ? 'User' : 'XO Bot'}**: ${msg.message}`
).join('\n')}
`).join('\n')}

---

# Your Task

Generate three distinct sections for a bot performance analysis report:

${ANALYSIS_OVERVIEW_PROMPT}

${DETAILED_ANALYSIS_PROMPT}

${CONTAINMENT_SUGGESTION_PROMPT}

All three sections should be written from the perspective of a bot performance analyst providing insights to improve XO bot effectiveness and user experience based on the conversation data analyzed.

Format your response as:

# ANALYSIS_OVERVIEW
[overview markdown content with rich formatting]

# ANALYSIS_SUMMARY  
[detailed analysis markdown content with structured headers and concise recommendations]

# CONTAINMENT_SUGGESTION
[single actionable sentence for improving XO bot containment]`;
}