import { Box, Grid, Paper, Slider, Stack, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Image from 'mui-image'
import React, { useState } from 'react';
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { RoomData } from '../../server';
import ImagesContainer from './ImagesContainer';
import UsersTable from './UsersTable';
import PointsModal from './Modals/PointsModal';
import Timer from './Timer';
import EndOfGameModal from './Modals/EndOfGameModal';
import LogoutIcon from '@mui/icons-material/Logout';

const minPlayers = 1

const marks = [
    {
      value: -1,
      label: 'Refuser',
    },
    {
        value: 0,
        label: 'Aucune idée',
      },
    {
      value: 1,
      label: 'Accepter',
    }
]

type GameBoardProps = {
    socket: Socket
    pseudo: string
    room: string
    roomData: RoomData
    callbackLeaveRoom: () => void
}
  
function GameBoard({socket, pseudo, room, roomData, callbackLeaveRoom}: GameBoardProps) {

    const [timer, setTimer] = useState<number>(0)
    const [timerKey, setTimerKey] = useState<number>(0)
    const [waitOnCreator, setWaitOnCreator] = useState(false)
    const [currentImage, setCurrentImage] = useState('')
    const [votingDisabled, setVotingDisabled] = useState(true)
    const [acceptedImages, setAcceptedImages] = useState<string[]>([])
    const [refusedImages, setRefusedImages] = useState<string[]>([])
    const [vote, setVote] = useState<number>(0)

    const [isPointsModalOpen, setIsPointsModalOpen] = useState(false)
    const [modalPoints, setModalPoints] = useState(0)

    const isRoomCreator = roomData ? pseudo === roomData.creator : false
    const isAutoRun = roomData ? roomData.autoRun : false

    if (!(pseudo in roomData.users)) {
        alert('Vous avez été déconnecté de la partie !')
    }

    const handleClickStartGame = () => {
        socket.emit('startGame', room)
    }

    const handleClickRevealRule = () => {
        socket.emit('endGame', room)
    }

    const handleDecisionChange = (_event: any, newValue: number | number[]) => {
        setVote(newValue as number)
    }

    const handleClickAccept = () => handleClickVote(1)
    const handleClickRefuse = () => handleClickVote(-1)

    const handleClickVote = (vote: number) => {
        socket.emit('vote', room, pseudo, vote);
        setVotingDisabled(true)
    }

    const leaveRoom = () => {
        socket.emit('leaveRoom', room, pseudo)
        callbackLeaveRoom()
    }

    useEffect(()=>{
        socket.on('timer', (timer: number) => {
            if (!waitOnCreator) {
                setTimer(timer)
            }
        })
    
        socket.on('newRound', (image: string) => {
            setCurrentImage(image)

            setVotingDisabled(false)

            setWaitOnCreator(false)

            setTimerKey(prevTimerKey => prevTimerKey + 1)
        })

        socket.on('waitCreator', () => {
            setWaitOnCreator(true)
        })

        socket.on('endOfRound', (usersPoints: {[pseudo: string]: number}, creatorVote: number) => {
            if (creatorVote > 0) {
                setAcceptedImages([...acceptedImages, currentImage])
            } else {
                setRefusedImages([...refusedImages, currentImage])
            }

            setCurrentImage('')
            
            if (!isRoomCreator) {
                setModalPoints(usersPoints[pseudo])
                setIsPointsModalOpen(true)
            }
        })
    },[acceptedImages, currentImage, isRoomCreator, pseudo, refusedImages, socket, waitOnCreator])

    return (
        <>
        <Grid container justifyContent="space-evenly" alignContent="flex-start" alignItems="center" spacing={2}>
            <Grid item textAlign="center" xs={12}>
                <Button variant="outlined" color="error" endIcon={<LogoutIcon />} onClick={leaveRoom} style={{ position: "absolute", left: 20 }}>
                    Quitter la partie
                </Button>
                <Typography variant="h3">Room {room}</Typography>
            </Grid>
            <Grid container item textAlign="center" xs={8} spacing={2}>
                <Grid container item justifyContent="space-evenly" alignItems="center" spacing={2} xs={12}>
                    <Grid item textAlign="center" xs={6}>
                        <Typography variant="h6">Images refusées par le maître</Typography>
                        <Paper sx={{ height: 200 }} elevation={3}>
                            <ImagesContainer images={refusedImages} category={"Refusé"} />
                        </Paper>
                    </Grid>
                    <Grid item textAlign="center" xs={6}>
                        <Typography variant="h6">Images acceptées par le maître</Typography>
                        <Paper sx={{ height: 200 }} elevation={3}>
                            <ImagesContainer images={acceptedImages} category={"Accepté"} />
                        </Paper>
                    </Grid>
                </Grid>
                <Grid container item alignItems="center" justifyContent="center" xs={12}>
                    <Box sx={{ height: 200 }}>
                        {currentImage ? <Image src={currentImage} duration={1000} height={200} /> : null}
                    </Box>
                </Grid>
                <Grid container item textAlign="center" alignItems="center" xs={12}>
                    {isRoomCreator
                        ? (
                            isAutoRun
                                ? (
                                    <Grid item textAlign="center" xs={12}>
                                        <Typography variant="h5">{roomData.hasStarted ? "Les labels sont déjà prêts !" : "Vous n'avez plus qu'à démarrer la partie quand vous êtes prêt !"}</Typography>
                                    </Grid>
                                )
                                : roomData.hasStarted && (
                                    <>
                                        <Grid item textAlign="center" xs={6}>
                                            <Button variant="contained" onClick={handleClickRefuse} disabled={votingDisabled}>Refuser</Button>
                                        </Grid><Grid item textAlign="center" xs={6}>
                                            <Button variant="contained" onClick={handleClickAccept} disabled={votingDisabled}>Accepter</Button>
                                        </Grid>
                                    </>
                                )
                        )
                        : roomData.hasStarted 
                            ? (
                                <>
                                    <Grid item textAlign="center" xs={12}>
                                        <Slider sx={{ width: 1/3 }}defaultValue={0} aria-label="Default" valueLabelDisplay="auto" step={0.1} min={-1} max={1} marks={marks} onChange={handleDecisionChange} />
                                    </Grid>
                                    <Grid item textAlign="center" xs={12}>
                                        <Button variant="contained" onClick={() => handleClickVote(vote)} disabled={votingDisabled || timer <= 0}>Confirmer</Button>
                                    </Grid>
                                </>
                            )
                            : (
                                <Grid item textAlign="center" xs={12}>
                                    <Typography variant="h5">Le maître du jeu n'a pas encore démarré la partie !</Typography>
                                </Grid>
                            )
                    }
                </Grid>
            </Grid>
            <Grid item alignSelf="flex-start" xs={4}>
                <Stack alignItems="center" justifyContent="flex-start" spacing={2}>
                    <Timer key={timerKey} roundDuration={roomData.roundDuration} isPlaying={roomData.hasStarted} />
                    {!isRoomCreator && <Typography variant="h6">{'Score: ' + (roomData && roomData.users[pseudo] ? roomData.users[pseudo].totalScore : 0)}</Typography>}
                    <Box sx={{ border: 1, m: 5, marginBottom: 2 }}>
                        {roomData ? <UsersTable roomData={roomData} pseudo={pseudo} /> : null}
                    </Box>
                    {isRoomCreator && !roomData.hasStarted ?
                        <Button variant="contained" onClick={handleClickStartGame} disabled={Object.keys(roomData.users).length < minPlayers}>Démarrer la partie</Button>
                        : null}
                    {isRoomCreator && roomData.hasStarted && !roomData.hasFinished ?
                        <Button variant="contained" color="error" onClick={handleClickRevealRule}>Révéler la règle</Button>
                        : null}
                </Stack>
            </Grid>
        </Grid>
        {!isRoomCreator && <PointsModal open={isPointsModalOpen} handleClose={() => setIsPointsModalOpen(false)} points={modalPoints} />}
        <EndOfGameModal open={roomData.hasFinished} rule={roomData.rule} users={roomData.users} pseudo={pseudo} creatorPseudo={roomData.creator} />
        </>
    )
}

export default GameBoard
