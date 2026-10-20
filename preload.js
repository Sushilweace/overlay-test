const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script: The single secure bridge between main process and renderer.
 * Complies with contextIsolation: true and nodeIntegration: false.
 */
contextBridge.exposeInMainWorld('meetingAssistant', {
  // Commands to main
  startListening: () => ipcRenderer.invoke('start-listening'),
  stopListening: () => ipcRenderer.invoke('stop-listening'),
  sendAudioChunk: (arrayBuffer) => ipcRenderer.send('audio-chunk', arrayBuffer),
  requestAiSuggestion: () => ipcRenderer.invoke('request-ai-suggestion'),
  requestSummary: () => ipcRenderer.invoke('request-summary'),
  toggleProtection: () => ipcRenderer.invoke('toggle-protection'),
  getProtectionState: () => ipcRenderer.invoke('get-protection-state'),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  clearSession: () => ipcRenderer.send('clear-session'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeApp: () => ipcRenderer.send('close-app'),
  getAiSettings: () => ipcRenderer.invoke('get-ai-settings'),
  saveGeminiKey: (key) => ipcRenderer.invoke('save-gemini-key', key),
  setLiveAnswers: (enabled) => ipcRenderer.invoke('set-live-answers', enabled),

  // Event listeners from main process
  onTranscript: (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on('transcript-data', listener);
    return () => ipcRenderer.removeListener('transcript-data', listener);
  },
  onStatusChange: (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on('status-update', listener);
    return () => ipcRenderer.removeListener('status-update', listener);
  },
  onAiStart: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('ai-suggestion-start', listener);
    return () => ipcRenderer.removeListener('ai-suggestion-start', listener);
  },
  onAiChunk: (cb) => {
    const listener = (_, chunk) => cb(chunk);
    ipcRenderer.on('ai-suggestion-chunk', listener);
    return () => ipcRenderer.removeListener('ai-suggestion-chunk', listener);
  },
  onAiComplete: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('ai-suggestion-complete', listener);
    return () => ipcRenderer.removeListener('ai-suggestion-complete', listener);
  },
  onSummaryChunk: (cb) => {
    const listener = (_, chunk) => cb(chunk);
    ipcRenderer.on('summary-chunk', listener);
    return () => ipcRenderer.removeListener('summary-chunk', listener);
  },
  onSummaryComplete: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('summary-complete', listener);
    return () => ipcRenderer.removeListener('summary-complete', listener);
  },
  onError: (cb) => {
    const listener = (_, msg) => cb(msg);
    ipcRenderer.on('app-error', listener);
    return () => ipcRenderer.removeListener('app-error', listener);
  },
  onAiSettings: (cb) => {
    const listener = (_, settings) => cb(settings);
    ipcRenderer.on('ai-settings-changed', listener);
    return () => ipcRenderer.removeListener('ai-settings-changed', listener);
  },
  onProtectionChange: (cb) => {
    const listener = (_, isProtected) => cb(isProtected);
    ipcRenderer.on('protection-changed', listener);
    return () => ipcRenderer.removeListener('protection-changed', listener);
  }
});
