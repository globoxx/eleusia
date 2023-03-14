export interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
}

export interface ClientToServerEvents {
  hello: () => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  name: string;
  age: number;
}

import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: {
    origin: "https://example.com"
  }
});

// our localhost port
const port = 5000

app.use(cors());

// This is what the socket.io syntax is like, we will work this later
io.on('connection', socket => {
  console.log('User connected')
  
  socket.on('disconnect', () => {
    console.log('user disconnected')
  })
})

httpServer.listen(port, () => console.log(`Listening on port ${port}`));
