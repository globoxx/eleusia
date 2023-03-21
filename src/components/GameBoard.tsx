import { Box, Grid, Slider } from '@mui/material';
import Button from '@mui/material/Button';
import Image from 'mui-image'
import React, { useState } from 'react';
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { RoomData } from '../../server';
import ImagesContainer from './ImagesContainer';
import UsersTable from './UsersTable';

function GameBoard({socket, pseudo, room}: {socket: Socket, pseudo: string, room: string}) {

    const [roomData, setRoomData] = useState<RoomData>()
    const [timer, setTimer] = useState<number | string>(0)
    const [waitOnCreator, setWaitOnCreator] = useState(false)
    const [currentImage, setCurrentImage] = useState('')
    const [votingDisabled, setVotingDisabled] = useState(true)
    const [acceptedImages, setAcceptedImages] = useState<string[]>([])
    const [refusedImages, setRefusedImages] = useState<string[]>([])
    const [vote, setVote] = useState<number>(0)

    const isRoomCreator = roomData ? pseudo === roomData.creator : false

    const handleClickStartGame = () => {
        socket.emit('startGame', room)
    }

    const handleDecisionChange = (_event: any, newValue: number | number[]) => {
        setVote(newValue as number)
    }

    const handleClickVote = () => {
        socket.emit('vote', room, pseudo, vote);
        
        setVotingDisabled(true)

        if (vote > 0) {
            setAcceptedImages([...acceptedImages, currentImage])
        } else {
            setRefusedImages([...refusedImages, currentImage])
        }

        setCurrentImage('')
    }

    useEffect(()=>{
        socket.on('updateData', (data: RoomData) => {
            setRoomData(data)
        });
    
        socket.on('timer', (timer: number) => {
            if (!waitOnCreator) {
                setTimer(timer)
            } else {
                setTimer("LE MAÎTRE DU JEU DOIT JOUER")
            }
        });
    
        socket.on('newRound', (image: string) => {
            setCurrentImage(image)

            setVotingDisabled(false)

            setWaitOnCreator(false)
        });

        socket.on('waitCreator', () => {
            setWaitOnCreator(true)
        });
    },[socket, waitOnCreator])

    return (
        <Grid container justifyContent="space-evenly" alignItems="center">
            <Grid item textAlign="center" xs={12}>
                <h1>Room {room}</h1>
            </Grid>
            <Grid item textAlign="center" xs={12}>
                <h2>Score: {roomData ? roomData.users[pseudo].score : 0}</h2>
                <h2>Timer: {timer}</h2>
                {isRoomCreator && roomData && !roomData.has_started ?
                    <Button variant="contained" onClick={handleClickStartGame}>Commencer le jeu</Button>
                    : null
                }
            </Grid>
            <Grid container item textAlign="center" xs={8}>
                <Grid container item justifyContent="space-evenly" alignItems="center">
                    <Grid item textAlign="center" xs={6}>
                        <Box sx={{ border: 1 }}>
                            <ImagesContainer images={refusedImages} category={"Refusé"}/>
                        </Box>
                    </Grid>
                    <Grid item textAlign="center" xs={6}>
                        <Box sx={{ border: 1 }}>
                            <ImagesContainer images={acceptedImages} category={"Accepté"}/>
                        </Box>
                    </Grid>
                </Grid>
                <Grid item textAlign="center" justifyContent="center" xs={12}>
                    <Box sx={{ width: 200 }}>
                        {currentImage ? <Image src={currentImage} width={200} /> : null}
                    </Box>
                </Grid>
                <Grid item textAlign="center" xs={10}>
                    <Slider defaultValue={0} aria-label="Default" valueLabelDisplay="auto" onChange={handleDecisionChange} />
                </Grid>
                <Grid item textAlign="center" xs={10}>
                    <Button variant="contained" onClick={handleClickVote} disabled={votingDisabled}>Confirmer</Button>
                </Grid>
            </Grid>
            <Grid item textAlign="start" xs={4}>
                <Box sx={{ border: 1, m: 5 }}>
                    {roomData ? <UsersTable users={roomData.users} /> : null}
                </Box>
            </Grid>
        </ Grid>
    )
}

export default GameBoard;
