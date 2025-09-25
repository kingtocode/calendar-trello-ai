# 🤖 AI Task Whisperer

## 🚀 Quick Start

To start the calendar-trello-ai agent:

1. **Navigate to project directory:**
   ```bash
   cd "/Volumes/T7 Shield/claude-projects/calendar-trello-ai"
   ```

2. **Start the backend server:**
   ```bash
   npm start
   ```

3. **Start the frontend (in another terminal):**
   ```bash
   npm run dev
   ```

4. **Access the app:** Open `http://localhost:5174` in your browser

---

A smart, agentic AI-powered task management app that integrates Google Calendar and Trello with conversational AI capabilities. Features voice recognition, natural language understanding, conflict detection, and intelligent task orchestration across multiple platforms.

## ✨ Features

### 🎤 Voice & Text Input
- **Voice Recognition**: Use your browser's speech recognition to create tasks hands-free
- **Natural Language Processing**: Speak naturally - "Dentist appointment tomorrow at 2 PM"
- **Smart Text Input**: Type commands in plain English

### 🤖 AI-Powered Intelligence
- **Intent Recognition**: Understands CREATE, EDIT, DELETE, and LIST commands
- **Conflict Detection**: Warns about scheduling conflicts with existing events
- **Smart Suggestions**: Provides optimization recommendations and related tasks
- **Context Awareness**: Knows your existing events and provides relevant responses

### 📅 Calendar Integration
- **Google Calendar Sync**: Automatically creates and manages calendar events
- **Smart Scheduling**: Extracts dates, times, and creates proper event durations
- **Event Editing**: Modify existing events with natural language commands
- **Conflict Warnings**: Alerts when new events overlap with existing ones

### 📋 Trello Integration
- **Multi-Board Support**: Supports Kings, Personal, Work, and Project boards
- **Automatic Card Creation**: Creates Trello cards alongside calendar events
- **Smart Matching**: Finds and manages related cards when editing/deleting events

### 📱 Mobile-Friendly Design
- **Responsive Layout**: Optimized for iPhone, Pixel, and other mobile devices
- **Dynamic Viewport**: Uses modern CSS for perfect mobile fit
- **Touch-Friendly**: Large buttons and intuitive mobile interface

## 🤖 Agentic AI Capabilities

**Agentic Scale: 7/10** - Your app demonstrates several key agentic AI characteristics:

### ✅ What Makes It Agentic
- **Natural Language Understanding**: Interprets complex commands and user intent
- **Multi-Tool Integration**: Autonomously manages Google Calendar and Trello APIs
- **Context Awareness**: Understands existing events and detects conflicts
- **Reasoning & Decision Making**: Chooses appropriate actions and provides smart suggestions
- **Planning**: Executes multi-step actions (create calendar event + Trello card)
- **Adaptation**: Adjusts responses based on context and conflicts

### 🔄 Agentic Features in Action
- **Tool Use**: Automatically calls appropriate APIs based on user intent
- **Context**: Maintains awareness of your schedule and provides relevant suggestions
- **Planning**: Orchestrates complex workflows across multiple platforms
- **Reasoning**: Makes intelligent decisions about event matching and conflict resolution

### 🚀 Future Enhancements for Full Autonomy
- Long-term memory and learning user preferences
- Proactive suggestions and autonomous task scheduling
- Multi-conversation context and relationship understanding
- Self-directed goal setting and task prioritization

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Calendar API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3001/auth/google/callback`
5. Download the client configuration
6. Set up OAuth consent screen with your email scope

### 3. Trello API Setup

1. Go to [Trello API Key](https://trello.com/app-key)
2. Get your API Key
3. Generate a token with read/write permissions
4. Find your Kings board list ID:
   - Go to your Trello board
   - Add `.json` to the board URL to get board data
   - Find the list ID for where you want cards created

### 4. Environment Configuration

1. Copy `.env.example` to `.env`
2. Fill in your API credentials:

```env
# Google Calendar API Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
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

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Claude AI API Configuration (alternative - keeping for reference)
# ANTHROPIC_API_KEY=your_claude_api_key_here

# Server Configuration
PORT=3001
```

### 5. Get Google Refresh Token

You'll need to get a refresh token for Google Calendar access:

1. Use Google's OAuth 2.0 Playground or create a simple auth flow
2. Authorize Calendar scope: `https://www.googleapis.com/auth/calendar`
3. Exchange authorization code for refresh token
4. Add refresh token to your `.env` file

## Running the Application

1. **Start the backend server**:
```bash
npm start
```

2. **Start the frontend development server** (in another terminal):
```bash
npm run dev
```

3. **Open your browser** to `http://localhost:5174` (or the port shown in your terminal)

## 📱 Mobile Access

### Option 1: Local Network (Same WiFi)
```bash
# Find your computer's IP address
ifconfig | grep "inet " | grep -v 127.0.0.1

# Access from phone using your IP
http://YOUR_IP_ADDRESS:5174
# Example: http://192.168.1.232:5174
```

### Option 2: ngrok (Internet Access)
```bash
# Install ngrok and setup your account
ngrok http 5174

# Use the provided https URL on any device
# Example: https://abc123.ngrok.app
```

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

## How It Works

1. **Input Processing**: The app accepts voice or text input describing your task
2. **Smart Parsing**: Uses regex patterns and natural language processing to extract:
   - Task title
   - Date/time information
   - Whether it's a calendar event or just a task
3. **Calendar Creation**: For time-sensitive items, creates Google Calendar events
4. **Trello Sync**: Creates cards in your Kings board with appropriate details
5. **Confirmation**: Shows success status and links to created items

## API Endpoints

- `POST /api/create-task`: Creates calendar events and Trello cards
- `GET /api/health`: Health check endpoint

## Configuration Notes

- Calendar email is set to: `vincent2king8@gmail.com`
- Trello cards are added to the Kings board list specified in your environment
- Time zone is set to America/New_York (adjust in server.js if needed)
- Default event duration is 1 hour for calendar events

## Troubleshooting

1. **Voice recognition not working**: Ensure you're using a supported browser (Chrome/Safari)
2. **Calendar events not creating**: Check your Google API credentials and refresh token
3. **Trello cards not creating**: Verify your API key, token, and list ID
4. **CORS issues**: Make sure both servers are running on the correct ports
5. **AI not working**: Check your OpenAI API key and billing status. The app falls back to basic parsing if AI fails

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite 5, Modern CSS with Glassmorphism design
- **Backend**: Node.js, Express.js, REST APIs
- **AI**: OpenAI GPT-4o-mini for fast, cost-effective natural language processing
- **Integrations**: Google Calendar API, Trello REST API
- **Voice**: Web Speech API (browser-native)
- **Styling**: Mobile-first responsive design, Dynamic viewport units
- **Architecture**: Agentic AI with multi-tool integration and context awareness

## 🔧 API Setup Quick Links

- **Google Calendar API**: [Google Cloud Console](https://console.cloud.google.com)
- **Trello API**: [Trello Developer Portal](https://trello.com/app-key)  
- **OpenAI API**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Claude API**: [Anthropic Console](https://console.anthropic.com/settings/keys) (alternative)
- **Helper Scripts**: `npm run setup-auth` (Google), `npm run get-boards` (Trello)