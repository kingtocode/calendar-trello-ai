import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { google } from 'googleapis'
import Trello from 'trello'
import OpenAI from 'openai'

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

// Enhanced CORS configuration for remote access
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)
    
    // Allow any origin in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true)
    }
    
    // In production, you'd add your domain here
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://your-domain.com' // Replace with your actual domain
    ]
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}

app.use(cors(corsOptions))
app.use(express.json())

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function processWithAI(userInput, currentEvents = []) {
  try {
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured')
    }
    const systemPrompt = `You are an AI assistant for a personal task management app that creates calendar events and Trello cards. Analyze natural language input and determine user intent.

CAPABILITIES: CREATE, EDIT, DELETE, LIST events/tasks

CURRENT EVENTS: ${JSON.stringify(currentEvents.slice(0, 10))}

INSTRUCTIONS:
- For CREATE: Extract title, dates, determine if it's an event (has time) or task
- For EDIT: Match events by keywords, specify changes needed  
- For DELETE: Find events by keywords for removal
- For LIST: Filter and summarize events
- Check for time conflicts with existing events
- Provide helpful suggestions

REQUIRED JSON RESPONSE FORMAT:
{
  "intent": "CREATE|EDIT|DELETE|LIST",
  "confidence": 0.8,
  "data": {
    "title": "Clean task title",
    "startDate": "2025-08-25T14:00:00.000Z",
    "endDate": "2025-08-25T15:00:00.000Z", 
    "isEvent": true,
    "description": "Original user input",
    "searchKeywords": ["for", "edit", "delete"],
    "changes": {"reminders": {"useDefault": false, "overrides": [{"method": "email", "minutes": 120}]}}
  },
  "response": "I'll create that appointment for you!",
  "suggestions": ["Add 15 min buffer before next meeting"],
  "conflicts": ["Overlaps with existing meeting at 2 PM"],
  "hasConflicts": false
}

RESPOND WITH ONLY VALID JSON - NO OTHER TEXT.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    })

    let aiResponse
    try {
      aiResponse = JSON.parse(completion.choices[0].message.content)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.log('Raw AI response:', completion.choices[0].message.content)
      // Create a fallback response if JSON parsing fails
      aiResponse = {
        intent: "CREATE",
        confidence: 0.5,
        data: parseTaskInput(userInput),
        response: "I'll create that task for you!",
        suggestions: [],
        conflicts: [],
        hasConflicts: false
      }
    }
    return aiResponse
  } catch (error) {
    console.error('AI processing error:', error)
    
    // Check if it's a quota/billing error
    if (error.message && (error.message.includes('quota') || error.message.includes('billing') || error.message.includes('exceeded'))) {
      return {
        intent: "ERROR",
        confidence: 0.0,
        data: {},
        response: "⚠️ AI quota limit reached. Please add billing to your OpenAI account or switch to Simple mode for basic task creation without AI enhancement.",
        suggestions: ["Switch to Simple mode", "Add OpenAI billing at platform.openai.com"],
        conflicts: [],
        hasConflicts: false,
        quotaError: true
      }
    }
    
    // Check for different command types
    const editPattern = /^(edit|change|modify|update|add|set)\b/i
    const deletePattern = /\b(delete|remove|cancel|archive|find.*delete|find.*remove)\b/i
    
    if (deletePattern.test(userInput)) {
      // Extract keywords for finding the event to delete
      const keywords = userInput
        .replace(/\b(find|the|event|called|and|delete|it|from|calendar|remove|card|fro|trello|board|if|exists?|archive|cancel)\b/gi, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !word.match(/^\d+$/))
        .slice(0, 4)
      
      console.log('Delete command detected, searching for keywords:', keywords)
      
      return {
        intent: "DELETE",
        confidence: 0.8,
        data: {
          searchKeywords: keywords
        },
        response: `I'll try to delete the event matching those keywords!`,
        suggestions: [`Looking for event with keywords: ${keywords.join(', ')}`],
        conflicts: [],
        hasConflicts: false
      }
    } else if (editPattern.test(userInput)) {
      // Extract keywords for finding the event  
      const keywords = userInput
        .replace(/\b(edit|change|modify|update|add|set|the|to|on|end|ends?|event|appointment|meeting|task|reminder|notification|aug|august|\d+|\d{4})\b/gi, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !word.match(/^\d+$/))
        .slice(0, 3)
      
      console.log('Edit command detected, searching for keywords:', keywords)
      
      return {
        intent: "EDIT",
        confidence: 0.7,
        data: {
          searchKeywords: keywords,
          changes: userInput.includes('end') ? {
            // If "end" mentioned, try to update end time
            description: `Updated: ${userInput}`
          } : {
            reminders: {
              useDefault: false,
              overrides: [{ method: "email", minutes: 120 }]
            }
          }
        },
        response: userInput.includes('end') ? `I'll try to update the end time for your event!` : `I'll try to add a 2-hour reminder to your event!`,
        suggestions: [`Looking for event with keywords: ${keywords.join(', ')}`],
        conflicts: [],
        hasConflicts: false
      }
    }
    
    // Fallback to basic parsing
    return {
      intent: "CREATE",
      confidence: 0.5,
      data: parseTaskInput(userInput),
      response: "I'll create that task for you!",
      suggestions: [],
      conflicts: [],
      hasConflicts: false
    }
  }
}

