# 🤖 AI Task Whisperer

**Live Demo:** https://calendar-trello-ai.vercel.app/

A smart, agentic AI-powered task management app that integrates Google Calendar and Trello with conversational AI capabilities. Features voice recognition, natural language understanding, conflict detection, and intelligent task orchestration across multiple platforms.

## 🚀 Quick Access

### 🌐 **Vercel Deployment (Recommended)**
**Access anywhere:** https://calendar-trello-ai.vercel.app/
- ✅ No local setup required
- ✅ Works on any device with internet
- ✅ Full API functionality
- ✅ Always up-to-date

### 💻 **Local Development**
```bash
# Navigate to project directory
cd calendar-trello-ai

# Start backend server
npm start

# Start frontend (in another terminal)
npm run dev

# Access at http://localhost:5174
```

## ✨ Features

### 🎤 Voice & Text Input
- **Voice Recognition**: Use your browser's speech recognition to create tasks hands-free
- **Natural Language Processing**: Speak naturally - "Dentist appointment tomorrow at 2 PM"
- **Smart Text Input**: Type commands in plain English

### 🤖 AI-Powered Intelligence (AI Mode)
- **Intent Recognition**: Understands CREATE, EDIT, DELETE, and LIST commands
- **Conflict Detection**: Warns about scheduling conflicts with existing events
- **Smart Suggestions**: Provides optimization recommendations and related tasks
- **Context Awareness**: Knows your existing events and provides relevant responses
- **Quota Handling**: Graceful fallback to Simple Mode if AI limits reached

### 📝 Simple Mode (No AI Required)
- **Direct Task Creation**: Basic task parsing without AI overhead
- **Reliable Fallback**: Always works even without OpenAI access
- **Fast Processing**: Instant task creation
- **Clear Mode Switching**: Intuitive toggle between modes

### 📅 Calendar Integration
- **Google Calendar Sync**: Automatically creates and manages calendar events
- **Smart Scheduling**: Extracts dates, times, and creates proper event durations
- **Event Editing**: Modify existing events with natural language commands
- **Event Viewing**: Browse your upcoming calendar events
- **Event Deletion**: Remove events directly from the app

### 📋 Trello Integration
- **Multi-Board Support**: Supports Kings, Personal, Work, and Project boards
- **Automatic Card Creation**: Creates Trello cards alongside calendar events
- **Board Selection**: Choose which Trello board to add tasks to

### 📱 Mobile-Friendly Design
- **Responsive Layout**: Optimized for iPhone, Android, and tablets
- **Touch-Friendly**: Large buttons and intuitive mobile interface
- **PWA Ready**: Install as app on mobile devices

## 🛠️ Current Architecture

### **Vercel Serverless Functions**
- `/api/create-task` - Simple mode task creation
- `/api/process-command` - AI-powered task processing
- `/api/events` - Get calendar events
- `/api/events/[eventId]` - Edit/delete specific events

### **Technology Stack**
- **Frontend**: React 18 + Vite 5, deployed to Vercel
- **Backend**: Node.js serverless functions on Vercel
- **AI**: Anthropic Claude 3.5 Haiku for natural language processing
- **Integrations**: Google Calendar API, Trello REST API
- **Voice**: Web Speech API (browser-native)

## 🎯 Usage Examples

### 🤖 AI Mode Commands (Advanced)
```
"Move my dentist appointment to Friday"
"What's my schedule for tomorrow?"
"Cancel my yoga class this week"
"Find time for grocery shopping"
"Add a 2-hour reminder to my meeting"
"Edit the Metro Spice Mart event to end earlier"
"Delete the trivia night event"
```

### 📝 Simple Mode Tasks (Direct Creation)
```
"Dentist appointment tomorrow at 2 PM"
"Call mom this Sunday afternoon"
"Grocery shopping tomorrow morning"
"Yoga class on Friday at 6 PM"
"Team standup meeting next Tuesday at 9 AM"
"Pickle ball on Tuesday night, invite friends"
```

### 🎤 Voice Examples
Simply click the 🎤 Voice button and say:
- "Schedule a doctor appointment for next week"
- "Remind me to call the plumber tomorrow at 10"
- "Cancel my gym session on Friday"

## ⚙️ Setup Instructions

### For Vercel Deployment (Current)

**Environment Variables Required:**
Set these in your Vercel dashboard → Project → Settings → Environment Variables:

