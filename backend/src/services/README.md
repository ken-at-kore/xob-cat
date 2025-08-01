# Transcript Sanitization Service

The `TranscriptSanitizationService` centralizes all message sanitization logic for cleaning up bot and user messages from the Kore.ai API. This service automatically handles various patterns to ensure clean, readable transcripts for analysis.

## Overview

The service is automatically integrated into the message extraction flow through:
- `KoreApiService.convertKoreMessageToMessage()` - Sanitizes messages during API conversion
- `SWTBuilder.createMessage()` - Sanitizes messages during SWT creation

## Sanitization Patterns

### Pattern 1: JSON Bot Messages

**Problem**: Bot messages sometimes contain JSON with the actual message text nested in complex structures.

**Example Input**:
```json
{
  "type": "command",
  "command": "redirect", 
  "data": [{
    "verb": "gather",
    "say": {
      "text": ["Hello. You can talk to me in complete sentences about claim status, time entry, and more. So, how can I help you today?"]
    }
  }]
}
```

**Output**: `"Hello. You can talk to me in complete sentences about claim status, time entry, and more. So, how can I help you today?"`

**Implementation**:
- Detects JSON-formatted messages (starts with `{`, ends with `}`)
- Extracts text from `say.text` fields (arrays joined with spaces)
- Recursively searches for any `text` field as fallback
- Only applies to bot messages

### Pattern 2: SSML Speak Tags

**Problem**: Bot messages contain SSML (Speech Synthesis Markup Language) tags that clutter the transcript.

**Example Inputs**:
```html
<speak><prosody rate="-10%">I can help you with that.First,let's look up your account.</prosody></speak>
<speak>Welcome! <emphasis>Please speak clearly</emphasis>.</speak>
```

**Outputs**:
```
I can help you with that.First,let's look up your account.
Welcome! Please speak clearly.
```

**Implementation**:
- Removes `<speak>`, `<prosody>`, `<emphasis>`, `<say-as>` tags
- Converts `<break/>` tags to spaces
- Cleans up extra whitespace
- Applies to both user and bot messages

### Pattern 3: Welcome Task Filtering

**Problem**: System-generated "Welcome Task" messages appear in user message streams and should be filtered out.

**Example Input**: `"Welcome Task"` (from user)

**Output**: Message filtered out entirely (returns `null`)

