"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var cors = require("cors");
var http_1 = require("http");
var socket_io_1 = require("socket.io");
var fs = require("fs");
var path = require("path");
var app = express();
var httpServer = (0, http_1.createServer)(app);
var io = new socket_io_1.Server(httpServer);
var port = 5000;
var build_path = path.join(__dirname, 'build');
var images_dir = path.join(build_path, 'images', 'cards');
var images = fs.readdirSync(images_dir).filter(function (file) { return file.endsWith('.png'); }).map(function (file) { return path.join('images', 'cards', file); });
var round_duration = 10;
var data = {};
app.use(cors());
app.use(express.static(build_path));
app.use('/images', express.static(images_dir));
app.get('/', function (_req, res) {
    res.sendFile(path.join(build_path, 'index.html'));
});
io.on('connection', function (socket) {
    console.log("User connected: ".concat(socket.id));
    socket.emit("updateRooms", Object.keys(data));
    socket.on('createRoom', function (roomId, pseudo) {
        var _a;
        console.log("User ".concat(socket.id, " with pseudo ").concat(pseudo, " created new room ").concat(roomId));
        data[roomId] = {
            counter: 0,
            creator: pseudo,
            has_started: false,
            timer: round_duration,
            images: images,
            users: (_a = {},
                _a[pseudo] = {
                    score: 0,
                    vote: null
                },
                _a)
        };
        socket.join(roomId);
        io.in(roomId).emit('updateData', data[roomId]);
        io.emit('updateRooms', Object.keys(data));
        console.log("List of rooms ".concat(Object.keys(data).toString()));
    });
    socket.on('joinRoom', function (roomId, pseudo) {
        if (roomId in data) {
            console.log("User ".concat(socket.id, " with pseudo ").concat(pseudo, " joined room ").concat(roomId));
            socket.join(roomId);
            data[roomId].users[pseudo] = {
                score: 0,
                vote: null
            };
            io.in(roomId).emit('updateData', data[roomId]);
        }
        else {
            console.log('ROOM NOT FOUND');
        }
    });
    socket.on('buttonClick', function (roomId, pseudo) {
        console.log("User ".concat(socket.id, " with pseudo ").concat(pseudo, " clicked button in room ").concat(roomId));
        if (roomId in data) {
            data[roomId].counter++;
            io.in(roomId).emit('counter', data[roomId].counter);
        }
        else {
            console.log("User ".concat(socket.id, " with pseudo ").concat(pseudo, " clicked button in room ").concat(roomId, " but this room does not exist !"));
        }
    });
    socket.on('startGame', function (roomId) {
        console.log("Game started in room ".concat(roomId));
        if (roomId in data) {
            data[roomId].has_started = true;
            start_new_round(roomId);
        }
        else {
            console.log("Game started in room ".concat(roomId, " but this room does not exist !"));
        }
    });
    socket.on('vote', function (roomId, pseudo, vote) {
        console.log("In room ".concat(roomId, ", ").concat(pseudo, " voted ").concat(vote));
        data[roomId].users[pseudo].vote = vote;
        io.in(roomId).emit('updateData', data[roomId]);
    });
    socket.on('disconnect', function () {
        console.log("User disconnected: ".concat(socket.id));
    });
});
function start_new_round(roomId) {
    console.log("New round in room ".concat(roomId, "."));
    // Get a random image path from the list of image paths
    var room_images = data[roomId].images;
    var random_image = room_images[Math.floor(Math.random() * room_images.length)];
    // Remove the image from the list
    data[roomId].images = data[roomId].images.filter(function (img) { return img !== random_image; });
    // Emit the random image path to all clients in the room
    io.in(roomId).emit('newRound', random_image);
    // Reset votes and update users
    for (var _i = 0, _a = Object.keys(data[roomId].users); _i < _a.length; _i++) {
        var user_pseudo = _a[_i];
        data[roomId].users[user_pseudo].vote = null;
    }
    io.in(roomId).emit('updateData', data[roomId]);
    data[roomId].timer = round_duration;
}
setInterval(function () {
    var _a;
    for (var roomId in data) {
        if (data[roomId].has_started) {
            data[roomId].timer--;
            if (data[roomId].timer <= 0) {
                var creator = data[roomId].creator;
                var creatorVote = data[roomId].users[creator].vote;
                if (creatorVote != null) {
                    for (var _i = 0, _b = Object.keys(data[roomId].users); _i < _b.length; _i++) {
                        var userPseudo = _b[_i];
                        if (userPseudo !== creator) {
                            var userVote = (_a = data[roomId].users[userPseudo].vote) !== null && _a !== void 0 ? _a : 0;
                            var score = 1 - Math.abs(creatorVote - userVote);
                            data[roomId].users[userPseudo].score += score;
                        }
                    }
                    // -----------------------------------------------------
                    start_new_round(roomId);
                }
                else {
                    console.log('CREATOR VOTE IS NULL, WAIT ON HIM');
                    io.in(roomId).emit('waitCreator');
                }
            }
            io.in(roomId).emit('timer', data[roomId].timer);
        }
    }
}, 1000);
httpServer.listen(port, function () { return console.log("Listening on port ".concat(port.toString())); });
