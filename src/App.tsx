import React, { useEffect, useState } from 'react'
import { io, Socket } from "socket.io-client";
import GameBoard from './components/GameBoard';
import Home from './components/Home'
import TeacherAuthButton from './components/TeacherAuthButton';
import type { AuthResponse, ClientRoomData, ReconnectRoomPayload, RoomAck, TeacherPublic } from './shared/types';
import { Alert, Box, Snackbar } from '@mui/material';

const socket: Socket = io()
const sessionStorageKey = 'eleusia.session';

interface StoredSession {
  roomId: string;
  pseudo: string;
  participantToken: string;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(sessionStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.roomId === 'string' && typeof parsed.pseudo === 'string' && typeof parsed.participantToken === 'string') {
      return parsed as StoredSession;
    }
  } catch (error) {
    sessionStorage.removeItem(sessionStorageKey);
  }

  return null;
}

function saveStoredSession(session: StoredSession) {
  sessionStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

function clearStoredSession() {
  sessionStorage.removeItem(sessionStorageKey);
}

function App() {
  const [isInGame, setIsInGame] = useState(false)
  const [pseudo, setPseudo] = useState('')
  const [room, setRoom] = useState('')
  const [roomData, setRoomData] = useState<ClientRoomData | null>(null)
  const [connectionError, setConnectionError] = useState(false)
  const [teacher, setTeacher] = useState<TeacherPublic | null>(null)

  useEffect(()=>{
    const tryReconnect = () => {
      const storedSession = readStoredSession();
      if (!storedSession) return;

      const payload: ReconnectRoomPayload = {
        roomId: storedSession.roomId,
        pseudo: storedSession.pseudo,
        participantToken: storedSession.participantToken,
      };

      socket.emit('reconnectRoom', payload, (ack: RoomAck) => {
        if (ack.ok) {
          setPseudo(ack.pseudo);
          setRoom(ack.roomId);
          setIsInGame(true);
          saveStoredSession(ack);
          return;
        }

        clearStoredSession();
        setRoom('');
        setPseudo('');
        setIsInGame(false);
        setRoomData(null);
      });
    };

    const onConnect = () => {
      console.log(socket.id)
      setConnectionError(false)
      tryReconnect();
    };

    const onConnectError = () => {
      setTimeout(() => {
          socket.connect();
      }, 5000);
      setConnectionError(true)
    };

    const onUpdateRoomData = (roomData: ClientRoomData) => {
      setRoomData(roomData)
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('updateRoomData', onUpdateRoomData);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('updateRoomData', onUpdateRoomData);
    };
  },[])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() as Promise<AuthResponse> : null))
      .then((payload) => setTeacher(payload?.teacher ?? null))
      .catch(() => setTeacher(null));
  }, []);

  const callbackPseudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {setPseudo(e.target.value)}
  const callbackRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {setRoom(e.target.value)}
  const callbackJoinRoom = (room: string, nextPseudo: string, participantToken: string) => {
    setRoom(room)
    setPseudo(nextPseudo)
    setIsInGame(true)
    saveStoredSession({ roomId: room, pseudo: nextPseudo, participantToken })
  }
  const callbackLeaveRoom = () => {
    setRoom('')
    setIsInGame(false)
    setRoomData(null)
    clearStoredSession()
  }

  return (
    <Box sx={{ p: 2 }}>
      {isInGame && roomData
        ? <GameBoard socket={socket} pseudo={pseudo} room={room} roomData={roomData} callbackLeaveRoom={callbackLeaveRoom} />
        : <Home socket={socket} teacher={teacher} callbackPseudoChange={callbackPseudoChange} callbackRoomChange={callbackRoomChange} callbackJoinRoom={callbackJoinRoom} />
      }
      <TeacherAuthButton teacher={teacher} onTeacherChange={setTeacher} />
      <Snackbar open={connectionError} autoHideDuration={6000} onClose={() => setConnectionError(false)}>
          <Alert onClose={() => setConnectionError(false)} severity="error" sx={{ width: '100%' }}>
              Impossible de se connecter au serveur. Veuillez contacter l'administrateur du jeu.
          </Alert>
      </Snackbar>
    </Box>
  )
}

export default App