**Implementation**:
- Case-insensitive matching
- Trims whitespace before comparison
- Only filters user messages (not bot messages)
- Exact match only (doesn't filter messages containing "Welcome Task")

### Pattern 4: Hangup Command Filtering

**Problem**: Bot messages containing hangup commands are system-generated control messages that clutter the transcript and provide no conversational value.

**Example Inputs**:
```json
{
  "type": "command",
  "command": "redirect",
  "queueCommand": true,
  "data": [
    {"verb": "pause", "length": 0.2},
    {"verb": "hangup", "headers": {}}
  ]
}
```

**Output**: Message filtered out entirely (returns `null`)

**Implementation**:
- Detects JSON messages with `type: "command"` and `command: "redirect"`
- Searches for any `verb: "hangup"` in the data array
- Works with any pause length value or additional properties
- Only applies to bot messages
- Gracefully handles malformed JSON

### Pattern 5: HTML Entity Decoding

**Problem**: Messages contain HTML entities like `&quot;`, `&apos;`, `&amp;` instead of actual characters, making text hard to read.

**Example Input**:
```
Lastly, what&apos;s the reason for your absence? You can say &quot;treatment or appointment&quot;; &quot;episode of incapacity&quot;; or, &quot;something else&quot;.
```

**Output**: 
```
Lastly, what's the reason for your absence? You can say "treatment or appointment"; "episode of incapacity"; or, "something else".
```

**Implementation**:
- Detects HTML entities using regex patterns
- Supports named entities (`&quot;`, `&amp;`, etc.)
- Supports numeric entities (decimal: `&#169;`, hexadecimal: `&#x24;`)
- Handles common entities: quotes, apostrophes, ampersands, brackets, spaces, dashes, copyright symbols
- Applies to both user and bot messages
- Gracefully handles malformed entities

**Supported Entities**:
- Basic: `&quot;` → `"`, `&apos;` → `'`, `&amp;` → `&`, `&lt;` → `<`, `&gt;` → `>`
- Typography: `&ndash;` → `–`, `&mdash;` → `—`, `&hellip;` → `…`
- Smart quotes: `&ldquo;` → `"`, `&rdquo;` → `"`, `&lsquo;` → `'`, `&rsquo;` → `'`
- Symbols: `&copy;` → `©`, `&reg;` → `®`, `&trade;` → `™`
- Spaces: `&nbsp;` → ` `
- Numeric: `&#169;` → `©`, `&#x24;` → `$`

### Pattern 6: MAX_NO_INPUT Replacement

**Problem**: System-generated user messages show "MAX_NO_INPUT" when users don't respond within the timeout period, which is not user-friendly for transcript analysis.

**Example Input**: `"MAX_NO_INPUT"` (from user)

**Output**: `"<User is silent>"`

**Implementation**:
- Case-insensitive matching (`MAX_NO_INPUT`, `max_no_input`, `Max_No_Input`)
- Trims whitespace before comparison
- Only applies to user messages (not bot messages)
- Exact match only (doesn't replace messages containing "MAX_NO_INPUT")
- Replaces with human-readable `<User is silent>` text

**Use Cases**:
- Timeout scenarios where users don't respond
- Silent periods in voice conversations
- Abandoned sessions due to no user input
- Better readability in transcript analysis

## Usage

### Automatic Integration

The service is automatically used by:

```typescript
// KoreApiService - during message conversion
const result = service.convertKoreMessageToMessage(koreMessage);

// SWTBuilder - during SWT creation  
const message = SWTBuilder.createMessage(rawMessage);
```

### Manual Usage

```typescript
import { TranscriptSanitizationService } from './transcriptSanitizationService';

// Single message
const result = TranscriptSanitizationService.sanitizeMessage(
  '<speak>Hello world!</speak>',
  'bot'
);
console.log(result.text); // "Hello world!"

// Batch processing
const messages = [
  { message: 'Welcome Task', message_type: 'user' },
  { message: '<speak>Hello</speak>', message_type: 'bot' }
];
const sanitized = TranscriptSanitizationService.sanitizeMessages(messages);
// Returns only the bot message: [{ message: 'Hello', message_type: 'bot', sanitized: true }]
```

## Return Values

The `sanitizeMessage` method returns a `SanitizationResult`:

```typescript
interface SanitizationResult {
  sanitized: boolean;    // Whether any changes were made
  text: string | null;   // Cleaned text, or null if message should be filtered
  reason?: string;       // Description of what happened
}
```

- `text: null` indicates the message should be filtered out entirely
- `sanitized: true` indicates cleaning was performed
- `reason` provides context for debugging

## Testing

Comprehensive tests cover:
- All sanitization patterns individually
- Combined patterns (JSON with SSML)
- Edge cases (empty strings, malformed JSON)
- Integration with existing services
- Batch processing

Run tests:
```bash
npm test -- transcriptSanitizationService
npm test -- transcriptSanitizationIntegration
```

## Performance

- Minimal overhead for messages that don't need sanitization
- JSON parsing only attempted on messages that look like JSON
- Regex operations optimized for common patterns
- Batch processing available for multiple messages

## Maintenance

When adding new sanitization patterns:

1. Add the pattern detection logic to `TranscriptSanitizationService`
2. Update the sanitization method to handle the new pattern
3. Add comprehensive tests covering the new pattern
4. Update this documentation
5. Consider integration test scenarios

Common extension points:
- `shouldFilterMessage()` - Add new filtering rules
- `sanitizeMessage()` - Add new cleaning patterns
- `sanitizeMessages()` - Modify batch processing logic