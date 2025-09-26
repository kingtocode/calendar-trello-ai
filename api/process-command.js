const { google } = require('googleapis')
const Trello = require('trello')
const Anthropic = require('@anthropic-ai/sdk')

// Natural action detection from Claude's responses
function detectActionsFromResponse(claudeResponse) {
  const response = claudeResponse.toLowerCase()

  const actions = {
    create: false,
    update: false,
    delete: false,
    search: false,
    details: null
  }

  // Detect CREATE intentions
  const createPhrases = [
    "i'll create", "i'll add", "i'll schedule", "i'll set up",
    "let me create", "let me add", "let me schedule",
    "i can create", "i can add", "i can schedule",
    "creating", "adding", "scheduling"
  ]

  // Detect UPDATE intentions
  const updatePhrases = [
    "i'll move", "i'll change", "i'll update", "i'll reschedule",
    "let me move", "let me change", "let me update", "let me reschedule",
    "i can move", "i can change", "i can update", "i can reschedule",
    "moving", "changing", "updating", "rescheduling"
  ]

  // Detect DELETE intentions
  const deletePhrases = [
    "i'll cancel", "i'll remove", "i'll delete",
    "let me cancel", "let me remove", "let me delete",
    "i can cancel", "i can remove", "i can delete",
    "canceling", "removing", "deleting"
  ]

  // Check for action intentions
  if (createPhrases.some(phrase => response.includes(phrase))) {
    actions.create = true
  }

  if (updatePhrases.some(phrase => response.includes(phrase))) {
    actions.update = true
  }

  if (deletePhrases.some(phrase => response.includes(phrase))) {
    actions.delete = true
  }

  // Extract details from the response (everything after action phrases)
  const allActionPhrases = [...createPhrases, ...updatePhrases, ...deletePhrases]
  for (const phrase of allActionPhrases) {
    const phraseIndex = response.indexOf(phrase)
    if (phraseIndex !== -1) {
      // Extract text after the action phrase
      const afterPhrase = claudeResponse.substring(phraseIndex + phrase.length).trim()
      if (afterPhrase.length > 0) {
        actions.details = afterPhrase.split('.')[0].trim() // Get first sentence
      }
      break
    }
  }

  return actions
}

// Parse event details from natural text
function parseNaturalEventDetails(text, userTimezone) {
  console.log('🔍 Parsing natural event details:', text)

  const now = new Date()
  let startDate = new Date()
  let endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // Default 1 hour
  let title = text
  let isEvent = false

  // Enhanced date detection
  const datePatterns = [
    { pattern: /\btoday\b/i, offset: 0 },
    { pattern: /\btomorrow\b/i, offset: 1 },
    { pattern: /\bnext week\b/i, offset: 7 },
    { pattern: /\bmонday\b/i, weekday: 1 },
    { pattern: /\btuesday\b/i, weekday: 2 },
    { pattern: /\bwednesday\b/i, weekday: 3 },
    { pattern: /\bthursday\b/i, weekday: 4 },
    { pattern: /\bfriday\b/i, weekday: 5 },
    { pattern: /\bsaturday\b/i, weekday: 6 },
    { pattern: /\bsunday\b/i, weekday: 0 },
  ]

  // Enhanced time detection
  const timePattern = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\b/g
  const timeMatches = [...text.matchAll(timePattern)]

  // Find date
  for (const datePattern of datePatterns) {
    if (datePattern.pattern.test(text)) {
      if (datePattern.offset !== undefined) {
        startDate = new Date()
        startDate.setDate(startDate.getDate() + datePattern.offset)
      } else if (datePattern.weekday !== undefined) {
        startDate = new Date()
        const days = (datePattern.weekday + 7 - startDate.getDay()) % 7
        if (days === 0) days = 7 // Next week if it's the same day
        startDate.setDate(startDate.getDate() + days)
      }
      break
    }
  }

  // Find time
  if (timeMatches.length > 0) {
    const timeMatch = timeMatches[0]
    let hours = parseInt(timeMatch[1])
    const minutes = parseInt(timeMatch[2] || '0')
    const period = timeMatch[3]

    if (period && period.toLowerCase() === 'pm' && hours !== 12) {
      hours += 12
    } else if (period && period.toLowerCase() === 'am' && hours === 12) {
      hours = 0
    }

    startDate.setHours(hours, minutes, 0, 0)
    isEvent = true
  }

  endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

  // Clean up title by removing date/time references
  title = text
    .replace(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm|AM|PM)?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Extract event name from common patterns
  const eventNamePatterns = [
    /(?:appointment|meeting|session)\s+(?:for|with)?\s*(.+)/i,
    /(.+)\s+(?:appointment|meeting|session)/i,
    /(?:schedule|create|add)\s+(.+)/i,
    /(.+)/i // Fallback - use the whole cleaned text
  ]

  for (const pattern of eventNamePatterns) {
    const match = title.match(pattern)
    if (match && match[1] && match[1].trim()) {
      title = match[1].trim()
      break
    }
  }

  if (!title || title.length < 2) {
    title = 'New Event'
  }

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1), // Capitalize first letter
    startDate,
    endDate,
    isEvent,
    timezone: userTimezone || 'America/Chicago',
    description: text
  }
}

