import Trello from 'trello'
import dotenv from 'dotenv'

dotenv.config()

const trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_TOKEN)

async function getBoards() {
  try {
    console.log('🔍 Fetching your Trello boards and lists...\n')
    
    // Get all boards
    const boards = await trello.getBoards('me')
    
    for (const board of boards) {
      console.log(`📋 Board: ${board.name}`)
      console.log(`   ID: ${board.id}`)
      
      try {
        const lists = await trello.getListsOnBoard(board.id)
        console.log('   Lists:')
        
        lists.forEach(list => {
          console.log(`   • ${list.name} (ID: ${list.id})`)
        })
        
      } catch (listError) {
        console.log('   ❌ Could not fetch lists for this board')
      }
      
      console.log('') // Empty line between boards
    }
    
    console.log('\n📝 Copy the List IDs you want to use for each board type in your .env file')
    console.log('💡 Tip: Look for lists like "To Do", "Backlog", or similar where you want new cards created')
    
  } catch (error) {
    console.error('❌ Error fetching boards:', error.message)
  }
}

getBoards()