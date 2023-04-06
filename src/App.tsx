import React, { useEffect, useState } from 'react'
import { io, Socket } from "socket.io-client";
import GameBoard from './components/GameBoard';
import Home from './components/Home'
import { RoomData } from '../server';
import { Box } from '@mui/material';

const socket: Socket = io()

function App() {
  useEffect(()=>{
    socket.on('connect', () => console.log(socket.id))
    socket.on('connect_error', () => {
      setTimeout(() => socket.connect(), 5000)
    })

    socket.on('updateRoomData', (roomData: RoomData) => {
      setRoomData(roomData)
    })
  },[])

  const [isInGame, setIsInGame] = useState(false)
  const [pseudo, setPseudo] = useState('')
  const [room, setRoom] = useState('')
  const [roomData, setRoomData] = useState<RoomData | null>(null)

  const callbackPseudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {setPseudo(e.target.value)}
  const callbackRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {setRoom(e.target.value)}
  const callbackJoinRoom = (room: string) => {
    setRoom(room)
    setIsInGame(true)
  }

  return (
    <Box padding={2}>
      {isInGame && roomData
        ? <GameBoard socket={socket} pseudo={pseudo} room={room} roomData={roomData} />
        : <Home socket={socket} callbackPseudoChange={callbackPseudoChange} callbackRoomChange={callbackRoomChange} callbackJoinRoom={callbackJoinRoom} />
      }
    </Box>
  )
}

export default App