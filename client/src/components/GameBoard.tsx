import Button from '@mui/material/Button';
import React, { useState } from 'react';
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

function BoardGame({socket, pseudo, room}: {socket: Socket, pseudo: string, room: string}) {

    const [counter, setCounter] = useState<number>(0)
    const [timer, setTimer] = useState<number | string>(0)

    const is_creator = pseudo === data['creator']

    const handleClickIncreaseCounter = () => {

    }

    const handleClickStartGame = () => {

    }

    const handleVote = (decision: string) => {
        socket.emit('vote', room, pseudo, decision);
        
        // Disable voting buttons

        // Remove main image

        // Add image to category
    }

    const handleClickRefuse = () => handleVote('Refuse')
    const handleClickAccept = () => handleVote('Accept')

    useEffect(()=>{
        socket.on('roomJoined', (data) => {
            loadTableData(data['users']);
        });
    
        socket.on('counter', (counter: number) => {
            setCounter(counter)
        });

        socket.on('updateUsers', (users) => {
            loadTableData(users);
        });
    
        socket.on('timer', (timer: number) => {
            if (!wait_on_creator) {
                setTimer(timer)
            } else {
                setTimer("LE MAÎTRE DU JEU DOIT JOUER")
            }
        });
    
        socket.on('newRound', (image_path: string) => {
            // Create a new image element
            const image = new Image();
            image.src = image_path;
            image.width = 100;
            current_image = image;

            // Add the image to the page
            const imageContainer = document.getElementById('image');
            imageContainer.innerHTML = '';
            imageContainer.appendChild(image);

            const button_refuser = document.getElementById("button-refuser");
            const button_accepter = document.getElementById("button-accepter");
            button_refuser.disabled = false;
            button_accepter.disabled = false;

            wait_on_creator = false;
        });

        socket.on('waitCreator', () => {
            wait_on_creator = true;
        });
    },[])

    return (
        <>
        <h1>Room {room}</h1>
        <p>Counter: {counter}</p>
        <p>Score: {score}</p> 
        <Button variant="contained" onClick={handleClickIncreaseCounter}>Increase counter</Button>
        <p>{message}</p>

        <p>Timer: {timer}</p>

        {is_creator ?
            <Button variant="contained" onClick={handleClickStartGame}>Start game</Button>
            : null
        }

        <Button variant="contained" onClick={handleClickRefuse}>Refuser</Button>
        <Button variant="contained" onClick={handleClickAccept}>Accepter</Button>

        <div class="image-container" id="refused-container"></div>

        <div class="image-container" id="accepted-container"></div>

        </>
    );
}

export default BoardGame;
