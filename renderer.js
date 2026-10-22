// DOM Elements
const listeningBadge = document.getElementById('listeningBadge');
const contextBadge = document.getElementById('contextBadge');
const contextWarning = document.getElementById('contextWarning');
const protectionBadge = document.getElementById('protectionBadge');
const settingsBtn = document.getElementById('settingsBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');
const settingsPanel = document.getElementById('settingsPanel');
const geminiKeyInput = document.getElementById('geminiKeyInput');
const toggleGeminiKeyBtn = document.getElementById('toggleGeminiKeyBtn');
const saveGeminiKeyBtn = document.getElementById('saveGeminiKeyBtn');
const geminiKeyStatus = document.getElementById('geminiKeyStatus');
const settingsHint = document.getElementById('settingsHint');
const liveAnswersToggle = document.getElementById('liveAnswersToggle');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewImg = document.getElementById('imagePreviewImg');
const clearImageBtn = document.getElementById('clearImageBtn');
const consentBanner = document.getElementById('consentBanner');
const acceptConsentBtn = document.getElementById('acceptConsentBtn');
const errorBanner = document.getElementById('errorBanner');
const audioSourceSelect = document.getElementById('audioSourceSelect');
const toggleListeningBtn = document.getElementById('toggleListeningBtn');
const aiSuggestBtn = document.getElementById('aiSuggestBtn');
const summarizeBtn = document.getElementById('summarizeBtn');
const clearBtn = document.getElementById('clearBtn');
const transcriptBox = document.getElementById('transcriptBox');
const transcriptHistory = document.getElementById('transcriptHistory');
const interimTranscript = document.getElementById('interimTranscript');
const wordCountEl = document.getElementById('wordCount');
const aiBox = document.getElementById('aiBox');
const copyAiBtn = document.getElementById('copyAiBtn');
const questionForm = document.getElementById('questionForm');
const questionInput = document.getElementById('questionInput');
const askBtn = document.getElementById('askBtn');
const footerBar = document.querySelector('.bottom-bar');
const footerToggleBtn = document.getElementById('footerToggleBtn');

let isCurrentlyListening = false;
let totalWordCount = 0;
let liveAnswersEnabled = true;
let activeAnswerEl = null;
let pendingImage = null;
const emptyAnswerText = 'Type a question below, or finish a sentence while listening.';

// Audio Recorder Instance
const recorder = new AudioRecorder((chunk) => {
  window.meetingAssistant.sendAudioChunk(chunk);
});

// Consent notice persistence
if (localStorage.getItem('meetingConsentAcknowledged') === 'true') {
  consentBanner.classList.add('hidden');
}

acceptConsentBtn.addEventListener('click', () => {
  localStorage.setItem('meetingConsentAcknowledged', 'true');
  consentBanner.classList.add('hidden');
});

// Error Display Helper
function showError(message) {
  errorBanner.textContent = message;
  errorBanner.style.display = 'block';
  setTimeout(() => {
    errorBanner.style.display = 'none';
  }, 6000);
}

// Toggle Listening
async function toggleListening() {
  if (isCurrentlyListening) {
    recorder.stop();
    await window.meetingAssistant.stopListening();
  } else {
    try {
      const source = audioSourceSelect.value;
      const res = await window.meetingAssistant.startListening();
      if (!res.success) {
        showError(res.error || 'Failed to start Deepgram connection');
        return;
      }
      await recorder.start(source);
    } catch (err) {
      showError(`Audio capture error: ${err.message}`);
      await window.meetingAssistant.stopListening();
    }
  }
}

toggleListeningBtn.addEventListener('click', toggleListening);

function setFooterVisible(visible) {
  footerBar.classList.toggle('hidden', !visible);
  footerToggleBtn.textContent = visible ? 'Hide footer' : 'Show footer';
  footerToggleBtn.title = visible ? 'Hide the bottom controls' : 'Show the bottom controls';
  localStorage.setItem('footerVisible', visible ? 'true' : 'false');
}

