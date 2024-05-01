import { Box, Grid, Paper, Slider, Stack, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import {Image as MuiImage} from 'mui-image';
import React, { useCallback, useState } from 'react';
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { RoomData } from '../../server';
import ImagesContainer from './ImagesContainer';
import UsersTable from './UsersTable';
import PointsModal from './Modals/PointsModal';
import Timer from './Timer';
import EndOfGameModal from './Modals/EndOfGameModal';
import LogoutIcon from '@mui/icons-material/Logout';
import PauseIcon from '@mui/icons-material/Pause';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import MyModel from './AIModel';

const minPlayers = 1

const marks = [
    {
      value: -1,
      label: 'Refuser',
    },
    {
        value: -0.5,
        label: 'Plutôt refuser',
    },
    {
        value: 0,
        label: 'Aucune idée',
    },
    {
        value: 0.5,
        label: 'Plutôt accepter',
    },
    {
      value: 1,
      label: 'Accepter',
    }
]

async function initializeModel() {
    await MyModel.loadFeatureExtractor();
    MyModel.loadModel();
}

async function trainModel(images: string[], labels: number[]) {
    let imgs = await Promise.all(images.map(async image => await createImageElement(image)))
    if (MyModel.model && MyModel.featureExtractor) {
        await MyModel.trainModel(imgs, labels);
    } else {
        throw new Error('Model or feature extractor not loaded');
    }
}

async function predictImage(image: string) {
    let img = await createImageElement(image)
    if (MyModel.model && MyModel.featureExtractor) {
        return MyModel.predictImage(img);
    } else {
        throw new Error('Model or feature extractor not loaded');
    }
}

function createImageElement(imageUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.src = imageUrl;
        img.onload = () => resolve(img);  // Resolve the promise when the image is loaded
        img.onerror = reject;  // Reject the promise if there is an error
    });
}

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
    const [allImages, setAllImages] = useState<string[]>([])
    const [allLabels, setAllLabels] = useState<string[]>([])
    const [vote, setVote] = useState<number>(0)

    const [isPointsModalOpen, setIsPointsModalOpen] = useState(false)
    const [modalPoints, setModalPoints] = useState(0)

    const isRoomCreator = roomData ? pseudo === roomData.creator : false
    const isAutoRun = roomData ? roomData.autoRun : false

    const handleClickStartGame = () => {
        socket.emit('startGame', room)
    }

    const handleClickRevealRule = () => {
        socket.emit('endGame', room)
    }

    const handleClickPause = () => {
        socket.emit('pause', room)
    }

    const handleDecisionChange = (_event: any, newValue: number | number[]) => {
        setVote(newValue as number)
    }

    const handleClickAccept = () => handleClickVote(1)
    const handleClickRefuse = () => handleClickVote(-1)

    const handleClickVote = (vote: number) => {
        socket.emit('vote', room, pseudo, vote)
        setVotingDisabled(true)
    }

    const leaveRoom = () => {
        socket.emit('leaveRoom', room, pseudo)
        callbackLeaveRoom()
    }

    const handleClosePointsModal = useCallback(() => {
        setIsPointsModalOpen(false);
    }, []);

    useEffect(() => {
        if (isRoomCreator && roomData.hasAI) {
            initializeModel()
            .then(() => console.log('Model initialized'))
            .catch((error) => console.error('Error initializing model:', error));
        }
    }, [isRoomCreator, roomData.hasAI])

    useEffect(() => {
        const onNewRound = async (image: string) => {
            setCurrentImage(image)

            setAllImages(current => [...current, image])

            setVotingDisabled(false)

            setWaitOnCreator(false)

            setTimerKey(prevTimerKey => prevTimerKey + 1)

            if (isRoomCreator && roomData.autoRun) {
                const creatorVote = roomData.acceptedImages.includes(image) ? 1 : -1
                socket.emit('vote', room, pseudo, creatorVote)
            }

            if (isRoomCreator && roomData.hasAI && (acceptedImages.length > 0 || refusedImages.length > 0)) {
                let trainingImages = acceptedImages.concat(refusedImages)
                let trainingLabels = Array(acceptedImages.length).fill(1).concat(Array(refusedImages.length).fill(0))
                try {
                    await trainModel(trainingImages, trainingLabels)
                    console.log("The model is trained with " + trainingImages.length + " samples")

                    const prediction = await predictImage(image)
                    console.log("The prediction is " + prediction)
                    let aiVote = (prediction[1] - 0.5) * 2
                    aiVote = Number(aiVote.toFixed(2))
                    socket.emit('vote', room, "Eleus-IA", aiVote)
                } catch (error) {
                    console.error("Error training the model: ", error)
                }
            }
        }

        socket.on('newRound', onNewRound)
        return () => {socket.off('newRound', onNewRound)}
    }, [acceptedImages, isRoomCreator, pseudo, refusedImages, room, roomData.acceptedImages, roomData.autoRun, roomData.hasAI, socket])

    useEffect(() => {
        const onTimer = (timer: number) => {
            if (!waitOnCreator) {
                setTimer(timer)
            }
        }
        socket.on('timer', onTimer)
        return () => {socket.off('timer', onTimer)}
    }, [socket, waitOnCreator])

    useEffect(() => {
        const onWaitCreator = () => {
            setWaitOnCreator(true)
        }
        socket.on('waitCreator', onWaitCreator)
        return () => {socket.off('waitCreator', onWaitCreator)}
    }, [socket])

    useEffect(()=>{
        const onEndOfRound = (usersPoints: {[pseudo: string]: number}, creatorVote: number) => {
            let label
            if (creatorVote > 0) {
                setAcceptedImages([...acceptedImages, currentImage])
                label = "Accepté"
            } else {
                setRefusedImages([...refusedImages, currentImage])
                label = "Refusé"
            }

            setCurrentImage('')
            setAllLabels(current => [...current, label])
            
            if (!isRoomCreator) {
                setModalPoints(usersPoints[pseudo])
                setIsPointsModalOpen(true)
            }
        }
        socket.on('endOfRound', onEndOfRound)
        return () => {socket.off('endOfRound', onEndOfRound)}
    }, [acceptedImages, currentImage, isRoomCreator, pseudo, refusedImages, socket])

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
                        {currentImage ? <MuiImage src={currentImage} duration={1000} height={200} /> : null}
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
                                        <Slider sx={{ width: 1/2 }}defaultValue={0} aria-label="Default" valueLabelDisplay="auto" step={0.1} min={-1} max={1} marks={marks} onChange={handleDecisionChange} />
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
                    <Timer key={timerKey} roundDuration={roomData.roundDuration} isPlaying={roomData.hasStarted && !roomData.hasFinished && !roomData.paused} />
                    {!isRoomCreator && <Typography variant="h6">{'Score: ' + (roomData && roomData.users[pseudo] ? roomData.users[pseudo].totalScore : 0)}</Typography>}
                    <Box sx={{ border: 1, m: 5, marginBottom: 2 }}>
                        {roomData ? <UsersTable roomData={roomData} pseudo={pseudo} /> : null}
                    </Box>
                    {isRoomCreator && !roomData.hasStarted ?
                        <Button variant="contained" onClick={handleClickStartGame} disabled={Object.keys(roomData.users).length < minPlayers}>Démarrer la partie</Button>
                        : null}
                    {isRoomCreator && roomData.hasStarted && !roomData.hasFinished ?
                        <Stack direction="row" spacing={2}>
                            <Button startIcon={!roomData.paused ? <PauseIcon/> : <PlayCircleFilledIcon/>} variant="outlined" onClick={handleClickPause}>{!roomData.paused ? "Pause" : "Reprendre"}</Button>
                            <Button variant="contained" color="error" onClick={handleClickRevealRule}>Révéler la règle</Button>
                        </Stack>
                        : null}
                </Stack>
            </Grid>
        </Grid>
        {!isRoomCreator && <PointsModal open={isPointsModalOpen} handleClose={handleClosePointsModal} points={modalPoints} />}
        <EndOfGameModal open={roomData.hasFinished} rule={roomData.rule} users={roomData.users} pseudo={pseudo} creatorPseudo={roomData.creator} images={allImages} labels={allLabels} />
        </>
    )
}

export default GameBoard
