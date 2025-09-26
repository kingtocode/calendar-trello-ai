const { google } = require('googleapis')
const Trello = require('trello')
const Anthropic = require('@anthropic-ai/sdk')

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

    if (dateStr === 'today') {
      startDate = new Date()
    } else if (dateStr === 'tomorrow') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() + 1)
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
  // Create a timezone-aware formatter to ensure correct time representation
  try {
    // Use Intl.DateTimeFormat to get the correct time in the target timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })

    const parts = formatter.formatToParts(date)
    const year = parts.find(p => p.type === 'year').value
    const month = parts.find(p => p.type === 'month').value
    const day = parts.find(p => p.type === 'day').value
    const hour = parts.find(p => p.type === 'hour').value
    const minute = parts.find(p => p.type === 'minute').value
    const second = parts.find(p => p.type === 'second').value

    return `${year}-${month}-${day}T${hour}:${minute}:${second}`
  } catch (error) {
    // Fallback to original method if timezone is invalid
    console.warn('Timezone formatting failed, using fallback:', error)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
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

async function processWithAI(userInput, currentEvents = []) {
  try {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
      throw new Error('Anthropic API key not configured')
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const systemPrompt = `You are a smart task management AI that helps users with calendar events and Trello cards. Your job is to analyze user input and determine their intent.

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
</instructions>

<response_format>
Respond with ONLY valid JSON in this exact format:

{
  "intent": "CREATE|EDIT|DELETE|LIST",
  "confidence": 0.9,
  "data": {
    "title": "Event title",
    "startDate": "2025-09-26T17:00:00",
    "endDate": "2025-09-26T18:00:00",
    "isEvent": true,
    "description": "Original user input",
    "searchKeywords": ["pickleball", "dentist"],
    "timezone": "America/Los_Angeles"
  },
  "response": "I'll help you with that!",
  "suggestions": ["Consider adding travel time"],
  "conflicts": [],
  "hasConflicts": false
}
</response_format>

IMPORTANT: Return ONLY the JSON response, no other text.`

    const completion = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        { role: "user", content: userInput }
      ]
    })

    let aiResponse
    try {
      aiResponse = JSON.parse(completion.content[0].text)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.log('Raw AI response:', completion.content[0].text)
      // Attempt to detect intent from keywords when JSON parsing fails
      const lowerInput = userInput.toLowerCase()
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
  if (!events || events.length === 0) return null
  if (!keywords || keywords.length === 0) {
    // If no specific keywords, try to find by matching against the full user input
    if (!originalUserInput) return null
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

  // Return the highest scoring event if it has a reasonable score
  const bestMatch = scoredEvents.sort((a, b) => b.score - a.score)[0]
  return bestMatch && bestMatch.score > 0 ? bestMatch.event : null
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
    const eventToEdit = findEventByKeywords(currentEvents, aiResult.data.searchKeywords, userInput)

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
      const timezone = aiResult.data.timezone || 'America/New_York'
      updateData.start = {
        dateTime: formatDateTimeForCalendar(new Date(aiResult.data.startDate), timezone),
        timeZone: timezone
      }

      // Calculate new end time (maintain duration or use provided end time)
      let endTime
      if (aiResult.data.endDate) {
        endTime = new Date(aiResult.data.endDate)
      } else {
        // Maintain 1-hour duration
        endTime = new Date(new Date(aiResult.data.startDate).getTime() + 60 * 60 * 1000)
      }

      updateData.end = {
        dateTime: formatDateTimeForCalendar(endTime, timezone),
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
          dateTime: formatDateTimeForCalendar(new Date(taskData.startDate), taskData.timezone),
          timeZone: taskData.timezone,
        },
        end: {
          dateTime: formatDateTimeForCalendar(new Date(taskData.endDate), taskData.timezone),
          timeZone: taskData.timezone,
        },
        attendees: [
          { email: calendarEmail }
        ]
      }

      const calendarResponse = await calendar.events.insert({
        calendarId: 'primary',
        resource: eventData,
      })

      calendarEvent = calendarResponse.data
    }

    const listId = getBoardListId(board)
    if (!listId) {
      return res.status(400).json({ error: `Board '${board}' not configured. Check your environment variables.` })
    }

    const trelloCard = await trello.addCard(
      taskData.title,
      `${taskData.isEvent ? `📅 Scheduled for: ${new Date(taskData.startDate).toLocaleString()}` : '📝 Task created using AI'}\n\n${calendarEvent ? `🔗 Calendar Event: ${calendarEvent.htmlLink}` : ''}\n\n📋 Board: ${board}`,
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

    // Process with AI
    const aiResult = await processWithAI(inputText, currentEvents)
    console.log('AI Result:', aiResult)

    // Handle different intents
    switch (aiResult.intent) {
      case 'CREATE':
        return await handleCreateTask(aiResult, calendarEmail, board, res)
      case 'EDIT':
        return await handleEditEvent(aiResult, calendarEmail, currentEvents, res, inputText)
      case 'DELETE':
      case 'LIST':
        // For now, return a simple response for these intents
        return res.json({
          success: true,
          response: aiResult.response + " (DELETE and LIST features coming soon!)",
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
    res.status(500).json({
      error: 'Failed to process command',
      details: error.message
    })
  }
}