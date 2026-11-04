/**
 * Low-latency OpenRouter streaming for live meeting answers & suggestions.
 * Compatible with OpenAI chat completions format.
 */
const {
  suggestionSystemPrompt,
  suggestionUserContent,
  questionUserContent,
  summarySystemPrompt,
  summaryUserContent
} = require('./answer-profile');

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

const PRESET_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Recommended, Fast & Stable)' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (High Quality & Fast)' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat (Low Cost)' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron Ultra 550B (100% Free)' },
  { id: 'openrouter/free', name: 'OpenRouter Free Auto-Router' }
];

class OpenRouterService {
  static getPresetModels() {
    return PRESET_MODELS;
  }
  constructor(apiKey, modelName) {
    this.apiKey = (apiKey || '').trim();
    this.model = (modelName || '').trim() || DEFAULT_MODEL;
    this.controller = null;
  }

  setApiKey(apiKey) {
    this.apiKey = (apiKey || '').trim();
  }

  setModel(modelName) {
    this.model = (modelName || '').trim() || DEFAULT_MODEL;
  }

  hasKey() {
    return this.apiKey.length > 0;
  }

  hint() {
    if (!this.hasKey()) return '';
    return this.apiKey.slice(-4);
  }

  cancel() {
    if (!this.controller) return;
    this.controller.abort();
    this.controller = null;
  }

  streamSuggestion(recentTranscript, onChunk, onComplete, onError, systemPrompt) {
    return this.streamMessages({
      systemPrompt: systemPrompt || suggestionSystemPrompt(),
      userContent: suggestionUserContent(recentTranscript),
      maxTokens: 140,
      onChunk,
      onComplete,
      onError
    });
  }

  streamQuestion(question, recentTranscript, onChunk, onComplete, onError, systemPrompt, image) {
    let content;
    const baseText = questionUserContent(question, recentTranscript, Boolean(image));
    if (image && image.data) {
      content = [
        { type: 'text', text: baseText },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
      ];
    } else {
      content = baseText;
    }

    return this.streamMessages({
      systemPrompt: systemPrompt || suggestionSystemPrompt(),
      userContent: content,
      maxTokens: 160,
      onChunk,
      onComplete,
      onError
    });
  }

  streamSummary(fullTranscript, onChunk, onComplete, onError, systemPrompt) {
    return this.streamMessages({
      systemPrompt: systemPrompt || summarySystemPrompt(),
      userContent: summaryUserContent(fullTranscript),
      maxTokens: 350,
      onChunk,
      onComplete,
      onError
    });
  }

  isFreeModel() {
    return this.model === 'openrouter/free' || this.model.endsWith(':free');
  }

  resolveMaxTokens(requested) {
    if (this.isFreeModel()) {
      return Math.max(requested || 150, 600);
    }
    return requested || 150;
  }

  async streamMessages({ systemPrompt, userContent, maxTokens, onChunk, onComplete, onError }) {
    if (!this.hasKey()) {
      if (onError) onError(new Error('OpenRouter API key is not configured.'));
      return;
    }

    this.cancel();
    const controller = new AbortController();
    this.controller = controller;

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userContent });

    const effectiveMaxTokens = this.resolveMaxTokens(maxTokens);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/sushil-kumar/overlay-assistant',
          'X-Title': 'Overlay Meeting Assistant'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          max_tokens: effectiveMaxTokens,
          temperature: 0.3,
          include_reasoning: false
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 402) {
          throw new Error('OpenRouter credit limit reached. Switch to "OpenRouter Free Auto-Router" in settings or top up at openrouter.ai/credits.');
        }
        throw new Error(`OpenRouter HTTP ${response.status}: ${errorText.slice(0, 160)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let hasSentContent = false;
      let reasoningBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // Retain incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.replace(/^data:\s*/, '');
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              hasSentContent = true;
              if (onChunk) onChunk(delta.content);
            } else if (!hasSentContent && delta?.reasoning) {
              reasoningBuffer += delta.reasoning;
            }
          } catch (_) {
            // Skip unparseable chunks
          }
        }
      }

      if (!hasSentContent && reasoningBuffer.trim() && onChunk) {
        onChunk(reasoningBuffer.trim());
      }

      if (this.controller === controller) this.controller = null;
      if (onComplete) onComplete();
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (this.controller === controller) this.controller = null;
      if (onError) onError(err);
    }
  }
}

module.exports = OpenRouterService;
