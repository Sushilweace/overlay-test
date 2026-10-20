/**
 * Low-latency Gemini streaming for live meeting answers.
 * Thinking is disabled so the first token is not held back.
 */
const {
  suggestionSystemPrompt,
  suggestionUserContent,
  summarySystemPrompt,
  summaryUserContent
} = require('./answer-profile');

const MODEL_ALIASES = {
  flash: 'gemini-3.8-flash',
  'gemini flash': 'gemini-3.8-flash',
  'gemini-flash': 'gemini-3.8-flash',
  '3.8-flash': 'gemini-3.8-flash',
  lite: 'gemini-3.5-flash-lite',
  'flash-lite': 'gemini-3.5-flash-lite',
  pro: 'gemini-3.1-pro-preview'
};

class GeminiService {
  constructor(apiKey, modelName) {
    this.apiKey = (apiKey || '').trim();
    this.model = GeminiService.resolveModel(modelName);
    this.controller = null;
  }

  static resolveModel(modelName) {
    const raw = (modelName || '').trim();
    if (!raw) return 'gemini-3.8-flash';
    return MODEL_ALIASES[raw.toLowerCase()] || raw;
  }

  setApiKey(apiKey) {
    this.apiKey = (apiKey || '').trim();
  }

  setModel(modelName) {
    this.model = GeminiService.resolveModel(modelName);
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
    return this.streamText({
      systemPrompt: systemPrompt || suggestionSystemPrompt(),
      userContent: suggestionUserContent(recentTranscript),
      maxOutputTokens: 320,
      onChunk,
      onComplete,
      onError
    });
  }

  streamSummary(fullTranscript, onChunk, onComplete, onError, systemPrompt) {
    return this.streamText({
      systemPrompt: systemPrompt || summarySystemPrompt(),
      userContent: summaryUserContent(fullTranscript),
      maxOutputTokens: 700,
      onChunk,
      onComplete,
      onError
    });
  }

  async streamText({ systemPrompt, userContent, maxOutputTokens, onChunk, onComplete, onError }) {
    const controller = new AbortController();
    this.cancel();
    this.controller = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20000);

    try {
      if (!this.hasKey()) {
        throw new Error('Add a Gemini API key with the gear icon.');
      }

      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: this.generationConfig(maxOutputTokens)
      };

      await this.generateStream(body, controller.signal, (text) => {
        if (this.controller !== controller) return;
        onChunk(text);
      });

      if (this.controller === controller) onComplete();
    } catch (err) {
      if (err.name === 'AbortError') {
        if (timedOut && this.controller === controller && onError) {
          onError(new Error('Gemini took too long. Try again.'));
        }
        return;
      }
      if (this.controller === controller && onError) onError(err);
    } finally {
      clearTimeout(timer);
      if (this.controller === controller) this.controller = null;
    }
  }

  generationConfig(maxOutputTokens) {
    const config = { maxOutputTokens };
    if (this.model.startsWith('gemini-3')) {
      config.thinkingConfig = { thinkingLevel: 'low' };
      return config;
    }
    config.temperature = 0.7;
    config.thinkingConfig = { thinkingBudget: 0 };
    return config;
  }

  async generateStream(body, signal, onText) {
    const response = await this.request(body, signal);
    if (!response.ok && body.generationConfig.thinkingConfig) {
      const errText = await response.text();
      if (/thinking/i.test(errText)) {
        const retryBody = {
          ...body,
          generationConfig: { temperature: body.generationConfig.temperature, maxOutputTokens: body.generationConfig.maxOutputTokens }
        };
        const retry = await this.request(retryBody, signal);
        if (!retry.ok) throw new Error(await this.readError(retry));
        await this.readBody(retry, onText);
        return;
      }
      throw new Error(this.parseErrorText(errText));
    }

    if (!response.ok) throw new Error(await this.readError(response));
    await this.readBody(response, onText);
  }

  request(body, signal) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`;
    return fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify(body)
    });
  }

  async readError(response) {
    return this.parseErrorText(await response.text());
  }

  parseErrorText(raw) {
    try {
      const json = JSON.parse(raw);
      if (json.error?.message) return `Gemini: ${json.error.message}`;
    } catch (_) {
      // Response was not JSON.
    }
    const compact = (raw || '').replace(/\s+/g, ' ').trim();
    return compact ? `Gemini: ${compact.slice(0, 240)}` : 'Gemini request failed.';
  }

  async readBody(response, onText) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const json = await response.json();
      const events = Array.isArray(json) ? json : [json];
      events.forEach((event) => this.emitText(event, onText));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) this.consumeSseLine(line, onText);
    }

    if (buffer.trim()) this.consumeSseLine(buffer, onText);
  }

  consumeSseLine(line, onText) {
    const trimmed = line.replace(/\r/g, '').trim();
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    this.emitText(JSON.parse(payload), onText);
  }

  emitText(event, onText) {
    if (event.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request (${event.promptFeedback.blockReason}).`);
    }
    const parts = event.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.thought || !part.text) continue;
      onText(part.text);
    }
  }
}

module.exports = GeminiService;
