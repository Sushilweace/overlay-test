const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

/**
 * Manages live WebSocket streaming to Deepgram for real-time speech-to-text.
 */
class DeepgramService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.connection = null;
    this.isOpen = false;
  }

  start({ onTranscript, onError, onClose }) {
    if (!this.apiKey) {
      throw new Error('DEEPGRAM_API_KEY is not set in .env');
    }

    const deepgram = createClient(this.apiKey);

    this.connection = deepgram.listen.live({
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      interim_results: true,
      punctuate: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1
    });

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      this.isOpen = true;
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const alternative = data.channel?.alternatives?.[0];
      const text = alternative?.transcript || '';
      if (!text.trim()) return;

      onTranscript({
        text,
        isFinal: Boolean(data.is_final),
        speechFinal: Boolean(data.speech_final)
      });
    });

    this.connection.on(LiveTranscriptionEvents.Error, (err) => {
      this.isOpen = false;
      if (onError) onError(err);
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      this.isOpen = false;
      if (onClose) onClose();
    });
  }

  sendAudio(chunkBuffer) {
    if (!this.isOpen || !this.connection) return;
    this.connection.send(chunkBuffer);
  }

  stop() {
    if (!this.connection) return;
    this.isOpen = false;
    try {
      this.connection.requestClose();
    } catch (_) {
      // Ignore if socket already closed
    }
    this.connection = null;
  }
}

module.exports = DeepgramService;
