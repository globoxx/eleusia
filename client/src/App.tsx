// import packages
import React, { useState } from 'react'
import { io, Socket } from "socket.io-client";
import BoardGame from './components/GameBoard'
import Home from './components/Home'
import {ServerToClientEvents, ClientToServerEvents} from '../../server/server'

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('http://localhost:5000')

// Making the App component
function App() {
  React.useEffect(()=>{
    socket.on('connect', () => console.log(socket.id))
    socket.on('connect_error', () => {
      setTimeout(() => socket.connect(), 5000)
    })
  },[])

  const [isInGame, setIsInGame] = useState(false)

  return (
    <div>
      {isInGame
        ? <BoardGame />
        : <Home socket />
      }
    </div>
  )
}

export default App