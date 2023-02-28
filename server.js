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
      users: {
          [pseudo]: {
              'score': 0
          }
      }
    }

    io.emit('updateRooms', Object.keys(data));
    console.log(`List of rooms ${Object.keys(data)}`);
  })

  socket.on('joinRoom', (roomId, pseudo) => {
    if (roomId in data) {
      console.log(`User ${socket.id} with pseudo ${pseudo} joined room ${roomId}`);
      socket.join(roomId);
      data[roomId]['users'][pseudo] = {
        'score': 0
      }
      const is_creator = pseudo === data[roomId]['creator'];
      io.to(roomId).emit('roomJoined', data[roomId], is_creator);
    } else {
      console.log('ROOM NOT FOUND');
    }
  });

  socket.on('buttonClick', (roomId, pseudo) => {
    console.log(`User ${socket.id} with pseudo ${pseudo} clicked button in room ${roomId}`);
    if (roomId in data) {
        data[roomId]['counter']++;
        data[roomId]['users'][pseudo]['score']++;
        io.to(roomId).emit(`counter`, data[roomId]);
    } else {
        console.log(`User ${socket.id} with pseudo ${pseudo} clicked button in room ${roomId} but this room does not exist !`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

http.listen(3000, () => {
  console.log('Server listening on port 3000');
});