footerToggleBtn.addEventListener('click', () => {
  setFooterVisible(footerBar.classList.contains('hidden'));
});

setFooterVisible(localStorage.getItem('footerVisible') !== 'false');

// Clear Transcripts & AI Output
clearBtn.addEventListener('click', () => {
  transcriptHistory.innerHTML = '';
  interimTranscript.textContent = '';
  totalWordCount = 0;
  wordCountEl.textContent = '0 words';
  resetAnswerChat(emptyAnswerText);
  window.meetingAssistant.clearSession();
});

questionInput.addEventListener('paste', async (event) => {
  const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith('image/'));
  if (!imageItem) return;
  event.preventDefault();
  const file = imageItem.getAsFile();
  if (!file) return;
  try {
    pendingImage = await fileToImagePayload(file);
    imagePreviewImg.src = pendingImage.preview;
    imagePreview.classList.remove('hidden');
  } catch (err) {
    pendingImage = null;
    showError(err.message);
  }
});

clearImageBtn.addEventListener('click', () => {
  pendingImage = null;
  imagePreviewImg.removeAttribute('src');
  imagePreview.classList.add('hidden');
  questionInput.focus();
});

questionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  const image = pendingImage;
  if (!question && !image) return;

  questionInput.value = '';
  addChatMessage('user', 'You', question, image ? image.preview : '');
  pendingImage = null;
  imagePreviewImg.removeAttribute('src');
  imagePreview.classList.add('hidden');
  askBtn.disabled = true;
  try {
    await window.meetingAssistant.askQuestion({
      question,
      image: image ? { mimeType: image.mimeType, data: image.data } : null
    });
  } catch (err) {
    showError(err.message);
    addChatMessage('error', 'Error', err.message);
  } finally {
    askBtn.disabled = false;
    questionInput.focus();
  }
});

function fileToImagePayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        const scale = Math.min(1, 1280 / img.width, 1280 / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const preview = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ mimeType: 'image/jpeg', data: preview.split(',')[1], preview });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// AI Suggestion & Summary Actions
aiSuggestBtn.addEventListener('click', async () => {
  await window.meetingAssistant.requestAiSuggestion();
});

summarizeBtn.addEventListener('click', async () => {
  await window.meetingAssistant.requestSummary();
});

// Copy Output
copyAiBtn.addEventListener('click', () => {
  const text = chatText();
  if (!text) return;
  navigator.clipboard.writeText(text);
  copyAiBtn.textContent = '✓';
  setTimeout(() => { copyAiBtn.textContent = '📋'; }, 1500);
});

// Protection Badge Toggle
protectionBadge.addEventListener('click', async () => {
  await window.meetingAssistant.toggleProtection();
});

minimizeBtn.addEventListener('click', () => {
  window.meetingAssistant.minimizeWindow();
});

closeBtn.addEventListener('click', () => {
  window.meetingAssistant.closeApp();
});

settingsBtn.addEventListener('click', () => {
  const open = settingsPanel.classList.toggle('hidden') === false;
  settingsBtn.classList.toggle('active', open);
  if (open) geminiKeyInput.focus();
});

toggleGeminiKeyBtn.addEventListener('click', () => {
  const showing = geminiKeyInput.type === 'text';
  geminiKeyInput.type = showing ? 'password' : 'text';
  toggleGeminiKeyBtn.textContent = showing ? 'Show' : 'Hide';
});

geminiKeyInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') saveGeminiKey();
});

saveGeminiKeyBtn.addEventListener('click', saveGeminiKey);

liveAnswersToggle.addEventListener('change', async () => {
  liveAnswersEnabled = liveAnswersToggle.checked;
  localStorage.setItem('liveAnswersEnabled', liveAnswersEnabled ? 'true' : 'false');
  const settings = await window.meetingAssistant.setLiveAnswers(liveAnswersEnabled);
  applyAiSettings(settings);
});