// Execute CREATE action
async function executeCreateAction(details, currentEvents, calendarEmail, board, userTimezone) {
  try {
    console.log('🎯 Executing CREATE action with details:', details)

    const eventDetails = parseNaturalEventDetails(details, userTimezone)
    console.log('📅 Parsed event details:', eventDetails)

    // Check for conflicts
    const conflicts = currentEvents.filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date)
      const eventEnd = new Date(event.end.dateTime || event.end.date)
      const newStart = eventDetails.startDate
      const newEnd = eventDetails.endDate

      return (newStart < eventEnd && newEnd > eventStart)
    })

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
      summary: eventDetails.title,
      description: `Created by AI assistant: ${eventDetails.description}`,
      start: {
        dateTime: eventDetails.startDate.toISOString(),
        timeZone: eventDetails.timezone,
      },
      end: {
        dateTime: eventDetails.endDate.toISOString(),
        timeZone: eventDetails.timezone,
      },
      attendees: [{ email: calendarEmail }]
    }

    const calendarResponse = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventData,
    })

    // Create Trello card
    const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_TOKEN)
    const listId = getBoardListId(board)

    const trelloCard = await trello.addCard(
      eventDetails.title,
      `📅 ${eventDetails.startDate.toLocaleString()}\n🔗 ${calendarResponse.data.htmlLink}`,
      listId
    )

    return {
      success: true,
      calendarEvent: calendarResponse.data,
      trelloCard: trelloCard,
      conflicts: conflicts,
      eventDetails: eventDetails
    }

  } catch (error) {
    console.error('❌ CREATE action failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Execute UPDATE action (placeholder for now)
async function executeUpdateAction(details, currentEvents, calendarEmail) {
  console.log('🔄 UPDATE action detected:', details)
  return {
    success: true,
    message: "Update functionality will be implemented next!",
    details: details
  }
}

// Execute DELETE action (placeholder for now)
async function executeDeleteAction(details, currentEvents, calendarEmail) {
  console.log('🗑️ DELETE action detected:', details)
  return {
    success: true,
    message: "Delete functionality will be implemented next!",
    details: details
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

    // Keep the simple LIST fallback for basic queries
    const lowerInput = inputText.toLowerCase()
    const listKeywords = ['when', 'what', 'show', 'list', 'schedule', 'do i have', 'am i', 'where', 'time']
    const isSimpleListQuery = listKeywords.some(keyword => lowerInput.includes(keyword))

    if (isSimpleListQuery) {
      console.log('🔍 Using direct calendar search for:', inputText)

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
        const searchTerms = inputText.toLowerCase().split(' ')
        const matchingEvents = events.filter(event => {
          const title = (event.summary || '').toLowerCase()
          const description = (event.description || '').toLowerCase()
          return searchTerms.some(term => title.includes(term) || description.includes(term))
        })

        if (matchingEvents.length > 0) {
          const eventSummaries = matchingEvents.slice(0, 3).map(event => {
            const date = new Date(event.start.dateTime || event.start.date)
            const formattedDate = date.toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            })
            const formattedTime = date.toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', hour12: true
            })
            return `• ${event.summary} - ${formattedDate} at ${formattedTime}`
          }).join('\n')

          return res.json({
            success: true,
            response: `✅ Found ${matchingEvents.length} matching event(s):\n\n${eventSummaries}`,
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
        console.error('Calendar error:', calError)
        return res.json({
          success: true,
          response: "I had trouble accessing your calendar. Please try again.",
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

    // Call Claude AI with completely natural prompt
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
      throw new Error('Anthropic API key not configured')
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const now = new Date()
    const userNow = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }))
    const currentDate = userNow.toISOString().split('T')[0]
    const currentDateTime = userNow.toISOString()

    const systemPrompt = `You are Claude, a friendly and intelligent AI calendar assistant. You can see the user's calendar and help them manage their schedule naturally.

Today is ${currentDate} and the current time is ${currentDateTime} in ${userTimezone} timezone.

Here are their upcoming calendar events:
${JSON.stringify(currentEvents.slice(0, 8), null, 2)}

You can help with:
• Finding events and answering questions about their schedule
• Creating new events and appointments
• Moving or updating existing events
• Canceling events they no longer need
• Suggesting better scheduling and avoiding conflicts

Just respond naturally as a helpful AI assistant. Be conversational, reference specific events by name, and offer to help with any calendar-related tasks. If you want to take an action like creating, updating, or deleting an event, just say so naturally in your response.

Examples of natural responses:
• "I can see you have pickleball on Thursday at 6 PM. Would you like me to move it to a different time?"
• "I'll create a dentist appointment for you tomorrow at 2 PM. Let me add that to your calendar."
• "I notice you have a conflict with your meeting at 3 PM. Should I reschedule one of them?"

Be helpful, conversational, and proactive in offering calendar assistance.`

    console.log('🤖 Calling Claude with natural prompt')

    const completion = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      temperature: 0.4,
      system: systemPrompt,
      messages: [
        { role: "user", content: inputText }
      ]
    })

    const claudeResponse = completion.content[0].text.trim()
    console.log('🤖 Claude responded naturally:', claudeResponse)

    // Detect if Claude wants to take actions from natural language
    const actions = detectActionsFromResponse(claudeResponse)
    console.log('🎯 Detected actions:', actions)

    // Execute actions if detected
    let actionResults = null

    if (actions.create && actions.details) {
      console.log('🎯 Executing CREATE action...')
      actionResults = await executeCreateAction(
        actions.details,
        currentEvents,
        calendarEmail,
        board,
        userTimezone
      )
    } else if (actions.update && actions.details) {
      console.log('🎯 Executing UPDATE action...')
      actionResults = await executeUpdateAction(actions.details, currentEvents, calendarEmail)
    } else if (actions.delete && actions.details) {
      console.log('🎯 Executing DELETE action...')
      actionResults = await executeDeleteAction(actions.details, currentEvents, calendarEmail)
    }

    // Prepare response
    let response = `✅ ${claudeResponse}`
    let suggestions = ["Ask about your schedule", "Create a new event", "Update an event"]

    // Add action results to response if any
    if (actionResults) {
      if (actionResults.success) {
        if (actionResults.calendarEvent) {
          response += `\n\n📅 Successfully created: "${actionResults.eventDetails.title}"\n🔗 Calendar: ${actionResults.calendarEvent.htmlLink}`

          if (actionResults.conflicts && actionResults.conflicts.length > 0) {
            response += `\n\n⚠️ Note: This overlaps with ${actionResults.conflicts.length} existing event(s).`
          }

          suggestions = ["Create another event", "View your calendar", "Edit this event"]
        } else if (actionResults.message) {
          response += `\n\n${actionResults.message}`
        }
      } else {
        response += `\n\n❌ Sorry, I encountered an issue: ${actionResults.error}`
        suggestions = ["Try again with different details", "View your events"]
      }
    }

    return res.json({
      success: true,
      response: response,
      suggestions: suggestions,
      actionsTaken: actionResults ? Object.keys(actions).filter(key => actions[key] && key !== 'details') : []
    })

  } catch (error) {
    console.error('Error in AI processing:', error)
    console.error('Error stack:', error.stack)

    if (error.message && (error.message.includes('quota') || error.message.includes('billing'))) {
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