// import packages
import React, { useState } from 'react'
import { io, Socket } from "socket.io-client";
import BoardGame from './components/GameBoard'
import Home from './components/Home'

const socket: Socket = io('http://localhost:5000')

// Making the App component
function App() {
  React.useEffect(()=>{
    socket.on('connect', () => console.log(socket.id))
    socket.on('connect_error', () => {
      setTimeout(() => socket.connect(), 5000)
    })
  },[])

  const [isInGame, setIsInGame] = useState(false)
  const [pseudo, setPseudo] = useState('')
  const [room, setRoom] = useState('')

  const callbackPseudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {setPseudo(e.target.value)}
  const callbackRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {setRoom(e.target.value)}

  return (
    <div>
      {isInGame
        ? <BoardGame socket={socket} pseudo={pseudo} room={room} />
        : <Home socket={socket} callbackPseudoChange={callbackPseudoChange} callbackRoomChange={callbackRoomChange} />
      }
    </div>
  )
}

export default App