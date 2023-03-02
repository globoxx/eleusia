const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const images_dir = './public/images/cards';
const images = fs.readdirSync(images_dir).filter(file => file.endsWith('.png')).map(file => `${images_dir}/${file}`);

app.use(express.static(path.join(__dirname, 'public')));

const data = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.emit('readRooms', Object.keys(data));

  socket.on('createRoom', (roomId, pseudo) => {
    console.log(`User ${socket.id} with pseudo ${pseudo} created new room ${roomId}`);
    data[roomId] = {
      counter: 0,
      creator: pseudo,
      has_started: false,
      timer: 30,
      users: {
          [pseudo]: {
              'score': 0
          }
      },
      images: images
    }

    io.emit('readRooms', Object.keys(data));
    console.log(`List of rooms ${Object.keys(data)}`);
  });

  socket.on('joinRoom', (roomId, pseudo) => {
    if (roomId in data) {
      console.log(`User ${socket.id} with pseudo ${pseudo} joined room ${roomId}`);
      socket.join(roomId);
      data[roomId]['users'][pseudo] = {
        'score': 0
      }
      io.in(roomId).emit('roomJoined', data[roomId]);
    } else {
      console.log('ROOM NOT FOUND');
    }
  });

  socket.on('buttonClick', (roomId, pseudo) => {
    console.log(`User ${socket.id} with pseudo ${pseudo} clicked button in room ${roomId}`);
    if (roomId in data) {
        data[roomId]['counter']++;
        data[roomId]['users'][pseudo]['score']++;
        io.in(roomId).emit(`counter`, data[roomId]);
    } else {
        console.log(`User ${socket.id} with pseudo ${pseudo} clicked button in room ${roomId} but this room does not exist !`);
    }
  });

  socket.on('startGame', (roomId) => {
    console.log(`Game started in room ${roomId}`);
    if (roomId in data) {
        data[roomId]['has_started'] = true;
    } else {
        console.log(`Game started in room ${roomId} but this room does not exist !`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const clock = setInterval(function(){
  for (const roomId in data) {
    if (data[roomId]['has_started']) {
      data[roomId]['timer']--;
      if (data[roomId]['timer'] <= 0) {
        console.log(`New round in room ${roomId}.`)
        // Get a random image path from the list of image paths
        const room_images = data[roomId]['images']
        const random_image = room_images[Math.floor(Math.random() * room_images.length)];

        // Remove the image from the list
        data[roomId]['images']= data[roomId]['images'].filter(img => img != random_image)
        
        // Emit the random image path to all clients in the room
        io.in(roomId).emit('showImage', random_image);

        data[roomId]['timer'] = 30
      }
      io.in(roomId).emit('timer', data[roomId]['timer']);
    }
  }
}, 1000);

http.listen(3000, () => {
  console.log('Server listening on port 3000');
});
