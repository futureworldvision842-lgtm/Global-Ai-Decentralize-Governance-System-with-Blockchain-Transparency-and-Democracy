# 24/7 Cloud JARVIS — Baby Steps (FREE, always online even when PC is off)

## What you get
A WhatsApp JARVIS that lives on a free cloud computer, online 24/7. You message
"jarvis <anything>" from your number → it replies (Gemini brain). Sends a daily
report. Never sleeps. (PC-control tasks still need PC-JARVIS; this = chat + reports.)

---

## PART A — Get the free cloud computer (Oracle Cloud "Always Free")
1. Go to: https://www.oracle.com/cloud/free/
2. Click **Start for free**.
3. Fill: name, email, country = Pakistan. Verify email (check inbox).
4. Phone verify (SMS code).
5. **Card step:** it asks for a debit/credit card for identity ONLY. It does NOT
   charge you — "Always Free" resources stay free forever. (If no card, tell me —
   we'll use an alternative free host.)
6. Choose Home Region near you (e.g. Middle East / Mumbai). Finish signup (5–10 min).

## PART B — Make the free server (VM)
1. In Oracle console → menu → **Compute → Instances → Create Instance**.
2. Name: `jarvis`. Image: **Ubuntu 22.04**. Shape: pick an **"Always Free eligible"**
   one (VM.Standard.A1.Flex or E2.1.Micro).
3. **Download the SSH private key** (Save it! You need it to log in).
4. Click **Create**. Wait until it says RUNNING. Copy its **Public IP address**.

## PART C — Log in & install (copy-paste commands)
On Windows, open **PowerShell**, then (replace KEYFILE + IP):
```
ssh -i C:\path\to\your-key.key ubuntu@YOUR_PUBLIC_IP
```
Then on the server, paste:
```
sudo apt update && sudo apt install -y nodejs npm git
mkdir jarvis && cd jarvis
```
Upload these 3 files into that folder (index.js, package.json — from
E:\jarvis\cloud-jarvis). Easiest: paste them with nano, or `git clone` your repo.
Then:
```
npm install
export GEMINI_KEY="YOUR_GEMINI_KEY"
export BOSS_NUMBER="REDACTED"
node index.js
```
A **QR code** appears. On your phone: WhatsApp → Settings → **Linked Devices →
Link a device** → scan it. JARVIS is now linked.

## PART D — Keep it running 24/7 (survives logout & reboot)
```
sudo npm install -g pm2
pm2 start index.js --name jarvis
pm2 save
pm2 startup      # run the line it prints
```
Done. Close PowerShell — JARVIS stays online forever.

---
## Notes / honesty
- Free forever on Oracle Always Free. No charges if you stay on free shapes.
- If Oracle blocks signup (card/capacity), FREE alternatives: Google Cloud e2-micro
  Always Free, or a $4/month VPS (Contabo/Hetzner) — tell me and I'll adapt.
- Your Gemini key lives only on YOUR server (env var), not public.
- To update the bot later: edit index.js, `pm2 restart jarvis`.
