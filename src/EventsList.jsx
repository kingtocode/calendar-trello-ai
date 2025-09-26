import React, { useState, useEffect } from 'react'

function EventsList() {
  const [events, setEvents] = useState([])
  const [trelloCards, setTrelloCards] = useState([])
  const [selectedBoard, setSelectedBoard] = useState('kings')
  const [activeTab, setActiveTab] = useState('calendar')
  const [loading, setLoading] = useState(true)
  const [editingEvent, setEditingEvent] = useState(null)
  const [status, setStatus] = useState('')

  const boards = [
    { value: 'kings', label: '👑 Kings Board', emoji: '👑' },
    { value: 'personal', label: '🏠 Personal', emoji: '🏠' },
    { value: 'work', label: '💼 Work', emoji: '💼' },
    { value: 'project', label: '🚀 Project', emoji: '🚀' }
  ]

  useEffect(() => {
    fetchEvents()
    fetchTrelloCards()
  }, [selectedBoard])

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events?limit=20')
      const data = await response.json()
      setEvents(data.events || [])
    } catch (error) {
      setStatus('❌ Error loading events')
    }
  }

  const fetchTrelloCards = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/trello-cards?board=${selectedBoard}&limit=20`)
      const data = await response.json()
      setTrelloCards(data.cards || [])
    } catch (error) {
      setStatus('❌ Error loading Trello cards')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCard = async (cardId, cardName) => {
    if (!confirm(`Are you sure you want to delete "${cardName}"?`)) {
      return
    }

    try {
      setStatus('🗑️ Deleting card...')
      const response = await fetch(`/api/trello-cards?cardId=${cardId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setStatus('✅ Card deleted successfully')
        // Remove the card from local state
        setTrelloCards(prevCards => prevCards.filter(card => card.id !== cardId))
      } else {
        setStatus(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setStatus('❌ Error deleting card')
    }
  }

  const handleEdit = (event) => {
    // Convert to local time for datetime-local input
    const startDate = new Date(event.start)
    const endDate = new Date(event.end)

    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatForInput = (date) => {
      const offset = date.getTimezoneOffset() * 60000 // offset in milliseconds
      const localISOTime = new Date(date.getTime() - offset).toISOString()
      return localISOTime.slice(0, 16)
    }

    setEditingEvent({
      ...event,
      startDate: formatForInput(startDate),
      endDate: formatForInput(endDate)
    })
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingEvent.title,
          description: editingEvent.description,
          startDate: editingEvent.startDate,
          endDate: editingEvent.endDate,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      })

      if (response.ok) {
        setStatus('✅ Event updated successfully!')
        setEditingEvent(null)
        fetchEvents()
      } else {
        setStatus('❌ Failed to update event')
      }
    } catch (error) {
      setStatus('❌ Error updating event')
    }
  }

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setStatus('✅ Event deleted successfully!')
        fetchEvents()
      } else {
        setStatus('❌ Failed to delete event')
      }
    } catch (error) {
      setStatus('❌ Error deleting event')
    }
  }

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return <div className="events-loading">Loading events...</div>
  }

  return (
    <div className="events-container">
      <div className="events-header">
        <h2 className="events-title">📅 Calendar & 📋 Trello</h2>

        {/* Tab Navigation */}
        <div className="tab-nav">
          <button
            className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            📅 Calendar Events ({events.length})
          </button>
          <button
            className={`tab ${activeTab === 'trello' ? 'active' : ''}`}
            onClick={() => setActiveTab('trello')}
          >
            📋 Trello Cards ({trelloCards.length})
          </button>
        </div>

        {/* Board Selector for Trello */}
        {activeTab === 'trello' && (
          <div className="board-selector">
            <label>Trello Board:</label>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="board-select"
            >
              {boards.map(board => (
                <option key={board.value} value={board.value}>
                  {board.emoji} {board.label.replace(board.emoji + ' ', '')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {status && (
        <div className={`status ${status.includes('✅') ? 'success' : 'error'}`}>
          {status}
        </div>
      )}

      {/* Calendar Events Tab */}
      {activeTab === 'calendar' && (
        <>
          {events.length === 0 ? (
            <div className="no-events">No upcoming events found.</div>
          ) : (
            <div className="events-list">
              {events.map(event => (
            <div key={event.id} className="event-card">
              <div className="event-header">
                <h3 className="event-title">{event.title}</h3>
                <div className="event-actions">
                  <button 
                    onClick={() => handleEdit(event)}
                    className="btn-edit"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(event.id)}
                    className="btn-delete"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
              
              <div className="event-details">
                <div className="event-time">
                  🕒 {formatDateTime(event.start)}
                </div>
                {event.description && (
                  <div className="event-description">{event.description}</div>
                )}
                <a 
                  href={event.htmlLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="event-link"
                >
                  📅 Open in Google Calendar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Trello Cards Tab */}
      {activeTab === 'trello' && (
        <>
          {trelloCards.length === 0 ? (
            <div className="no-events">No Trello cards found on this board.</div>
          ) : (
            <div className="events-list">
              {trelloCards.map(card => (
                <div key={card.id} className="event-card trello-card">
                  <div className="event-header">
                    <h3 className="event-title">{card.name}</h3>
                    <div className="event-actions">
                      <a
                        href={card.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-edit"
                      >
                        🔗 Open in Trello
                      </a>
                      <button
                        onClick={() => handleDeleteCard(card.id, card.name)}
                        className="btn-delete"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  <div className="event-details">
                    {card.desc && (
                      <p className="card-description">{card.desc}</p>
                    )}

                    <div className="card-meta">
                      <span className="card-board">{boards.find(b => b.value === card.board)?.emoji} {card.board}</span>

                      {card.due && (
                        <span className="card-due">📅 Due: {new Date(card.due).toLocaleDateString()}</span>
                      )}

                      {card.labels && card.labels.length > 0 && (
                        <div className="card-labels">
                          {card.labels.map(label => (
                            <span
                              key={label.id}
                              className="card-label"
                              style={{ backgroundColor: label.color }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <span className="card-activity">
                        Last updated: {new Date(card.dateLastActivity).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editingEvent && (
        <div className="edit-modal">
          <div className="edit-form">
            <h3>Edit Event</h3>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Title:</label>
                <input
                  type="text"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({
                    ...editingEvent,
                    title: e.target.value
                  })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Start Date & Time:</label>
                <input
                  type="datetime-local"
                  value={editingEvent.startDate}
                  onChange={(e) => setEditingEvent({
                    ...editingEvent,
                    startDate: e.target.value
                  })}
                  required
                />
              </div>

              <div className="form-group">
                <label>End Date & Time:</label>
                <input
                  type="datetime-local"
                  value={editingEvent.endDate}
                  onChange={(e) => setEditingEvent({
                    ...editingEvent,
                    endDate: e.target.value
                  })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description:</label>
                <textarea
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({
                    ...editingEvent,
                    description: e.target.value
                  })}
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-save">
                  💾 Save Changes
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingEvent(null)}
                  className="btn-cancel"
                >
                  ❌ Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventsList