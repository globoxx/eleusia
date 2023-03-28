import React, { useEffect, useState } from 'react'
import { TextField, Button, Grid, Accordion, AccordionSummary, AccordionDetails, MenuItem, Select, ImageList, ImageListItem, Box} from '@mui/material'
import { Socket } from 'socket.io-client'
import { ExpandMoreOutlined } from '@mui/icons-material'

function Home({socket, callbackPseudoChange, callbackRoomChange, callbackJoinRoom}: {socket: Socket, callbackPseudoChange: (e: React.ChangeEvent<HTMLInputElement>) => void, callbackRoomChange: (e: React.ChangeEvent<HTMLInputElement>) => void, callbackJoinRoom: (room: string) => void}) {
    const [rooms, setRooms] = useState<string[]>([])
    const [pseudo, setPseudo] = useState('')
    const [room, setRoom] = useState('')

    const [allImages, setAllImages] = useState<{[folder: string]: string[]}>({})

    const [newRoom, setNewRoom] = useState('')
    const [newRoomRoundDuration, setNewRoomRoundDuration] = useState(10)
    const [newRoomImageSet, setNewRoomImageSet] = useState('')

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
          socket.emit('createRoom', pseudo, newRoom, newRoomRoundDuration, newRoomImageSet)
          callbackJoinRoom(newRoom)
        } else {
          alert('Choisissez un pseudo pour rejoindre une room.');
        }
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
                <AccordionSummary expandIcon={<ExpandMoreOutlined />} aria-controls="panel1a-content" id="panel1a-header" >
                    Créer une nouvelle room
                </AccordionSummary>
                <AccordionDetails>
                    <TextField id="outlined-basic" label="Room code" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} variant="outlined" />
                    <TextField inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} value={newRoomRoundDuration} onChange={(e) => setNewRoomRoundDuration(parseInt(e.target.value))} />
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={newRoomImageSet}
                        label="Images"
                        onChange={(e) => setNewRoomImageSet(e.target.value)}
                    >
                        <MenuItem value={'cards'}>Cartes</MenuItem>
                        <MenuItem value={'abstract'}>Abstrait</MenuItem>
                    </Select>
                    <Box sx={{maxHeight: 200, overflow: 'auto'}}>
                        <ImageList variant="masonry" cols={10}>
                            {selectedImages.map((item: string) => (
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
                    <Button variant="contained" disabled={pseudo.length === 0 || newRoom.length === 0 || newRoomImageSet.length === 0} onClick={handleClickCreateRoom}>Créer la room !</Button>
                </AccordionDetails>
            </Accordion>
        </Grid>
    </Grid>
    )
}

export default Home