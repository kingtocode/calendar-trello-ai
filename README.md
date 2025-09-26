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

### 🤖 AI-Powered Intelligence (Advanced Mode)
- **Claude Integration**: Uses Anthropic Claude 3.5 Haiku for superior reasoning
- **Intent Recognition**: Understands CREATE, EDIT, DELETE, and LIST commands
- **Intelligent Editing**: "Edit tomorrow's pickleball to 5 PM" works perfectly
- **Timezone Detection**: Recognizes "CST", "EDT", "PST" etc. in your commands
- **Conflict Detection**: Warns about scheduling conflicts with existing events
- **Smart Suggestions**: Provides optimization recommendations and related tasks
- **Context Awareness**: Knows your existing events and provides relevant responses
- **Quota Handling**: Graceful fallback to Simple Mode if AI limits reached

### 📝 Simple Mode (Default - Token-Free)
- **Default Experience**: App starts in Simple mode to save AI costs
- **Direct Task Creation**: Basic task parsing without AI overhead
- **Reliable & Fast**: Always works with instant task creation
- **Smart Disclaimer**: Clear guidance on when to use AI mode
- **Manual Editing**: Edit events via 📅 View Events → Edit button

### 📅 Calendar Integration
- **Google Calendar Sync**: Automatically creates and manages calendar events
- **Intelligent Editing**: AI mode can edit events: "move dentist to Friday"
- **Manual Editing**: Simple mode users can edit via View Events → Edit
- **Event Viewing**: Browse your upcoming calendar events
- **Event Deletion**: Remove events directly from the app
- **Clean Descriptions**: Professional "Task created using AI" instead of verbose prompts

### 📋 Trello Integration
- **Multi-Board Support**: Supports Kings, Personal, Work, and Project boards
- **Automatic Card Creation**: Creates Trello cards alongside calendar events
- **Board Selection**: Choose which Trello board to add tasks to

### 🌍 Advanced Timezone Handling
- **Explicit Timezone Support**: "6 PM CST" creates events at correct Central Time
- **Automatic Detection**: Recognizes CST, CDT, EST, EDT, PST, PDT, MST, MDT
- **Custom APP_TIMEZONE**: Set default timezone via environment variable
- **Browser Fallback**: Uses your browser's timezone when no explicit mention
- **Server-Independent**: Works regardless of Vercel's server timezone

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
- **Timezone**: Intl.DateTimeFormat with custom APP_TIMEZONE support

## 🎯 Usage Examples

### 🤖 AI Mode Commands (Advanced)
```
"Move my dentist appointment to Friday at 3 PM CST"
"Edit tomorrow's pickleball event to show as 5 PM"
"Reschedule the team meeting to next Tuesday"
"What's my schedule for tomorrow?"
"Cancel my yoga class this week"
"Find time for grocery shopping"
"Delete the trivia night event"
```

### 📝 Simple Mode Tasks (Default - Direct Creation)
```
"Dentist appointment tomorrow at 2 PM CST"
"Call mom this Sunday afternoon"
"Grocery shopping tomorrow morning"
"Yoga class on Friday at 6 PM EDT"
"Team standup meeting next Tuesday at 9 AM"
"Pickleball on Tuesday night, invite friends"
```

### 🎤 Voice Examples
Simply click the 🎤 Voice button and say:
- "Schedule a doctor appointment for next week at 2 PM CST"
- "Remind me to call the plumber tomorrow at 10 AM"
- "Edit my pickleball game to start at 5 PM" (AI Mode only)

## ⚙️ Setup Instructions

### For Vercel Deployment (Current)

**Environment Variables Required:**
Set these in your Vercel dashboard → Project → Settings → Environment Variables:

**NEW FEATURES:**
- 🌍 **APP_TIMEZONE**: Set default timezone (e.g., America/Chicago) for consistent behavior
- 🤖 **ANTHROPIC_API_KEY**: Required for AI Mode's intelligent editing and commands
- 📝 **Simple Mode**: Works without ANTHROPIC_API_KEY (default mode)

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

# App Default Timezone (Optional - for consistent timezone behavior)
APP_TIMEZONE=America/Chicago
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

## 🚀 Latest Improvements

### ✅ **Switched to Claude AI (Major Upgrade)**
- Replaced OpenAI with Anthropic Claude 3.5 Haiku for superior performance
- Better intent detection and more reliable JSON parsing
- Cost-effective pricing and fewer quota issues

### ✅ **Advanced Timezone Handling**
- Fixed "6 PM CST → 11 PM" bug with comprehensive timezone support
- Explicit timezone detection: CST, CDT, EST, EDT, PST, PDT automatically recognized
- Custom APP_TIMEZONE environment variable for default timezone
- Server-independent timezone handling (works regardless of Vercel's UTC servers)

### ✅ **Smart Default UX**
- Simple Mode now default to save AI costs
- Helpful disclaimer explains when to use AI vs Simple mode
- Easy switching between modes with clear guidance

### ✅ **Intelligent Event Editing**
- AI Mode: "Edit tomorrow's pickleball to 5 PM" actually works now
- Manual editing via View Events → Edit for Simple Mode users
- Clean event descriptions ("Task created using AI" instead of verbose prompts)

### ✅ **Complete Infrastructure**
- All Vercel serverless API functions working perfectly
- Proper error handling and graceful AI quota management
- CORS configured, mobile-responsive design

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