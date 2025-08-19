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
 * Analysis Overview Prompt - Conversational yet professional
 */
export const ANALYSIS_OVERVIEW_PROMPT = `
## 1. Analysis Overview (~150-200 words)
Write a clear, engaging summary that kicks off the analysis report. Think of this as explaining your findings to a colleague who wants the big picture first:

**Start with the basics (1-2 sentences, NO section heading)**
- Tell us what you analyzed - how many conversations, over what timeframe, and how you did it
- Keep it straightforward and skip the jargon
- Do NOT include any section heading like "Section 1:" or "Scope & Methodology"

**Share the key numbers and what people were asking about (1 paragraph, no bullets, NO section heading)**
- Weave together the main performance numbers and what users were trying to accomplish
- Use **bold formatting** for the important stats (transfer rate, containment rate, session length)
- Mention the top 3-4 things people were asking the bot about, with percentages worked naturally into your sentences
- Write this as a flowing paragraph - no bullet points here
- Do NOT include any section heading like "Section 2:" or "Key Performance Metrics"

**Highlight what stood out (bullet points OK, small heading only)**
- Use the heading "**What Stood Out**" (using ## markdown for smaller heading)
- Point out the most interesting patterns you found - both good and concerning
- Use bullet points to list your observations, keeping each one conversational
- Use *italics* only for specific numbers and key terms, not whole sentences
- Include wins and challenges - give us the real picture

**Keep it readable:**
- NO section headings for the first two parts
- Only use "**What Stood Out**" as a ## heading for the third part
- Use **bold** for important numbers and stats
- Use *italics* sparingly - just for emphasis on specific details
- Keep paragraphs short and digestible (2-3 sentences max)
- Write like you're talking to a smart colleague, not writing a formal report
- Call it "XO bot" or "bot" throughout
`;

/**
 * Detailed Analysis Prompt - In-depth but accessible
 */
export const DETAILED_ANALYSIS_PROMPT = `
## 2. Detailed Analysis (~600-800 words, thorough but readable)
Now dive deeper into what the data is telling us. This is where you get to tell the full story behind the numbers - write this for people who need to understand what's really happening and what to do about it.

**What to cover:**
- **How the bot is really performing**: Look at the patterns in how users interact with the bot and what leads to success or frustration
- **When things go well vs. when they don't**: Dig into what makes some conversations work while others end up getting transferred
- **The user experience journey**: Walk through where people get stuck, where they drop off, and what that tells us about pain points
- **Why transfers happen**: Get into the real reasons - not just the categories, but what's actually going wrong from the user's perspective
- **What to do about it**: Give specific, practical suggestions that can actually be implemented
- **Connect the dots**: Use the actual numbers and patterns you're seeing to back up your insights
- **Expert insight**: Share your analysis like you're the go-to person who really understands how bots work

**Make it readable:**
- Write in flowing paragraphs that tell a story, not bullet-heavy lists
- Use clear section headers (##, ###) to break things up
- Use **bold** for the important insights and key numbers
- Use *italics* for specific data points and key terms
- Write substantial paragraphs (4-6 sentences) that really explore what's happening
- Keep calling it "XO bot" or "bot" consistently
- Give us enough detail to really understand the situation

**Try this structure:**
### How Users Actually Interact with the Bot
[2-3 paragraphs that dig into the real patterns you're seeing - how people engage, what they're trying to accomplish, where things work well, and what the numbers tell us about user behavior. Include specific data points and trends.]

### When Conversations Break Down
[2-3 paragraphs exploring what leads to transfers - the user experience that causes problems, common failure points, and how different issues affect people's satisfaction. Look at the connection between where people drop off and why they need help.]

### What We Can Do About It
[2-3 paragraphs with practical recommendations that make sense based on what you found. Give context about what would have the biggest impact, how changes might improve containment rates, and what would make the biggest difference for users. Include both quick wins and longer-term improvements.]
`;

/**
 * Containment Improvement Prompt - One clear, actionable suggestion
 */
export const CONTAINMENT_SUGGESTION_PROMPT = `
## 3. Top Improvement Suggestion (1 sentence, plain text only)
Give us the one change that would make the biggest difference in keeping more conversations contained. Write this as one clear, actionable sentence:

- **Be specific**: Point to actual patterns in the data, not generic advice  
- **Use the numbers**: Reference the top transfer reasons, drop-off spots, or percentages you found
- **Focus on impact**: Go after the improvement that would help the most people
- **Keep it concise**: Should fit nicely in a card display (under 120 characters works best)
- **Make it sound natural**: Write like you're giving advice to a colleague, not writing a manual
- **Include the data**: Work in specific percentages or numbers when they help make the point
- **Stay consistent**: Keep using "XO bot" or "bot" 
- **Plain text only**: Don't use any markdown formatting (*italics*, **bold**, etc.) since this displays as regular text

**Good examples of what we're looking for:**
- "Fix the account verification flow to prevent the 34% of transfers caused by authentication problems"
- "Add help prompts during billing questions to keep 28% more conversations from getting transferred"  
- "Expand the bot's knowledge about technical issues to handle the 19% of sessions that currently need human help"
- "Make policy number entry easier to stop 41% of authentication-related transfers"
`;

/**
 * Create the comprehensive analysis prompt
 */
export function createAnalysisPrompt(aggregation: AnalysisAggregation, sessions: Array<{ start_time: string }>, additionalContext?: string): string {
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
  
  // Add additional context if provided
  const contextSection = additionalContext 
    ? `\nAdditional Context and Instructions from User: ${additionalContext}\n`
    : '';

  return `# Kore.ai Bot Analysis Context

You're analyzing conversations between people and a Kore.ai bot — a bot created in the Kore.ai platform — to figure out what's working, what isn't, and how to make things better. You work on behalf of Kore.ai. You're usually analyzing sessions of an IVA (Interactive Voice Assistant) or a chatbot.
${contextSection}

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

## What Happened in Each Session
Here's a quick summary of each conversation we analyzed:

${aggregation.allSessionNotes.map((note, index) => `${index + 1}. ${note}`).join('\n')}

## Real Conversation Examples

Here are 5 actual conversations to show you what users are experiencing:

${aggregation.sampleTranscripts.map((transcript, index) => `
### Sample ${index + 1}: ${transcript.intent} (${transcript.outcome})
**Session ID:** ${transcript.sessionId}

${transcript.messages.map(msg => 
  `**${msg.message_type === 'user' ? 'User' : 'Bot'}**: ${msg.message}`
).join('\n')}
`).join('\n')}

---

# What You Need to Do

Create three parts for a bot performance analysis report:

${ANALYSIS_OVERVIEW_PROMPT}

${DETAILED_ANALYSIS_PROMPT}

${CONTAINMENT_SUGGESTION_PROMPT}

Write all three sections like you're a bot performance expert sharing insights with your team to help improve how the bot works and what users experience. Say "I" instead of "we". 

Format your response as:

# ANALYSIS_OVERVIEW
[overview markdown content with rich formatting]

# ANALYSIS_SUMMARY  
[detailed analysis markdown content with structured headers and concise recommendations]

# CONTAINMENT_SUGGESTION
[single actionable sentence for improving XO bot containment]`;
}