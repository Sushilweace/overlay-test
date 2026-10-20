/**
 * AudioRecorder: Captures mic / system audio, resamples to 16kHz mono linear PCM,
 * and passes chunks to the callback.
 */
class AudioRecorder {
  constructor(onAudioChunk) {
    this.onAudioChunk = onAudioChunk;
    this.audioContext = null;
    this.mediaStream = null;
    this.ownedStreams = [];
    this.processor = null;
    this.source = null;
  }

  async start(sourceType = 'mic') {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });

    try {
      await this.capture(sourceType);
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  async capture(sourceType) {
    if (sourceType === 'system' || sourceType === 'mixed') {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      this.ownedStreams.push(displayStream);
      displayStream.getVideoTracks().forEach((track) => track.stop());

      if (displayStream.getAudioTracks().length === 0) {
        throw new Error('System audio was not shared. Start again and allow the meeting call audio.');
      }

      if (sourceType === 'system') {
        this.mediaStream = displayStream;
      } else {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.ownedStreams.push(micStream);
        const destination = this.audioContext.createMediaStreamDestination();
        this.audioContext.createMediaStreamSource(displayStream).connect(destination);
        this.audioContext.createMediaStreamSource(micStream).connect(destination);
        this.mediaStream = destination.stream;
      }
    } else {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      this.ownedStreams.push(this.mediaStream);
    }

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16Buffer = this.floatTo16BitPCM(inputData);
      if (this.onAudioChunk) {
        this.onAudioChunk(pcm16Buffer);
      }
    };

    const silent = this.audioContext.createGain();
    silent.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(silent);
    silent.connect(this.audioContext.destination);
  }

  floatTo16BitPCM(input) {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    this.ownedStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    this.ownedStreams = [];
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