function applyAiSettings(settings) {
  liveAnswersEnabled = settings.liveAnswers;
  liveAnswersToggle.checked = settings.liveAnswers;

  if (settings.hasGeminiKey) {
    geminiKeyStatus.textContent = `Key saved ····${settings.geminiKeyHint}`;
    geminiKeyStatus.classList.add('ok');
    geminiKeyInput.placeholder = 'Paste a new key to replace';
  } else {
    geminiKeyStatus.textContent = liveAnswersEnabled
      ? 'Save a Gemini key to start live answers.'
      : 'No Gemini key yet';
    geminiKeyStatus.classList.remove('ok');
    geminiKeyInput.placeholder = 'Paste Gemini API key';
  }

  const resumeBit = settings.resumeError
    ? settings.resumeError
    : settings.resumeLoaded
      ? `Using ${settings.resumeLabel}`
      : 'Add resume.txt, or set RESUME_PATH in .env';
  settingsHint.textContent = `Model ${settings.model} from .env. ${resumeBit}. Clear GEMINI_API_KEY in .env to remove the key, then click this window.`;
  minimizeBtn.title = settings.hideFromTaskbar ? 'Hide (Ctrl+Shift+H shows it again)' : 'Minimize';

  const language = String(settings.language || 'auto').toUpperCase();
  const mode = String(settings.mode || 'meeting').toUpperCase();
  contextBadge.textContent = `${language} · ${mode}`;
  if (settings.contextWarning) {
    contextWarning.textContent = settings.contextWarning;
    contextWarning.classList.remove('hidden');
  } else {
    contextWarning.textContent = '';
    contextWarning.classList.add('hidden');
  }

  if (aiBox.classList.contains('empty')) {
    aiBox.textContent = settings.hasGeminiKey
      ? emptyAnswerText
      : 'Add a Gemini key with the gear icon, or type a question below.';
  }

}

async function saveGeminiKey() {
  const key = geminiKeyInput.value.trim();
  if (!key) {
    showError('Paste a Gemini API key first.');
    return;
  }

  saveGeminiKeyBtn.disabled = true;
  try {
    const res = await window.meetingAssistant.saveGeminiKey(key);
    if (!res.success) {
      showError(res.error || 'Could not save the Gemini key.');
      return;
    }
    geminiKeyInput.value = '';
    applyAiSettings(res.settings);
  } catch (err) {
    showError(err.message);
  } finally {
    saveGeminiKeyBtn.disabled = false;
  }
}

// Incoming IPC Events from Main Bridge
window.meetingAssistant.onStatusChange(({ listening }) => {
  isCurrentlyListening = listening;
  if (listening) {
    listeningBadge.textContent = 'LISTENING';
    listeningBadge.classList.add('active');
    toggleListeningBtn.textContent = 'Stop Listening';
    toggleListeningBtn.classList.remove('btn-primary');
    toggleListeningBtn.classList.add('btn-danger');
  } else {
    listeningBadge.textContent = 'IDLE';
    listeningBadge.classList.remove('active');
    toggleListeningBtn.textContent = 'Start Listening';
    toggleListeningBtn.classList.remove('btn-danger');
    toggleListeningBtn.classList.add('btn-primary');
  }
});

window.meetingAssistant.onTranscript(({ text, isFinal }) => {
  if (isFinal) {
    interimTranscript.textContent = '';
    const entry = document.createElement('div');
    entry.className = 'transcript-entry';

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    entry.innerHTML = `<span class="time">[${timeStr}]</span> ${escapeHtml(text)}`;
    transcriptHistory.appendChild(entry);

    totalWordCount += text.trim().split(/\s+/).length;
    wordCountEl.textContent = `${totalWordCount} words`;
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
  } else {
    interimTranscript.textContent = text;
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
  }
});

function resetAnswerChat(message) {
  activeAnswerEl = null;
  aiBox.classList.add('empty');
  aiBox.classList.remove('pending');
  aiBox.textContent = message;
}

