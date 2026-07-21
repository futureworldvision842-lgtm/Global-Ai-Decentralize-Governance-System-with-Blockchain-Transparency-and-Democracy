# 24/7 JARVIS — FREE, NO CARD (old Android phone + Termux)

Best free option when cloud cards don't work. A spare/old Android phone, kept on
charge, becomes your always-on JARVIS server. No signup, no card, no monthly fee.

## What you need
- 1 spare Android phone (any old one works) + charger.
- Your MAIN phone with your WhatsApp (to scan the QR).
  (Bot runs on the OLD phone; you link it from your MAIN WhatsApp.)

## STEP 1 — Install Termux (on the OLD phone)
- Do NOT use Play Store Termux (outdated). Install from **F-Droid**:
  1. Open browser → **f-droid.org** → download & install F-Droid.
  2. In F-Droid, search **Termux** → install.

## STEP 2 — Set up Node (paste in Termux, one line at a time)
```
pkg update -y && pkg upgrade -y
pkg install -y nodejs git
termux-setup-storage
mkdir jarvis && cd jarvis
```

## STEP 3 — Get the bot files
Easiest — clone from your GitHub (files also in E:\jarvis\cloud-jarvis):
```
git clone https://github.com/futureworldvision842-lgtm/ai-and-blockchain-platform temp
cp temp/../cloud-jarvis/* .   2>/dev/null
```
If that doesn't work, create the files by hand:
```
nano index.js      # paste index.js contents, then Ctrl+X, Y, Enter
nano package.json  # paste package.json contents, save
```
(Tell JARVIS on the PC — it can push cloud-jarvis to a repo so you just `git clone` it.)

## STEP 4 — Install & run
```
npm install
export GEMINI_KEY="YOUR_GEMINI_KEY"
export BOSS_NUMBER="REDACTED"
node index.js
```
A **QR code** shows in Termux. On your MAIN phone:
WhatsApp → Settings → **Linked Devices → Link a device** → scan the QR.
JARVIS is now linked. Message your own number "jarvis salam" → it replies.

## STEP 5 — Keep it running 24/7
```
termux-wake-lock
npm install -g pm2
pm2 start index.js --name jarvis
pm2 save
```
Then on the phone: Settings → Battery → Termux → **Don't optimize / No restrictions**.
Keep the phone plugged in. Done — JARVIS stays online forever, PC off ya on.

---
## Other no-card free options (if no spare phone)
- **Keep your PC on** — simplest, free (electricity only). PC-JARVIS already does everything.
- **Render.com free** — no card to start, BUT free apps sleep + lose WhatsApp login on
  restart (bad for WhatsApp). Only okay for the website, not the bot.
- **$4/month VPS** (Hetzner/Contabo) — not free, but cheapest rock-solid always-on if you
  ever want it; pay with easypaisa→USDT etc.

Recommendation: **old phone + Termux** = the true free 24/7 answer.
