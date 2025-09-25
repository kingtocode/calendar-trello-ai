import React, { useState, useEffect } from 'react'

function EventsList() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingEvent, setEditingEvent] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/events?limit=20')
      const data = await response.json()
      setEvents(data.events || [])
    } catch (error) {
      setStatus('❌ Error loading events')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (event) => {
    setEditingEvent({
      ...event,
      startDate: new Date(event.start).toISOString().slice(0, 16),
      endDate: new Date(event.end).toISOString().slice(0, 16)
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
          endDate: editingEvent.endDate
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
        <h2 className="events-title">📅 Upcoming Events</h2>
      </div>
      
      {status && (
        <div className={`status ${status.includes('✅') ? 'success' : 'error'}`}>
          {status}
        </div>
      )}

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