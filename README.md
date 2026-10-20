# Meeting Assistant Overlay

A floating overlay for live meetings. It transcribes speech with Deepgram and streams a short answer with Gemini as soon as a sentence ends. Answers can follow a resume you provide and are written in the first person, so you can read them out loud.

## Consent and responsible use

- Tell the other people in the meeting before you transcribe the call.
- Do not use this in proctored exams, interviews, or any setting where help is not allowed.
- This is a notes and speaking aid. It is not a way to hide assistance.

## Setup

```bash
npm install
npm start
```

Copy `.env.example` to `.env` and fill in the keys you use.

| Variable | Purpose |
|---|---|
| `DEEPGRAM_API_KEY` | Live speech-to-text |
| `GEMINI_API_KEY` | Live answers. Paste it here, or use the gear menu. Clear this line to remove the key. |
| `GEMINI_MODEL` | Model id. Default `gemini-3.8-flash`. `flash`, `lite`, and `pro` are also accepted. |
| `ANTHROPIC_API_KEY` | Optional. Used for suggestions only when no Gemini key is set. |
| `ANTHROPIC_MODEL` | Claude model, if you use Anthropic. |
| `HIDE_FROM_TASKBAR` | `true` keeps the window off the taskbar. `Ctrl+Shift+H` shows it again. |
| `RESUME_PATH` | Optional path to a `.txt` or `.md` resume. If empty, the app reads `resume.txt` or `resume.md` in this folder. |
| `RESPONSE_STYLE` | `spoken` (default) or `brief`. |

After you edit `.env`, click the overlay window so it reloads the file.

## Listening

Choose the source before you press **Start Listening**.

| Source | What it hears |
|---|---|
| Microphone only | Your microphone |
| Meeting call (system audio) | The online call playing through the computer. Your microphone is left out. |
| Microphone + meeting call | Both |

System audio uses the Windows playback mix, so the meeting has to be playing on this PC. Headphones are fine. Other system sounds are included too.

## Answers

The answer box is at the top. With **Real-time answers** on, Gemini writes a spoken reply when a sentence ends. **Suggestion** and **Summary** use the same key.

Put your resume in `resume.txt` if you want those replies to use your real background. The model will not invent employers, dates, or numbers that are not in that file.

**Transparency** fades the overlay background. The answer text stays darker so it stays readable. The level is remembered.

## Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+A` | Ask for a suggestion |
| `Ctrl+Shift+S` | Summarize the transcript |
| `Ctrl+Shift+H` | Hide or show the window |
| `Ctrl+Shift+P` | Toggle screen-capture protection |
| `Ctrl+Shift+Q` | Quit |

The header also has minimize and close. Minimize hides the window when `HIDE_FROM_TASKBAR` is true.

## What to check

1. Start the app and accept the consent notice.
2. Pick **Meeting call (system audio)** during a call, or **Microphone only** to test with your own voice.
3. Confirm words appear in the transcript and an answer appears above it.
4. Move the transparency slider and confirm the answer text stays readable.
