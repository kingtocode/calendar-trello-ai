const { google } = require('googleapis')
const Trello = require('trello')
const Anthropic = require('@anthropic-ai/sdk')
const { DateTime } = require('luxon')

// Proper timezone-aware date formatting using Luxon
function formatDateTimeWithLuxon(dateString, timezone) {
  try {
    console.log('🚀 LUXON formatDateTime:')
    console.log('- Input dateString:', dateString)
    console.log('- Target timezone:', timezone)

    // Parse the date string as being in the user's timezone
    let dt = DateTime.fromISO(dateString, { zone: timezone })

    // If parsing failed, try without timezone assumption
    if (!dt.isValid) {
      console.log('- Trying to parse as local time in timezone')
      dt = DateTime.fromISO(dateString).setZone(timezone)
    }

    if (!dt.isValid) {
      throw new Error(`Invalid date: ${dateString}`)
    }

    // Format for Google Calendar API (ISO string without timezone)
    const formatted = dt.toFormat("yyyy-MM-dd'T'HH:mm:ss")
    console.log('- Luxon formatted:', formatted)
    console.log('- DateTime object:', dt.toString())

    return formatted
  } catch (error) {
    console.error('Luxon formatting failed:', error)
    // Fallback to simple parsing
    return new Date(dateString).toISOString().slice(0, 19)
  }
}

// Helper function to parse AI dates in user timezone
function parseAIDateInUserTimezone(dateString, userTimezone) {
  // Claude AI returns dates like "2024-09-26T17:00:00" (no timezone info)
  // We need to interpret this as the user's timezone, not UTC
  try {
    console.log('🐛 PARSING AI DATE:')
    console.log('- AI date string:', dateString)
    console.log('- User timezone:', userTimezone)

    // If the date already has timezone info, use it as-is
    if (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-')) {
      console.log('- Date has timezone info, using as-is')
      return new Date(dateString)
    }

    // Otherwise, treat it as a local time in the user's timezone
    // Parse the components manually
    const [datePart, timePart] = dateString.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hours, minutes, seconds = 0] = timePart ? timePart.split(':').map(Number) : [0, 0, 0]

    // Create date in user's timezone
    const dateInUserTZ = new Date()
    dateInUserTZ.setFullYear(year)
    dateInUserTZ.setMonth(month - 1) // Month is 0-indexed
    dateInUserTZ.setDate(day)
    dateInUserTZ.setHours(hours)
    dateInUserTZ.setMinutes(minutes)
    dateInUserTZ.setSeconds(seconds)
    dateInUserTZ.setMilliseconds(0)

    console.log('- Parsed date:', dateInUserTZ.toString())
    console.log('- Local time string:', dateInUserTZ.toLocaleString())

    return dateInUserTZ
  } catch (error) {
    console.error('Error parsing AI date:', error)
    // Fallback to regular date parsing
    return new Date(dateString)
  }
}

