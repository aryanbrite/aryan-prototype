# Setup Deployments: Next.js Frontend + Node.js Backend on AWS

This guide covers deploying the two-folder structure entirely on AWS.
We’ll use an EC2 instance for the backend (with PM2 and Caddy for HTTPS), and AWS Amplify for the Next.js frontend.

- **Frontend**: Next.js on AWS Amplify
- **Backend**: Node.js (Express + WebSockets) on AWS EC2
- **Domain**: `api.deyweaver.live` for the backend API

---

## 1. Backend Deployment on AWS EC2

### Step A: Launch an EC2 Instance

1. Go to **EC2 Dashboard** → **Launch Instance**.
2. **Name**: `prototype`
3. **AMI**: Choose **Ubuntu Server 24.04 LTS** (or newer). Avoid AMIs with bundled databases.
4. **Instance type**: `t3.micro` (free tier) or `t3.small`.
5. **Key pair**: Create a new key pair, download the `.pem` file.
6. **Network settings**:
   - **Auto-assign public IP**: Enabled
   - **Firewall (security groups)**: Allow **SSH**, **HTTP**, **HTTPS** from anywhere (0.0.0.0/0).
   - Remove any extra rules (like MSSQL).
7. **Storage**: 8 GiB gp3 is fine.
8. Click **Launch Instance**.

Wait for the instance to be “Running” and note its **Public IPv4 address** (e.g., `13.232.146.221`).

### Step B: Connect via SSH

```bash
ssh -i your-key.pem ubuntu@<your-ec2-public-ip>
```

### Step C: Install Node.js and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### Step D: Clone and Start the Backend

```bash
git clone https://github.com/aryanbrite/aryan-prototype
cd aryan-prototype/backend
npm install
pm2 start server.js --name "meeting-bot"
pm2 save
pm2 startup
```

### Step E: Set Backend Environment Variables

Create a `.env` file in the `backend` folder:

```bash
nano .env
```

Add your keys:

```env
MEETING_BAAS_API_KEY=your_meeting_baas_key
GEMINI_API_KEY=your_gemini_key
PUBLIC_URL=https://api.deyweaver.live
```

Save and restart:

```bash
pm2 restart meeting-bot
```

### Step F: Install and Configure Caddy (Reverse Proxy + HTTPS)

1. **Install Caddy**:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

2. **Configure Caddy**:

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the entire file with:

```caddy
{
    acme_ca https://acme.zerossl.com/v2/DV90
    email aryanbrite@gmail.com
}

api.deyweaver.live {
    reverse_proxy localhost:8000
}
```

**Why this exact config?**
- The `acme_ca` line tells Caddy to use **ZeroSSL** (free 90-day certificates). If you prefer Let’s Encrypt, just remove that line.
- **No extra `http://` block** – Caddy automatically handles HTTP→HTTPS redirects and the ACME challenge needed to prove domain ownership. Adding any manual response for port 80 would block the challenge and prevent certificate issuance.

3. **Restart Caddy**:

```bash
sudo systemctl restart caddy
```

### Step G: Fix DNS – The Critical Step

**Problem:**  
You have `api.deyweaver.live` pointing to your EC2 IP at your DNS registrar (name.com). However, your domain also uses **Vercel’s nameservers** for other subdomains. Without an explicit `api` record in Vercel’s DNS, Vercel returns its own IPs, causing:
- ACME validation hitting wrong servers → certificate failure.
- Browsers connecting to Vercel instead of your EC2 → TLS errors even after a certificate is issued.

**Solution:**  
Add the same A record **inside Vercel’s DNS dashboard** (even if you already have it elsewhere).

1. Log into your **Vercel Dashboard** → select the `deyweaver.live` domain.
2. Go to **DNS** → **Add Record**:
   - **Type**: `A`
   - **Name**: `api`
   - **Value**: `13.232.146.221`   (your EC2 public IP)
   - **TTL**: `60` (or default)
3. Save. It becomes active within seconds.

4. **On your EC2 server**, flush DNS cache and test:

```bash
sudo resolvectl flush-caches
dig +short api.deyweaver.live
```

It must return **only** `13.232.146.221`. If you see any other IP (like `216.198.79.1` or `64.29.17.65`), wait a minute or flush again.

5. **Test HTTPS**:

```bash
curl -I https://api.deyweaver.live
```

You should see `HTTP/2 200`. If you get a TLS error, re-check DNS and Caddy logs (`sudo journalctl -u caddy -f`). The certificate will be obtained automatically once DNS is correct.

---

## 2. Frontend Deployment on AWS Amplify

1. Go to **AWS Amplify Console** → **New app** → **Host web app**.
2. Connect your GitHub repository (`https://github.com/aryanbrite/aryan-prototype`).
3. Set the **Build settings** (if not using `amplify.yml` in the repo, add this):

```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

4. **Add Environment Variable**:
   - Key: `NEXT_PUBLIC_BACKEND_URL`
   - Value: `https://api.deyweaver.live`

5. Click **Save and Deploy**.

Once deployed, Amplify will give you a URL (e.g., `main.xxxxxxxxx.amplifyapp.com`). You can also point your main domain to Amplify later.

---

## Troubleshooting Tips

- **Certificate stuck?** Check Caddy logs: `sudo journalctl -u caddy -f`. Look for “challenge failed” or “validations succeeded; finalizing order”. Common causes are DNS misconfiguration or missing `api` record on Vercel.
- **DNS still returns wrong IPs?** Run `dig +short api.deyweaver.live @ns1.vercel-dns.com` to see what Vercel’s nameserver returns. If it’s not your EC2 IP, you missed adding the record in Vercel.
- **Backend not responding?** Ensure PM2 is running: `pm2 status`. Check that `.env` has correct keys.
- **Caddy “respond ok” mistake?** Never add a generic HTTP handler like `respond "ok"` for your domain on port 80 — it will break certificate renewal.

---

**Done!** Your frontend on Amplify now connects securely to the EC2 backend via `https://api.deyweaver.live`, supporting WebSockets for Gemini Live sessions.
