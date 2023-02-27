const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const data = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinRoom', (roomId) => {
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.join(roomId);
    let is_creator = false;
    if (!(roomId in data)) {
      data[roomId] = {
        counter: 0,
        creator: socket.id, // set createdBy to the current socket's ID
        users: {
            id: {
                'points': 0
            }
        }
      }
      is_creator = true;
    }
    socket.emit('roomJoined', data[roomId]['counter'], is_creator);
  });

  socket.on('buttonClick', (roomId) => {
    console.log(`User ${socket.id} clicked button in room ${roomId}`);
    if (roomId in data) {
        data[roomId]['counter']++;
        io.to(roomId).emit(`counter:${roomId}`, data[roomId]['counter']);
    } else {
        console.log(`User ${socket.id} clicked button in room ${roomId} but this room does not exist !`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

http.listen(3000, () => {
  console.log('Server listening on port 3000');
});