// Helper functions (same as create-task.js)
function parseTaskInput(taskDescription, userTimezone = null) {
  const now = new Date()
  let startDate = new Date()
  let endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
  let isEvent = false

  // Detect explicit timezone mentions in the text
  const timezoneMap = {
    'cst': 'America/Chicago',
    'cdt': 'America/Chicago',
    'central': 'America/Chicago',
    'est': 'America/New_York',
    'edt': 'America/New_York',
    'eastern': 'America/New_York',
    'pst': 'America/Los_Angeles',
    'pdt': 'America/Los_Angeles',
    'pacific': 'America/Los_Angeles',
    'mst': 'America/Denver',
    'mdt': 'America/Denver',
    'mountain': 'America/Denver'
  }

  let detectedTimezone = userTimezone
  const lowerInput = taskDescription.toLowerCase()
  for (const [abbr, tz] of Object.entries(timezoneMap)) {
    if (lowerInput.includes(abbr)) {
      detectedTimezone = tz
      break
    }
  }

  const timePattern = /(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/gi
  const datePattern = /(today|tomorrow|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|aug\s+\d+|aug\s+\d+,\s+\d+|\d{1,2}\/\d{1,2}|\d{1,2}th|\d{1,2}nd|\d{1,2}rd|\d{1,2}st)/gi
  const meetingPattern = /(meeting|call|appointment|session|interview|standup)/i

  if (meetingPattern.test(taskDescription)) {
    isEvent = true
  }

  const timeMatch = taskDescription.match(timePattern)
  const dateMatch = taskDescription.match(datePattern)

  if (dateMatch) {
    const dateStr = dateMatch[0].toLowerCase()

    console.log('🐛 DATE DEBUG - Processing date:')
    console.log('- dateStr:', dateStr)
    console.log('- Current date:', new Date().toString())
    console.log('- Current date getDate():', new Date().getDate())

    if (dateStr === 'today') {
      startDate = new Date()
    } else if (dateStr === 'tomorrow') {
      startDate = new Date()
      console.log('- Before setDate:', startDate.toString())
      startDate.setDate(startDate.getDate() + 1)
      console.log('- After setDate:', startDate.toString())
    } else if (dateStr.includes('aug')) {
      const matches = dateStr.match(/aug\s+(\d+)(?:,\s+(\d+))?/)
      if (matches) {
        const day = parseInt(matches[1])
        const year = matches[2] ? parseInt(matches[2]) : new Date().getFullYear()
        startDate = new Date(year, 7, day)
      }
    }
  }

  if (timeMatch) {
    const timeStr = timeMatch[0]
    const [, hours, minutes = '00', period] = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/i) || []

    let hour = parseInt(hours)
    if (period && period.toLowerCase() === 'pm' && hour !== 12) {
      hour += 12
    } else if (period && period.toLowerCase() === 'am' && hour === 12) {
      hour = 0
    }

    startDate.setHours(hour, parseInt(minutes), 0, 0)
    isEvent = true
  }

  if (isEvent) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
  } else {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
  }

  if (endDate <= startDate) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
  }

  let title = taskDescription
    .replace(/\b(today|tomorrow|after work|this (morning|afternoon|evening|weekend))\b/gi, '')
    .replace(/at \d{1,2}:?\d{0,2}\s*(AM|PM|am|pm)?(\s+(CDT|CST|EDT|EST|PST|PDT))?/gi, '')
    .replace(/on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, '')
    .replace(/on (aug|august)\s+\d+,?\s*\d*/gi, '')
    .replace(/\bnext\s+(week|month|year)\b/gi, '')
    .replace(/set alert.*?minutes/gi, '')
    .replace(/remind.*?before.*?minutes/gi, '')
    .replace(/\s+/g, ' ')
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
    timezone: detectedTimezone || userTimezone || process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

