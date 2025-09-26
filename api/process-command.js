const { google } = require('googleapis')
const Trello = require('trello')
const Anthropic = require('@anthropic-ai/sdk')
const { DateTime } = require('luxon')

// Natural event creation handler
async function handleNaturalCreate(claudeResponse, toolDetails, currentEvents, calendarEmail, board, res, userTimezone) {
  try {
    console.log('🔧 Creating event naturally from:', toolDetails)

    // Simple parsing of tool details - Claude will provide something like "Dentist appointment, tomorrow 2 PM"
    const taskInput = toolDetails.trim()

    // Use existing parseTaskInput logic for now
    const parsedTask = parseTaskInput(taskInput, userTimezone)

    // Initialize Google Calendar
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Create calendar event
    const eventData = {
      summary: parsedTask.title,
      description: `Task created using AI`,
      start: {
        dateTime: formatDateTimeForCalendar(parsedTask.startDate, parsedTask.timezone),
        timeZone: parsedTask.timezone,
      },
      end: {
        dateTime: formatDateTimeForCalendar(parsedTask.endDate, parsedTask.timezone),
        timeZone: parsedTask.timezone,
      },
      attendees: [
        { email: calendarEmail }
      ]
    }

    const calendarResponse = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventData,
    })

    const calendarEvent = calendarResponse.data

    // Create Trello card
    const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_TOKEN)
    const listId = getBoardListId(board)

    const trelloCard = await trello.addCard(
      parsedTask.title,
      `📅 Scheduled for: ${parsedTask.startDate.toLocaleString()}\n🔗 Calendar Event: ${calendarEvent.htmlLink}\n📋 Board: ${board}`,
      listId
    )

    return res.json({
      success: true,
      response: `✅ ${claudeResponse}`,
      calendarEvent: {
        id: calendarEvent.id,
        htmlLink: calendarEvent.htmlLink,
        summary: calendarEvent.summary
      },
      trelloCard: {
        id: trelloCard.id,
        url: trelloCard.url,
        name: trelloCard.name
      },
      suggestions: ["Create another event", "View your calendar", "Edit this event"]
    })

  } catch (error) {
    console.error('Error in natural create:', error)
    return res.json({
      success: false,
      response: `❌ Sorry, I couldn't create that event. ${error.message}`,
      suggestions: ["Try again with more details", "Switch to Simple mode"]
    })
  }
}

// Natural event update handler (placeholder for now)
async function handleNaturalUpdate(claudeResponse, toolDetails, currentEvents, calendarEmail, res) {
  return res.json({
    success: true,
    response: `✅ ${claudeResponse}\n\n(Update functionality will be implemented next!)`,
    suggestions: ["View your events", "Create a new event"]
  })
}

// Natural event delete handler (placeholder for now)
async function handleNaturalDelete(claudeResponse, toolDetails, currentEvents, calendarEmail, res) {
  return res.json({
    success: true,
    response: `✅ ${claudeResponse}\n\n(Delete functionality will be implemented next!)`,
    suggestions: ["View your events", "Create a new event"]
  })
}

// Simple task parsing (reusing existing logic for now)
function parseTaskInput(taskDescription, userTimezone = null) {
  const now = new Date()
  let startDate = new Date()
  let endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // Default 1 hour duration
  let isEvent = false

  // Detect time patterns
  const timePattern = /(\\d{1,2}):?(\\d{2})?\\s*(AM|PM|am|pm)?/gi
  const datePattern = /(today|tomorrow|next\\s+\\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi

  const timeMatch = taskDescription.match(timePattern)
  const dateMatch = taskDescription.match(datePattern)

  if (dateMatch) {
    const dateStr = dateMatch[0].toLowerCase()
    if (dateStr === 'today') {
      startDate = new Date()
    } else if (dateStr === 'tomorrow') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() + 1)
    }
  }

  if (timeMatch) {
    const timeStr = timeMatch[0]
    const [, hours, minutes = '00', period] = timeStr.match(/(\\d{1,2}):?(\\d{2})?\\s*(AM|PM|am|pm)?/i) || []

    let hour = parseInt(hours)
    if (period && period.toLowerCase() === 'pm' && hour !== 12) {
      hour += 12
    } else if (period && period.toLowerCase() === 'am' && hour === 12) {
      hour = 0
    }

    startDate.setHours(hour, parseInt(minutes), 0, 0)
    isEvent = true
  }

  endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

  // Create cleaner title
  let title = taskDescription
    .replace(/\\b(today|tomorrow)\\b/gi, '')
    .replace(/at \\d{1,2}:?\\d{0,2}\\s*(AM|PM|am|pm)?/gi, '')
    .replace(/\\s+/g, ' ')
    .trim()

  if (!title) {
    title = taskDescription
  }

  return {
    title,
    description: taskDescription,
    startDate,
    endDate,
    isEvent,
    timezone: userTimezone || process.env.APP_TIMEZONE || 'America/Chicago'
  }
}

