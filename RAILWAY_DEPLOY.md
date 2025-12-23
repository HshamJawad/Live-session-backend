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
