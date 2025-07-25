import OpenAI from 'openai';
import { 
  SessionWithTranscript, 
  ExistingClassifications, 
  AUTO_ANALYZE_FUNCTION_SCHEMA 
} from '../../../shared/types';

export interface OpenAIBatchResult {
  sessions: Array<{
    user_id: string;
    general_intent: string;
    session_outcome: 'Transfer' | 'Contained';
    transfer_reason: string;
    drop_off_location: string;
    notes: string;
  }>;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
}

export class OpenAIAnalysisService {
  // GPT-4o-mini pricing (per 1M tokens)
  private readonly GPT4O_MINI_INPUT_COST = 0.000015;
  private readonly GPT4O_MINI_OUTPUT_COST = 0.000060;

  async analyzeBatch(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications,
    apiKey: string
  ): Promise<OpenAIBatchResult> {
    const client = new OpenAI({ apiKey });
    
    const prompt = this.createAnalysisPrompt(sessions, existingClassifications);

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert session analyst. Analyze the session transcripts and use the provided function to classify them consistently.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [{ type: 'function', function: AUTO_ANALYZE_FUNCTION_SCHEMA }],
        tool_choice: { type: 'function', function: { name: 'analyze_sessions_batch' } },
        temperature: 0 // Deterministic results
      });

      // Extract function call results
      if (!response.choices[0]?.message?.tool_calls?.[0]) {
        throw new Error('No tool calls in response');
      }

      const toolCall = response.choices[0].message.tool_calls[0];
      const functionArgs = JSON.parse(toolCall.function.arguments);

      if (!functionArgs.sessions || !Array.isArray(functionArgs.sessions)) {
        throw new Error('Invalid response format: missing sessions array');
      }

      // Calculate cost
      const cost = this.calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0,
        response.model
      );

      return {
        sessions: functionArgs.sessions,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        cost,
        model: response.model
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  createAnalysisPrompt(
    sessions: SessionWithTranscript[],
    existingClassifications: ExistingClassifications
  ): string {
    // Build classification guidance based on existing classifications
    let intentGuidance = '';
    let transferReasonGuidance = '';
    let dropOffGuidance = '';

    if (existingClassifications.generalIntent.size > 0) {
      const sortedIntents = Array.from(existingClassifications.generalIntent).sort();
      intentGuidance = `\nExisting General Intent classifications: ${sortedIntents.join(', ')}`;
    }

    if (existingClassifications.transferReason.size > 0) {
      const sortedReasons = Array.from(existingClassifications.transferReason).sort();
      transferReasonGuidance = `\nExisting Transfer Reason classifications: ${sortedReasons.join(', ')}`;
    }

    if (existingClassifications.dropOffLocation.size > 0) {
      const sortedLocations = Array.from(existingClassifications.dropOffLocation).sort();
      dropOffGuidance = `\nExisting Drop-Off Location classifications: ${sortedLocations.join(', ')}`;
    }

    // Format session transcripts
    const sessionsText = sessions.map((session, index) => {
      const transcript = session.messages
        .map(msg => `${msg.message_type}: ${msg.message}`)
        .join('\n');

      return `--- Session ${index + 1} ---
User ID: ${session.user_id}
Transcript:
${transcript}`;
    }).join('\n\n');

    return `Analyze the following session transcripts and classify each session according to the specified criteria.

${intentGuidance}${transferReasonGuidance}${dropOffGuidance}

For each session, provide the following classifications:

1. **General Intent**: What the user is trying to accomplish (usually 1-2 words). Common examples: "Claim Status", "Billing", "Eligibility", "Live Agent", "Provider Enrollment", "Portal Access", "Authorization". If unknown, use "Unknown".

2. **Session Outcome**: Either "Transfer" (if session was transferred to live agent) or "Contained" (if session was handled by bot). Classify sessions as "Transfer" if there's a transfer message toward the end of the session (e.g. "Please hold while I connect you with a customer service representative"). Classify sessions as "Contained" if the session was not transferred. Consider that some "Contained" sessions will end with the Bot saying it's ending the conversation ("I am closing our current conversation...").

3. **Transfer Reason**: Why the session was transferred (only if Session Outcome is "Transfer"). Look for specific error messages or invalid responses that caused the transfer. Common reasons: "Invalid Provider ID" (when provider ID is rejected), "Invalid Member ID" (when member ID is rejected), "Invalid Claim Number" (when claim number is rejected), "No Provider ID" (when user says they don't have one), "Inactive Provider ID" (when provider ID is inactive), "Authentication Failed", "Technical Issue", "Policy Not Found", "Can't Capture Policy Number". If not transferred, leave blank.

4. **Drop-Off Location**: Where in the session flow (at which prompt) the user dropped off (started getting routed to an agent). Will only have a value if session_outcome is "Transfer"). Example locations: "Policy Number Prompt", "Authentication", "Claim Details", "Member Information", "Provider ID", "Date of Service", "User Name". If not transferred, leave blank.

5. **Notes**: One sentence summary of what happened in the session.

IMPORTANT: 
- Use existing classifications when possible to maintain consistency
- If Session Outcome is "Contained", leave Transfer Reason and Drop-Off Location blank
- Be concise but descriptive in your classifications

${sessionsText}`;
  }

  calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    if (!model.includes('gpt-4o-mini')) {
      return 0; // Unknown model
    }

    const inputCost = (promptTokens * this.GPT4O_MINI_INPUT_COST) / 1_000_000;
    const outputCost = (completionTokens * this.GPT4O_MINI_OUTPUT_COST) / 1_000_000;
    
    return inputCost + outputCost;
  }
}