function formatDateTimeForCalendar(date, timezone) {
  try {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  } catch (error) {
    console.warn('Date formatting failed:', error)
    return date.toISOString()
  }
}

function getBoardListId(boardName) {
  const boardMapping = {
    kings: process.env.TRELLO_KINGS_BOARD_LIST_ID,
    personal: process.env.TRELLO_PERSONAL_BOARD_LIST_ID,
    work: process.env.TRELLO_WORK_BOARD_LIST_ID,
    project: process.env.TRELLO_PROJECT_BOARD_LIST_ID
  }

  return boardMapping[boardName] || boardMapping[process.env.DEFAULT_TRELLO_BOARD] || boardMapping.kings
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userInput, command, calendarEmail, board = process.env.DEFAULT_TRELLO_BOARD, timezone } = req.body
    const inputText = userInput || command

    if (!inputText) {
      return res.status(400).json({ error: 'User input is required' })
    }

    const userTimezone = timezone || process.env.APP_TIMEZONE || 'America/Chicago'

    // Check for simple LIST queries first (fallback)
    const lowerInput = inputText.toLowerCase()
    const listKeywords = ['when', 'what', 'show', 'list', 'schedule', 'do i have', 'am i', 'where', 'time']
    const isSimpleListQuery = listKeywords.some(keyword => lowerInput.includes(keyword))

    if (isSimpleListQuery) {
      console.log('🔍 Using fallback LIST handler for:', inputText)

      // Get calendar events
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      )

      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      })

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

      try {
        const eventsResponse = await calendar.events.list({
          calendarId: 'primary',
          timeMin: (new Date()).toISOString(),
          maxResults: 20,
          singleEvents: true,
          orderBy: 'startTime'
        })

        const events = eventsResponse.data.items || []

        // Simple search
        const searchTerms = inputText.toLowerCase().split(' ')
        const matchingEvents = events.filter(event => {
          const title = (event.summary || '').toLowerCase()
          const description = (event.description || '').toLowerCase()
          return searchTerms.some(term =>
            title.includes(term) || description.includes(term)
          )
        })

        if (matchingEvents.length > 0) {
          const eventSummaries = matchingEvents.slice(0, 3).map(event => {
            const date = new Date(event.start.dateTime || event.start.date)
            const formattedDate = date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })
            const formattedTime = date.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })
            return `• ${event.summary} - ${formattedDate} at ${formattedTime}`
          }).join('\\n')

          return res.json({
            success: true,
            response: `✅ Found ${matchingEvents.length} matching event(s):\\n\\n${eventSummaries}`,
            suggestions: ["Create a new event", "View all events"]
          })
        } else {
          return res.json({
            success: true,
            response: "✅ No matching events found in your calendar.",
            suggestions: ["Create a new event", "View all events"]
          })
        }
      } catch (calError) {
        console.error('Calendar error in fallback:', calError)
        return res.json({
          success: true,
          response: "I had trouble accessing your calendar events. Please try again.",
          suggestions: ["Try again", "Create a new event"]
        })
      }
    }

    // Get current events for AI context
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    let currentEvents = []
    try {
      const eventsResponse = await calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
      })
      currentEvents = eventsResponse.data.items || []
    } catch (eventError) {
      console.error('Could not fetch events for AI context:', eventError)
    }

    // Call Claude AI with conversational prompt
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
      throw new Error('Anthropic API key not configured')
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Get current date context
    const now = new Date()
    const userNow = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }))
    const currentDate = userNow.toISOString().split('T')[0]
    const currentDateTime = userNow.toISOString()

    const systemPrompt = `You are Claude, an intelligent AI calendar assistant with a natural, helpful personality. You can see the user's calendar events and help them manage their schedule through natural conversation.

<current_context>
📅 Today is: ${currentDate}
🕒 Current time: ${currentDateTime}
🌍 User timezone: ${userTimezone}
</current_context>

<your_capabilities>
You can help with:
- 🔍 Finding events ("When is my pickleball?")
- 📝 Creating new events ("Schedule dentist tomorrow 2 PM")
- ✏️ Updating events ("Move my meeting to 3 PM")
- 🗑️ Deleting events ("Cancel my yoga class")
- 📋 Creating Trello cards for tasks
- 💡 Suggesting better scheduling
</your_capabilities>

<user_calendar>
Here are their upcoming events:
${JSON.stringify(currentEvents.slice(0, 10), null, 2)}
</user_calendar>

<conversation_guidelines>
- Be conversational and natural, like a smart personal assistant
- Reference specific events by name when discussing them
- Always use ${userTimezone} timezone for dates/times
- For dates: "today" = ${currentDate}, "tomorrow" = next day
- Ask clarifying questions if requests are unclear
- Offer helpful suggestions and point out conflicts
- Be proactive - suggest related actions when appropriate

When you need to perform actions, indicate them naturally:
- "Let me check your calendar..." [SEARCH]
- "I'll create that event..." [CREATE: event details]
- "I'll move that meeting..." [UPDATE: event_id, changes]
- "I'll cancel that..." [DELETE: event_id]
</conversation_guidelines>

Respond naturally as Claude, the AI assistant. Be helpful and conversational.`

    console.log('🤖 Calling Claude with conversational prompt')

    const completion = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        { role: "user", content: inputText }
      ]
    })

    const rawResponse = completion.content[0].text.trim()
    console.log('🤖 Claude responded:', rawResponse)

    // Parse Claude's natural response for tool usage
    const toolMatches = {
      search: rawResponse.match(/\\[SEARCH\\]/i),
      create: rawResponse.match(/\\[CREATE:([^\\]]+)\\]/i),
      update: rawResponse.match(/\\[UPDATE:([^\\]]+)\\]/i),
      delete: rawResponse.match(/\\[DELETE:([^\\]]+)\\]/i)
    }

    // If no tools detected, return natural conversation
    if (!Object.values(toolMatches).some(match => match)) {
      console.log('🗣️ Pure conversational response')
      return res.json({
        success: true,
        response: `✅ ${rawResponse}`,
        intent: 'CONVERSATION',
        suggestions: ["Create a new event", "Ask about your schedule", "Update an event"]
      })
    }

    // Handle tool usage
    if (toolMatches.create) {
      console.log('🔧 Claude wants to CREATE event')
      return await handleNaturalCreate(rawResponse, toolMatches.create[1], currentEvents, calendarEmail, board, res, userTimezone)
    }

    if (toolMatches.update) {
      console.log('🔧 Claude wants to UPDATE event')
      return await handleNaturalUpdate(rawResponse, toolMatches.update[1], currentEvents, calendarEmail, res)
    }

    if (toolMatches.delete) {
      console.log('🔧 Claude wants to DELETE event')
      return await handleNaturalDelete(rawResponse, toolMatches.delete[1], currentEvents, calendarEmail, res)
    }

    // Default: return conversational response
    return res.json({
      success: true,
      response: `✅ ${rawResponse}`,
      intent: 'CONVERSATION',
      suggestions: ["Create a new event", "Ask about your schedule"]
    })

  } catch (error) {
    console.error('Error processing command:', error)
    console.error('Error stack:', error.stack)

    if (error.message && (error.message.includes('quota') || error.message.includes('billing') || error.message.includes('exceeded'))) {
      return res.json({
        success: false,
        response: "⚠️ AI quota limit reached. Please check your Anthropic account billing or switch to Simple mode.",
        suggestions: ["Switch to Simple mode", "Check Anthropic billing"]
      })
    }

    return res.json({
      success: false,
      response: "⚠️ AI processing temporarily unavailable. Please try again or switch to Simple mode.",
      suggestions: ["Try again", "Switch to Simple mode"]
    })
  }
}