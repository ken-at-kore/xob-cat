/**
 * Session Analysis Prompt Engineering
 * 
 * This file contains all prompt templates for OpenAI session analysis,
 * including system messages, user prompts, and classification instructions.
 * This ensures consistency and makes prompt engineering easily reviewable.
 */

import { SessionWithTranscript, ExistingClassifications } from '../types';

/**
 * System message for OpenAI session analysis
 */
export const SESSION_ANALYSIS_SYSTEM_MESSAGE = 'You are an expert session analyst. Analyze the session transcripts and use the provided function to classify them consistently.';

/**
 * Classification instructions for session analysis
 */
export const CLASSIFICATION_INSTRUCTIONS = `For each session, provide the following classifications:

1. **General Intent**: What the user is trying to accomplish (usually 1-2 words). Common examples: "Claim Status", "Billing", "Eligibility", "Live Agent", "Provider Enrollment", "Portal Access", "Authorization". If unknown, use "Unknown". If the user's intent was both Live Agent and another intent, classify the intent as the other intent.

2. **Session Outcome**: Either "Transfer" (if session was transferred to live agent) or "Contained" (if session was handled by bot). Classify sessions as "Transfer" if there's a transfer message toward the end of the session (e.g. "Please hold while I connect you with a customer service representative"). Classify sessions as "Contained" if the session was not transferred. Consider that some "Contained" sessions will end with the Bot saying it's ending the conversation ("I am closing our current conversation...").

3. **Transfer Reason**: Why the session was transferred (only if Session Outcome is "Transfer"). Look for specific error messages or invalid responses that caused the transfer. Example reasons: "Invalid Provider ID" (when provider ID is rejected), "Live Agent Request", "Invalid Member ID" (when member ID is rejected), "Invalid Claim Number" (when claim number is rejected), "No Provider ID" (when user says they don't have one), "Inactive Provider ID" (when provider ID is inactive), "Authentication Failed", "Technical Issue", "Policy Not Found", "Can't Capture Policy Number". If not transferred, leave blank.

4. **Drop-Off Location**: Where in the session flow (at which prompt) the user dropped off (started getting routed to an agent), not counting error response prompts or Live Agent rebuttal prompts. Will only have a value if session_outcome is "Transfer"). Example locations: "Policy Number Prompt", "Help Offer Prompt", "Authentication", "Claim Details", "Member Information", "Provider ID", "Date of Service", "User Name". If not transferred, leave blank.

5. **Notes**: One sentence summary of what happened in the session.

EXAMPLE 1:
Consider the following example transcript...
---
Bot: How can I help you today?
User: Speak to a person
Bot: I can connect you to an agent, but before I do, can you tell me the reason for your call?
User: Live agent
Bot: Please hold while I transfer you.
---
In that example, the classifications should be as follows:
Intent: Live Agent
Outcome: Transfer
Transfer Reason: Live Agent Request
Drop-Off Location: Help Offer Prompt

EXAMPLE 2:
Consider the following example transcript...
---
Bot: How can I help you today?
User: Claim status
Bot: <After determining claim and giving info>. How else can I help you?
User: Live agent
Bot: Please hold while I transfer you.
---
In that example, the classifications should be as follows:
Intent: Claim status
Outcome: Transfer
Transfer Reason: Live Agent Request
Drop-Off Location: Help Offer Prompt

IMPORTANT: 
- Use existing classifications when possible to maintain consistency
- If Session Outcome is "Contained", leave Transfer Reason and Drop-Off Location blank
- Be concise but descriptive in your classifications`;

/**
 * Create the complete analysis prompt for OpenAI
 */
export function createSessionAnalysisPrompt(
  sessions: SessionWithTranscript[],
  existingClassifications: ExistingClassifications,
  additionalContext?: string
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

  // Add additional context if provided
  const contextSection = additionalContext 
    ? `\nAdditional Context and Instructions from User: ${additionalContext}\n`
    : '';

  return `Analyze the following session transcripts and classify each session according to the specified criteria.
${contextSection}
${intentGuidance}${transferReasonGuidance}${dropOffGuidance}

${CLASSIFICATION_INSTRUCTIONS}

${sessionsText}`;
}