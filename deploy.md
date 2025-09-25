# Deployment Guide - Access from Anywhere

## Option 1: Using ngrok (Recommended for Testing)

### Install ngrok
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Setup ngrok
```bash
# Sign up at ngrok.com and get your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Run Your App with ngrok
```bash
# Terminal 1: Start backend
npm start

# Terminal 2: Start frontend  
npm run dev

# Terminal 3: Expose frontend to internet
ngrok http 5173

# Terminal 4: Expose backend to internet
ngrok http 3001
```

### Update Frontend for Remote Backend
Create `src/config.js`:
```javascript
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-ngrok-backend-url.ngrok.io'  // Replace with your ngrok backend URL
  : '/api'
```

Update `src/App.jsx` and `src/EventsList.jsx` to use:
```javascript
import { API_BASE_URL } from './config'

// Replace '/api/...' with `${API_BASE_URL}/...`
fetch(`${API_BASE_URL}/create-task`, ...)
```

## Option 2: Cloud Deployment (Production)

### Deploy to Railway/Render/Vercel

#### Backend (Railway/Render)
1. Push code to GitHub
2. Connect to Railway/Render
3. Set environment variables
4. Deploy backend

#### Frontend (Vercel/Netlify)
1. Update `API_BASE_URL` to your backend domain
2. Deploy to Vercel/Netlify

### Environment Variables Needed:
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
TRELLO_API_KEY=your_trello_api_key
TRELLO_TOKEN=your_trello_token
TRELLO_KINGS_BOARD_LIST_ID=your_list_id
NODE_ENV=production
```

## Option 3: Local Network Access (Current Setup)

### Your app is accessible on local network:
- **Computer**: http://localhost:5173
- **Phone** (same WiFi): http://192.168.1.232:5173

### To find your IP address:
```bash
# macOS/Linux
ifconfig | grep inet

# Windows
ipconfig
```

## Option 4: Quick Setup with ngrok (Right Now)

Run these commands in separate terminals:

```bash
# Terminal 1
npm start

# Terminal 2  
npm run dev

# Terminal 3 (if you have ngrok installed)
ngrok http 5173
```

Then use the ngrok URL (like https://abc123.ngrok.io) to access from anywhere!

## Security Considerations

- ngrok URLs are public - anyone with the link can access
- For production, use proper authentication
- Consider rate limiting and security headers
- Use HTTPS in production

## Mobile App Alternative

For native mobile access, consider:
- Converting to PWA (Progressive Web App)
- Using Expo/React Native
- Creating shortcuts on mobile home screen