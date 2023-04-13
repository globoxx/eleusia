import React, { useEffect, useState } from 'react'
import { TextField, Button, Grid, Accordion, AccordionSummary, AccordionDetails, MenuItem, Select, ImageList, ImageListItem, Box, Typography, Stack, IconButton, Tooltip } from '@mui/material'
import { Socket } from 'socket.io-client'
import { ExpandMoreOutlined, FileDownloadOutlined } from '@mui/icons-material'

function Home({socket, callbackPseudoChange, callbackRoomChange, callbackJoinRoom}: {socket: Socket, callbackPseudoChange: (e: React.ChangeEvent<HTMLInputElement>) => void, callbackRoomChange: (e: React.ChangeEvent<HTMLInputElement>) => void, callbackJoinRoom: (room: string) => void}) {
    const [rooms, setRooms] = useState<string[]>([])
    const [pseudo, setPseudo] = useState('')
    const [room, setRoom] = useState('')

    const [allImages, setAllImages] = useState<{[folder: string]: string[]}>({})

    const [newRoom, setNewRoom] = useState('')
    const [newRoomRoundDuration, setNewRoomRoundDuration] = useState(10)
    const [newRoomImageSet, setNewRoomImageSet] = useState('')
    const [newRoomRule, setNewRoomRule] = useState('')

    const selectedImages = newRoomImageSet && allImages[newRoomImageSet] ? allImages[newRoomImageSet] : []

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
          socket.emit('createRoom', pseudo, newRoom, newRoomRoundDuration, newRoomImageSet, newRoomRule)
          callbackJoinRoom(newRoom)
        } else {
          alert('Choisissez un pseudo pour rejoindre une room.');
        }
    }

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

    useEffect(()=>{
        socket.on('updateRooms', (rooms: string[]) => {
            setRooms(rooms)
        })

        socket.on('updateImages', (allImages: {[folder: string]: string[]}) => {
            setAllImages(allImages)
        })
    },[socket])

    return (
    <Grid container justifyContent="space-evenly" alignItems="flex-start" alignContent="flex-start" spacing={5}>
        <Grid item textAlign="center" xs={12}>
            <Typography variant="h3">ELEUS-IA</Typography>
            <Typography variant="h5">Qui sera la meilleure IA ?</Typography>
        </Grid>
        <Grid item textAlign="center" xs={12}>
            <TextField id="outlined-basic" label="Pseudo" value={pseudo} onChange={handlePseudoChange} variant="outlined" />
        </Grid>
        <Grid container item direction="column" alignContent="center" alignItems="center" justifyContent="flex-start" spacing={2} xs={6}>
            <Grid item>
                <Typography variant="h6">Rejoindre une room</Typography>
            </Grid>
            <Grid item>
                <TextField id="outlined-basic" label="Room code" value={room} onChange={handleRoomChange} variant="outlined" />
            </Grid>
            <Grid item>
                <Button variant="contained" disabled={pseudo.length === 0 || room.length === 0} onClick={handleClickJoinRoom}>Rejoindre</Button>
            </Grid>
        </Grid>
        <Grid item xs={6}>
            <Accordion sx={{width: '75%'}}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{backgroundColor: 'lightblue'}} aria-controls="panel1a-content" id="panel1a-header" >
                    <Typography variant="h6">Créer une nouvelle room</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Stack spacing={2}>
                        <TextField id="outlined-basic" label="Room code" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} variant="outlined" fullWidth />
                        <TextField id="outlined-basic" label="Durée d'un round (s)" type='number' value={newRoomRoundDuration} onChange={(e) => setNewRoomRoundDuration(parseInt(e.target.value))} variant="outlined" error={newRoomRoundDuration <= 0} fullWidth/>
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                            <Select
                                labelId="demo-simple-select-label"
                                id="demo-simple-select"
                                value={newRoomImageSet}
                                displayEmpty
                                fullWidth
                                onChange={(e) => setNewRoomImageSet(e.target.value)}
                            >
                                <MenuItem value={''} selected>Sélectionne un ensemble d'images</MenuItem>
                                <MenuItem value={'cards'}>Cartes</MenuItem>
                                <MenuItem value={'abstract'}>Art abstrait</MenuItem>
                                <MenuItem value={'shapes'}>Formes</MenuItem>
                                <MenuItem value={'words'}>Mots</MenuItem>
                            </Select>
                            <Tooltip title="Télécharger">
                                <IconButton color="primary" onClick={() => downloadImages(newRoomImageSet)} disabled={newRoomImageSet.length === 0}><FileDownloadOutlined /></IconButton>
                            </Tooltip>
                        </Stack>
                        <Box sx={{maxHeight: 200, overflow: 'auto'}}>
                            <ImageList variant="masonry" cols={8}>
                                {selectedImages.slice(0, 50).map((item: string) => (
                                    <ImageListItem key={item}>
                                    <img
                                        src={`${item}?w=50&fit=crop&auto=format`}
                                        srcSet={`${item}?w=50&fit=crop&auto=format&dpr=2 2x`}
                                        alt={item}
                                        loading="lazy"
                                    />
                                    </ImageListItem>
                                ))}
                            </ImageList>
                        </Box>
                        <TextField id="outlined-basic" label="Règle d'acceptation" multiline value={newRoomRule} onChange={(e) => setNewRoomRule(e.target.value)} variant="outlined" fullWidth />
                        <Button sx={{marginTop: 2}} variant="contained" disabled={pseudo.length === 0 || newRoom.length === 0 || newRoomImageSet.length === 0 || newRoomRoundDuration <= 0 || newRoomRule.length === 0} onClick={handleClickCreateRoom}>Créer la room !</Button>
                    </Stack>
                </AccordionDetails>
            </Accordion>
        </Grid>
    </Grid>
    )
}

export default Home