import React, { useCallback, useEffect, useState } from 'react'
import { TextField, Button, Grid, Accordion, AccordionSummary, AccordionDetails, MenuItem, Select, ImageList, ImageListItem, Box, Typography, Stack, IconButton, Tooltip, Switch, FormControlLabel, Checkbox } from '@mui/material'
import { Socket } from 'socket.io-client'
import { ExpandMoreOutlined, FileDownloadOutlined } from '@mui/icons-material'
import TransferImage from './TransferImage'
import HelpTooltip from './HelpTooltip'
import MenuBookIcon from '@mui/icons-material/MenuBook';
import RulesModal from './Modals/RulesModal'

function Home({ socket, callbackPseudoChange, callbackRoomChange, callbackJoinRoom }: { socket: Socket, callbackPseudoChange: (e: React.ChangeEvent<HTMLInputElement>) => void, callbackRoomChange: (e: React.ChangeEvent<HTMLInputElement>) => void, callbackJoinRoom: (room: string) => void }) {
    const [rooms, setRooms] = useState<string[]>([])
    const [pseudo, setPseudo] = useState('')
    const [room, setRoom] = useState('')

    const [allImages, setAllImages] = useState<{ [folder: string]: string[] }>({})
    const [left, setLeft] = useState<string[]>([])
    const [right, setRight] = useState<string[]>([])

    const [newRoom, setNewRoom] = useState('')
    const [newRoomRoundDuration, setNewRoomRoundDuration] = useState('')
    const [newRoomImageSet, setNewRoomImageSet] = useState('')
    const [newRoomRule, setNewRoomRule] = useState('')
    const [newRoomSizeLimitChecked, setNewRoomSizeLimitChecked] = useState(false);
    const [newRoomSizeLimit, setNewRoomSizeLimit] = useState('');
    const [labelsSwitchChecked, setLabelsSwitchChecked] = useState(false)
    const [AISwitchChecked, setAISwitchChecked] = useState(false)

    const [isRulesModalOpen, setIsRulesModalOpen] = useState(false)

    const selectedImages = newRoomImageSet && allImages[newRoomImageSet] ? allImages[newRoomImageSet] : []

    const handlePseudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        callbackPseudoChange(e)
        setPseudo(e.target.value)
    }
    const handleRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        callbackRoomChange(e)
        setRoom(e.target.value)
    }

    const handleLabelsSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLabelsSwitchChecked(event.target.checked)
    }

    const handleAISwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setAISwitchChecked(event.target.checked)
    }

    const callbackLabels = useCallback((newLeft: string[], newRight: string[]) => {
        setLeft(newLeft)
        setRight(newRight)
    }, [])

    const handleClickJoinRoom = () => {
        if (pseudo && room) {
            if (rooms.includes(room)) {
                socket.emit('joinRoom', room, pseudo)
                callbackJoinRoom(room)
            } else {
                alert('Cette room n\'existe pas ou a déjà commencé.')
            }
        } else {
            alert('Choisissez un pseudo et un numéro de room à rejoindre.')
        }
    }
    const handleClickCreateRoom = () => {
        const sizeLimit = newRoomSizeLimitChecked && newRoomSizeLimit.length > 0 ? parseInt(newRoomSizeLimit) : 1000
        socket.emit('createRoom', pseudo, newRoom, parseInt(newRoomRoundDuration), newRoomImageSet, newRoomRule, labelsSwitchChecked, AISwitchChecked, sizeLimit, left, right)
        callbackJoinRoom(newRoom)
    }

    const handleCheckboxChange = (event) => {
        setNewRoomSizeLimitChecked(event.target.checked);
        if (!event.target.checked) {
          setNewRoomSizeLimit(''); // Réinitialise l'input quand le checkbox est décoché
        }
      };

    const downloadImages = (newRoomImageSet: string) => {
        fetch('/images_to_download/' + newRoomImageSet + '.zip').then(response => {
            response.blob().then(blob => {
                // Creating new object of PDF file
                const fileURL = window.URL.createObjectURL(blob)
                // Setting various property values
                let alink = document.createElement('a')
                alink.href = fileURL
                alink.download = 'images.zip'
                alink.click()
            })
        })
    }

    useEffect(() => {
        socket.on('updateRooms', (rooms: string[]) => {
            setRooms(rooms)
        })

        socket.on('updateImages', (allImages: { [folder: string]: string[] }) => {
            setAllImages(allImages)
        })

        socket.on('roomAlreadyExists', () => {
            alert('Ce numéro de room existe déjà.')
        })

        socket.on('pseudoAlreadyExists', () => {
            alert('Ce pseudo existe déjà dans cette room.')
        })

        socket.on('roomFull', () => {
            alert('Cette room est déjà pleine.')
        })
    }, [socket])

    return (
        <>
        <Grid container justifyContent="center" spacing={5}>
            <Grid item textAlign="center" xs={12}>
                <Button variant="contained" color="success" endIcon={<MenuBookIcon />} onClick={() => setIsRulesModalOpen(true)} style={{ position: "absolute", left: 20 }}>
                    Règles du jeu
                </Button>
                <Typography variant="h3">ELEUS-IA</Typography>
                <Typography variant="h5">Dans la peau d'une intelligence artificielle</Typography>
            </Grid>
            <Grid item textAlign="center" xs={12}>
                <TextField required label="Pseudo" inputProps={{maxLength: 15}} value={pseudo} onChange={handlePseudoChange} variant="outlined" />
            </Grid>
            <Grid item xs={6}>
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ backgroundColor: 'lightblue' }}>
                        <Stack direction="row" alignItems="center">
                            <Typography variant="h6">Rejoindre une room</Typography>
                            <HelpTooltip title="Si vous ne connaissez pas le numéro de la room, demandez à son créateur de vous le communiquer." />
                        </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Stack spacing={2}>
                            <TextField label="Room code" value={room} onChange={handleRoomChange} variant="outlined" />
                            <Button variant="contained" disabled={pseudo.length === 0 || pseudo.length > 15 || room.length === 0} onClick={handleClickJoinRoom}>Rejoindre la room !</Button>
                        </Stack>
                    </AccordionDetails>
                </Accordion>
            </Grid>
            <Grid item xs={6}>
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ backgroundColor: 'lightblue' }}>
                        <Stack direction="row" alignItems="center">
                            <Typography variant="h6">Créer une nouvelle room</Typography>
                            <HelpTooltip title="Vous serez le maître de la room créée. Vous pourrez choisir le jeu de données, les labels ainsi que la configuration de la partie." />
                        </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Stack spacing={2}>
                            <TextField required label="Room code" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} variant="outlined" fullWidth />
                            <Select
                                value={newRoomRoundDuration}
                                displayEmpty
                                fullWidth
                                onChange={(e) => setNewRoomRoundDuration(e.target.value)}
                            >
                                <MenuItem value={''} selected>Sélectionne le temps offert pour chaque prédiction</MenuItem>
                                <MenuItem value={'10'}>Très court (10 secondes)</MenuItem>
                                <MenuItem value={'15'}>Court (15 secondes)</MenuItem>
                                <MenuItem value={'20'}>Moyen (20 secondes)</MenuItem>
                                <MenuItem value={'30'}>Long (30 secondes)</MenuItem>
                            </Select>
                            <Stack direction="row" justifyContent="space-between" spacing={2}>
                                <Select
                                    value={newRoomImageSet}
                                    displayEmpty
                                    fullWidth
                                    onChange={(e) => setNewRoomImageSet(e.target.value)}
                                >
                                    <MenuItem value={''} selected>Sélectionne un ensemble d'images</MenuItem>
                                    <MenuItem value={'cards'}>Cartes</MenuItem>
                                    <MenuItem value={'shapes'}>Formes</MenuItem>
                                    <MenuItem value={'faces'}>Visages</MenuItem>
                                    <MenuItem value={'cars'}>Voitures</MenuItem>
                                    <MenuItem value={'animals'}>Animaux</MenuItem>
                                    <MenuItem value={'abstract'}>Art abstrait</MenuItem>
                                    <MenuItem value={'objects'}>Objets</MenuItem>
                                    <MenuItem value={'words'}>Mots</MenuItem>
                                </Select>
                                <Tooltip title="Télécharger">
                                    <IconButton color="primary" onClick={() => downloadImages(newRoomImageSet)} disabled={newRoomImageSet.length === 0}><FileDownloadOutlined /></IconButton>
                                </Tooltip>
                            </Stack>
                            {newRoomImageSet &&
                                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                                    <ImageList variant="masonry" cols={8}>
                                        {selectedImages.slice(0, 50).map((item: string) => (
                                            <ImageListItem key={item}>
                                                <img
                                                    src={`${item}?w=50&fit=crop&auto=format`}
                                                    srcSet={`${item}?w=50&fit=crop&auto=format&dpr=2 2x`}
                                                    alt={item}
                                                    loading="lazy" />
                                            </ImageListItem>
                                        ))}
                                    </ImageList>
                                </Box>
                            }
                            <Stack direction="row" alignItems="center">
                                <FormControlLabel control={<Switch checked={labelsSwitchChecked} onChange={handleLabelsSwitchChange} inputProps={{ 'aria-label': 'controlled' }} />} label="Préparer les labels à l'avance" />
                                <HelpTooltip title="Cocher cette option permet de définir les labels à l'avance. Cela vous permet de ne pas avoir à catégoriser les images en cours de partie." />
                            </Stack>
                            <TransferImage key={newRoomImageSet} visible={labelsSwitchChecked} imagesList={selectedImages} callback={callbackLabels} />
                            <Stack direction="row" alignItems="center">
                                <FormControlLabel control={<Switch checked={AISwitchChecked} onChange={handleAISwitchChange} inputProps={{ 'aria-label': 'controlled' }} />} label="Ajouter une IA comme joueur (beta)" />
                                <HelpTooltip title="Cocher cette option va ajouter une IA à la liste des joueurs. Elle va s'entraîner à chaque image et faire ses prédictions comme tout autre joueur. Le modèle est un MobileNet-V3-small pré-entrainé identique à celui de Teachable Machine de Google." />
                            </Stack>
                            <Stack direction="row" alignItems="center">
                                <FormControlLabel
                                    control={
                                    <Checkbox
                                        checked={newRoomSizeLimitChecked}
                                        onChange={handleCheckboxChange}
                                        color="primary"
                                    />
                                    }
                                    label="Limiter le nombre de joueurs"
                                />
                                {newRoomSizeLimitChecked && (
                                    <TextField
                                    label="Entrez un nombre"
                                    type="number"
                                    value={newRoomSizeLimit}
                                    onChange={(e) => setNewRoomSizeLimit(e.target.value)}
                                    variant="outlined"
                                    margin="normal"
                                    />
                                )}
                            </Stack>
                            <TextField required label="Règle d'acceptation" multiline value={newRoomRule} onChange={(e) => setNewRoomRule(e.target.value)} variant="outlined" fullWidth />
                            <Button sx={{ marginTop: 2 }} variant="contained" disabled={pseudo.length === 0 || newRoom.length === 0 || newRoomImageSet.length === 0 || newRoomRoundDuration.length === 0 || newRoomRule.length === 0 || (labelsSwitchChecked && (left.length === 0 || right.length === 0))} onClick={handleClickCreateRoom}>{labelsSwitchChecked ? 'Préparer la room !' : 'Créer la room et superviser !'}</Button>
                        </Stack>
                    </AccordionDetails>
                </Accordion>
            </Grid>
        </Grid>
        <RulesModal open={isRulesModalOpen} handleClose={() => setIsRulesModalOpen(false)} />
        </>
    )
}

export default Home