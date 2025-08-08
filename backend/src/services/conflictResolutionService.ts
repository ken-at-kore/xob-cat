import {
  SessionWithFacts,
  ExistingClassifications,
  ConflictResolutions,
  ConflictResolutionResult,
  ClassificationConflicts,
  BatchTokenUsage
} from '../../../shared/types';
import { IOpenAIService } from '../interfaces';
import OpenAI from 'openai';

export class ConflictResolutionService {
  // OpenAI function schema for conflict resolution
  private readonly CONFLICT_RESOLUTION_SCHEMA = {
    name: "resolve_classification_conflicts",
    description: "Identify and resolve semantic duplicate classifications",
    parameters: {
      type: "object",
      properties: {
        generalIntents: {
          type: "array",
          description: "Groups of general intent classifications that mean the same thing",
          items: {
            type: "object",
            properties: {
              canonical: { 
                type: "string", 
                description: "The chosen canonical classification (most specific and clearest)" 
              },
              aliases: { 
                type: "array", 
                items: { type: "string" },
                description: "All other classifications that should map to the canonical name"
              }
            },
            required: ["canonical", "aliases"]
          }
        },
        transferReasons: {
          type: "array",
          description: "Groups of transfer reason classifications that mean the same thing",
          items: {
            type: "object",
            properties: {
              canonical: { 
                type: "string", 
                description: "The chosen canonical classification (most specific and clearest)" 
              },
              aliases: { 
                type: "array", 
                items: { type: "string" },
                description: "All other classifications that should map to the canonical name"
              }
            },
            required: ["canonical", "aliases"]
          }
        },
        dropOffLocations: {
          type: "array",
          description: "Groups of drop-off location classifications that mean the same thing",
          items: {
            type: "object",
            properties: {
              canonical: { 
                type: "string", 
                description: "The chosen canonical classification (most specific and clearest)" 
              },
              aliases: { 
                type: "array", 
                items: { type: "string" },
                description: "All other classifications that should map to the canonical name"
              }
            },
            required: ["canonical", "aliases"]
          }
        }
      },
      required: ["generalIntents", "transferReasons", "dropOffLocations"]
    }
  };

  constructor(private openaiService: IOpenAIService) {}

  async resolveConflicts(
    sessions: SessionWithFacts[],
    apiKey: string,
    modelId: string = 'gpt-4o-mini'
  ): Promise<ConflictResolutionResult> {
    console.log(`[ConflictResolutionService] Starting conflict resolution for ${sessions.length} sessions`);
    
    const startTime = Date.now();
    
    // Extract all unique classifications from sessions
    const allClassifications = this.extractAllClassifications(sessions);
    
    console.log(`[ConflictResolutionService] Found classifications:`, {
      intents: allClassifications.generalIntent.size,
      reasons: allClassifications.transferReason.size,
      locations: allClassifications.dropOffLocation.size
    });
    
    // Check if conflict resolution is needed
    if (!this.needsConflictResolution(allClassifications)) {
      console.log(`[ConflictResolutionService] No conflicts detected, skipping resolution`);
      return {
        resolvedSessions: sessions,
        resolutionStats: {
          conflictsFound: 0,
          conflictsResolved: 0,
          canonicalMappings: 0
        },
        resolutions: {
          generalIntents: [],
          transferReasons: [],
          dropOffLocations: []
        },
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
          model: modelId
        }
      };
    }

    // Use LLM to identify and resolve conflicts
    const llmResolutions = await this.callLLMForConflictResolution(
      allClassifications,
      apiKey,
      modelId
    );

    // Apply resolutions to sessions
    const resolvedSessions = this.applyResolutions(sessions, llmResolutions.resolutions);
    
    const processingTime = Date.now() - startTime;
    
    const result: ConflictResolutionResult = {
      resolvedSessions,
      resolutionStats: {
        conflictsFound: this.countPotentialConflicts(allClassifications),
        conflictsResolved: this.countResolutions(llmResolutions.resolutions),
        canonicalMappings: this.countCanonicalMappings(llmResolutions.resolutions)
      },
      resolutions: llmResolutions.resolutions,
      tokenUsage: llmResolutions.tokenUsage
    };

    console.log(`[ConflictResolutionService] Conflict resolution complete in ${processingTime}ms:`, result.resolutionStats);
    
    return result;
  }

  identifyPotentialConflicts(
    classifications: ExistingClassifications
  ): ClassificationConflicts {
    const conflicts: ClassificationConflicts = {
      intentConflicts: [],
      reasonConflicts: [],
      locationConflicts: []
    };

    // Simple similarity-based conflict detection
    // This is a heuristic approach - the LLM will make final determination
    
    conflicts.intentConflicts = this.findSimilarClassifications(
      Array.from(classifications.generalIntent)
    );
    
    conflicts.reasonConflicts = this.findSimilarClassifications(
      Array.from(classifications.transferReason)
    );
    
    conflicts.locationConflicts = this.findSimilarClassifications(
      Array.from(classifications.dropOffLocation)
    );

    const totalConflicts = conflicts.intentConflicts.length + 
                          conflicts.reasonConflicts.length + 
                          conflicts.locationConflicts.length;

    console.log(`[ConflictResolutionService] Identified ${totalConflicts} potential conflict groups`);
    
    return conflicts;
  }

  applyResolutions(
    sessions: SessionWithFacts[],
    resolutions: ConflictResolutions
  ): SessionWithFacts[] {
    console.log(`[ConflictResolutionService] Applying resolutions to ${sessions.length} sessions`);
    
    // Create mapping dictionaries for fast lookup
    const intentMapping = this.createMapping(resolutions.generalIntents);
    const reasonMapping = this.createMapping(resolutions.transferReasons);
    const locationMapping = this.createMapping(resolutions.dropOffLocations);
    
    let totalMappings = 0;
    
    const resolvedSessions = sessions.map(session => {
      const updatedFacts = { ...session.facts };
      let sessionMappings = 0;
      
      // Apply intent resolution
      if (intentMapping.has(updatedFacts.generalIntent)) {
        const canonical = intentMapping.get(updatedFacts.generalIntent)!;
        if (canonical !== updatedFacts.generalIntent) {
          updatedFacts.generalIntent = canonical;
          sessionMappings++;
        }
      }
      
      // Apply reason resolution
      if (reasonMapping.has(updatedFacts.transferReason)) {
        const canonical = reasonMapping.get(updatedFacts.transferReason)!;
        if (canonical !== updatedFacts.transferReason) {
          updatedFacts.transferReason = canonical;
          sessionMappings++;
        }
      }
      
      // Apply location resolution
      if (locationMapping.has(updatedFacts.dropOffLocation)) {
        const canonical = locationMapping.get(updatedFacts.dropOffLocation)!;
        if (canonical !== updatedFacts.dropOffLocation) {
          updatedFacts.dropOffLocation = canonical;
          sessionMappings++;
        }
      }
      
      totalMappings += sessionMappings;
      
      return {
        ...session,
        facts: updatedFacts
      };
    });
    
    console.log(`[ConflictResolutionService] Applied ${totalMappings} classification mappings across ${sessions.length} sessions`);
    
    return resolvedSessions;
  }

  private async callLLMForConflictResolution(
    classifications: ExistingClassifications,
    apiKey: string,
    modelId: string
  ): Promise<{
    resolutions: ConflictResolutions;
    tokenUsage: BatchTokenUsage;
  }> {
    const client = new OpenAI({ apiKey });
    
    const prompt = this.createConflictResolutionPrompt(classifications);
    
    console.log(`[ConflictResolutionService] Calling LLM for conflict resolution with model ${modelId}`);
    
    if (process.env.OPENAI_LOGGING_VERBOSE === 'true') {
      if (process.env.OPENAI_LOGGING_FULL_PROMPT === 'true') {
        console.log('🔧 Full Conflict Resolution Prompt:', prompt);
      } else {
        console.log('🔧 Conflict Resolution Prompt Preview:', prompt.substring(0, 300) + '...');
      }
    }
    
    try {
      const response = await client.chat.completions.create({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: this.getSystemMessage()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [{ type: 'function', function: this.CONFLICT_RESOLUTION_SCHEMA }],
        tool_choice: { type: 'function', function: { name: 'resolve_classification_conflicts' } },
        temperature: 0 // Deterministic results for consistency
      });

      if (!response.choices[0]?.message?.tool_calls?.[0]) {
        throw new Error('No tool calls in conflict resolution response');
      }

      const toolCall = response.choices[0].message.tool_calls[0];
      const functionArgs = JSON.parse(toolCall.function.arguments);

      // Validate response format
      if (!this.validateResolutionResponse(functionArgs)) {
        throw new Error('Invalid conflict resolution response format');
      }

      const resolutions: ConflictResolutions = {
        generalIntents: functionArgs.generalIntents || [],
        transferReasons: functionArgs.transferReasons || [],
        dropOffLocations: functionArgs.dropOffLocations || []
      };

      const tokenUsage: BatchTokenUsage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        cost: this.openaiService.calculateCost(
          response.usage?.prompt_tokens || 0,
          response.usage?.completion_tokens || 0,
          modelId
        ),
        model: modelId
      };

      console.log(`[ConflictResolutionService] LLM conflict resolution complete:`, {
        intents: resolutions.generalIntents.length,
        reasons: resolutions.transferReasons.length,
        locations: resolutions.dropOffLocations.length,
        tokens: tokenUsage.totalTokens,
        cost: tokenUsage.cost
      });
      
      if (process.env.OPENAI_LOGGING_VERBOSE === 'true') {
        console.log('🔧 Conflict Resolution Response:', JSON.stringify(resolutions, null, 2));
      }

      return {
        resolutions,
        tokenUsage
      };

    } catch (error) {
      console.error('[ConflictResolutionService] LLM call failed:', error);
      throw new Error(`Conflict resolution failed: ${error}`);
    }
  }

  private createConflictResolutionPrompt(classifications: ExistingClassifications): string {
    const intents = Array.from(classifications.generalIntent).sort();
    const reasons = Array.from(classifications.transferReason).filter(r => r.trim()).sort();
    const locations = Array.from(classifications.dropOffLocation).filter(l => l.trim()).sort();

    return `You are reviewing classifications from parallel analysis streams. Identify any semantic duplicates and choose the canonical version for each group.

**Instructions:**
1. Look for classifications that refer to the same concept but use different wording
2. For each group of duplicates, choose the most specific and clearest name as canonical
3. Only group classifications that truly mean the same thing - be conservative
4. If no duplicates exist for a category, return an empty array for that category

**General Intents found (${intents.length} total):**
${intents.map((intent, i) => `${i + 1}. "${intent}"`).join('\n')}

**Transfer Reasons found (${reasons.length} total):**
${reasons.length > 0 ? reasons.map((reason, i) => `${i + 1}. "${reason}"`).join('\n') : 'None'}

**Drop-Off Locations found (${locations.length} total):**
${locations.length > 0 ? locations.map((location, i) => `${i + 1}. "${location}"`).join('\n') : 'None'}

**Examples of what to look for:**
- "Claim Status" and "Claim Inquiry" → same concept
- "Live Agent" and "Transfer to Human" → same concept  
- "Invalid Provider ID" and "Bad Provider ID" → same concept
- "Policy Number Prompt" and "Policy Number Entry" → same concept

For each group of semantic duplicates:
1. Choose the canonical name (most specific and professional)
2. List all aliases that should map to the canonical name
3. Only include groups where you're confident the classifications mean the same thing

If no semantic duplicates exist in a category, return an empty array for that category.`;
  }

  private getSystemMessage(): string {
    return `You are an expert at analyzing customer service classifications and identifying semantic duplicates. Your goal is to consolidate similar classifications to maintain consistency across the dataset.

Guidelines:
- Only group classifications that truly refer to the same concept
- Choose canonical names that are specific, professional, and clear
- Be conservative - it's better to miss a conflict than create a false positive
- Consider context: "Authentication" and "Login" might be the same in some contexts
- Preserve important distinctions: "Invalid ID" vs "Missing ID" are different concepts`;
  }

  private extractAllClassifications(sessions: SessionWithFacts[]): ExistingClassifications {
    const classifications: ExistingClassifications = {
      generalIntent: new Set(),
      transferReason: new Set(),
      dropOffLocation: new Set()
    };

    for (const session of sessions) {
      const { facts } = session;
      
      if (facts.generalIntent && facts.generalIntent.trim()) {
        classifications.generalIntent.add(facts.generalIntent);
      }
      
      if (facts.transferReason && facts.transferReason.trim()) {
        classifications.transferReason.add(facts.transferReason);
      }
      
      if (facts.dropOffLocation && facts.dropOffLocation.trim()) {
        classifications.dropOffLocation.add(facts.dropOffLocation);
      }
    }

    return classifications;
  }

  private needsConflictResolution(classifications: ExistingClassifications): boolean {
    // Simple heuristic: if we have more than a few classifications in any category,
    // there might be conflicts worth checking
    const minClassificationsForConflictCheck = 5;
    
    return classifications.generalIntent.size >= minClassificationsForConflictCheck ||
           classifications.transferReason.size >= minClassificationsForConflictCheck ||
           classifications.dropOffLocation.size >= minClassificationsForConflictCheck;
  }

  private findSimilarClassifications(classifications: string[]): string[][] {
    const groups: string[][] = [];
    
    // Simple similarity detection based on common words and patterns
    // This is a heuristic - the LLM makes the final decision
    
    for (let i = 0; i < classifications.length; i++) {
      for (let j = i + 1; j < classifications.length; j++) {
        const a = classifications[i]!.toLowerCase();
        const b = classifications[j]!.toLowerCase();
        
        if (this.areSimilar(a, b)) {
          // Check if either classification is already in a group
          let foundGroup = false;
          for (const group of groups) {
            if (group.includes(classifications[i]!) || group.includes(classifications[j]!)) {
              if (!group.includes(classifications[i]!)) group.push(classifications[i]!);
              if (!group.includes(classifications[j]!)) group.push(classifications[j]!);
              foundGroup = true;
              break;
            }
          }
          
          if (!foundGroup) {
            groups.push([classifications[i]!, classifications[j]!]);
          }
        }
      }
    }
    
    return groups;
  }

  private areSimilar(a: string, b: string): boolean {
    // Simple similarity heuristics
    
    // Check for common stems
    if (a.includes('claim') && b.includes('claim')) return true;
    if (a.includes('agent') && b.includes('human')) return true;
    if (a.includes('transfer') && b.includes('connect')) return true;
    if (a.includes('invalid') && b.includes('bad')) return true;
    if (a.includes('provider') && b.includes('provider')) return true;
    if (a.includes('member') && b.includes('member')) return true;
    if (a.includes('policy') && b.includes('policy')) return true;
    if (a.includes('auth') && b.includes('login')) return true;
    
    // Check for word overlap
    const wordsA = a.split(/\s+/);
    const wordsB = b.split(/\s+/);
    const commonWords = wordsA.filter(word => wordsB.includes(word));
    
    return commonWords.length >= Math.min(wordsA.length, wordsB.length) * 0.5;
  }

  private createMapping(resolutions: Array<{ canonical: string; aliases: string[] }>): Map<string, string> {
    const mapping = new Map<string, string>();
    
    for (const resolution of resolutions) {
      // Map canonical to itself
      mapping.set(resolution.canonical, resolution.canonical);
      
      // Map all aliases to canonical
      for (const alias of resolution.aliases) {
        mapping.set(alias, resolution.canonical);
      }
    }
    
    return mapping;
  }

  private validateResolutionResponse(response: any): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }
    
    const categories = ['generalIntents', 'transferReasons', 'dropOffLocations'];
    
    for (const category of categories) {
      if (!Array.isArray(response[category])) {
        return false;
      }
      
      for (const group of response[category]) {
        if (!group.canonical || typeof group.canonical !== 'string' ||
            !Array.isArray(group.aliases)) {
          return false;
        }
      }
    }
    
    return true;
  }

  private countPotentialConflicts(classifications: ExistingClassifications): number {
    const conflicts = this.identifyPotentialConflicts(classifications);
    return conflicts.intentConflicts.length + 
           conflicts.reasonConflicts.length + 
           conflicts.locationConflicts.length;
  }

  private countResolutions(resolutions: ConflictResolutions): number {
    return resolutions.generalIntents.length + 
           resolutions.transferReasons.length + 
           resolutions.dropOffLocations.length;
  }

  private countCanonicalMappings(resolutions: ConflictResolutions): number {
    let mappings = 0;
    
    for (const group of resolutions.generalIntents) {
      mappings += group.aliases.length;
    }
    
    for (const group of resolutions.transferReasons) {
      mappings += group.aliases.length;
    }
    
    for (const group of resolutions.dropOffLocations) {
      mappings += group.aliases.length;
    }
    
    return mappings;
  }
}