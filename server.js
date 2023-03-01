const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

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
      timer: 30,
      users: {
          [pseudo]: {
              'score': 0
          }
      }
    }

    io.emit('updateRooms', Object.keys(data));
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
  let i = 0
  for (const roomId in data) {
    console.log(`${roomId} ${i}`);
    if (data[roomId]['has_started']) {
      data[roomId]['timer']--;
      if (data[roomId]['timer'] <= 0) {
        data[roomId]['timer'] = 30
      }
      io.in(roomId).emit('timer', data[roomId]['timer']);
    }
    i++;
  }
}, 1000);

http.listen(3000, () => {
  console.log('Server listening on port 3000');
});
