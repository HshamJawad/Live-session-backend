# Railway Deployment Guide

## Quick Deploy to Railway

### Method 1: Deploy from GitHub (Recommended)

1. **Push code to GitHub**
   ```bash
   cd backend
   git init
   git add .
   git commit -m "Initial commit: DACUM Live Workshop API"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/dacum-live-api.git
   git push -u origin main
   ```

2. **Deploy on Railway**
   - Go to [railway.app](https://railway.app)
   - Click "Start a New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect Node.js and deploy
   - Your API will be live at: `https://your-app.railway.app`

3. **Update Frontend**
   - Open `DACUM_Live_Workshop_MVP.html`
   - Line 140: Update `API_BASE` with your Railway URL
   ```javascript
   const API_BASE = 'https://your-app.railway.app/api';
   ```

---

### Method 2: Deploy from CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize and Deploy**
   ```bash
   cd backend
   railway init
   railway up
   ```

4. **Get your URL**
   ```bash
   railway domain
   ```

---

## Verify Deployment

1. **Check health endpoint**
   ```bash
   curl https://your-app.railway.app/
   ```
   
   Expected response:
   ```json
   {
     "status": "ok",
     "message": "DACUM Live Workshop API",
     "activeSessions": 0
   }
   ```

2. **Test session creation** (optional)
   ```bash
   curl -X POST https://your-app.railway.app/api/create-session \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "test123",
       "data": {
         "occupation": "Test",
         "duties": {}
       }
     }'
   ```

---

## Environment Variables (Optional)

If you want to add environment variables:

1. Go to Railway dashboard
2. Select your project
3. Go to "Variables" tab
4. Add variables:
   - `PORT` (Railway sets this automatically)
   - `NODE_ENV=production`

---

## Monitoring

### View Logs
```bash
railway logs
```

Or view in Railway dashboard under "Deployments" → "Logs"

### View Active Sessions (Debug)
```bash
curl https://your-app.railway.app/api/debug/sessions
```

---

## Troubleshooting

### Issue: 404 Not Found
- Check if Railway deployment is complete
- Verify your URL is correct
- Check Railway logs for errors

### Issue: CORS Error
- The backend has CORS enabled for all origins
- If still having issues, check browser console
- Verify API_BASE URL in frontend has correct protocol (https://)

### Issue: Session Not Found
- Sessions are stored in memory and reset on deployment
- For persistence, you'll need to add Redis or database

---

## Upgrade to Production (Future)

For production use, consider:

1. **Add Redis for persistence**
   ```bash
   railway add plugin redis
   ```

2. **Add environment variables**
   - `REDIS_URL`
   - `SESSION_TIMEOUT`
   - `MAX_SESSIONS`

3. **Add rate limiting**
   ```bash
   npm install express-rate-limit
   ```

4. **Add logging**
   ```bash
   npm install winston
   ```

---

## Cost

Railway offers:
- **Free tier**: 500 hours/month, $5 credit
- **Pro tier**: $20/month for production

This MVP should run comfortably on the free tier.

---

## Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check logs: `railway logs`

## Debug endpoints (`ADMIN_TOKEN`)

`GET /api/debug/sessions` and `DELETE /api/debug/session/:id` are **disabled by default** (they answer 404).
To use them, set a long random `ADMIN_TOKEN` variable in Railway and send it as a header:

```
curl -H "x-admin-token: <ADMIN_TOKEN>" https://<your-app>.up.railway.app/api/debug/sessions
```

## Vote validation

`POST /api/submit-vote` accepts only ratings for tasks that exist in the session, and only when
`importance`, `frequency` and `difficulty` are all numbers from 0 to 3. Anything else is dropped;
a submission with no valid rating is refused with HTTP 400.

## One vote per device (`voterToken`)

The voting page sends a random `voterToken` (made once per device and session). `POST /api/submit-vote`
accepts the first vote for a token and answers every later one with **HTTP 409**
(`{ "success": false, "code": "already_voted" }`); a refused or invalid submission does not use up the token.

- Pages that send no token (older versions) are still accepted, so rollout order does not matter.
- Set `REQUIRE_VOTER_TOKEN=1` once every participant uses the new page, to refuse votes without a token.
- This stops repeat votes from reloading, the back button and network retries. It does not stop someone
  who deliberately clears their browser data or uses another device.

## What `create-session` accepts

Ids go into HTML attributes on the voting page, so `POST /api/create-session` refuses (HTTP 400, with the
field named but never the bad value) any session that does not follow these rules:

- `sessionId`: 8 to 64 letters, digits, `_` or `-`.
- Duty ids (the keys of `duties`), task ids, supplementary category ids and item ids: 1 to 64 letters, digits, `_` or `-`.
  Task ids must be unique in the session, and so must supplementary item ids.
- `occupation` (required) up to 500 characters; `jobTitle` up to 500; duty titles up to 1000; task and item texts up to 2000.
- `duties` is an object with 1 to 200 duties; each has a `tasks` array (up to 500; 5000 in all).
- `supplementary` (optional) has at most 50 categories of up to 500 items.

A session that already has votes cannot be replaced: the answer is HTTP 409 `session_exists`.
Supplementary ratings for item ids that are not in the session are ignored.
