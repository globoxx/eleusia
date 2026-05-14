import PauseIcon from '@mui/icons-material/Pause';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import LogoutIcon from '@mui/icons-material/Logout';
import { Box, Grid, Paper, Slider, Stack, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import React, { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { RoomData } from '../shared/types';
import ImagesContainer from './ImagesContainer';
import EndOfGameModal from './Modals/EndOfGameModal';
import PointsModal from './Modals/PointsModal';
import Timer from './Timer';
import UsersTable from './UsersTable';

const minPlayers = 1;

const marks = [
  { value: -1, label: 'Refuser' },
  { value: -0.5 },
  { value: 0, label: 'Aucune idée' },
  { value: 0.5 },
  { value: 1, label: 'Accepter' },
];

type AIModel = typeof import('./AIModel').default;

async function loadAIModel() {
  const { default: model } = await import('./AIModel');
  return model;
}

async function initializeModel(model: AIModel) {
  await model.loadFeatureExtractor();
  model.loadModel();
}

async function trainModel(model: AIModel, images: string[], labels: number[]) {
  const imgs = await Promise.all(images.map(async (image) => createImageElement(image)));
  if (model.model && model.featureExtractor) {
    await model.trainModel(imgs, labels);
    return;
  }

  throw new Error('Model or feature extractor not loaded');
}

async function predictImage(model: AIModel, image: string) {
  const img = await createImageElement(image);
  if (model.model && model.featureExtractor) {
    return model.predictImage(img);
  }

  throw new Error('Model or feature extractor not loaded');
}

function createImageElement(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

type GameBoardProps = {
  socket: Socket;
  pseudo: string;
  room: string;
  roomData: RoomData;
  callbackLeaveRoom: () => void;
};

function GameBoard({ socket, pseudo, room, roomData, callbackLeaveRoom }: GameBoardProps) {
  const [timer, setTimer] = useState<number>(0);
  const [timerKey, setTimerKey] = useState<number>(0);
  const [waitOnCreator, setWaitOnCreator] = useState(false);
  const [currentImage, setCurrentImage] = useState('');
  const [votingDisabled, setVotingDisabled] = useState(true);
  const [acceptedImages, setAcceptedImages] = useState<string[]>([]);
  const [refusedImages, setRefusedImages] = useState<string[]>([]);
  const [allImages, setAllImages] = useState<string[]>([]);
  const [allLabels, setAllLabels] = useState<string[]>([]);
  const [vote, setVote] = useState<number>(0);
  const [modelReady, setModelReady] = useState(false);
  const [aiModel, setAiModel] = useState<AIModel | null>(null);

  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [modalPoints, setModalPoints] = useState(0);

  const isRoomCreator = pseudo === roomData.creator;
  const isAutoRun = roomData.autoRun;

  const handleClickStartGame = () => {
    socket.emit('startGame', room);
  };

  const handleClickRevealRule = () => {
    socket.emit('endGame', room);
  };

  const handleClickPause = () => {
    socket.emit('pause', room);
  };

  const handleDecisionChange = (_event: Event, newValue: number | number[]) => {
    setVote(newValue as number);
  };

  const handleClickAccept = () => handleClickVote(1);
  const handleClickRefuse = () => handleClickVote(-1);

  const handleClickVote = (newVote: number) => {
    socket.emit('vote', room, newVote);
    setVotingDisabled(true);
  };

  const leaveRoom = () => {
    socket.emit('leaveRoom', room);
    callbackLeaveRoom();
    window.location.reload();
  };

  const handleClosePointsModal = useCallback(() => {
    setIsPointsModalOpen(false);
  }, []);

  useEffect(() => {
    if (!isRoomCreator || !roomData.hasAI) {
      setAiModel(null);
      setModelReady(false);
      return undefined;
    }

    let cancelled = false;
    setModelReady(false);

    loadAIModel()
      .then(async (model) => {
        await initializeModel(model);
        if (!cancelled) {
          setAiModel(model);
          setModelReady(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAiModel(null);
          setModelReady(false);
          console.error('Error initializing model:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isRoomCreator, roomData.hasAI]);

  useEffect(() => {
    const onNewRound = async (image: string) => {
      setCurrentImage(image);
      setAllImages((current) => [...current, image]);
      setVotingDisabled(false);
      setWaitOnCreator(false);
      setTimerKey((prevTimerKey) => prevTimerKey + 1);

      if (isRoomCreator && roomData.autoRun) {
        const creatorVote = roomData.acceptedImages.includes(image) ? 1 : -1;
        socket.emit('vote', room, creatorVote);
      }

      if (isRoomCreator && roomData.hasAI && modelReady && aiModel && (acceptedImages.length > 0 || refusedImages.length > 0)) {
        const trainingImages = acceptedImages.concat(refusedImages);
        const trainingLabels = Array(acceptedImages.length).fill(1).concat(Array(refusedImages.length).fill(0));

        try {
          await trainModel(aiModel, trainingImages, trainingLabels);
          const prediction = await predictImage(aiModel, image);
          const acceptedProbability = prediction[1] ?? 0.5;
          const aiVote = Number(((acceptedProbability - 0.5) * 2).toFixed(2));
          socket.emit('aiVote', room, aiVote);
        } catch (error: unknown) {
          console.error('Error training the model:', error);
        }
      }
    };

    socket.on('newRound', onNewRound);
    return () => {
      socket.off('newRound', onNewRound);
    };
  }, [
    acceptedImages,
    aiModel,
    isRoomCreator,
    modelReady,
    refusedImages,
    room,
    roomData.acceptedImages,
    roomData.autoRun,
    roomData.hasAI,
    socket,
  ]);

  useEffect(() => {
    const onTimer = (newTimer: number) => {
      if (!waitOnCreator) {
        setTimer(newTimer);
      }
    };

    socket.on('timer', onTimer);
    return () => {
      socket.off('timer', onTimer);
    };
  }, [socket, waitOnCreator]);

  useEffect(() => {
    const onWaitCreator = () => {
      setWaitOnCreator(true);
    };

    socket.on('waitCreator', onWaitCreator);
    return () => {
      socket.off('waitCreator', onWaitCreator);
    };
  }, [socket]);

  useEffect(() => {
    const onEndOfRound = (usersPoints: Record<string, number>, creatorVote: number) => {
      const label = creatorVote > 0 ? 'Accepté' : 'Refusé';

      if (currentImage) {
        if (creatorVote > 0) {
          setAcceptedImages((current) => [...current, currentImage]);
        } else {
          setRefusedImages((current) => [...current, currentImage]);
        }
      }

      setCurrentImage('');
      setAllLabels((current) => [...current, label]);

      if (!isRoomCreator) {
        setModalPoints(usersPoints[pseudo] ?? 0);
        setIsPointsModalOpen(true);
      }
    };

    socket.on('endOfRound', onEndOfRound);
    return () => {
      socket.off('endOfRound', onEndOfRound);
    };
  }, [currentImage, isRoomCreator, pseudo, socket]);

  return (
    <>
      <Grid container spacing={2} sx={{ justifyContent: 'space-evenly', alignContent: 'flex-start' }}>
        <Grid size={12} sx={{ textAlign: 'center' }}>
          <Button variant="outlined" color="error" endIcon={<LogoutIcon />} onClick={leaveRoom} style={{ position: 'absolute', left: 20 }}>
            Quitter la partie
          </Button>
          <Typography variant="h3">Room {room}</Typography>
        </Grid>
        <Grid size={8} sx={{ textAlign: 'center' }}>
          <Stack spacing={2} sx={{ width: '100%', alignItems: 'center' }}>
          <Grid container spacing={2} sx={{ justifyContent: 'space-evenly', alignItems: 'center' }}>
            <Grid size={6} sx={{ textAlign: 'center' }}>
              <Typography variant="h6">Images refusées par le maître</Typography>
              <Paper sx={{ height: 200 }} elevation={3}>
                <ImagesContainer images={refusedImages} category="Refusé" />
              </Paper>
            </Grid>
            <Grid size={6} sx={{ textAlign: 'center' }}>
              <Typography variant="h6">Images acceptées par le maître</Typography>
              <Paper sx={{ height: 200 }} elevation={3}>
                <ImagesContainer images={acceptedImages} category="Accepté" />
              </Paper>
            </Grid>
          </Grid>
          <Grid container sx={{ alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ height: 200 }}>
              {currentImage ? (
                <Box
                  component="img"
                  src={currentImage}
                  alt="Image courante"
                  sx={{ display: 'block', height: 200, maxWidth: '100%', objectFit: 'contain' }}
                />
              ) : null}
            </Box>
          </Grid>
          <Grid container sx={{ textAlign: 'center', alignItems: 'center' }}>
            {isRoomCreator ? (
              isAutoRun ? (
                <Grid size={12} sx={{ textAlign: 'center' }}>
                  <Typography variant="h5">
                    {roomData.hasStarted
                      ? 'Les labels sont déjà prêts !'
                      : "Vous n'avez plus qu'à démarrer la partie quand vous êtes prêt !"}
                  </Typography>
                </Grid>
              ) : (
                roomData.hasStarted && (
                  <>
                    <Grid size={6} sx={{ textAlign: 'center' }}>
                      <Button variant="contained" onClick={handleClickRefuse} disabled={votingDisabled}>
                        Refuser
                      </Button>
                    </Grid>
                    <Grid size={6} sx={{ textAlign: 'center' }}>
                      <Button variant="contained" onClick={handleClickAccept} disabled={votingDisabled}>
                        Accepter
                      </Button>
                    </Grid>
                  </>
                )
              )
            ) : roomData.hasStarted ? (
              <>
                <Grid size={12} sx={{ textAlign: 'center' }}>
                  <Slider
                    sx={{ width: 0.8 }}
                    defaultValue={0}
                    aria-label="Default"
                    valueLabelDisplay="auto"
                    step={0.1}
                    min={-1}
                    max={1}
                    marks={marks}
                    onChange={handleDecisionChange}
                  />
                </Grid>
                <Grid size={12} sx={{ textAlign: 'center' }}>
                  <Button variant="contained" onClick={() => handleClickVote(vote)} disabled={votingDisabled || timer <= 0}>
                    Confirmer
                  </Button>
                </Grid>
              </>
            ) : (
              <Grid size={12} sx={{ textAlign: 'center' }}>
                <Typography variant="h5">Le maître du jeu n'a pas encore démarré la partie !</Typography>
              </Grid>
            )}
          </Grid>
          </Stack>
        </Grid>
        <Grid size={4} sx={{ alignSelf: 'flex-start' }}>
          <Stack spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-start' }}>
            <Timer
              key={timerKey}
              timerKey={timerKey}
              roundDuration={roomData.roundDuration}
              isPlaying={roomData.hasStarted && !roomData.hasFinished && !roomData.paused}
            />
            {!isRoomCreator && (
              <Typography variant="h6">{'Score: ' + (roomData.users[pseudo] ? roomData.users[pseudo].totalScore : 0)}</Typography>
            )}
            <Box sx={{ border: 1, m: 5, marginBottom: 2 }}>
              <UsersTable roomData={roomData} pseudo={pseudo} />
            </Box>
            {isRoomCreator && !roomData.hasStarted ? (
              <Button variant="contained" onClick={handleClickStartGame} disabled={Object.keys(roomData.users).length < minPlayers}>
                Démarrer la partie
              </Button>
            ) : null}
            {isRoomCreator && roomData.hasStarted && !roomData.hasFinished ? (
              <Stack direction="row" spacing={2}>
                <Button startIcon={!roomData.paused ? <PauseIcon /> : <PlayCircleFilledIcon />} variant="outlined" onClick={handleClickPause}>
                  {!roomData.paused ? 'Pause' : 'Reprendre'}
                </Button>
                <Button variant="contained" color="error" onClick={handleClickRevealRule}>
                  Révéler la règle
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Grid>
      </Grid>
      {!isRoomCreator && <PointsModal open={isPointsModalOpen} handleClose={handleClosePointsModal} points={modalPoints} />}
      <EndOfGameModal
        open={roomData.hasFinished}
        rule={roomData.rule}
        users={roomData.users}
        pseudo={pseudo}
        creatorPseudo={roomData.creator}
        images={allImages}
        labels={allLabels}
      />
    </>
  );
}

export default GameBoard;