function parseTaskInput(taskDescription) {
  const now = new Date()
  let startDate = new Date()
  let endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // Default 1 hour duration
  let isEvent = false

  const timePattern = /(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/gi
  const datePattern = /(today|tomorrow|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|aug\s+\d+|aug\s+\d+,\s+\d+|\d{1,2}\/\d{1,2}|\d{1,2}th|\d{1,2}nd|\d{1,2}rd|\d{1,2}st)/gi
  const meetingPattern = /(meeting|call|appointment|session|interview|standup)/i
  const reminderPattern = /(set alert|remind|reminder|alert).*?(\d+)\s*(minutes?|mins?|hours?)\s*(before|prior)/gi
  
  if (meetingPattern.test(taskDescription)) {
    isEvent = true
  }

  // Enhanced date parsing
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
      // Handle "Aug 24, 2025" format
      const matches = dateStr.match(/aug\s+(\d+)(?:,\s+(\d+))?/)
      if (matches) {
        const day = parseInt(matches[1])
        const year = matches[2] ? parseInt(matches[2]) : new Date().getFullYear()
        startDate = new Date(year, 7, day) // August is month 7 (0-indexed)
      }
    } else if (dateStr.includes('next')) {
      const dayName = dateStr.replace('next ', '')
      startDate = getNextWeekday(dayName)
    } else if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(dateStr)) {
      startDate = getNextWeekday(dateStr)
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

  // Ensure end date is always after start date
  if (isEvent) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // 1 hour duration for events
  } else {
    // For tasks, set end date to same day but later time, or next day if no time specified
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // Default 1 hour later
  }
  
  // Safety check: if end is before start, fix it
  if (endDate <= startDate) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
  }

  // Create cleaner title by extracting the main action/event
  let title = taskDescription
  
  // Remove common time/date/reminder phrases for cleaner title
  title = title
    .replace(/\b(today|tomorrow|after work|this (morning|afternoon|evening|weekend))\b/gi, '')
    .replace(/at \d{1,2}:?\d{0,2}\s*(AM|PM|am|pm)?(\s+(CDT|CST|EDT|EST|PST|PDT))?/gi, '')
    .replace(/on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, '')
    .replace(/on (aug|august)\s+\d+,?\s*\d*/gi, '')
    .replace(/\bnext\s+(week|month|year)\b/gi, '')
    .replace(/set alert.*?minutes/gi, '')
    .replace(/remind.*?before.*?minutes/gi, '')
    .replace(/,\s*set alert.*$/gi, '')
    .replace(/,\s*remind.*$/gi, '')
    .replace(/^\s*(go to|visit)\s+/i, '') // Remove "go to" prefix
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '') // Remove leading/trailing commas and spaces
    .replace(/^./, c => c.toUpperCase()) // Capitalize first letter

  // Limit title length and ensure it's meaningful
  if (title.length > 50) {
    title = title.substring(0, 47) + '...'
  }
  
  if (!title.trim()) {
    title = 'New Task'
  }

  return {
    title,
    startDate,
    endDate,
    isEvent,
    description: taskDescription
  }
}

function getNextWeekday(dayName) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const targetDay = days.indexOf(dayName.toLowerCase())
  const today = new Date()
  const currentDay = today.getDay()
  
  let daysToAdd = targetDay - currentDay
  if (daysToAdd <= 0) {
    daysToAdd += 7
  }
  
  const nextDate = new Date(today)
  nextDate.setDate(today.getDate() + daysToAdd)
  return nextDate
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

