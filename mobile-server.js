/**
 * Mobile Web & PWA Server for Android Chat Testing.
 * Access from your Android phone on the same Wi-Fi network at:
 * http://<YOUR_LAPTOP_IP>:3000 (e.g. http://192.168.31.236:3000)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

const OpenRouterService = require('./openrouter-service');
const { suggestionSystemPrompt } = require('./answer-profile');

const PORT = process.env.MOBILE_PORT || 3000;
const openRouter = new OpenRouterService(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini');

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  // Route: /api/chat (Server-Sent Events streaming)
  if (req.method === 'POST' && url === '/api/chat') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const question = (payload.question || '').trim();

        if (!question) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Question is required' }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        const systemPrompt = suggestionSystemPrompt();

        await openRouter.streamQuestion(
          question,
          '',
          (chunk) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          },
          () => {
            res.write('data: [DONE]\n\n');
            res.end();
          },
          (err) => {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
          },
          systemPrompt
        );
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Route: /apk or /download (Download Sushil-Assistant.apk directly to phone)
  if (url === '/apk' || url === '/download') {
    const apkPath = path.join(__dirname, 'Sushil-Assistant.apk');
    if (fs.existsSync(apkPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="Sushil-Assistant.apk"'
      });
      fs.createReadStream(apkPath).pipe(res);
      return;
    }
  }

  // Route: /manifest.json
  if (url === '/manifest.json') {
    const manifest = {
      name: "Sushil Interview & Meeting Assistant",
      short_name: "Assistant",
      start_url: "/",
      display: "standalone",
      background_color: "#0f172a",
      theme_color: "#1e293b",
      icons: [
        {
          src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%236366f1'/><text x='50' y='65' font-size='50' text-anchor='middle' fill='white'>AI</text></svg>",
          sizes: "192x192 512x512",
          type: "image/svg+xml"
        }
      ]
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manifest));
    return;
  }

  // Route: / (Serve mobile.html)
  const mobileHtmlPath = path.join(__dirname, 'mobile.html');
  if (fs.existsSync(mobileHtmlPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(mobileHtmlPath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log('\n======================================================');
  console.log(' Mobile Web & APK Download Server Running!');
  console.log(` Web App URL:         http://${ip}:${PORT}`);
  console.log(` Direct APK Download: http://${ip}:${PORT}/apk`);
  console.log('======================================================\n');
  console.log('How to install APK on your Android Phone:');
  console.log(`1. Make sure your phone is on the same Wi-Fi.`);
  console.log(`2. On your phone browser, open: http://${ip}:${PORT}/apk`);
  console.log(`3. Tap Download -> Open -> Install!`);
  console.log(`(Or open http://${ip}:${PORT} to chat directly in browser)\n`);
});
