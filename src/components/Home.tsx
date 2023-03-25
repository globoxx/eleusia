import React, { useEffect, useState } from 'react';
import { TextField, Button, Grid, Accordion, AccordionSummary, AccordionDetails} from '@mui/material';
import { Socket } from 'socket.io-client';

function Home({socket, callbackPseudoChange, callbackRoomChange, callbackJoinRoom}: {socket: Socket, callbackPseudoChange: (e: React.ChangeEvent<HTMLInputElement>) => void, callbackRoomChange: (e: React.ChangeEvent<HTMLInputElement>) => void, callbackJoinRoom: (room: string) => void}) {
    const [rooms, setRooms] = useState<string[]>([])
    const [pseudo, setPseudo] = useState('')
    const [room, setRoom] = useState('')

    const [newRoom, setNewRoom] = useState('')
    const [newRoomRoundDuration, setNewRoomRoundDuration] = useState(10)

    const handlePseudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        callbackPseudoChange(e)
        setPseudo(e.target.value)
    }
    const handleRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        callbackRoomChange(e)
        setRoom(e.target.value)
    }

    const handleClickJoinRoom = () => {
        if (pseudo && room) {
          if (rooms.includes(room)) {
            socket.emit('joinRoom', room, pseudo);
            callbackJoinRoom(room)
          } else {
            alert('Cette room n\'existe pas ou a déjà commencé.');
          }
        } else {
          alert('Choisissez un pseudo et un numéro de room à rejoindre.');
        }
    }
    const handleClickCreateRoom = () => {
        if (pseudo) {
          socket.emit('createRoom', pseudo, newRoom, newRoomRoundDuration)
          callbackJoinRoom(newRoom)
        } else {
          alert('Choisissez un pseudo pour rejoindre une room.');
        }
    }

    useEffect(()=>{
        socket.on('updateRooms', (rooms: string[]) => {
            setRooms(rooms)
        })
    },[socket])
    
    return (
    <Grid container justifyContent="space-evenly" alignItems="center">
        <Grid item textAlign="center" xs={12}>
            <h1>ELEUS-IA</h1>
            <h2>Qui sera la meilleure IA ?</h2>
        </Grid>
        <Grid item textAlign="center" xs={12}>
            <TextField id="outlined-basic" label="Pseudo" value={pseudo} onChange={handlePseudoChange} variant="outlined" />
        </Grid>
        <Grid container item direction="column" textAlign="center" spacing={2} xs={6}>
            <Grid item>
                <TextField id="outlined-basic" label="Room code" value={room} onChange={handleRoomChange} variant="outlined" />
            </Grid>
            <Grid item>
                <Button variant="contained" disabled={pseudo.length === 0 || room.length === 0} onClick={handleClickJoinRoom}>Rejoindre une room !</Button>
            </Grid>
        </Grid>
        <Grid item textAlign="center" xs={6}>
            <Accordion>
                <AccordionSummary>
                    Créer une nouvelle room
                </AccordionSummary>
                <AccordionDetails>
                    <TextField id="outlined-basic" label="Room code" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} variant="outlined" />
                    <TextField inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} value={newRoomRoundDuration} onChange={(e) => setNewRoomRoundDuration(parseInt(e.target.value))} />
                    <Button variant="contained" disabled={pseudo.length === 0 || newRoom.length === 0} onClick={handleClickCreateRoom}>Créer la room !</Button>
                </AccordionDetails>
            </Accordion>
        </Grid>
    </Grid>
    );
}

export default Home;
