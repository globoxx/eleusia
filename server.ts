import express = require('express')
import { createServer } from "http"
import { Server, Socket } from "socket.io"
import * as fs from 'fs'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer)

// our localhost port
const port = 5000
const path = __dirname + '/build/'

app.use(express.static(path));

app.get('/', function(_req, res) {
  res.sendFile(path + "index.html");
});

export interface User {
  score: number,
  vote: string | null
}

export interface Users {
  [pseudo: string]: User
}

export interface RoomData {
  counter: number,
  creator: string,
  has_started: boolean,
  timer: number,
  images: string[]
  users: Users
}

export interface Data {
  [roomId: string]: RoomData
}

const images_dir = 'build/images/cards'
const images = fs.readdirSync(images_dir).filter(file => file.endsWith('.png')).map(file => `${images_dir}/${file}`)
const round_duration = 10
const data: Data = {}

// This is what the socket.io syntax is like, we will work this later
io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`)

  socket.emit("updateRooms", Object.keys(data))

  socket.on('createRoom', (roomId: string, pseudo: string) => {
    console.log(`User ${socket.id} with pseudo ${pseudo} created new room ${roomId}`)
    data[roomId] = {
      counter: 0,
      creator: pseudo,
      has_started: false,
      timer: round_duration,
      images: images,
      users: {
        [pseudo]: {
          score: 0,
          vote: null
        }
      }
    }

    socket.join(roomId)
    io.in(roomId).emit('updateData', data[roomId])

    io.emit('updateRooms', Object.keys(data))
    console.log(`List of rooms ${Object.keys(data).toString()}`)
  })

  socket.on('joinRoom', (roomId: string, pseudo: string) => {
    if (roomId in data) {
      console.log(`User ${socket.id} with pseudo ${pseudo} joined room ${roomId}`)
      socket.join(roomId)
      data[roomId].users[pseudo] = {
        score: 0,
        vote: null
      }
      io.in(roomId).emit('updateData', data[roomId])
    } else {
      console.log('ROOM NOT FOUND')
    }
  })

  socket.on('buttonClick', (roomId: string, pseudo: string) => {
    console.log(`User ${socket.id} with pseudo ${pseudo} clicked button in room ${roomId}`)
    if (roomId in data) {
        data[roomId].counter++
        io.in(roomId).emit('counter', data[roomId].counter)
    } else {
        console.log(`User ${socket.id} with pseudo ${pseudo} clicked button in room ${roomId} but this room does not exist !`)
    }
  })

  socket.on('startGame', (roomId: string) => {
    console.log(`Game started in room ${roomId}`)
    if (roomId in data) {
        data[roomId].has_started = true
        start_new_round(roomId)
    } else {
        console.log(`Game started in room ${roomId} but this room does not exist !`)
    }
  })

  socket.on('vote', (roomId: string, pseudo: string, decision: string) => {
    console.log(`In room ${roomId}, ${pseudo} voted ${decision}`)
    data[roomId].users[pseudo].vote = decision
    io.in(roomId).emit('updateData', data[roomId])
  })

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
  })
})

function start_new_round(roomId: string) {
  console.log(`New round in room ${roomId}.`)
  // Get a random image path from the list of image paths
  const room_images = data[roomId].images
  const random_image = room_images[Math.floor(Math.random() * room_images.length)]

  // Remove the image from the list
  data[roomId].images= data[roomId].images.filter(img => img !== random_image)

  // Emit the random image path to all clients in the room
  io.in(roomId).emit('newRound', random_image)

  // Reset votes and update users
  for (const user_pseudo of Object.keys(data[roomId].users)) {
    data[roomId].users[user_pseudo].vote = null
  }
  io.in(roomId).emit('updateData', data[roomId])

  data[roomId].timer = round_duration
}

setInterval(function(){
  for (const roomId in data) {
    if (data[roomId].has_started) {
      data[roomId].timer--
      if (data[roomId].timer <= 0) {
        const creator = data[roomId].creator
        const vote_of_creator = data[roomId].users[creator].vote
        if (vote_of_creator != null) {
          for (const user_pseudo of Object.keys(data[roomId].users)) {
            if (user_pseudo !== creator) {
              const user_vote = data[roomId].users[user_pseudo].vote
              if (user_vote === vote_of_creator) {
                data[roomId].users[user_pseudo].score++
              }
            }
          }
          // -----------------------------------------------------
          start_new_round(roomId)
        } else {
          console.log('CREATOR VOTE IS NULL, WAIT ON HIM')
          io.in(roomId).emit('waitCreator')
        }
      }
      io.in(roomId).emit('timer', data[roomId].timer)
    }
  }
}, 1000)

httpServer.listen(port, () => console.log(`Listening on port ${port.toString()}`))
