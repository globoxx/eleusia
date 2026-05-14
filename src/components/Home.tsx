import { ExpandMoreOutlined, FileDownloadOutlined } from '@mui/icons-material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  ImageList,
  ImageListItem,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { CreateRoomPayload, ImageCatalog, JoinRoomPayload, RoomAck } from '../shared/types';
import HelpTooltip from './HelpTooltip';
import RulesModal from './Modals/RulesModal';
import TransferImage from './TransferImage';

type HomeProps = {
  socket: Socket;
  callbackPseudoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  callbackRoomChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  callbackJoinRoom: (room: string, pseudo: string, participantToken: string) => void;
};

function Home({ socket, callbackPseudoChange, callbackRoomChange, callbackJoinRoom }: HomeProps) {
  const [pseudo, setPseudo] = useState('');
  const [room, setRoom] = useState('');

  const [allImages, setAllImages] = useState<ImageCatalog>({});
  const [left, setLeft] = useState<string[]>([]);
  const [right, setRight] = useState<string[]>([]);

  const [newRoom, setNewRoom] = useState('');
  const [newRoomRoundDuration, setNewRoomRoundDuration] = useState('');
  const [newRoomImageSet, setNewRoomImageSet] = useState('');
  const [newRoomRule, setNewRoomRule] = useState('');
  const [newRoomSizeLimitChecked, setNewRoomSizeLimitChecked] = useState(false);
  const [newRoomSizeLimit, setNewRoomSizeLimit] = useState('');
  const [labelsSwitchChecked, setLabelsSwitchChecked] = useState(false);
  const [AISwitchChecked, setAISwitchChecked] = useState(false);

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const selectedImages = newRoomImageSet && allImages[newRoomImageSet] ? allImages[newRoomImageSet] : [];
  const labeledImagesCount = left.length + right.length;
  const missingLabelsCount = Math.max(0, selectedImages.length - labeledImagesCount);
  const labelsAreComplete = !labelsSwitchChecked || (selectedImages.length > 0 && labeledImagesCount === selectedImages.length);

  const handlePseudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    callbackPseudoChange(e);
    setPseudo(e.target.value);
  };

  const handleRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    callbackRoomChange(e);
    setRoom(e.target.value);
  };

  const callbackLabels = useCallback((newLeft: string[], newRight: string[]) => {
    setLeft(newLeft);
    setRight(newRight);
  }, []);

  const handleClickJoinRoom = () => {
    if (pseudo && room) {
      const payload: JoinRoomPayload = { roomId: room, pseudo };
      socket.emit('joinRoom', payload, (ack: RoomAck) => {
        if (ack.ok) {
          callbackJoinRoom(ack.roomId, ack.pseudo, ack.participantToken);
          return;
        }

        alert(getRejectionMessage(ack.reason));
      });
      return;
    }

    alert('Choisissez un pseudo et un numéro de room à rejoindre.');
  };

  const handleClickCreateRoom = () => {
    const sizeLimit = newRoomSizeLimitChecked && newRoomSizeLimit.length > 0 ? parseInt(newRoomSizeLimit, 10) : 1000;
    const payload: CreateRoomPayload = {
      pseudo,
      roomId: newRoom,
      roundDuration: parseInt(newRoomRoundDuration, 10),
      imageSet: newRoomImageSet,
      rule: newRoomRule,
      autoRun: labelsSwitchChecked,
      hasAI: AISwitchChecked,
      sizeLimit,
      refusedImages: left,
      acceptedImages: right,
    };

    socket.emit('createRoom', payload, (ack: RoomAck) => {
      if (ack.ok) {
        callbackJoinRoom(ack.roomId, ack.pseudo, ack.participantToken);
        return;
      }

      alert(getRejectionMessage(ack.reason));
    });
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewRoomSizeLimitChecked(event.target.checked);
    if (!event.target.checked) {
      setNewRoomSizeLimit('');
    }
  };

  const downloadImages = (imageSet: string) => {
    fetch('/images_to_download/' + imageSet + '.zip').then((response) => {
      response.blob().then((blob) => {
        const fileURL = window.URL.createObjectURL(blob);
        const alink = document.createElement('a');
        alink.href = fileURL;
        alink.download = 'images.zip';
        alink.click();
      });
    });
  };

  useEffect(() => {
    const onUpdateImages = (updatedImages: ImageCatalog) => setAllImages(updatedImages);
    const onRoomAlreadyExists = () => alert('Ce numéro de room existe déjà.');
    const onPseudoAlreadyExists = () => alert('Ce pseudo existe déjà dans cette room.');
    const onRoomFull = () => alert('Cette room est déjà pleine.');
    const onActionRejected = () => alert('Action refusée par le serveur.');

    socket.on('updateImages', onUpdateImages);
    socket.on('roomAlreadyExists', onRoomAlreadyExists);
    socket.on('pseudoAlreadyExists', onPseudoAlreadyExists);
    socket.on('roomFull', onRoomFull);
    socket.on('actionRejected', onActionRejected);

    return () => {
      socket.off('updateImages', onUpdateImages);
      socket.off('roomAlreadyExists', onRoomAlreadyExists);
      socket.off('pseudoAlreadyExists', onPseudoAlreadyExists);
      socket.off('roomFull', onRoomFull);
      socket.off('actionRejected', onActionRejected);
    };
  }, [socket]);

  const handleRoundDurationChange = (event: SelectChangeEvent<string>) => {
    setNewRoomRoundDuration(event.target.value);
  };

  const handleImageSetChange = (event: SelectChangeEvent<string>) => {
    setNewRoomImageSet(event.target.value);
  };

  return (
    <>
      <Grid container spacing={5} sx={{ justifyContent: 'center' }}>
        <Grid size={12} sx={{ textAlign: 'center' }}>
          <Button
            variant="contained"
            color="success"
            endIcon={<MenuBookIcon />}
            onClick={() => setIsRulesModalOpen(true)}
            style={{ position: 'absolute', left: 20 }}
          >
            Règles du jeu
          </Button>
          <Typography variant="h3">ELEUS-IA</Typography>
          <Typography variant="h5">Dans la peau d'une intelligence artificielle</Typography>
        </Grid>
        <Grid size={12} sx={{ textAlign: 'center' }}>
          <TextField required label="Pseudo" slotProps={{ htmlInput: { maxLength: 15 } }} value={pseudo} onChange={handlePseudoChange} variant="outlined" />
        </Grid>
        <Grid size={6}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ backgroundColor: 'lightblue' }}>
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <Typography variant="h6">Rejoindre une room</Typography>
                <HelpTooltip title="Si vous ne connaissez pas le numéro de la room, demandez à son créateur de vous le communiquer." />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField label="Room code" value={room} onChange={handleRoomChange} variant="outlined" />
                <Button variant="contained" disabled={pseudo.length === 0 || pseudo.length > 15 || room.length === 0} onClick={handleClickJoinRoom}>
                  Rejoindre la room !
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Grid>
        <Grid size={6}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ backgroundColor: 'lightblue' }}>
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <Typography variant="h6">Créer une nouvelle room</Typography>
                <HelpTooltip title="Vous serez le maître de la room créée. Vous pourrez choisir le jeu de données, les labels ainsi que la configuration de la partie." />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField required label="Room code" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} variant="outlined" fullWidth />
                <Select<string> value={newRoomRoundDuration} displayEmpty fullWidth onChange={handleRoundDurationChange}>
                  <MenuItem value="">Sélectionne le temps offert pour chaque prédiction</MenuItem>
                  <MenuItem value="10">Très court (10 secondes)</MenuItem>
                  <MenuItem value="15">Court (15 secondes)</MenuItem>
                  <MenuItem value="20">Moyen (20 secondes)</MenuItem>
                  <MenuItem value="30">Long (30 secondes)</MenuItem>
                </Select>
                <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                  <Select<string> value={newRoomImageSet} displayEmpty fullWidth onChange={handleImageSetChange}>
                    <MenuItem value="">Sélectionne un ensemble d'images</MenuItem>
                    <MenuItem value="cards">Cartes</MenuItem>
                    <MenuItem value="shapes">Formes</MenuItem>
                    <MenuItem value="faces">Visages</MenuItem>
                    <MenuItem value="cars">Voitures</MenuItem>
                    <MenuItem value="animals">Animaux</MenuItem>
                    <MenuItem value="abstract">Art abstrait</MenuItem>
                    <MenuItem value="objects">Objets</MenuItem>
                    <MenuItem value="words">Mots</MenuItem>
                  </Select>
                  <Tooltip title="Télécharger">
                    <span>
                      <IconButton color="primary" onClick={() => downloadImages(newRoomImageSet)} disabled={newRoomImageSet.length === 0}>
                        <FileDownloadOutlined />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                {newRoomImageSet ? (
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <ImageList variant="masonry" cols={8}>
                      {selectedImages.slice(0, 50).map((item: string) => (
                        <ImageListItem key={item}>
                          <img src={`${item}?w=50&fit=crop&auto=format`} srcSet={`${item}?w=50&fit=crop&auto=format&dpr=2 2x`} alt={item} loading="lazy" />
                        </ImageListItem>
                      ))}
                    </ImageList>
                  </Box>
                ) : null}
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                  <FormControlLabel
                    control={<Switch checked={labelsSwitchChecked} onChange={(event) => setLabelsSwitchChecked(event.target.checked)} slotProps={{ input: { 'aria-label': 'controlled' } }} />}
                    label="Préparer les labels à l'avance"
                  />
                  <HelpTooltip title="Cocher cette option permet de définir les labels à l'avance. Cela vous permet de ne pas avoir à catégoriser les images en cours de partie." />
                </Stack>
                <TransferImage key={newRoomImageSet} visible={labelsSwitchChecked} imagesList={selectedImages} callback={callbackLabels} />
                {labelsSwitchChecked ? (
                  <Typography variant="body2" color={missingLabelsCount === 0 ? 'success.main' : 'warning.main'}>
                    {missingLabelsCount === 0 ? 'Toutes les images sont classées.' : `${missingLabelsCount} image(s) restent à classer.`}
                  </Typography>
                ) : null}
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                  <FormControlLabel
                    control={<Switch checked={AISwitchChecked} onChange={(event) => setAISwitchChecked(event.target.checked)} slotProps={{ input: { 'aria-label': 'controlled' } }} />}
                    label="Ajouter une IA comme joueur (beta)"
                  />
                  <HelpTooltip title="Cocher cette option va ajouter une IA à la liste des joueurs. Elle va s'entraîner à chaque image et faire ses prédictions comme tout autre joueur. Le modèle est un MobileNet-V3-small pré-entrainé identique à celui de Teachable Machine de Google." />
                </Stack>
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                  <FormControlLabel
                    control={<Checkbox checked={newRoomSizeLimitChecked} onChange={handleCheckboxChange} color="primary" />}
                    label="Limiter le nombre de joueurs"
                  />
                  {newRoomSizeLimitChecked ? (
                    <TextField
                      label="Entrez un nombre"
                      type="number"
                      value={newRoomSizeLimit}
                      onChange={(e) => setNewRoomSizeLimit(e.target.value)}
                      variant="outlined"
                      margin="normal"
                    />
                  ) : null}
                </Stack>
                <TextField required label="Règle d'acceptation" multiline value={newRoomRule} onChange={(e) => setNewRoomRule(e.target.value)} variant="outlined" fullWidth />
                <Button
                  sx={{ marginTop: 2 }}
                  variant="contained"
                  disabled={
                    pseudo.length === 0 ||
                    newRoom.length === 0 ||
                    newRoomImageSet.length === 0 ||
                    newRoomRoundDuration.length === 0 ||
                    newRoomRule.length === 0 ||
                    !labelsAreComplete
                  }
                  onClick={handleClickCreateRoom}
                >
                  {labelsSwitchChecked ? 'Préparer la room !' : 'Créer la room et superviser !'}
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
      <RulesModal open={isRulesModalOpen} handleClose={() => setIsRulesModalOpen(false)} />
    </>
  );
}

function getRejectionMessage(reason: string) {
  const messages: Record<string, string> = {
    invalidPseudo: 'Pseudo invalide.',
    invalidRoom: 'Room invalide.',
    invalidRule: 'Règle invalide ou trop longue.',
    invalidRoundDuration: 'Durée de round invalide.',
    invalidSizeLimit: 'Limite de joueurs invalide.',
    invalidImageSet: "Jeu d'images invalide.",
    invalidLabels: 'Labels invalides.',
    incompleteLabels: 'Toutes les images doivent être classées une seule fois.',
    roomAlreadyExists: 'Ce numéro de room existe déjà.',
    pseudoAlreadyExists: 'Ce pseudo existe déjà dans cette room.',
    roomFull: 'Cette room est déjà pleine.',
    roomNotFound: "Cette room n'existe pas ou a déjà commencé.",
    alreadyInRoom: 'Vous êtes déjà dans une room.',
  };

  return messages[reason] ?? 'Action refusée par le serveur.';
}

export default Home;
