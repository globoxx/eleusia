import { Grid } from '@mui/material';
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

    const isRoomCreator = roomData ? pseudo === roomData.creator : false

    const handleClickStartGame = () => {
        socket.emit('startGame', room)
    }

    const handleVote = (decision: string) => {
        socket.emit('vote', room, pseudo, decision);
        
        setVotingDisabled(true)

        if (decision === "Accept") {
            setAcceptedImages([...acceptedImages, currentImage])
        } else {
            setRefusedImages([...refusedImages, currentImage])
        }

        setCurrentImage('')
    }

    const handleClickRefuse = () => handleVote('Refuse')
    const handleClickAccept = () => handleVote('Accept')

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
                        <ImagesContainer images={acceptedImages} category={"Accepté"}/>
                    </Grid>
                    <Grid item textAlign="center" xs={6}>
                        <ImagesContainer images={refusedImages} category={"Refusé"}/>
                    </Grid>
                </Grid>
                <Grid item textAlign="center" xs={12}>
                    {currentImage ? <Image src={currentImage} width={500} /> : null}
                </Grid>
                <Grid item textAlign="center" xs={6}>
                    <Button variant="contained" onClick={handleClickRefuse} disabled={votingDisabled}>Refuser</Button>
                </Grid>
                <Grid item textAlign="center" xs={6}>
                    <Button variant="contained" onClick={handleClickAccept} disabled={votingDisabled}>Accepter</Button>
                </Grid>
            </Grid>
            <Grid item textAlign="center" xs={4}>
                {roomData ? <UsersTable users={roomData.users} /> : null}
            </Grid>
        </ Grid>
    )
}

export default GameBoard;
