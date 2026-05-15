import React, { useEffect, useState } from 'react'
import { io, Socket } from "socket.io-client";
import GameBoard from './components/GameBoard';
import Home from './components/Home'
import TeacherAuthButton from './components/TeacherAuthButton';
import type { AuthResponse, ClientRoomData, ReconnectCreatorPayload, ReconnectRoomPayload, RoomAck, TeacherPublic } from './shared/types';
import { Alert, Box, Snackbar } from '@mui/material';

const socket: Socket = io()
const sessionStorageKey = 'eleusia.session';

type StoredSession =
  | {
      role: 'player';
      roomId: string;
      pseudo: string;
      participantToken: string;
    }
  | {
      role: 'creator';
      roomId: string;
      creatorToken: string;
    };

type RoomRole = 'creator' | 'player';

interface LegacyStoredSession {
  roomId: string;
  pseudo: string;
  participantToken: string;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(sessionStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession & LegacyStoredSession>;
    if (parsed.role === 'creator' && typeof parsed.roomId === 'string' && typeof parsed.creatorToken === 'string') {
      return parsed as StoredSession;
    }
    if ((parsed.role === 'player' || !parsed.role) && typeof parsed.roomId === 'string' && typeof parsed.pseudo === 'string' && typeof parsed.participantToken === 'string') {
      return { role: 'player', roomId: parsed.roomId, pseudo: parsed.pseudo, participantToken: parsed.participantToken };
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
  const [role, setRole] = useState<RoomRole>('player')
  const [room, setRoom] = useState('')
  const [roomData, setRoomData] = useState<ClientRoomData | null>(null)
  const [connectionError, setConnectionError] = useState(false)
  const [teacher, setTeacher] = useState<TeacherPublic | null>(null)

  useEffect(()=>{
    const tryReconnect = () => {
      const storedSession = readStoredSession();
      if (!storedSession) return;

      if (storedSession.role === 'creator') {
        const payload: ReconnectCreatorPayload = {
          roomId: storedSession.roomId,
          creatorToken: storedSession.creatorToken,
        };

        socket.emit('reconnectCreator', payload, (ack: RoomAck) => {
          if (ack.ok && ack.role === 'creator') {
            setPseudo('');
            setRoom(ack.roomId);
            setRole('creator');
            setIsInGame(true);
            saveStoredSession({ role: 'creator', roomId: ack.roomId, creatorToken: ack.creatorToken });
            return;
          }

          clearStoredSession();
          setRoom('');
          setPseudo('');
          setRole('player');
          setIsInGame(false);
          setRoomData(null);
        });
        return;
      }

      const payload: ReconnectRoomPayload = {
        roomId: storedSession.roomId,
        pseudo: storedSession.pseudo,
        participantToken: storedSession.participantToken,
      };

      socket.emit('reconnectRoom', payload, (ack: RoomAck) => {
        if (ack.ok && ack.role === 'player') {
          setPseudo(ack.pseudo);
          setRoom(ack.roomId);
          setRole('player');
          setIsInGame(true);
          saveStoredSession({ role: 'player', roomId: ack.roomId, pseudo: ack.pseudo, participantToken: ack.participantToken });
          return;
        }

        clearStoredSession();
        setRoom('');
        setPseudo('');
        setRole('player');
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

    const onActionRejected = (reason: string) => {
      console.warn('Action rejected by server:', reason);
      alert('Action refusée par le serveur.');
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('updateRoomData', onUpdateRoomData);
    socket.on('actionRejected', onActionRejected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('updateRoomData', onUpdateRoomData);
      socket.off('actionRejected', onActionRejected);
    };
  },[])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() as Promise<AuthResponse> : null))
      .then((payload) => setTeacher(payload?.teacher ?? null))
      .catch(() => setTeacher(null));
  }, []);

  const onPlayerJoined = ({ roomId, pseudo: nextPseudo, participantToken }: { roomId: string; pseudo: string; participantToken: string }) => {
    setRoom(roomId)
    setPseudo(nextPseudo)
    setRole('player')
    setIsInGame(true)
    saveStoredSession({ role: 'player', roomId, pseudo: nextPseudo, participantToken })
  }
  const onCreatorJoined = ({ roomId, creatorToken }: { roomId: string; creatorToken: string }) => {
    setRoom(roomId)
    setPseudo('')
    setRole('creator')
    setIsInGame(true)
    saveStoredSession({ role: 'creator', roomId, creatorToken })
  }
  const callbackLeaveRoom = () => {
    setRoom('')
    setPseudo('')
    setRole('player')
    setIsInGame(false)
    setRoomData(null)
    clearStoredSession()
  }

  return (
    <Box sx={{ p: 2 }}>
      {isInGame && roomData
        ? <GameBoard socket={socket} pseudo={pseudo} room={room} roomData={roomData} role={role} callbackLeaveRoom={callbackLeaveRoom} />
        : <Home socket={socket} teacher={teacher} onPlayerJoined={onPlayerJoined} onCreatorJoined={onCreatorJoined} />
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
