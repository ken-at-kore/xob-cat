import OpenAI from 'openai';
import { AnalysisResult, Message, ANALYSIS_FUNCTION_SCHEMA } from '../../../shared/types';

// GPT-4o-mini pricing (per 1M tokens)
const GPT4O_MINI_INPUT_COST = 0.000015;
const GPT4O_MINI_OUTPUT_COST = 0.000060;

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for session analysis');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

function calculateCost(promptTokens: number, completionTokens: number): number {
  const cost = (promptTokens * GPT4O_MINI_INPUT_COST + completionTokens * GPT4O_MINI_OUTPUT_COST) / 1_000_000;
  return cost;
}

function createAnalysisPrompt(messages: Message[]): string {
  const conversationText = messages
    .map((msg, index) => `${msg.message_type.toUpperCase()}: ${msg.message}`)
    .join('\n');

  return `Analyze the following chatbot conversation and classify it according to the specified criteria.

For this conversation, provide the following classifications:

1. **General Intent**: What the user is asking about (usually 1-2 words). Common examples: "Claim Status", "Billing", "Eligibility", "Live Agent", "Provider Enrollment", "Portal Access", "Authorization". If unknown, use "Unknown".

2. **Call Outcome**: Either "Transfer" (if conversation was transferred to live agent) or "Contained" (if conversation was handled by bot). Classify as "Transfer" if there's a transfer message toward the end (e.g. "Please hold while I connect you with a customer service representative"). Classify as "Contained" if the conversation was not transferred.

3. **Transfer Reason**: Why the conversation was transferred (only if Call Outcome is "Transfer"). Look for specific error messages or invalid responses. Common reasons: "Invalid Provider ID", "Invalid Member ID", "Invalid Claim Number", "No Provider ID", "Inactive Provider ID", "Authentication Failed", "Technical Issue", "Policy Not Found", "Can't Capture Policy Number". If not transferred, leave blank.

4. **Drop-Off Location**: Where in the conversation flow the user dropped off (only if call_outcome is "Transfer"). Example locations: "Policy Number Prompt", "Authentication", "Claim Details", "Member Information", "Provider ID", "Date of Service", "Caller Name". If not transferred, leave blank.

5. **Notes**: One sentence summary of what happened in the conversation.

IMPORTANT: 
- If Call Outcome is "Contained", leave Transfer Reason and Drop-Off Location blank
- Be concise but descriptive in your classifications

Conversation:
${conversationText}`;
}

export async function analyzeSessionWithOpenAI(sessionId: string, messages: Message[]): Promise<AnalysisResult> {
  try {
    const prompt = createAnalysisPrompt(messages);
    
    console.log(`Analyzing session ${sessionId} with ${messages.length} messages`);
    
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert conversation analyst. Analyze the chatbot conversation and use the provided function to classify it."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      tools: [{ type: "function", function: ANALYSIS_FUNCTION_SCHEMA }],
      tool_choice: { type: "function", function: { name: "analyze_session" } },
      temperature: 0
    });
    
    console.log(`Received response from OpenAI for session ${sessionId}`);
    
    // Extract the function call response
    const choice = response.choices[0];
    if (!choice?.message?.tool_calls) {
      throw new Error("No tool calls in response");
    }
    
    const toolCall = choice.message.tool_calls[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid tool call response");
    }
    
    const functionArgs = JSON.parse(toolCall.function.arguments);
    
    // Calculate token usage and cost
    const usage = response.usage;
    const tokenUsage = {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
      cost: calculateCost(usage?.prompt_tokens || 0, usage?.completion_tokens || 0)
    };
    
    const analysis: AnalysisResult = {
      session_id: sessionId,
      user_id: `user_${Math.floor(Math.random() * 1000)}`, // Mock user ID for now
      general_intent: functionArgs.general_intent,
      call_outcome: functionArgs.call_outcome,
      transfer_reason: functionArgs.transfer_reason || undefined,
      drop_off_location: functionArgs.drop_off_location || undefined,
      notes: functionArgs.notes,
      token_usage: tokenUsage,
      analyzed_at: new Date().toISOString()
    };
    
    console.log(`Analysis completed for session ${sessionId}: ${analysis.general_intent} - ${analysis.call_outcome}`);
    
    return analysis;
  } catch (error) {
    console.error(`Error analyzing session ${sessionId}:`, error);
    throw error;
  }
} 