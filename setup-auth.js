import { google } from 'googleapis'
import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3002/auth/callback'
)

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
]

app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })
  
  console.log('Visit this URL to authorize the application:')
  console.log(authUrl)
  res.redirect(authUrl)
})

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query
  
  try {
    const { tokens } = await oauth2Client.getToken(code)
    
    console.log('\n=== Add these to your .env file ===')
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log('=====================================\n')
    
    res.send(`
      <h2>Authorization successful!</h2>
      <p>Your refresh token has been logged to the console.</p>
      <p>Copy the GOOGLE_REFRESH_TOKEN value to your .env file.</p>
      <p>You can now close this window and stop the auth server.</p>
    `)
  } catch (error) {
    console.error('Error getting tokens:', error)
    res.status(500).send('Error during authentication')
  }
})

const port = 3002
app.listen(port, () => {
  console.log(`\n🔐 Google Auth Helper running on http://localhost:${port}`)
  console.log(`📝 Make sure your Google OAuth redirect URI includes: http://localhost:${port}/auth/callback`)
  console.log(`🌐 Visit: http://localhost:${port}/auth to start authorization`)
  console.log(`\n⚠️  Make sure you have GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file\n`)
})