// AI Intent Handlers
async function handleCreateTask(aiResult, calendarEmail, board, res) {
  const taskData = aiResult.data
  
  let calendarEvent = null
  if (taskData.isEvent) {
    const eventData = {
      summary: taskData.title,
      description: `Task created via AI Assistant: ${taskData.description}`,
      start: {
        dateTime: taskData.startDate,
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: taskData.endDate,
        timeZone: 'America/New_York',
      },
      attendees: [{ email: calendarEmail }]
    }

    const calendarResponse = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventData,
    })
    
    calendarEvent = calendarResponse.data
  }

  // Create Trello card
  const listId = getBoardListId(board)
  if (listId) {
    const trelloCard = await trello.addCard(
      taskData.title,
      `${taskData.description}\n\n${taskData.isEvent ? `📅 Scheduled for: ${new Date(taskData.startDate).toLocaleString()}` : '📝 Task created via AI Assistant'}\n\n${calendarEvent ? `🔗 Calendar Event: ${calendarEvent.htmlLink}` : ''}\n\n📋 Board: ${board}`,
      listId
    )
  }

  return res.json({
    success: true,
    response: aiResult.response,
    calendarEvent: calendarEvent ? {
      id: calendarEvent.id,
      htmlLink: calendarEvent.htmlLink,
      summary: calendarEvent.summary
    } : null,
    suggestions: aiResult.suggestions
  })
}

async function handleEditTask(aiResult, currentEvents, res) {
  try {
    const { searchKeywords, changes } = aiResult.data
    
    // Find matching event by keywords
    const matchingEvent = currentEvents.find(event => {
      if (!event.title) return false
      const title = event.title.toLowerCase()
      return searchKeywords.some(keyword => title.includes(keyword.toLowerCase()))
    })

    if (!matchingEvent) {
      return res.json({
        success: false,
        response: "I couldn't find an event matching those keywords. Could you be more specific?",
        suggestions: [`Available events: ${currentEvents.map(e => e.title).join(', ')}`]
      })
    }

    console.log('Editing event:', matchingEvent.title, 'ID:', matchingEvent.id)

    // Get the full event details first
    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: matchingEvent.id,
    })

    // Merge the changes with existing event data to preserve required fields
    const updatedEvent = {
      ...existingEvent.data,
      ...changes,
    }

    // Update the calendar event
    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: matchingEvent.id,
      resource: updatedEvent,
    })

    return res.json({
      success: true,
      response: aiResult.response,
      event: {
        id: response.data.id,
        summary: response.data.summary
      },
      suggestions: aiResult.suggestions
    })
  } catch (error) {
    console.error('Error editing task:', error)
    return res.status(500).json({ 
      error: 'Failed to edit event',
      response: aiResult.response,
      details: error.message
    })
  }
}

async function handleDeleteTask(aiResult, currentEvents, res) {
  try {
    const { searchKeywords } = aiResult.data
    
    // Find matching event by keywords
    const matchingEvent = currentEvents.find(event => {
      if (!event.title) return false
      const title = event.title.toLowerCase()
      return searchKeywords.some(keyword => title.includes(keyword.toLowerCase()))
    })

    if (!matchingEvent) {
      return res.json({
        success: false,
        response: "I couldn't find an event matching those keywords. Could you be more specific?",
        suggestions: [`Available events: ${currentEvents.map(e => e.title).join(', ')}`]
      })
    }

    console.log('Deleting event:', matchingEvent.title, 'ID:', matchingEvent.id)

    // Delete the calendar event
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: matchingEvent.id,
    })

    // Search for matching Trello cards
    let trelloResponse = ""
    try {
      const boards = ['kings', 'personal', 'work', 'project']
      const matchingCards = []
      
      for (const board of boards) {
        const listId = process.env[`TRELLO_${board.toUpperCase()}_BOARD_LIST_ID`]
        if (!listId || listId.includes('your_')) continue
        
        try {
          const cards = await trello.get(`/1/lists/${listId}/cards`)
          
          const matching = cards.filter(card => {
            if (!card.name) return false
            const cardName = card.name.toLowerCase()
            return searchKeywords.some(keyword => cardName.includes(keyword.toLowerCase()))
          })
          
          matchingCards.push(...matching.map(card => ({...card, board})))
        } catch (err) {
          console.log(`Could not search ${board} board:`, err.message)
        }
      }

      if (matchingCards.length > 0) {
        // For now, just inform about the cards - could add confirmation later
        const cardNames = matchingCards.map(card => `"${card.name}" (${card.board} board)`).join(', ')
        trelloResponse = ` Found ${matchingCards.length} matching Trello card(s): ${cardNames}. These were not archived - please archive them manually if needed.`
      }
    } catch (error) {
      console.log('Error searching Trello cards:', error.message)
    }

    return res.json({
      success: true,
      response: `Successfully deleted "${matchingEvent.title}" from your calendar!${trelloResponse}`,
      suggestions: aiResult.suggestions
    })
  } catch (error) {
    console.error('Error deleting task:', error)
    return res.status(500).json({ 
      error: 'Failed to delete event',
      response: aiResult.response,
      details: error.message
    })
  }
}