function chatText() {
  return [...aiBox.querySelectorAll('.chat-msg')].map((el) => el.innerText.trim()).filter(Boolean).join('\n\n');
}

function addChatMessage(kind, label, text, imageSrc) {
  if (aiBox.classList.contains('empty')) {
    aiBox.textContent = '';
    aiBox.classList.remove('empty');
  }
  const message = document.createElement('div');
  message.className = `chat-msg chat-${kind}`;
  const labelEl = document.createElement('span');
  labelEl.className = 'chat-label';
  labelEl.textContent = label;
  const body = document.createElement('div');
  body.className = 'chat-body';
  body.textContent = text || '';
  message.append(labelEl, body);
  if (imageSrc) {
    const img = document.createElement('img');
    img.className = 'chat-image';
    img.alt = 'Pasted image';
    img.src = imageSrc;
    message.appendChild(img);
  }
  aiBox.appendChild(message);
  aiBox.scrollTop = aiBox.scrollHeight;
  return body;
}

function beginAnswerStream() {
  activeAnswerEl = addChatMessage('assistant', 'Answer', '');
  activeAnswerEl.parentElement.classList.add('pending');
  aiBox.classList.add('pending');
}

function appendAnswerChunk(chunk) {
  if (!activeAnswerEl) beginAnswerStream();
  activeAnswerEl.parentElement.classList.remove('pending');
  aiBox.classList.remove('pending');
  activeAnswerEl.textContent += chunk;
  aiBox.scrollTop = aiBox.scrollHeight;
}

function finishAnswerStream() {
  if (activeAnswerEl && activeAnswerEl.parentElement) {
    activeAnswerEl.parentElement.classList.remove('pending');
  }
  activeAnswerEl = null;
  aiBox.classList.remove('pending');
}

window.meetingAssistant.onAiStart(beginAnswerStream);
window.meetingAssistant.onAiChunk(appendAnswerChunk);
window.meetingAssistant.onAiComplete(finishAnswerStream);
window.meetingAssistant.onSummaryChunk(appendAnswerChunk);
window.meetingAssistant.onSummaryComplete(finishAnswerStream);

window.meetingAssistant.onAiSettings(applyAiSettings);

window.meetingAssistant.onProtectionChange((isProtected) => {
  protectionBadge.textContent = isProtected ? 'PROTECTED' : 'UNPROTECTED';
  protectionBadge.style.color = isProtected ? 'var(--accent-color)' : 'var(--danger-color)';
});

window.meetingAssistant.onError((msg) => {
  showError(msg);
  if (activeAnswerEl && !activeAnswerEl.textContent) {
    activeAnswerEl.textContent = msg;
    activeAnswerEl.parentElement.classList.remove('pending');
    activeAnswerEl.parentElement.classList.add('chat-error');
    activeAnswerEl = null;
    aiBox.classList.remove('pending');
    return;
  }
  finishAnswerStream();
  addChatMessage('error', 'Error', msg);
});

const opacitySlider = document.getElementById('opacitySlider');
const opacityValue = document.getElementById('opacityValue');

function applyTransparency(percent) {
  const transparency = Math.min(80, Math.max(0, Number(percent) || 0));
  document.documentElement.style.setProperty('--overlay-alpha', (1 - transparency / 100).toFixed(2));
  opacitySlider.value = String(transparency);
  opacityValue.textContent = `${transparency}%`;
  localStorage.setItem('overlayTransparency', String(transparency));
}

applyTransparency(localStorage.getItem('overlayTransparency') ?? '8');
opacitySlider.addEventListener('input', () => applyTransparency(opacitySlider.value));

const storedLiveAnswers = localStorage.getItem('liveAnswersEnabled');
window.meetingAssistant.setLiveAnswers(storedLiveAnswers === null ? true : storedLiveAnswers === 'true')
  .then(applyAiSettings)
  .catch((err) => showError(err.message));

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
