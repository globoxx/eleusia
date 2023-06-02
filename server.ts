import express = require('express')
import cors = require('cors')
import { createServer } from "http"
import { Server, Socket } from "socket.io"
import path = require('path')
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
  socketId: string,
  totalScore: number,
  lastScore: number | null,
  allScores: number[],
  vote: number | null
}

export interface Users {
  [pseudo: string]: User
}

export interface RoomData {
  rule: string,
  roundDuration: number,
  creator: string,
  autoRun: boolean,
  hasAI: boolean,
  paused: boolean,
  refusedImages: string[],
  acceptedImages: string[],
  hasStarted: boolean,
  hasFinished: boolean,
  timer: number,
  images: string[]
  currentImage: string | null,
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

  socket.on('createRoom', (pseudo: string, roomId: string, roundDuration: number, imageSet: string, rule: string, autoRun: boolean, hasAI: boolean, left: string[], right: string[]) => {
    if (roomId in data) {
      console.log(`User ${socket.id} with pseudo ${pseudo} tried to create room ${roomId} but this room already exists !`)
      socket.emit('roomAlreadyExists')
      return
    }
    console.log(`User ${socket.id} with pseudo ${pseudo} created new room ${roomId} with autorun: ${autoRun}`)
    const images = allImages[imageSet]
    data[roomId] = {
      rule: rule,
      roundDuration: roundDuration,
      creator: pseudo,
      autoRun: autoRun,
      hasAI: hasAI,
      paused: false,
      refusedImages: left,
      acceptedImages: right,
      hasStarted: false,
      hasFinished: false,
      timer: roundDuration,
      images: images,
      currentImage: null,
      users: {
        [pseudo]: {
          socketId: socket.id,
          totalScore: 0,
          lastScore: null,
          allScores: [],
          vote: null
        },
        ...(hasAI && {'Eleus-IA': {
          socketId: '0',
          totalScore: 0,
          lastScore: null,
          allScores: [],
          vote: null
        }})
      }
    }

    socket.join(roomId)

    io.in(roomId).emit('updateRoomData', data[roomId])

    io.emit("updateRooms", Object.keys(Object.fromEntries(Object.entries(data).filter(([, roomData]) => !roomData.hasStarted))))
    console.log(`List of rooms ${Object.keys(data).toString()}`)
  })

  socket.on('joinRoom', (roomId: string, pseudo: string) => {
    if (roomId in data) {
      if (pseudo in data[roomId].users) {
        console.log(`User ${socket.id} with pseudo ${pseudo} tried to join room ${roomId} but this pseudo already exists !`)
        socket.emit('pseudoAlreadyExists')
        return
      }
      console.log(`User ${socket.id} with pseudo ${pseudo} joined room ${roomId}`)
      socket.join(roomId)
      data[roomId].users[pseudo] = {
        socketId: socket.id,
        totalScore: 0,
        lastScore: null,
        allScores: [],
        vote: null
      }
      io.in(roomId).emit('updateRoomData', data[roomId])
    } else {
      console.log(`ROOM WITH ID ${roomId} NOT FOUND`)
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

  socket.on('endGame', (roomId: string) => {
    console.log(`The creator ended the game in room ${roomId}`)
    data[roomId].hasFinished = true
    io.in(roomId).emit('updateRoomData', data[roomId])
  })

  socket.on('leaveRoom', (roomId: string, pseudo: string) => {
    console.log(`User ${pseudo} with socket id ${socket.id} left room ${roomId}`)
    socket.leave(roomId)

    // Remove the user associated to the socket from the data
    for (const roomId of Object.keys(data)) {
      for (const userPseudo of Object.keys(data[roomId].users)) {
        if (userPseudo === pseudo) {
          delete data[roomId].users[userPseudo]
          io.in(roomId).emit('updateRoomData', data[roomId])
          if (data[roomId].hasStarted && userPseudo === data[roomId].creator && !data[roomId].autoRun) {
            // The creator left the room, game over
            data[roomId].hasFinished = true
          }
        }
      }
    }

    socket.emit("updateRooms", Object.keys(Object.fromEntries(Object.entries(data).filter(([, roomData]) => !roomData.hasStarted))))
    io.in(roomId).emit('updateRoomData', data[roomId])
  })

  socket.on('pause', (roomId: string) => {
    if (!data[roomId].paused) {
      console.log(`The room ${roomId} is posed`)
    } else {
      console.log(`The room ${roomId} resumes`)
    }
    
    data[roomId].paused = !data[roomId].paused
    io.in(roomId).emit('updateRoomData', data[roomId])
  })

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)

    // Remove the user associated to the socket from the data
    let roomIdOfUser
    for (const roomId of Object.keys(data)) {
      for (const userPseudo of Object.keys(data[roomId].users)) {
        if (data[roomId].users[userPseudo].socketId === socket.id) {
          roomIdOfUser = roomId
          delete data[roomId].users[userPseudo]
          io.in(roomId).emit('updateRoomData', data[roomId])
          if (data[roomId].hasStarted && userPseudo === data[roomId].creator && !data[roomId].autoRun) {
            // The creator left the room, game over
            data[roomId].hasFinished = true
          }
        }
      }
    }

    io.in(roomIdOfUser).emit('updateRoomData', data[roomIdOfUser])
  })
})

function startNewRound(roomId: string) {
  const room_images = data[roomId].images
  
  if (room_images.length > 0) {
    console.log(`New round in room ${roomId}.`)
    const random_image = room_images[Math.floor(Math.random() * room_images.length)]
    data[roomId].currentImage = random_image

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
  for (const roomId of Object.keys(data)) {
    if (data[roomId].hasStarted && !data[roomId].hasFinished && !data[roomId].paused) {
      data[roomId].timer--
      if (Object.values(data[roomId].users).map(user => user.vote).every(vote => vote !== null)) {
        data[roomId].timer = 0
      }
      if (data[roomId].timer <= 0) {
        const creator = data[roomId].creator
        let creatorVote: number | null = null
        if (data[roomId].autoRun) {
          const currentImage = data[roomId].currentImage
          if (currentImage) {
            creatorVote = data[roomId].acceptedImages.includes(currentImage) ? 1 : -1
          } else {
            console.log('CURRENT IMAGE IS NULL')
          }
        } else {
          creatorVote = data[roomId].users[creator].vote
        }
        if (creatorVote != null) {
          const usersPoints: {[pseudo: string]: number} = {}
          for (const userPseudo of Object.keys(data[roomId].users)) {
            if (userPseudo !== creator) {
              const userVote = data[roomId].users[userPseudo].vote ?? 0
              const points = Math.round((1 - Math.abs(creatorVote - userVote)) * 100)
              data[roomId].users[userPseudo].lastScore = points
              data[roomId].users[userPseudo].allScores.push(points)
              data[roomId].users[userPseudo].totalScore += points
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
