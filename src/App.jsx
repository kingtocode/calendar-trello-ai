import React, { useState, useRef, useEffect } from 'react'
import EventsList from './EventsList'

function App() {
  const [task, setTask] = useState('')
  const [selectedBoard, setSelectedBoard] = useState('kings')
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [aiMode, setAiMode] = useState(false) // Default to Simple mode to save AI tokens
  // Suggestions now integrated into natural AI responses
  const [currentDateTime, setCurrentDateTime] = useState('')
  const recognitionRef = useRef(null)

  const boards = [
    { value: 'kings', label: '👑 Kings Board', emoji: '👑' },
    { value: 'personal', label: '🏠 Personal', emoji: '🏠' },
    { value: 'work', label: '💼 Work', emoji: '💼' },
    { value: 'project', label: '🚀 Project', emoji: '🚀' }
  ]

  // Update current date/time on component mount and every minute
  const updateDateTime = () => {
    const now = new Date()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: timezone
    })
    setCurrentDateTime(formatter.format(now))
  }

  useEffect(() => {
    updateDateTime()
    const interval = setInterval(updateDateTime, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setStatus('Speech recognition not supported in this browser')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognitionRef.current = new SpeechRecognition()
    
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = false
    recognitionRef.current.lang = 'en-US'

    recognitionRef.current.onstart = () => {
      setIsListening(true)
      setStatus('Listening...')
    }

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setTask(transcript)
      setIsListening(false)
      setStatus('Voice input captured')
    }

    recognitionRef.current.onerror = (event) => {
      setIsListening(false)
      setStatus(`Speech recognition error: ${event.error}`)
    }

    recognitionRef.current.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current.start()
  }

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!task.trim()) {
      setStatus('Please enter a task')
      return
    }

    setIsProcessing(true)
    // Clear any previous status
    setStatus('')

    try {
      if (aiMode) {
        setStatus('🤖 AI processing your request...')
        
        const response = await fetch('/api/process-command', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userInput: task.trim(),
            calendarEmail: 'vincent2king8@gmail.com',
            board: selectedBoard,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }),
        })

        const result = await response.json()

        if (response.ok) {
          if (result.response) {
            setStatus(`🤖 ${result.response}`)
            
            // Check if it's a quota error and suggest switching to Simple mode
            if (result.quotaError) {
              setTimeout(() => {
                if (confirm('Switch to Simple Mode now? This will work without AI but with basic task creation.')) {
                  setAiMode(false)
                  setStatus('📝 Switched to Simple Mode - you can create tasks without AI enhancement')
                }
              }, 2000)
            }
          }
          // Natural conversation mode - no separate suggestions needed
          // Suggestions are now integrated into Claude's natural response
          // In natural conversation mode, conflicts are included in Claude's response
          // No need for separate conflict handling
          if (!result.quotaError) {
            setTask('')
          }
        } else {
          setStatus(`❌ AI Error: ${result.error}`)
        }
      } else {
        setStatus('Processing task...')
        
        const response = await fetch('/api/create-task', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            task: task.trim(),
            calendarEmail: 'vincent2king8@gmail.com',
            board: selectedBoard,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }),
        })

        const result = await response.json()

        if (response.ok) {
          const boardEmoji = boards.find(b => b.value === selectedBoard)?.emoji || '📋'
          setStatus(`✅ Task created successfully! Calendar event and Trello card added to ${boardEmoji} ${boards.find(b => b.value === selectedBoard)?.label || selectedBoard}.`)
          setTask('')
        } else {
          setStatus(`❌ Error: ${result.error}`)
        }
      }
    } catch (error) {
      setStatus(`❌ Network error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusClass = () => {
    if (status.includes('✅')) return 'success'
    if (status.includes('❌')) return 'error'
    if (isProcessing) return 'processing'
    return ''
  }

  return (
    <div className="app">
      <div className="header">
        <h1 className="title">AI Task Whisperer</h1>
        <p className="subtitle">
          Create calendar events and Trello cards with voice or text
          <span className={`current-mode ${aiMode ? 'ai-mode' : 'simple-mode'}`}>
            {aiMode ? ' • AI Mode Active' : ' • Simple Mode Active'}
          </span>
        </p>
        {currentDateTime && (
          <div className="current-datetime">
            🕐 {currentDateTime}
          </div>
        )}
        <div className="header-buttons">
          <button
            onClick={() => setAiMode(!aiMode)}
            className={`ai-mode-btn ${aiMode ? 'ai-active' : ''}`}
          >
            {aiMode ? '📝 Switch to Simple Mode' : '🤖 Switch to AI Mode'}
          </button>
          <button 
            onClick={() => setShowEvents(!showEvents)}
            className="toggle-events-btn"
          >
            {showEvents ? 'Board' : '📅 View Events'}
          </button>
        </div>
      </div>

      {!showEvents ? (
        <form onSubmit={handleSubmit}>
          <div className="input-section">
          <div className="board-selector">
            <label htmlFor="board-select">Choose Trello Board:</label>
            <select 
              id="board-select" 
              value={selectedBoard} 
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="board-select"
              disabled={isProcessing}
            >
              {boards.map(board => (
                <option key={board.value} value={board.value}>
                  {board.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="input-container">
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder={aiMode ? "Say anything (e.g., 'Move my dentist appointment to Friday' or 'What's my schedule tomorrow?')" : "Describe your task (e.g., 'Meeting with John tomorrow at 2 PM')"}
              className="task-input"
              disabled={isProcessing}
            />
            <button
              type="button"
              onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
              className={`voice-button ${isListening ? 'listening' : ''}`}
              disabled={isProcessing}
            >
              {isListening ? '🛑 Stop' : '🎤 Voice'}
            </button>
          </div>
          
          <button
            type="submit"
            className="submit-button"
            disabled={isProcessing || !task.trim()}
          >
            {isProcessing ? (aiMode ? '🤖 AI Processing...' : 'Processing...') : (aiMode ? '🤖 Ask AI' : 'Create Task')}
          </button>
        </div>

        {/* Simple Mode Disclaimer */}
        {!aiMode && (
          <div className="simple-mode-notice">
            💡 <strong>Simple Mode Active</strong> - Basic task creation without AI to save tokens.
            For intelligent editing, switch to AI Mode above or edit existing events via <strong>📅 View Events → Edit</strong>.
          </div>
        )}
        </form>
      ) : (
        <EventsList />
      )}

      {!showEvents && status && (
        <div className={`status ${getStatusClass()}`}>
          {status}
        </div>
      )}

      {/* Suggestions are now integrated into Claude's natural conversation responses */}

      <div className="examples">
        <h3>Try saying something like:</h3>
        <ul>
          {aiMode ? (
            <>
              <li>"Move my dentist appointment to Friday"</li>
              <li>"What's my schedule for tomorrow?"</li>
              <li>"Cancel my yoga class this week"</li>
              <li>"Find time for grocery shopping"</li>
              <li>"Reschedule pickle ball to Thursday evening"</li>
            </>
          ) : (
            <>
              <li>"Dentist appointment next Tuesday at 2 PM"</li>
              <li>"Call mom this Sunday afternoon"</li>
              <li>"Grocery shopping tomorrow morning"</li>
              <li>"Yoga class on Friday at 6 PM"</li>
              <li>"Pickle ball on Tuesday night, invite friends"</li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}

export default App