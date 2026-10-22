const Anthropic = require('@anthropic-ai/sdk');
const {
  suggestionSystemPrompt,
  suggestionUserContent,
  questionUserContent,
  summarySystemPrompt,
  summaryUserContent
} = require('./answer-profile');

/**
 * Handles interactions with Anthropic Claude API for live suggestions and summaries.
 */
class AiService {
  constructor(apiKey, modelName) {
    this.apiKey = apiKey;
    this.modelName = modelName || 'claude-3-5-haiku-20241022';
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  ensureClient() {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set in .env');
      }
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /**
   * Generates short, real-time talking points or answers based on recent transcript.
   * Treats transcript strictly as data to prevent prompt injection.
   */
  async streamSuggestion(recentTranscript, onChunk, onComplete, onError, systemPrompt) {
    try {
      const client = this.ensureClient();
      systemPrompt = systemPrompt || suggestionSystemPrompt();
      const userContent = suggestionUserContent(recentTranscript);

      const stream = await client.messages.stream({
        model: this.modelName,
        max_tokens: 350,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }]
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          onChunk(event.delta.text);
        }
      }

      onComplete();
    } catch (err) {
      if (onError) onError(err);
    }
  }

  async streamQuestion(question, recentTranscript, onChunk, onComplete, onError, systemPrompt, image) {
    if (image) {
      if (onError) onError(new Error('Pasted images need a Gemini key.'));
      return;
    }
    try {
      const client = this.ensureClient();
      systemPrompt = systemPrompt || suggestionSystemPrompt();
      const userContent = questionUserContent(question, recentTranscript);

      const stream = await client.messages.stream({
        model: this.modelName,
        max_tokens: 350,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }]
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          onChunk(event.delta.text);
        }
      }

      onComplete();
    } catch (err) {
      if (onError) onError(err);
    }
  }

  /**
   * Generates a structured end-of-meeting summary (Decisions, Action Items, Summary).
   */
  async streamSummary(fullTranscript, onChunk, onComplete, onError, systemPrompt) {
    try {
      const client = this.ensureClient();
      systemPrompt = systemPrompt || summarySystemPrompt();
      const userContent = summaryUserContent(fullTranscript);

      const stream = await client.messages.stream({
        model: this.modelName,
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }]
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          onChunk(event.delta.text);
        }
      }

      onComplete();
    } catch (err) {
      if (onError) onError(err);
    }
  }
}

module.exports = AiService;
