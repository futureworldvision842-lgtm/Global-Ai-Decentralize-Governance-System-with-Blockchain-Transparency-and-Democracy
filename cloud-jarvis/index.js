// Cloud JARVIS — 24/7 WhatsApp assistant (runs on a free always-on Linux VM).
// Boss messages his own number "jarvis <anything>" -> JARVIS (Gemini) replies.
// Sends a daily report. Auto-reconnects. NO PC needed — this stays online 24/7.
// (PC-control tasks still need PC-JARVIS; this handles chat, Q&A, reports.)
// BOSS_NUMBER must come from the environment. Never commit a phone number.
const BOSS = String(process.env.BOSS_NUMBER || '').replace(/\D/g, '');
if (!BOSS) {
  console.error('Set BOSS_NUMBER in the environment.');
  process.exit(1);
}
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } =
  require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const https = require('https');
const http = require('http');
const fs = require('fs');

// Tiny HTTP server so free hosts (Render/Koyeb) see this as a live "web service"
// and an uptime pinger (cron-job.org) can keep it awake. Also shows the QR link.
let lastQR = '';
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h2>🤖 Cloud JARVIS</h2><p>Status: ' + (ready ? 'ONLINE ✅' : 'connecting…') +
    '</p>' + (lastQR && !ready ? '<p>Scan pending — check server logs for QR.</p>' : ''));
}).listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('[JARVIS] keep-alive HTTP up'));

const KEY = process.env.GEMINI_KEY || '';
const AUTH = './auth';
let sock, ready = false;

const BRAIN =
  "You are J.A.R.V.I.S., Muhammad Qureshi's personal AI, replying on WhatsApp. " +
  "Answer in his language (English/Roman-Urdu). Mission: a people-owned platform — " +
  "decentralized governance, blockchain transparency, AI that informs not decides, a science " +
  "game, education that frees; built by a solo founder in Islamabad, Pakistan. " +
  "Warm, concise, decisive. Demo: onepiecejourney-crew.netlify.app. Never invent facts.";

function gemini(prompt) {
  return new Promise((resolve) => {
    if (!KEY) return resolve('Server has no Gemini key set (GEMINI_KEY).');
    const body = JSON.stringify({
      system_instruction: { parts: [{ text: BRAIN }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-flash-latest:generateContent',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': KEY,
        'Content-Length': Buffer.byteLength(body) },
    }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => {
      try { resolve(JSON.parse(d).candidates[0].content.parts.map(p => p.text).join('')); }
      catch { resolve('JARVIS is thinking-blocked right now, Sir — try again.'); }
    }); });
    req.on('error', () => resolve('Connection hiccup, Sir.'));
    req.write(body); req.end();
  });
}

async function send(jid, text) { try { await sock.sendMessage(jid, { text }); } catch {} }

async function dailyReport() {
  const jid = BOSS + '@s.whatsapp.net';
  const msg = await gemini('Give Muhammad a short daily motivational + mission-progress nudge for ' +
    'his platform (onepiecejourney-crew.netlify.app). One tight paragraph, end with one action for today.');
  await send(jid, '🤖 JARVIS DAILY — ' + new Date().toDateString() + '\n\n' + msg);
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH);
  sock = makeWASocket({ auth: state, browser: ['CloudJARVIS', 'Chrome', '1.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) { lastQR = qr; console.log('\n[JARVIS] Scan this QR in WhatsApp > Linked Devices:\n'); qrcode.generate(qr, { small: true }); }
    if (connection === 'open') { ready = true; console.log('[JARVIS] ONLINE 24/7 — connected.'); }
    if (connection === 'close') {
      ready = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) console.log('[JARVIS] logged out — delete ./auth and rescan.');
      else { console.log('[JARVIS] reconnecting…'); setTimeout(start, 2000); }
    }
  });
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg?.message) return;
      const text = (msg.message.conversation ||
        msg.message.extendedTextMessage?.text || '').trim();
      if (!text.toLowerCase().startsWith('jarvis')) return;
      const q = text.replace(/^jarvis[,:\s]*/i, '').trim() || 'hello';
      const jid = msg.key.remoteJid;
      // Only the Boss (his own chats) get full assistant; others get a friendly line.
      if (msg.key.fromMe || (jid || '').startsWith(BOSS)) {
        await send(jid, '🤖 ' + await gemini(q));
      } else {
        await send(jid, "🤖 Salam! Main JARVIS hoon, Muhammad Qureshi ka AI. " +
          "Platform dekhein: onepiecejourney-crew.netlify.app");
      }
    } catch {}
  });
}

// daily report at ~09:00 server time (checks every 30 min)
let lastReport = '';
setInterval(() => {
  const h = new Date().getHours(), day = new Date().toDateString();
  if (h === 9 && lastReport !== day && ready) { lastReport = day; dailyReport(); }
}, 30 * 60 * 1000);

start();
console.log('[JARVIS] Cloud assistant starting…');
