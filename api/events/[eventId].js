const { google } = require('googleapis')

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

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Get eventId from query parameters (Vercel dynamic routing)
  const { eventId } = req.query

  if (!eventId) {
    return res.status(400).json({ error: 'Event ID is required' })
  }

  try {
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

    // Handle PUT request (update event)
    if (req.method === 'PUT') {
      const { title, description, startDate, endDate, timezone } = req.body

      if (!title || !startDate || !endDate) {
        return res.status(400).json({ error: 'Title, startDate, and endDate are required' })
      }

      // Use provided timezone, app default, or detect from browser
      const eventTimezone = timezone || process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone

      const eventData = {
        summary: title,
        description: description || '',
        start: {
          dateTime: formatDateTimeForCalendar(new Date(startDate), eventTimezone),
          timeZone: eventTimezone,
        },
        end: {
          dateTime: formatDateTimeForCalendar(new Date(endDate), eventTimezone),
          timeZone: eventTimezone,
        }
      }

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: eventData,
      })

      return res.json({
        success: true,
        event: {
          id: response.data.id,
          htmlLink: response.data.htmlLink,
          summary: response.data.summary,
          description: response.data.description,
          start: response.data.start,
          end: response.data.end
        }
      })
    }

    // Handle DELETE request (delete event)
    if (req.method === 'DELETE') {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      })

      return res.json({
        success: true,
        message: 'Event deleted successfully',
        eventId: eventId
      })
    }

    // Method not allowed
    return res.status(405).json({ error: `Method ${req.method} not allowed` })

  } catch (error) {
    console.error(`Error ${req.method.toLowerCase()}ing event:`, error)

    // Handle specific Google Calendar errors
    if (error.code === 404) {
      return res.status(404).json({ error: 'Event not found' })
    }

    if (error.code === 403) {
      return res.status(403).json({ error: 'Permission denied' })
    }

    return res.status(500).json({
      error: `Failed to ${req.method.toLowerCase()} event`,
      details: error.message
    })
  }
}