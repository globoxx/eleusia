import Button from '@mui/material/Button';
import Image from 'mui-image'
import React, { useState } from 'react';
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { RoomData } from '../../../server/server';
import ImagesContainer from './ImagesContainer';
import UsersTable from './UsersTable';

function BoardGame({socket, pseudo, room}: {socket: Socket, pseudo: string, room: string}) {

    const [roomData, setRoomData] = useState<RoomData>({})
    const [counter, setCounter] = useState<number>(0)
    const [timer, setTimer] = useState<number | string>(0)
    const [waitOnCreator, setWaitOnCreator] = useState(false)
    const [currentImage, setCurrentImage] = useState('')
    const [votingDisabled, setVotingDisabled] = useState(false)
    const [acceptedImages, setAcceptedImages] = useState<string[]>([])
    const [refusedImages, setRefusedImages] = useState<string[]>([])

    const isRoomCreator = pseudo === roomData.creator
    const message = isRoomCreator ? "Bienvenue Ô créateur" : "Hey t'es un simple joueur"

    const handleClickIncreaseCounter = () => {

    }

    const handleClickStartGame = () => {

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
        socket.on('counter', (counter: number) => {
            setCounter(counter)
        });

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
        <>
        <h1>Room {room}</h1>
        <p>Counter: {counter}</p>
        <p>Score: {roomData.users[pseudo].score}</p> 
        <Button variant="contained" onClick={handleClickIncreaseCounter}>Increase counter</Button>
        <p>{message}</p>

        <p>Timer: {timer}</p>

        {isRoomCreator ?
            <Button variant="contained" onClick={handleClickStartGame}>Start game</Button>
            : null
        }

        <UsersTable users={roomData.users} />

        {currentImage ? <Image src={currentImage} width={500} /> : null}

        <Button variant="contained" onClick={handleClickRefuse} disabled={votingDisabled}>Refuser</Button>
        <Button variant="contained" onClick={handleClickAccept} disabled={votingDisabled}>Accepter</Button>

        
        <ImagesContainer images={acceptedImages} category={"Accepté"}/>

        <ImagesContainer images={refusedImages} category={"Accepté"}/>

        </>
    )
}

export default BoardGame;