async function handleListTasks(aiResult, currentEvents, res) {
  return res.json({
    success: true,
    response: aiResult.response,
    events: currentEvents,
    suggestions: aiResult.suggestions
  })
}

// AI-powered task processing endpoint
app.post('/api/process-command', async (req, res) => {
  try {
    const { userInput, command, calendarEmail, board = process.env.DEFAULT_TRELLO_BOARD } = req.body
    const inputText = userInput || command
    
    if (!inputText) {
      return res.status(400).json({ error: 'User input is required' })
    }

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
        return await handleEditTask(aiResult, currentEvents, res)
      case 'DELETE':
        return await handleDeleteTask(aiResult, currentEvents, res)
      case 'LIST':
        return await handleListTasks(aiResult, currentEvents, res)
      default:
        return res.json({
          success: true,
          response: aiResult.response,
          suggestions: aiResult.suggestions
        })
    }
  } catch (error) {
    console.error('Error processing command:', error)
    res.status(500).json({ 
      error: 'Failed to process command',
      details: error.message 
    })
  }
})

app.post('/api/create-task', async (req, res) => {
  try {
    const { task, calendarEmail, board = process.env.DEFAULT_TRELLO_BOARD } = req.body
    
    if (!task) {
      return res.status(400).json({ error: 'Task description is required' })
    }

    const parsedTask = parseTaskInput(task)
    console.log('Parsed task:', parsedTask)

    let calendarEvent = null
    if (parsedTask.isEvent) {
      const eventData = {
        summary: parsedTask.title,
        description: `Task created via AI Assistant: ${parsedTask.description}`,
        start: {
          dateTime: parsedTask.startDate.toISOString(),
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: parsedTask.endDate.toISOString(),
          timeZone: 'America/New_York',
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
      console.log('Calendar event created:', calendarEvent.id)
    }

    const listId = getBoardListId(board)
    if (!listId) {
      return res.status(400).json({ error: `Board '${board}' not configured. Check your .env file.` })
    }

    const trelloCard = await trello.addCard(
      parsedTask.title,
      `${parsedTask.description}\n\n${parsedTask.isEvent ? `📅 Scheduled for: ${parsedTask.startDate.toLocaleString()}` : '📝 Task created via AI Assistant'}\n\n${calendarEvent ? `🔗 Calendar Event: ${calendarEvent.htmlLink}` : ''}\n\n📋 Board: ${board}`,
      listId
    )

    console.log('Trello card created:', trelloCard.id)

    res.json({
      success: true,
      calendarEvent: calendarEvent ? {
        id: calendarEvent.id,
        htmlLink: calendarEvent.htmlLink,
        summary: calendarEvent.summary
      } : null,
      trelloCard: {
        id: trelloCard.id,
        url: trelloCard.url,
        name: trelloCard.name
      },
      parsedTask
    })

  } catch (error) {
    console.error('Error creating task:', error)
    res.status(500).json({ 
      error: 'Failed to create task',
      details: error.message 
    })
  }
})

// Get upcoming events
app.get('/api/events', async (req, res) => {
  try {
    const { limit = 10 } = req.query
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: parseInt(limit),
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items.map(event => ({
      id: event.id,
      title: event.summary,
      description: event.description,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      htmlLink: event.htmlLink
    }))

    res.json({ events })
  } catch (error) {
    console.error('Error fetching events:', error)
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

// Update an existing event
app.put('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params
    const { title, description, startDate, endDate } = req.body

    const eventData = {
      summary: title,
      description: description,
      start: {
        dateTime: new Date(startDate).toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: new Date(endDate).toISOString(),
        timeZone: 'America/New_York',
      }
    }

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: eventData,
    })

    res.json({
      success: true,
      event: {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        summary: response.data.summary
      }
    })
  } catch (error) {
    console.error('Error updating event:', error)
    res.status(500).json({ error: 'Failed to update event' })
  }
})

// Delete an event
app.delete('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    })

    res.json({ success: true, message: 'Event deleted successfully' })
  } catch (error) {
    console.error('Error deleting event:', error)
    res.status(500).json({ error: 'Failed to delete event' })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`)
  console.log(`📅 Calendar integration: ${process.env.GOOGLE_CLIENT_ID ? 'Configured' : 'Not configured'}`)
  console.log(`📋 Trello integration: ${process.env.TRELLO_API_KEY ? 'Configured' : 'Not configured'}`)
})