function formatDateTimeForCalendar(date, timezone) {
  // Try a different approach: convert to UTC properly
  try {
    console.log('🐛 DEBUG formatDateTimeForCalendar:')
    console.log('- Input date:', date)
    console.log('- Input timezone:', timezone)
    console.log('- Date toString():', date.toString())
    console.log('- Date toISOString():', date.toISOString())

    // Method 1: Simple format (what we were doing)
    const simpleFormat = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`

    console.log('- Simple format:', simpleFormat)

    return simpleFormat
  } catch (error) {
    console.warn('Timezone formatting failed:', error)
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

async function processWithAI(userInput, currentEvents = [], userTimezone = 'America/Chicago') {
  try {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
      throw new Error('Anthropic API key not configured')
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Get current date context for AI - use USER's timezone, not server timezone
    const now = new Date()
    const userNow = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }))
    const currentDate = userNow.toISOString().split('T')[0] // YYYY-MM-DD format
    const currentDateTime = userNow.toISOString()

    console.log('🐛 DATE CONTEXT DEBUG:')
    console.log('- Server time (UTC):', now.toISOString())
    console.log('- User timezone:', userTimezone)
    console.log('- User local time:', userNow.toISOString())
    console.log('- Sending to Claude - currentDate:', currentDate)
    console.log('- Sending to Claude - currentDateTime:', currentDateTime)

    const systemPrompt = `You are a smart task management AI that helps users with calendar events and Trello cards. Your job is to analyze user input and determine their intent.

<current_context>
CURRENT DATE: ${currentDate}
CURRENT DATETIME: ${currentDateTime}
USER TIMEZONE: ${userTimezone} - USE THIS TIMEZONE FOR ALL DATE/TIME OPERATIONS
</current_context>

<capabilities>
CREATE: Make new events/tasks
EDIT: Modify existing events
DELETE: Remove events
LIST: Show/filter events
</capabilities>

<current_events>
${JSON.stringify(currentEvents.slice(0, 10), null, 2)}
</current_events>

<instructions>
1. INTENT DETECTION:
   - CREATE: "schedule", "add", "create", "new", "book", "plan"
   - EDIT: "edit", "change", "move", "reschedule", "update", "modify", "shift"
   - DELETE: "delete", "remove", "cancel", "drop"
   - LIST: "show", "list", "what's", "schedule for", "events"

2. For EDIT/DELETE: Extract keywords from existing event titles to match them
3. For CREATE: Parse dates, times, and determine if it's a timed event
4. Check for scheduling conflicts with existing events
5. Provide helpful, contextual suggestions

IMPORTANT DATE PARSING:
- Use the CURRENT_DATE context above to calculate relative dates
- "today" = ${currentDate}
- "tomorrow" = day after ${currentDate}
- Always return dates in YYYY-MM-DDTHH:mm:ss format
- Don't assume dates - use the current context provided
- CRITICAL: ALWAYS use timezone: "${userTimezone}" - DO NOT use Pacific or any other timezone!
</instructions>

<response_format>
For LIST queries (questions about existing events):
- Respond naturally in conversational language
- Search through the current_events and answer the user's question directly
- Example: "You have pickleball on Tuesday at 6 PM and Thursday at 7 PM this week."
- Be helpful and specific about what you find

For CREATE/EDIT/DELETE operations:
- Respond with valid JSON in this format:
{
  "intent": "CREATE|EDIT|DELETE",
  "confidence": 0.9,
  "data": {
    "title": "Event title",
    "startDate": "2025-09-26T17:00:00",
    "endDate": "2025-09-26T18:00:00",
    "isEvent": true,
    "description": "Original user input",
    "searchKeywords": ["pickleball", "dentist"],
    "timezone": "America/Chicago"
  },
  "response": "I'll help you with that!",
  "suggestions": ["Consider adding travel time"],
  "conflicts": [],
  "hasConflicts": false
}
</response_format>

IMPORTANT:
- For LIST queries: Respond in natural language directly
- For CREATE/EDIT/DELETE: Return ONLY JSON, no other text`

    console.log('🤖 Calling Anthropic API with input:', userInput)

    let completion
    try {
      completion = await anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          { role: "user", content: userInput }
        ]
      })
      console.log('🤖 Anthropic API response received')
    } catch (apiError) {
      console.error('🤖 Anthropic API error:', apiError)
      return res.status(500).json({
        error: 'AI service error',
        details: apiError.message,
        type: 'anthropic_api_error'
      })
    }

    const rawResponse = completion.content[0].text.trim()
    console.log('🤖 Raw response:', rawResponse)
    let aiResponse

    // Check if this is a LIST query with natural language response
    const lowerInput = userInput.toLowerCase()
    const listKeywords = ['when', 'what', 'show', 'list', 'schedule', 'do i have', 'am i', 'where', 'time']
    const isLikelyListQuery = listKeywords.some(keyword => lowerInput.includes(keyword))

    // Try to parse as JSON first
    try {
      aiResponse = JSON.parse(rawResponse)
    } catch (parseError) {
      console.log('Not JSON, checking if natural language response:', rawResponse)

      // If it's likely a LIST query and not JSON, treat as natural language response
      if (isLikelyListQuery && !rawResponse.startsWith('{')) {
        console.log('Detected natural language LIST response')
        return res.json({
          success: true,
          response: rawResponse,
          intent: 'LIST',
          events: currentEvents,
          suggestions: ["Create a new event", "View all events", "Edit an event"]
        })
      }

      // Otherwise, handle as parse error
      console.error('JSON parse error:', parseError)
      console.log('Raw AI response:', rawResponse)

      const editKeywords = ['edit', 'change', 'move', 'reschedule', 'update', 'modify']
      const isEditIntent = editKeywords.some(keyword => lowerInput.includes(keyword))

      if (isEditIntent) {
        aiResponse = {
          intent: "ERROR",
          confidence: 0.0,
          data: {},
          response: "⚠️ I detected you want to edit an event, but AI processing failed. Please try again or switch to Simple mode.",
          suggestions: ["Try again in a few seconds", "Switch to Simple mode", "Create a new event instead"],
          conflicts: [],
          hasConflicts: false,
          parseError: true
        }
      } else {
        aiResponse = {
          intent: "CREATE",
          confidence: 0.5,
          data: parseTaskInput(userInput, timezone),
          response: "I'll create that task for you!",
          suggestions: [],
          conflicts: [],
          hasConflicts: false
        }
      }
    }
    return aiResponse
  } catch (error) {
    console.error('AI processing error:', error)

    if (error.message && (error.message.includes('quota') || error.message.includes('billing') || error.message.includes('exceeded'))) {
      return {
        intent: "ERROR",
        confidence: 0.0,
        data: {},
        response: "⚠️ AI quota limit reached. Please check your Anthropic account billing or switch to Simple mode for basic task creation without AI enhancement.",
        suggestions: ["Switch to Simple mode", "Check Anthropic billing at console.anthropic.com"],
        conflicts: [],
        hasConflicts: false,
        quotaError: true
      }
    }

    // Attempt to detect intent from keywords when AI fails
    const lowerInput = userInput.toLowerCase()
    const editKeywords = ['edit', 'change', 'move', 'reschedule', 'update', 'modify']
    const isEditIntent = editKeywords.some(keyword => lowerInput.includes(keyword))

    if (isEditIntent) {
      return {
        intent: "ERROR",
        confidence: 0.0,
        data: {},
        response: "⚠️ I detected you want to edit an event, but AI processing failed. Editing requires AI functionality. Please check your Anthropic account or try creating a new event instead.",
        suggestions: ["Check Anthropic billing at console.anthropic.com", "Switch to Simple mode", "Create a new event instead"],
        conflicts: [],
        hasConflicts: false,
        aiError: true
      }
    }

    return {
      intent: "CREATE",
      confidence: 0.5,
      data: parseTaskInput(userInput, timezone),
      response: "I'll create that task for you!",
      suggestions: [],
      conflicts: [],
      hasConflicts: false
    }
  }
}

function findEventByKeywords(events, keywords, originalUserInput = '') {
  if (!events || events.length === 0) return { event: null, multipleMatches: [] }
  if (!keywords || keywords.length === 0) {
    // If no specific keywords, try to find by matching against the full user input
    if (!originalUserInput) return { event: null, multipleMatches: [] }
    const inputWords = originalUserInput.toLowerCase().split(' ').filter(word => word.length > 2)
    keywords = inputWords
  }

  // Enhanced matching logic
  const searchTerms = keywords.map(k => k.toLowerCase())

  // Score each event based on keyword matches
  const scoredEvents = events.map(event => {
    const title = (event.title || '').toLowerCase()
    const description = (event.description || '').toLowerCase()

    let score = 0

    // Exact phrase match gets highest score
    searchTerms.forEach(term => {
      if (title.includes(term)) score += 5
      if (description.includes(term)) score += 2
    })

    // Partial word matches
    const titleWords = title.split(' ')
    const descWords = description.split(' ')

    searchTerms.forEach(term => {
      titleWords.forEach(word => {
        if (word.includes(term) || term.includes(word)) score += 2
      })
      descWords.forEach(word => {
        if (word.includes(term) || term.includes(word)) score += 1
      })
    })

    return { event, score }
  })

  // Filter events with reasonable scores
  const goodMatches = scoredEvents.filter(match => match.score > 0).sort((a, b) => b.score - a.score)

  if (goodMatches.length === 0) {
    return { event: null, multipleMatches: [] }
  }

  if (goodMatches.length === 1) {
    return { event: goodMatches[0].event, multipleMatches: [] }
  }

  // Check if there are multiple events with the same high score
  const topScore = goodMatches[0].score
  const topMatches = goodMatches.filter(match => match.score === topScore)

  if (topMatches.length > 1) {
    // Multiple events with same score - ask for clarification
    return {
      event: null,
      multipleMatches: topMatches.map(m => m.event)
    }
  }

  // Single clear winner
  return { event: goodMatches[0].event, multipleMatches: [] }
}

async function handleEditEvent(aiResult, calendarEmail, currentEvents, res, userInput = '') {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Find the event to edit based on search keywords and original user input
    const findResult = findEventByKeywords(currentEvents, aiResult.data.searchKeywords, userInput)

    if (findResult.multipleMatches.length > 0) {
      // Multiple events found - ask user to be more specific
      const eventList = findResult.multipleMatches.map(event => {
        const startTime = new Date(event.start?.dateTime || event.start?.date).toLocaleString()
        return `• "${event.title}" (${startTime})`
      }).join('\n')

      return res.json({
        success: false,
        response: `🤔 I found multiple events matching "${aiResult.data.searchKeywords?.join(' ') || 'your search'}":\n\n${eventList}\n\nPlease be more specific about which event you want to edit.`,
        suggestions: [
          "Include the date/time in your request",
          "Use more specific keywords",
          "Say something like 'edit dinner plan on Friday'"
        ]
      })
    }

    const eventToEdit = findResult.event
    if (!eventToEdit) {
      return res.json({
        success: false,
        response: "I couldn't find the event you want to edit. Please be more specific or check if the event exists.",
        suggestions: ["Try using more specific keywords", "Check your calendar for the exact event name"]
      })
    }

    // Prepare update data
    const updateData = {}

    // Update title if provided
    if (aiResult.data.title && aiResult.data.title !== eventToEdit.title) {
      updateData.summary = aiResult.data.title
    }

    // Update time if provided
    if (aiResult.data.startDate) {
      const timezone = aiResult.data.timezone || userTimezone || 'America/Chicago'
      updateData.start = {
        dateTime: formatDateTimeWithLuxon(aiResult.data.startDate, timezone),
        timeZone: timezone
      }

      // Calculate new end time (maintain duration or use provided end time)
      let endTime
      if (aiResult.data.endDate) {
        endTime = aiResult.data.endDate
      } else {
        // Maintain 1-hour duration using Luxon
        const startDt = DateTime.fromISO(aiResult.data.startDate, { zone: timezone })
        const endDt = startDt.plus({ hours: 1 })
        endTime = endDt.toISO({ includeOffset: false }).slice(0, 19)
      }

      updateData.end = {
        dateTime: formatDateTimeWithLuxon(endTime, timezone),
        timeZone: timezone
      }
    }

    // Add any other changes from AI result
    if (aiResult.data.changes) {
      Object.assign(updateData, aiResult.data.changes)
    }

    // Update the event
    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventToEdit.id,
      resource: updateData
    })

    return res.json({
      success: true,
      response: aiResult.response || `✅ Successfully updated "${eventToEdit.title}"`,
      suggestions: aiResult.suggestions || [],
      updatedEvent: {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        summary: response.data.summary
      }
    })

  } catch (error) {
    console.error('Error editing event:', error)
    return res.status(500).json({
      error: 'Failed to edit event',
      details: error.message
    })
  }
}

async function handleCreateTask(aiResult, calendarEmail, board, res) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_TOKEN)

    const taskData = aiResult.data
    let calendarEvent = null

    if (taskData.isEvent) {
      const eventData = {
        summary: taskData.title,
        description: `Task created using AI`,
        start: {
          dateTime: formatDateTimeWithLuxon(taskData.startDate, taskData.timezone),
          timeZone: taskData.timezone,
        },
        end: {
          dateTime: formatDateTimeWithLuxon(taskData.endDate, taskData.timezone),
          timeZone: taskData.timezone,
        },
        attendees: [
          { email: calendarEmail }
        ]
      }

      // DEBUG: Log exact data being sent to Google Calendar
      console.log('🐛 TIMEZONE DEBUG - Sending to Google Calendar:')
      console.log('- User input:', userInput)
      console.log('- Original startDate:', taskData.startDate)
      console.log('- Original timezone:', taskData.timezone)
      console.log('- Formatted start dateTime:', eventData.start.dateTime)
      console.log('- Formatted start timeZone:', eventData.start.timeZone)
      console.log('- Full eventData:', JSON.stringify(eventData, null, 2))

      const calendarResponse = await calendar.events.insert({
        calendarId: 'primary',
        resource: eventData,
      })

      calendarEvent = calendarResponse.data

      // DEBUG: Log what Google Calendar returned
      console.log('🐛 TIMEZONE DEBUG - Google Calendar returned:')
      console.log('- Event ID:', calendarEvent.id)
      console.log('- Start:', calendarEvent.start)
      console.log('- End:', calendarEvent.end)
      console.log('- HTML Link:', calendarEvent.htmlLink)
    }

    const listId = getBoardListId(board)
    if (!listId) {
      return res.status(400).json({ error: `Board '${board}' not configured. Check your environment variables.` })
    }

    const trelloCard = await trello.addCard(
      taskData.title,
      `${taskData.isEvent ? `📅 Scheduled for: ${DateTime.fromISO(taskData.startDate, { zone: taskData.timezone }).toLocaleString(DateTime.DATETIME_MED)}` : '📝 Task created using AI'}\n\n${calendarEvent ? `🔗 Calendar Event: ${calendarEvent.htmlLink}` : ''}\n\n📋 Board: ${board}`,
      listId
    )

    return res.json({
      success: true,
      response: aiResult.response,
      suggestions: aiResult.suggestions,
      conflicts: aiResult.conflicts,
      hasConflicts: aiResult.hasConflicts,
      quotaError: aiResult.quotaError,
      calendarEvent: calendarEvent ? {
        id: calendarEvent.id,
        htmlLink: calendarEvent.htmlLink,
        summary: calendarEvent.summary
      } : null,
      trelloCard: {
        id: trelloCard.id,
        url: trelloCard.url,
        name: trelloCard.name
      }
    })

  } catch (error) {
    console.error('Error creating task:', error)
    return res.status(500).json({
      error: 'Failed to create task',
      details: error.message
    })
  }
}

async function handleListEvents(aiResult, currentEvents, res) {
  try {
    console.log('🔍 Handling LIST intent with AI result:', aiResult)

    // If AI provided a specific response about the events, use it
    if (aiResult.response && !aiResult.response.includes('coming soon')) {
      return res.json({
        success: true,
        response: aiResult.response,
        events: currentEvents,
        suggestions: aiResult.suggestions
      })
    }

    // Fallback: provide a generic response with event list
    const eventCount = currentEvents?.length || 0
    let response = `Found ${eventCount} upcoming events.`

    if (eventCount > 0) {
      const eventSummaries = currentEvents.slice(0, 5).map(event => {
        const date = new Date(event.start).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
        const time = new Date(event.start).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit'
        })
        return `• ${event.title} - ${date} at ${time}`
      }).join('\n')

      response += `\n\nUpcoming events:\n${eventSummaries}`

      if (eventCount > 5) {
        response += `\n... and ${eventCount - 5} more events.`
      }
    } else {
      response = "No upcoming events found in your calendar."
    }

    return res.json({
      success: true,
      response: response,
      events: currentEvents,
      suggestions: aiResult.suggestions || ["Create a new event", "View all events"]
    })

  } catch (error) {
    console.error('Error handling list events:', error)
    return res.status(500).json({
      error: 'Failed to list events',
      details: error.message
    })
  }
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

    // Check if this looks like a simple LIST query - handle without AI
    const lowerInput = inputText.toLowerCase()
    const listKeywords = ['when', 'what', 'show', 'list', 'schedule', 'do i have', 'am i', 'where', 'time']
    const isSimpleListQuery = listKeywords.some(keyword => lowerInput.includes(keyword))

    if (isSimpleListQuery) {
      console.log('🔍 Detected simple LIST query, handling without AI:', inputText)

      // Get current events for fallback response
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

        // Simple search through events
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
            return `• ${event.summary} - ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`
          }).join('\n')

          return res.json({
            success: true,
            response: `Found ${matchingEvents.length} matching event(s):\n\n${eventSummaries}`,
            intent: 'LIST',
            events: matchingEvents,
            suggestions: ["Create a new event", "View all events"]
          })
        } else {
          return res.json({
            success: true,
            response: "No matching events found in your calendar.",
            intent: 'LIST',
            events: [],
            suggestions: ["Create a new event", "View all events"]
          })
        }
      } catch (calError) {
        console.error('Calendar error in fallback:', calError)
        return res.json({
          success: true,
          response: "I had trouble accessing your calendar events. Please try again or create a new event.",
          intent: 'LIST',
          events: [],
          suggestions: ["Create a new event", "Try again"]
        })
      }
    }

    // Initialize Google Calendar for getting current events
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Get current events for AI context
    const eventsResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const currentEvents = eventsResponse.data.items.map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date
    }))

    // Process with AI - pass user's timezone for proper date context
    const aiResult = await processWithAI(inputText, currentEvents, timezone)
    console.log('🐛 CLAUDE AI RESULT:')
    console.log('- Intent:', aiResult.intent)
    console.log('- Start Date:', aiResult.data?.startDate)
    console.log('- End Date:', aiResult.data?.endDate)
    console.log('- Timezone:', aiResult.data?.timezone)
    console.log('- Full AI Result:', JSON.stringify(aiResult, null, 2))

    // Handle different intents
    switch (aiResult.intent) {
      case 'CREATE':
        return await handleCreateTask(aiResult, calendarEmail, board, res)
      case 'EDIT':
        return await handleEditEvent(aiResult, calendarEmail, currentEvents, res, inputText)
      case 'LIST':
        return await handleListEvents(aiResult, currentEvents, res)
      case 'DELETE':
        // For now, return a simple response for delete intent
        return res.json({
          success: true,
          response: aiResult.response + " (DELETE feature coming soon!)",
          suggestions: aiResult.suggestions
        })
      default:
        return res.json({
          success: true,
          response: aiResult.response,
          suggestions: aiResult.suggestions,
          quotaError: aiResult.quotaError
        })
    }
  } catch (error) {
    console.error('Error processing command:', error)
    console.error('Error stack:', error.stack)
    console.error('User input was:', inputText)
    res.status(500).json({
      error: 'Failed to process command',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}