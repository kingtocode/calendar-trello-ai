import React, { useState, useRef } from 'react'
import EventsList from './EventsList'

function App() {
  const [task, setTask] = useState('')
  const [selectedBoard, setSelectedBoard] = useState('kings')
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [aiMode, setAiMode] = useState(true)
  const [suggestions, setSuggestions] = useState([])
  const recognitionRef = useRef(null)

  const boards = [
    { value: 'kings', label: '👑 Kings Board', emoji: '👑' },
    { value: 'personal', label: '🏠 Personal', emoji: '🏠' },
    { value: 'work', label: '💼 Work', emoji: '💼' },
    { value: 'project', label: '🚀 Project', emoji: '🚀' }
  ]

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
    setSuggestions([])

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
            board: selectedBoard
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
          if (result.suggestions && result.suggestions.length > 0) {
            setSuggestions(result.suggestions)
          }
          if (result.hasConflicts && result.conflicts) {
            const conflictSuggestions = result.conflicts.map(conflict => `⚠️ ${conflict}`)
            setSuggestions(prev => [...conflictSuggestions, ...prev])
          }
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
            board: selectedBoard
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
        </form>
      ) : (
        <EventsList />
      )}

      {!showEvents && status && (
        <div className={`status ${getStatusClass()}`}>
          {status}
        </div>
      )}

      {!showEvents && suggestions.length > 0 && (
        <div className="suggestions">
          <h4>💡 AI Suggestions:</h4>
          <ul>
            {suggestions.map((suggestion, index) => (
              <li 
                key={index} 
                className={`suggestion-item ${suggestion.startsWith('⚠️') ? 'conflict-warning' : ''}`}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

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