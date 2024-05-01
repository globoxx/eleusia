import React, { useEffect, useState } from 'react'
import { io, Socket } from "socket.io-client";
import GameBoard from './components/GameBoard';
import Home from './components/Home'
import { RoomData } from '../server';
import { Alert, Box, Snackbar } from '@mui/material';

const socket: Socket = io()

function App() {
  useEffect(()=>{
    socket.on('connect', () => {
      console.log(socket.id)
      setConnectionError(false)
    });

    socket.on('connect_error', () => {
      setTimeout(() => {
          socket.connect();
      }, 5000);
      setConnectionError(true)
    });

    socket.on('updateRoomData', (roomData: RoomData) => {
      setRoomData(roomData)
    })
  },[])

  const [isInGame, setIsInGame] = useState(false)
  const [pseudo, setPseudo] = useState('')
  const [room, setRoom] = useState('')
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [connectionError, setConnectionError] = useState(false)

  const callbackPseudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {setPseudo(e.target.value)}
  const callbackRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {setRoom(e.target.value)}
  const callbackJoinRoom = (room: string) => {
    setRoom(room)
    setIsInGame(true)
  }
  const callbackLeaveRoom = () => {
    setRoom('')
    setIsInGame(false)
  }

  return (
    <Box padding={2}>
      {isInGame && roomData
        ? <GameBoard socket={socket} pseudo={pseudo} room={room} roomData={roomData} callbackLeaveRoom={callbackLeaveRoom} />
        : <Home socket={socket} callbackPseudoChange={callbackPseudoChange} callbackRoomChange={callbackRoomChange} callbackJoinRoom={callbackJoinRoom} />
      }
      <Snackbar open={connectionError} autoHideDuration={6000} onClose={() => setConnectionError(false)}>
          <Alert onClose={() => setConnectionError(false)} severity="error" sx={{ width: '100%' }}>
              Impossible de se connecter au serveur. Veuillez contacter l'administrateur du jeu.
          </Alert>
      </Snackbar>
    </Box>
  )
}

export default App