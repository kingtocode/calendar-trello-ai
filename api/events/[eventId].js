const { google } = require('googleapis')

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
      const { title, description, startDate, endDate } = req.body

      if (!title || !startDate || !endDate) {
        return res.status(400).json({ error: 'Title, startDate, and endDate are required' })
      }

      const eventData = {
        summary: title,
        description: description || '',
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