// import packages
import React, { useEffect, useState } from 'react'
import { io, Socket } from "socket.io-client";
import GameBoard from './components/GameBoard';
import Home from './components/Home'

const socket: Socket = io('http://localhost:5000')

// Making the App component
function App() {
  useEffect(()=>{
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
  const callbackJoinRoom = (room: string) => {
    setRoom(room)
    setIsInGame(true)
  }

  return (
    <div>
      {isInGame
        ? <GameBoard socket={socket} pseudo={pseudo} room={room} />
        : <Home socket={socket} callbackPseudoChange={callbackPseudoChange} callbackRoomChange={callbackRoomChange} callbackJoinRoom={callbackJoinRoom} />
      }
    </div>
  )
}

export default App