import express = require('express')
import cors = require('cors')
import { createServer } from "http"
import { Server, Socket } from "socket.io"
import path = require('path')
import sizeOf from 'image-size'
import * as fs from 'fs'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer)

const port = 5000
const build_path = path.join(__dirname, 'build')

app.use(cors())
app.use(express.static(build_path))
app.use('/images', express.static(path.join(build_path, 'images')))

app.get('/', function(_req, res) {
  res.sendFile(path.join(build_path, 'index.html'))
})

export interface User {
  score: number,
  vote: number | null
}

export interface Users {
  [pseudo: string]: User
}

export interface RoomData {
  roundDuration: number,
  creator: string,
  hasStarted: boolean,
  hasFinished: boolean,
  timer: number,
  images: string[]
  imageSize: {width: number, height: number},
  users: Users
}

export interface Data {
  [roomId: string]: RoomData
}

const data: Data = {}

const imagesFolder = path.join(build_path, 'images')
const imageFolders = fs.readdirSync(imagesFolder)
const allImages: {[folder: string]: string[]} = {}
for (const imageFolder of imageFolders) {
  allImages[imageFolder] = fs.readdirSync(path.join(imagesFolder, imageFolder)).filter((file: string) => file.endsWith('.png') || file.endsWith('.jpg')).map((file: string) => path.join('images', imageFolder, file))
}

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`)

  socket.emit("updateRooms", Object.keys(Object.fromEntries(Object.entries(data).filter(([, roomData]) => !roomData.hasStarted))))
  socket.emit("updateImages", allImages)

  socket.on('createRoom', (pseudo: string, roomId: string, roundDuration: number, imageSet: string) => {
    console.log(`User ${socket.id} with pseudo ${pseudo} created new room ${roomId}`)
    const images = allImages[imageSet]
    const imageDimensions = sizeOf(path.join(build_path, images[0]))
    const imageSize = {width: imageDimensions.width ?? 100, height: imageDimensions.height ?? 100}
    data[roomId] = {
      roundDuration: roundDuration,
      creator: pseudo,
      hasStarted: false,
      hasFinished: false,
      timer: roundDuration,
      images: images,
      imageSize: imageSize,
      users: {
        [pseudo]: {
          score: 0,
          vote: null
        }
      }
    }

    socket.join(roomId)

    io.in(roomId).emit('updateRoomData', data[roomId])

    io.emit("updateRooms", Object.keys(Object.fromEntries(Object.entries(data).filter(([, roomData]) => !roomData.hasStarted))))
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
      io.in(roomId).emit('updateRoomData', data[roomId])
    } else {
      console.log('ROOM NOT FOUND')
    }
  })

  socket.on('startGame', (roomId: string) => {
    console.log(`Game started in room ${roomId}`)
    if (roomId in data) {
        data[roomId].hasStarted = true
        startNewRound(roomId)
    } else {
        console.log(`Game started in room ${roomId} but this room does not exist !`)
    }
  })

  socket.on('vote', (roomId: string, pseudo: string, vote: number) => {
    console.log(`In room ${roomId}, ${pseudo} voted ${vote}`)
    data[roomId].users[pseudo].vote = vote
    io.in(roomId).emit('updateRoomData', data[roomId])
  })

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
  })
})

function startNewRound(roomId: string) {
  const room_images = data[roomId].images
  
  if (room_images.length > 0) {
    console.log(`New round in room ${roomId}.`)
    const random_image = room_images[Math.floor(Math.random() * room_images.length)]

    // Remove the image from the list
    data[roomId].images = data[roomId].images.filter(img => img !== random_image)

    // Emit the random image path to all clients in the room
    io.in(roomId).emit('newRound', random_image)

    // Reset votes and update users
    for (const user_pseudo of Object.keys(data[roomId].users)) {
      data[roomId].users[user_pseudo].vote = null
    }

    data[roomId].timer = data[roomId].roundDuration
  } else {
    console.log(`No more images in room ${roomId}.`)
    data[roomId].hasFinished = true
  }

  io.in(roomId).emit('updateRoomData', data[roomId])
}

setInterval(function(){
  for (const roomId in data) {
    if (data[roomId].hasStarted) {
      data[roomId].timer--
      if (Object.values(data[roomId].users).map(user => user.vote).every(vote => vote !== null)) {
        data[roomId].timer = 0
      }
      if (data[roomId].timer <= 0) {
        const creator = data[roomId].creator
        const creatorVote = data[roomId].users[creator].vote
        if (creatorVote != null) {
          const usersPoints: {[pseudo: string]: number} = {}
          for (const userPseudo of Object.keys(data[roomId].users)) {
            if (userPseudo !== creator) {
              const userVote = data[roomId].users[userPseudo].vote ?? 0
              const points = Math.round((1 - Math.abs(creatorVote - userVote)) * 100)
              data[roomId].users[userPseudo].score += points
              usersPoints[userPseudo] = points
            }
          }
          io.in(roomId).emit('endOfRound', usersPoints, creatorVote)
          // -----------------------------------------------------
          startNewRound(roomId)
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
