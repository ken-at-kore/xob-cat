import { TranscriptSanitizationService } from '../../services/transcriptSanitizationService';

describe('TranscriptSanitizationService', () => {
  describe('sanitizeMessage', () => {
    describe('Pattern 1: JSON Bot Messages', () => {
      it('should extract text from JSON bot message with say.text array', () => {
        const jsonMessage = JSON.stringify({
          type: 'command',
          command: 'redirect',
          queueCommand: false,
          data: [{
            verb: 'gather',
            say: {
              text: ['Hello. You can talk to me in complete sentences about claim status, time entry, and more. So, how can I help you today?']
            }
          }]
        });

        const result = TranscriptSanitizationService.sanitizeMessage(jsonMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Hello. You can talk to me in complete sentences about claim status, time entry, and more. So, how can I help you today?');
      });

      it('should extract text from JSON bot message with direct say.text', () => {
        const jsonMessage = JSON.stringify({
          say: {
            text: 'Welcome to our service!'
          }
        });

        const result = TranscriptSanitizationService.sanitizeMessage(jsonMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Welcome to our service!');
      });

      it('should handle JSON with multiple text elements in array', () => {
        const jsonMessage = JSON.stringify({
          say: {
            text: ['Hello.', 'How can I help you?']
          }
        });

        const result = TranscriptSanitizationService.sanitizeMessage(jsonMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Hello. How can I help you?');
      });

      it('should not sanitize non-JSON bot messages', () => {
        const plainMessage = 'This is a regular bot message';

        const result = TranscriptSanitizationService.sanitizeMessage(plainMessage, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe('This is a regular bot message');
      });

      it('should not sanitize user messages even if they look like JSON', () => {
        const jsonMessage = JSON.stringify({ say: { text: 'Test' } });

        const result = TranscriptSanitizationService.sanitizeMessage(jsonMessage, 'user');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(jsonMessage);
      });

      it('should handle malformed JSON gracefully', () => {
        const malformedJson = '{"say": {"text": "Hello"'; // Missing closing braces

        const result = TranscriptSanitizationService.sanitizeMessage(malformedJson, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(malformedJson);
      });
    });

    describe('Pattern 2: SSML Speak Tags', () => {
      it('should remove speak and prosody tags', () => {
        const ssmlMessage = '<speak><prosody rate="-10%">I can help you with that.First,let\'s look up your account.</prosody></speak>';

        const result = TranscriptSanitizationService.sanitizeMessage(ssmlMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('I can help you with that.First,let\'s look up your account.');
      });

      it('should handle nested SSML tags', () => {
        const ssmlMessage = '<speak>Welcome! <prosody rate="slow">Please <emphasis>speak clearly</emphasis>.</prosody></speak>';

        const result = TranscriptSanitizationService.sanitizeMessage(ssmlMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Welcome! Please speak clearly.');
      });

      it('should handle break tags', () => {
        const ssmlMessage = '<speak>Hello<break/>How are you?</speak>';

        const result = TranscriptSanitizationService.sanitizeMessage(ssmlMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Hello How are you?');
      });

      it('should handle say-as tags', () => {
        const ssmlMessage = '<speak>Your number is <say-as interpret-as="telephone">555-1234</say-as></speak>';

        const result = TranscriptSanitizationService.sanitizeMessage(ssmlMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Your number is 555-1234');
      });

      it('should clean up extra whitespace after tag removal', () => {
        const ssmlMessage = '<speak>  Hello   <prosody>  world  </prosody>  </speak>';

        const result = TranscriptSanitizationService.sanitizeMessage(ssmlMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Hello world');
      });

      it('should sanitize SSML in user messages too', () => {
        const ssmlMessage = '<speak>User said this</speak>';

        const result = TranscriptSanitizationService.sanitizeMessage(ssmlMessage, 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('User said this');
      });
    });

    describe('Pattern 3: Welcome Task Filtering', () => {
      it('should filter out "Welcome Task" user messages', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('Welcome Task', 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe(null);
        expect(result.reason).toBe('Filtered system message');
      });

      it('should filter out "welcome task" (lowercase)', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('welcome task', 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe(null);
      });

      it('should filter out "WELCOME TASK" (uppercase)', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('WELCOME TASK', 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe(null);
      });

      it('should filter out "Welcome Task" with extra whitespace', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('  Welcome Task  ', 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe(null);
      });

      it('should NOT filter "Welcome Task" in bot messages', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('Welcome Task', 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe('Welcome Task');
      });

      it('should NOT filter messages containing but not exactly "Welcome Task"', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('The Welcome Task is starting', 'user');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe('The Welcome Task is starting');
      });
    });

    describe('Pattern 4: Hangup Command Filtering', () => {
      it('should filter out hangup command JSON messages', () => {
        const hangupMessage = JSON.stringify({
          type: 'command',
          command: 'redirect',
          queueCommand: true,
          data: [
            { verb: 'pause', length: 0.2 },
            { verb: 'hangup', headers: {} }
          ]
        });

        const result = TranscriptSanitizationService.sanitizeMessage(hangupMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe(null);
        expect(result.reason).toBe('Filtered system message');
      });

      it('should filter out hangup command with different length values', () => {
        const hangupMessage = JSON.stringify({
          type: 'command',
          command: 'redirect',
          queueCommand: false,
          data: [
            { verb: 'pause', length: 1.5 },
            { verb: 'hangup', headers: {} }
          ]
        });

        const result = TranscriptSanitizationService.sanitizeMessage(hangupMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe(null);
      });

      it('should filter out hangup command with minimal structure', () => {
        const hangupMessage = JSON.stringify({
          type: 'command',
          command: 'redirect',
          data: [{ verb: 'hangup' }]
        });

        const result = TranscriptSanitizationService.sanitizeMessage(hangupMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe(null);
      });

      it('should NOT filter hangup commands in user messages', () => {
        const hangupMessage = JSON.stringify({
          type: 'command',
          command: 'redirect',
          data: [{ verb: 'hangup', headers: {} }]
        });

        const result = TranscriptSanitizationService.sanitizeMessage(hangupMessage, 'user');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(hangupMessage);
      });

      it('should NOT filter JSON without hangup command', () => {
        const nonHangupMessage = JSON.stringify({
          type: 'command',
          command: 'redirect',
          data: [
            { verb: 'pause', length: 0.2 },
            { verb: 'play', url: 'https://example.com/audio.wav' }
          ]
        });

        const result = TranscriptSanitizationService.sanitizeMessage(nonHangupMessage, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(nonHangupMessage);
      });

      it('should NOT filter non-command JSON messages', () => {
        const nonCommandMessage = JSON.stringify({
          type: 'response',
          data: [{ verb: 'hangup', headers: {} }]
        });

        const result = TranscriptSanitizationService.sanitizeMessage(nonCommandMessage, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(nonCommandMessage);
      });

      it('should NOT filter command JSON with different command type', () => {
        const differentCommandMessage = JSON.stringify({
          type: 'command',
          command: 'transfer',
          data: [{ verb: 'hangup', headers: {} }]
        });

        const result = TranscriptSanitizationService.sanitizeMessage(differentCommandMessage, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(differentCommandMessage);
      });

      it('should handle malformed JSON gracefully', () => {
        const malformedJson = '{"type":"command","command":"redirect","data":[{"verb":"hangup"}'; // Missing closing braces

        const result = TranscriptSanitizationService.sanitizeMessage(malformedJson, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(malformedJson);
      });

      it('should handle JSON with non-array data', () => {
        const nonArrayData = JSON.stringify({
          type: 'command',
          command: 'redirect',
          data: { verb: 'hangup', headers: {} }
        });

        const result = TranscriptSanitizationService.sanitizeMessage(nonArrayData, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(nonArrayData);
      });
    });

    describe('Pattern 5: HTML Entity Decoding', () => {
      it('should decode common HTML entities', () => {
        const message = 'Lastly, what&apos;s the reason for your absence? You can say &quot;treatment or appointment&quot;; &quot;episode of incapacity&quot;; or, &quot;something else&quot;.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Lastly, what\'s the reason for your absence? You can say "treatment or appointment"; "episode of incapacity"; or, "something else".');
      });

      it('should decode quote entities (&quot;)', () => {
        const message = 'Please say &quot;yes&quot; or &quot;no&quot;.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Please say "yes" or "no".');
      });

      it('should decode apostrophe entities (&apos;)', () => {
        const message = 'Here&apos;s what&apos;s available today.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Here\'s what\'s available today.');
      });

      it('should decode ampersand entities (&amp;)', () => {
        const message = 'Terms &amp; Conditions apply here.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Terms & Conditions apply here.');
      });

      it('should decode less than and greater than entities', () => {
        const message = 'If value &lt; 100 &amp; &gt; 50, then proceed.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('If value < 100 & > 50, then proceed.');
      });

      it('should decode numeric entities (decimal)', () => {
        const message = 'Copyright &#169; 2025 Company Name.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Copyright © 2025 Company Name.');
      });

      it('should decode numeric entities (hexadecimal)', () => {
        const message = 'Price: &#x24;99.99 (&#x41;&#x42;&#x43;)';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Price: $99.99 (ABC)');
      });

      it('should decode multiple different entities in one message', () => {
        const message = '&quot;Hello&quot; &amp; &quot;goodbye&quot; &#8211; that&apos;s all!';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('"Hello" & "goodbye" – that\'s all!');
      });

      it('should decode smart quotes and dashes', () => {
        const message = '&ldquo;Smart quotes&rdquo; &mdash; they&rsquo;re different from &quot;regular quotes&quot;.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('\u201CSmart quotes\u201D — they\u2019re different from "regular quotes".');
      });

      it('should handle non-breaking spaces and ellipsis', () => {
        const message = 'Please&nbsp;wait&hellip;&nbsp;Loading&nbsp;content.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Please wait… Loading content.');
      });

      it('should NOT sanitize messages without HTML entities', () => {
        const message = 'This is a regular message with normal punctuation.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe('This is a regular message with normal punctuation.');
      });

      it('should handle malformed entities gracefully', () => {
        const message = 'This has &incomplete and &; malformed entities.';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe('This has &incomplete and &; malformed entities.');
      });

      it('should apply to both user and bot messages', () => {
        const userResult = TranscriptSanitizationService.sanitizeMessage('User said &quot;hello&quot;', 'user');
        const botResult = TranscriptSanitizationService.sanitizeMessage('Bot replied &quot;hi&quot;', 'bot');
        
        expect(userResult.sanitized).toBe(true);
        expect(userResult.text).toBe('User said "hello"');
        expect(botResult.sanitized).toBe(true);
        expect(botResult.text).toBe('Bot replied "hi"');
      });
    });

    describe('Pattern 6: MAX_NO_INPUT Replacement', () => {
      it('should replace MAX_NO_INPUT with <User is silent>', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('MAX_NO_INPUT', 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('<User is silent>');
        expect(result.reason).toBe('Text extracted and cleaned');
      });

      it('should replace max_no_input (lowercase) with <User is silent>', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('max_no_input', 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('<User is silent>');
      });

      it('should replace Max_No_Input (mixed case) with <User is silent>', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('Max_No_Input', 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('<User is silent>');
      });

      it('should replace MAX_NO_INPUT with extra whitespace', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('  MAX_NO_INPUT  ', 'user');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('<User is silent>');
      });

      it('should NOT replace MAX_NO_INPUT in bot messages', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('MAX_NO_INPUT', 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe('MAX_NO_INPUT');
      });

      it('should NOT replace messages containing but not exactly MAX_NO_INPUT', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('The MAX_NO_INPUT occurred', 'user');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe('The MAX_NO_INPUT occurred');
      });

      it('should NOT replace partial matches', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('MAX_NO_INPUT_TIMEOUT', 'user');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe('MAX_NO_INPUT_TIMEOUT');
      });

      it('should handle MAX_NO_INPUT with different separators', () => {
        // Should NOT match variations
        const variations = ['MAX-NO-INPUT', 'MAX NO INPUT', 'MAXNOINPUT', 'MAX_NO_IN_PUT'];
        
        for (const variation of variations) {
          const result = TranscriptSanitizationService.sanitizeMessage(variation, 'user');
          expect(result.sanitized).toBe(false);
          expect(result.text).toBe(variation);
        }
      });

      it('should apply to user messages only', () => {
        const userResult = TranscriptSanitizationService.sanitizeMessage('MAX_NO_INPUT', 'user');
        const botResult = TranscriptSanitizationService.sanitizeMessage('MAX_NO_INPUT', 'bot');
        
        expect(userResult.sanitized).toBe(true);
        expect(userResult.text).toBe('<User is silent>');
        expect(botResult.sanitized).toBe(false);
        expect(botResult.text).toBe('MAX_NO_INPUT');
      });
    });

    describe('Combined Patterns', () => {
      it('should handle JSON with SSML content', () => {
        const combinedMessage = JSON.stringify({
          say: {
            text: '<speak><prosody rate="fast">Hello world!</prosody></speak>'
          }
        });

        const result = TranscriptSanitizationService.sanitizeMessage(combinedMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Hello world!');
      });

      it('should handle complex real-world JSON message', () => {
        const complexMessage = JSON.stringify({
          type: 'command',
          command: 'redirect',
          data: [{
            verb: 'config',
            synthesizer: { vendor: 'microsoft' }
          }, {
            verb: 'gather',
            say: {
              text: ['<speak>Welcome to <emphasis>our service</emphasis>. <prosody rate="-10%">How can I help?</prosody></speak>']
            }
          }]
        });

        const result = TranscriptSanitizationService.sanitizeMessage(complexMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('Welcome to our service. How can I help?');
      });

      it('should handle JSON with SSML and HTML entities', () => {
        const combinedMessage = JSON.stringify({
          say: {
            text: '<speak>&quot;Hello&quot; &amp; <prosody rate="fast">welcome to our service!</prosody></speak>'
          }
        });

        const result = TranscriptSanitizationService.sanitizeMessage(combinedMessage, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('"Hello" & welcome to our service!');
      });

      it('should handle SSML with HTML entities', () => {
        const message = '<speak>&quot;Please say &apos;yes&apos; or &apos;no&apos;&quot;</speak>';

        const result = TranscriptSanitizationService.sanitizeMessage(message, 'bot');
        
        expect(result.sanitized).toBe(true);
        expect(result.text).toBe('"Please say \'yes\' or \'no\'"');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('', 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(null);
        expect(result.reason).toBe('Empty or invalid text');
      });

      it('should handle null/undefined gracefully', () => {
        const result = TranscriptSanitizationService.sanitizeMessage(null as any, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(null);
      });

      it('should handle non-string input', () => {
        const result = TranscriptSanitizationService.sanitizeMessage(123 as any, 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe(null);
      });

      it('should trim whitespace from final output', () => {
        const result = TranscriptSanitizationService.sanitizeMessage('  Hello World  ', 'bot');
        
        expect(result.sanitized).toBe(false);
        expect(result.text).toBe('Hello World');
      });
    });
  });

  describe('sanitizeMessages (batch processing)', () => {
    it('should sanitize multiple messages', () => {
      const messages = [
        { message: 'Welcome Task', message_type: 'user' as const },
        { message: '<speak>Hello</speak>', message_type: 'bot' as const },
        { message: 'Regular message', message_type: 'user' as const },
        { message: JSON.stringify({ say: { text: 'JSON message' } }), message_type: 'bot' as const }
      ];

      const results = TranscriptSanitizationService.sanitizeMessages(messages);
      
      expect(results).toHaveLength(3); // Welcome Task filtered out
      expect(results[0]).toEqual({
        message: 'Hello',
        message_type: 'bot',
        sanitized: true
      });
      expect(results[1]).toEqual({
        message: 'Regular message',
        message_type: 'user',
        sanitized: false
      });
      expect(results[2]).toEqual({
        message: 'JSON message',
        message_type: 'bot',
        sanitized: true
      });
    });

    it('should handle empty array', () => {
      const results = TranscriptSanitizationService.sanitizeMessages([]);
      expect(results).toEqual([]);
    });

    it('should filter out all messages if all should be filtered', () => {
      const messages = [
        { message: 'Welcome Task', message_type: 'user' as const },
        { message: 'welcome task', message_type: 'user' as const }
      ];

      const results = TranscriptSanitizationService.sanitizeMessages(messages);
      expect(results).toEqual([]);
    });

    it('should handle hangup commands in batch processing', () => {
      const hangupMessage = JSON.stringify({
        type: 'command',
        command: 'redirect',
        data: [{ verb: 'hangup', headers: {} }]
      });

      const messages = [
        { message: 'Welcome Task', message_type: 'user' as const },
        { message: hangupMessage, message_type: 'bot' as const },
        { message: 'Regular message', message_type: 'user' as const },
        { message: '<speak>Hello</speak>', message_type: 'bot' as const }
      ];

      const results = TranscriptSanitizationService.sanitizeMessages(messages);
      
      expect(results).toHaveLength(2); // Welcome Task and hangup filtered out
      expect(results[0]).toEqual({
        message: 'Regular message',
        message_type: 'user',
        sanitized: false
      });
      expect(results[1]).toEqual({
        message: 'Hello',
        message_type: 'bot',
        sanitized: true
      });
    });

    it('should handle HTML entities in batch processing', () => {
      const messages = [
        { message: 'You can say &quot;yes&quot; or &quot;no&quot;.', message_type: 'bot' as const },
        { message: 'I&apos;ll take &quot;yes&quot; please.', message_type: 'user' as const },
        { message: '<speak>&quot;Welcome&quot;</speak>', message_type: 'bot' as const }
      ];

      const results = TranscriptSanitizationService.sanitizeMessages(messages);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        message: 'You can say "yes" or "no".',
        message_type: 'bot',
        sanitized: true
      });
      expect(results[1]).toEqual({
        message: 'I\'ll take "yes" please.',
        message_type: 'user',
        sanitized: true
      });
      expect(results[2]).toEqual({
        message: '"Welcome"',
        message_type: 'bot',
        sanitized: true
      });
    });

    it('should handle MAX_NO_INPUT replacement in batch processing', () => {
      const messages = [
        { message: 'MAX_NO_INPUT', message_type: 'user' as const },
        { message: 'Hello there!', message_type: 'bot' as const },
        { message: 'max_no_input', message_type: 'user' as const },
        { message: 'MAX_NO_INPUT', message_type: 'bot' as const } // Should not be replaced
      ];

      const results = TranscriptSanitizationService.sanitizeMessages(messages);
      
      expect(results).toHaveLength(4);
      expect(results[0]).toEqual({
        message: '<User is silent>',
        message_type: 'user',
        sanitized: true
      });
      expect(results[1]).toEqual({
        message: 'Hello there!',
        message_type: 'bot',
        sanitized: false
      });
      expect(results[2]).toEqual({
        message: '<User is silent>',
        message_type: 'user',
        sanitized: true
      });
      expect(results[3]).toEqual({
        message: 'MAX_NO_INPUT',
        message_type: 'bot',
        sanitized: false
      });
    });
  });
});