```env
# Google Calendar API Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://calendar-trello-ai.vercel.app/auth/google/callback
GOOGLE_REFRESH_TOKEN=your_refresh_token_here

# Trello API Configuration
TRELLO_API_KEY=your_trello_api_key_here
TRELLO_TOKEN=your_trello_token_here

# Multiple Trello Boards Support
TRELLO_KINGS_BOARD_LIST_ID=your_kings_board_list_id_here
TRELLO_PERSONAL_BOARD_LIST_ID=your_personal_board_list_id_here
TRELLO_WORK_BOARD_LIST_ID=your_work_board_list_id_here
TRELLO_PROJECT_BOARD_LIST_ID=your_project_board_list_id_here

# Default board (options: kings, personal, work, project)
DEFAULT_TRELLO_BOARD=kings

# Anthropic Claude API Configuration (Optional - for AI Mode)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### For Local Development

1. **Install Dependencies**
```bash
npm install
```

2. **Environment Setup**
- Copy `.env.example` to `.env`
- Fill in your API credentials (same as above, but use `http://localhost:3001/auth/google/callback` for redirect URI)

3. **Run Locally**
```bash
# Backend (Terminal 1)
npm start

# Frontend (Terminal 2)
npm run dev
```

## 🔧 API Setup Guides

### 1. Google Calendar API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - For Vercel: `https://calendar-trello-ai.vercel.app/auth/google/callback`
   - For local: `http://localhost:3001/auth/google/callback`
5. Set up OAuth consent screen with calendar scope

### 2. Trello API Setup

1. Go to [Trello API Key](https://trello.com/app-key)
2. Get your API Key
3. Generate a token with read/write permissions
4. Find your board list IDs:
   - Go to your Trello board
   - Add `.json` to the board URL
   - Find the list ID for where you want cards created

### 3. Anthropic Claude API Setup (Optional)

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Add billing if needed for usage beyond free tier
4. AI Mode will gracefully fallback to Simple Mode if quota exceeded

## 📱 Mobile & Remote Access

### **Vercel App (Recommended)**
- **URL:** https://calendar-trello-ai.vercel.app/
- **Access:** Works on any device with internet
- **Performance:** Fast global CDN
- **Updates:** Auto-deployed from GitHub

### **Local Network Access**
```bash
# Find your computer's IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Access from phone (same WiFi)
http://YOUR_IP_ADDRESS:5174
```

### **Internet Access via Tunneling**
```bash
# Using ngrok
ngrok http 5174

# Use provided HTTPS URL anywhere
```

## 🚀 Recent Improvements

### ✅ **Fixed Network Errors**
- Created all missing Vercel serverless API functions
- Fixed "The string did not match the expected pattern" error

### ✅ **Enhanced UX**
- Mode toggle now shows action ("Switch to AI Mode" vs "Switch to Simple Mode")
- Added current mode indicator
- Improved mobile responsiveness

### ✅ **Complete Event Management**
- Event viewing works properly
- Event editing fully functional (PUT /api/events/[eventId])
- Event deletion supported (DELETE /api/events/[eventId])

### ✅ **Robust Error Handling**
- Graceful AI quota handling with mode switching
- Proper Google Calendar API error responses
- CORS configured for all endpoints

## 🔍 How It Works

1. **Input Processing**: Accepts voice or text describing your task
2. **Mode Processing**:
   - **AI Mode**: Uses OpenAI to understand complex commands
   - **Simple Mode**: Uses regex patterns for direct parsing
3. **Calendar Integration**: Creates Google Calendar events for time-sensitive items
4. **Trello Sync**: Creates cards in selected Trello board
5. **Confirmation**: Shows success status with links to created items

## 🛡️ Troubleshooting

### **Vercel Deployment Issues**
- Check environment variables are set correctly
- Verify API keys have proper permissions
- Check Vercel function logs for errors

### **Local Development Issues**
1. **Voice not working**: Use Chrome/Safari, ensure microphone permissions
2. **Calendar events not creating**: Check Google API credentials and refresh token
3. **Trello cards not creating**: Verify API key, token, and list ID
4. **AI not responding**: Check Anthropic API key and billing. App falls back to Simple Mode
5. **CORS issues**: Ensure both servers running on correct ports

### **API Rate Limits**
- Anthropic Claude: App gracefully switches to Simple Mode
- Google Calendar: Built-in retry logic
- Trello: Standard rate limiting applies

## 🔗 Quick Links

- **Live App**: https://calendar-trello-ai.vercel.app/
- **Google Calendar API**: [Console](https://console.cloud.google.com)
- **Trello API**: [Developer Portal](https://trello.com/app-key)
- **Anthropic API**: [Console](https://console.anthropic.com/)
- **Vercel Dashboard**: [Manage Deployment](https://vercel.com/dashboard)

---

**🎉 Your AI Task Whisperer is now live and ready to help you manage tasks across Google Calendar and Trello!**