const { google } = require('googleapis')
const Trello = require('trello')

// Helper functions
function parseTaskInput(taskDescription, userTimezone = null) {
  const now = new Date()
  let startDate = new Date()
  let endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // Default 1 hour duration
  let isEvent = false

  const timePattern = /(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/gi
  const datePattern = /(today|tomorrow|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|aug\s+\d+|aug\s+\d+,\s+\d+|\d{1,2}\/\d{1,2}|\d{1,2}th|\d{1,2}nd|\d{1,2}rd|\d{1,2}st)/gi
  const meetingPattern = /(meeting|call|appointment|session|interview|standup)/i

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
      const matches = dateStr.match(/aug\s+(\d+)(?:,\s+(\d+))?/)
      if (matches) {
        const day = parseInt(matches[1])
        const year = matches[2] ? parseInt(matches[2]) : new Date().getFullYear()
        startDate = new Date(year, 7, day) // August is month 7 (0-indexed)
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

  // Ensure end date is always after start date
  if (isEvent) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // 1 hour duration for events
  } else {
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
    .replace(/\s+/g, ' ')
    .trim()

  // If title is empty after cleanup, use original
  if (!title) {
    title = taskDescription
  }

  return {
    title,
    description: taskDescription,
    startDate,
    endDate,
    isEvent,
    timezone: userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

function formatDateTimeForCalendar(date, timezone) {
  // Format date to ISO string but maintain the timezone context
  // by creating the date in the specified timezone
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
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
    const { task, calendarEmail, board = process.env.DEFAULT_TRELLO_BOARD, timezone } = req.body

    if (!task) {
      return res.status(400).json({ error: 'Task description is required' })
    }

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

    // Initialize Trello
    const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_TOKEN)

    const parsedTask = parseTaskInput(task, timezone)
    console.log('Parsed task:', parsedTask)

    let calendarEvent = null
    if (parsedTask.isEvent) {
      const eventData = {
        summary: parsedTask.title,
        description: `Task created via AI Assistant: ${parsedTask.description}`,
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
}