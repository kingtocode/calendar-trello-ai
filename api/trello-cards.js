const Trello = require('trello')

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    if (!process.env.TRELLO_API_KEY || !process.env.TRELLO_TOKEN) {
      return res.status(500).json({ error: 'Trello API credentials not configured' })
    }

    const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_TOKEN)

    // Handle DELETE request (delete card)
    if (req.method === 'DELETE') {
      const { cardId } = req.query

      if (!cardId) {
        return res.status(400).json({ error: 'Card ID is required for deletion' })
      }

      console.log('Deleting Trello card:', cardId)

      await trello.deleteCard(cardId)

      return res.json({
        success: true,
        message: 'Trello card deleted successfully',
        cardId: cardId
      })
    }

    // Handle GET request (fetch cards)
    const { board = process.env.DEFAULT_TRELLO_BOARD || 'kings', limit = 20 } = req.query
    const listId = getBoardListId(board)

    if (!listId) {
      return res.status(400).json({ error: `Board '${board}' not configured. Check your environment variables.` })
    }

    console.log('Fetching Trello cards from list:', listId, 'for board:', board)

    // Get cards from the specific list
    const cards = await trello.getCardsOnList(listId)

    // Format cards for frontend
    const formattedCards = cards.slice(0, parseInt(limit)).map(card => ({
      id: card.id,
      name: card.name,
      desc: card.desc || '',
      url: card.url,
      dateLastActivity: card.dateLastActivity,
      due: card.due,
      labels: card.labels || [],
      board: board,
      listName: card.list?.name || 'Unknown List'
    }))

    console.log(`Found ${formattedCards.length} cards for board ${board}`)

    res.json({
      success: true,
      cards: formattedCards,
      board: board,
      count: formattedCards.length
    })

  } catch (error) {
    console.error('Error fetching Trello cards:', error)
    res.status(500).json({
      error: 'Failed to fetch Trello cards',
      details: error.message
    })
  }
}