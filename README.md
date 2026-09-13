# 🚽 Bio-Toilet Effluent Test – ASR & CIA 2026

Web app for recording and tracking bio-toilet effluent quality tests for the Amritsar & CIA Railway Division.

## 📋 Test Parameters

| Parameter | Limit | Unit |
|-----------|-------|------|
| pH | 6 – 9 | — |
| COD | < 1800 | mgO₂/L |
| FCFC | < 107 | MPN/100ml |

## 🚀 Setup

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/bio-toilet-asr
cd bio-toilet-asr
npm install
```

### 2. Turso Database Setup
1. Sign up at [turso.tech](https://turso.tech)
2. Create a new database: `turso db create bio-toilet-asr`
3. Get your URL and token:
   ```bash
   turso db show bio-toilet-asr --url
   turso db tokens create bio-toilet-asr
   ```

### 3. Environment Variables
```bash
cp .env.example .env.local
# Fill in your Turso URL and auth token
```

### 4. Run Locally
```bash
npm run dev
# Open http://localhost:3000
```

## 🌐 Deploy to Vercel

1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add environment variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. Deploy!

## 🎨 Themes

- **☀️ Light** – Clean, bright default
- **🌙 Dark** – Easy on eyes for night use
- **🚂 Railway** – Indian Railways navy & gold

## 📧 Contact
biotoiletcwasr@gmail.com
