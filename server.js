const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const images_dir = '/images/cards';
const images = fs.readdirSync('./public' + images_dir).filter(file => file.endsWith('.png')).map(file => `${images_dir}/${file}`);

app.use(express.static(path.join(__dirname, 'public')));

const round_duration = 10;

const data = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.emit('updateRooms', Object.keys(data));

  socket.on('createRoom', (roomId, pseudo) => {
    console.log(`User ${socket.id} with pseudo ${pseudo} created new room ${roomId}`);
    data[roomId] = {
      counter: 0,
      creator: pseudo,
      has_started: false,
      timer: round_duration,
      users: {},
      images: images
    }

    io.emit('updateRooms', Object.keys(data));
    console.log(`List of rooms ${Object.keys(data)}`);
  });

  socket.on('joinRoom', (roomId, pseudo) => {
    if (roomId in data) {
      console.log(`User ${socket.id} with pseudo ${pseudo} joined room ${roomId}`);
      socket.join(roomId);
      const is_creator = data[roomId]['creator'] === pseudo;
      data[roomId]['users'][pseudo] = {
        'score': is_creator ? 'Maître du jeu' : 0,
        'vote': null
      };
      io.in(roomId).emit('roomJoined', data[roomId]);
    } else {
      console.log('ROOM NOT FOUND');
    }
  });

  socket.on('buttonClick', (roomId, pseudo) => {
    console.log(`User ${socket.id} with pseudo ${pseudo} clicked button in room ${roomId}`);
    if (roomId in data) {
        data[roomId]['counter']++;
        io.in(roomId).emit('counter', data[roomId]['counter']);
    } else {
        console.log(`User ${socket.id} with pseudo ${pseudo} clicked button in room ${roomId} but this room does not exist !`);
    }
  });

  socket.on('startGame', (roomId) => {
    console.log(`Game started in room ${roomId}`);
    if (roomId in data) {
        data[roomId]['has_started'] = true;
        start_new_round(roomId);
    } else {
        console.log(`Game started in room ${roomId} but this room does not exist !`);
    }
  });

  socket.on('vote', (roomId, pseudo, decision) => {
    console.log(`In room ${roomId}, ${pseudo} voted ${decision}`);
    data[roomId]['users'][pseudo]['vote'] = decision;
    io.in(roomId).emit('updateUsers', data[roomId]['users']);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

function start_new_round(roomId) {
  console.log(`New round in room ${roomId}.`)
  // Get a random image path from the list of image paths
  const room_images = data[roomId]['images']
  const random_image = room_images[Math.floor(Math.random() * room_images.length)];

  // Remove the image from the list
  data[roomId]['images']= data[roomId]['images'].filter(img => img != random_image)

  // Emit the random image path to all clients in the room
  io.in(roomId).emit('newRound', random_image);

  // Reset votes and update users
  for (const user_pseudo of Object.keys(data[roomId]['users'])) {
    data[roomId]['users'][user_pseudo]['vote'] = null;
  }
  io.in(roomId).emit('updateUsers', data[roomId]['users']);

  data[roomId]['timer'] = round_duration;
}

const clock = setInterval(function(){
  for (const roomId in data) {
    if (data[roomId]['has_started']) {
      data[roomId]['timer']--;
      if (data[roomId]['timer'] <= 0) {
        const creator = data[roomId]['creator'];
        const vote_of_creator = data[roomId]['users'][creator]['vote'];
        if (vote_of_creator != null) {
          for (const user_pseudo of Object.keys(data[roomId]['users'])) {
            if (user_pseudo != creator) {
              const user_vote = data[roomId]['users'][user_pseudo]['vote'];
              if (user_vote === vote_of_creator) {
                data[roomId]['users'][user_pseudo]['score']++;
              }
            }
          }
          // -----------------------------------------------------
          start_new_round(roomId);
        } else {
          console.log('CREATOR VOTE IS NULL, WAIT ON HIM');
          // Emit the random image path to all clients in the room
          io.in(roomId).emit('waitCreator');
        }
      }
      io.in(roomId).emit('timer', data[roomId]['timer']);
    }
  }
}, 1000);

http.listen(3000, () => {
  console.log('Server listening on port 3000');
});
