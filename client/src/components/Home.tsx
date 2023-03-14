import React, { useState } from 'react';
import { TextField, Button, Grid, Accordion, AccordionSummary, AccordionDetails} from '@mui/material';
import { Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents } from '../../../server/server';

function Home({socket}: {socket: Socket<ServerToClientEvents, ClientToServerEvents>}) {
    const [rooms, setRooms] = useState<String>([])
    const [pseudo, setPseudo] = useState('')
    const [room, setRoom] = useState('')

    const handlePseudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {setPseudo(e.target.value)}
    const handleRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {setRoom(e.target.value)}

    const handleClickJoinRoom = () => {
        if (pseudo && room) {
          if (rooms.includes(room)) {
            // Faire remonter l'info que le user entre dans la partie
            socket.emit('joinRoom', room, pseudo);
          } else {
            alert('The room does not exist.');
          }
        } else {
          alert('Please enter a username and room ID to join a room.');
        }
    }
    const handleClickCreateRoom = () => {
        const min = 1000
        const max = 9999
        const generated_room = (Math.floor(Math.random()*(max-min+1)+min)).toString();
        if (pseudo) {
          socket.emit('createRoom', generated_room, pseudo);
        } else {
          alert('Please enter a pseudo to create a room.');
        }
    }
    
    return (
    <Grid container justifyContent="space-evenly" alignItems="center">
        <Grid item textAlign="center" xs={12}>
            <h1>ELEUS-IA</h1>
            <h2>Qui sera la meilleure IA ?</h2>
        </Grid>
        <Grid item textAlign="center" xs={12}>
            <TextField id="outlined-basic" label="Pseudo" value={pseudo} onChange={handlePseudoChange} variant="outlined" />
        </Grid>
        <Grid container direction="column" textAlign="center" spacing={2} xs={6}>
            <Grid item>
                <TextField id="outlined-basic" label="Numéro de room" value={room} onChange={handleRoomChange} variant="outlined" />
            </Grid>
            <Grid item>
                <Button variant="contained" disabled={pseudo.length === 0 || room.length === 0} onClick={handleClickJoinRoom}>Rejoindre room !</Button>
            </Grid>
        </Grid>
        <Grid item textAlign="center" xs={6}>
            <Accordion>
                <AccordionSummary>
                    Créer une nouvelle room
                </AccordionSummary>
                <AccordionDetails>
                    <Button variant="contained" disabled={pseudo.length === 0} onClick={handleClickCreateRoom}>Créer room !</Button>
                </AccordionDetails>
            </Accordion>
        </Grid>
    </Grid>
    );
}

export default Home;
