"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var cors = require("cors");
var http_1 = require("http");
var socket_io_1 = require("socket.io");
var path = require("path");
var fs = require("fs");
var app = express();
var httpServer = (0, http_1.createServer)(app);
var io = new socket_io_1.Server(httpServer);
var port = 5000;
var build_path = path.join(__dirname, 'build');
app.use(cors());
app.use(express.static(build_path));
app.use('/images', express.static(path.join(build_path, 'images')));
app.get('/', function (_req, res) {
    res.sendFile(path.join(build_path, 'index.html'));
});
var data = {};
var imagesFolder = path.join(build_path, 'images');
var imageFolders = fs.readdirSync(imagesFolder);
var allImages = {};
var _loop_1 = function (imageFolder) {
    allImages[imageFolder] = fs.readdirSync(path.join(imagesFolder, imageFolder)).filter(function (file) { return file.endsWith('.png') || file.endsWith('.jpg'); }).map(function (file) { return path.join('images', imageFolder, file); });
};
for (var _i = 0, imageFolders_1 = imageFolders; _i < imageFolders_1.length; _i++) {
    var imageFolder = imageFolders_1[_i];
    _loop_1(imageFolder);
}
io.on('connection', function (socket) {
    console.log("User connected: ".concat(socket.id));
    socket.emit("updateRooms", Object.keys(Object.fromEntries(Object.entries(data).filter(function (_a) {
        var roomData = _a[1];
        return !roomData.hasStarted;
    }))));
    socket.emit("updateImages", allImages);
    socket.on('createRoom', function (pseudo, roomId, roundDuration, imageSet, rule, autoRun, left, right) {
        var _a;
        console.log("User ".concat(socket.id, " with pseudo ").concat(pseudo, " created new room ").concat(roomId, " with autorun: ").concat(autoRun));
        var images = allImages[imageSet];
        data[roomId] = {
            rule: rule,
            roundDuration: roundDuration,
            creator: pseudo,
            autoRun: autoRun,
            refusedImages: left,
            acceptedImages: right,
            hasStarted: false,
            hasFinished: false,
            timer: roundDuration,
            images: images,
            currentImage: null,
            users: (_a = {},
                _a[pseudo] = {
                    socketId: socket.id,
                    score: 0,
                    lastScore: null,
                    vote: null
                },
                _a)
        };
        socket.join(roomId);
        io.in(roomId).emit('updateRoomData', data[roomId]);
        io.emit("updateRooms", Object.keys(Object.fromEntries(Object.entries(data).filter(function (_a) {
            var roomData = _a[1];
            return !roomData.hasStarted;
        }))));
        console.log("List of rooms ".concat(Object.keys(data).toString()));
    });
    socket.on('joinRoom', function (roomId, pseudo) {
        if (roomId in data) {
            console.log("User ".concat(socket.id, " with pseudo ").concat(pseudo, " joined room ").concat(roomId));
            socket.join(roomId);
            data[roomId].users[pseudo] = {
                socketId: socket.id,
                score: 0,
                lastScore: null,
                vote: null
            };
            io.in(roomId).emit('updateRoomData', data[roomId]);
        }
        else {
            console.log('ROOM NOT FOUND');
        }
    });
    socket.on('startGame', function (roomId) {
        console.log("Game started in room ".concat(roomId));
        if (roomId in data) {
            data[roomId].hasStarted = true;
            startNewRound(roomId);
        }
        else {
            console.log("Game started in room ".concat(roomId, " but this room does not exist !"));
        }
    });
    socket.on('vote', function (roomId, pseudo, vote) {
        console.log("In room ".concat(roomId, ", ").concat(pseudo, " voted ").concat(vote));
        data[roomId].users[pseudo].vote = vote;
        io.in(roomId).emit('updateRoomData', data[roomId]);
    });
    socket.on('endGame', function (roomId) {
        console.log("The creator ended the game in room ".concat(roomId));
        data[roomId].hasFinished = true;
        io.in(roomId).emit('updateRoomData', data[roomId]);
    });
    socket.on('disconnect', function () {
        console.log("User disconnected: ".concat(socket.id));
        // Remove the user associated to the socket from the data
        for (var _i = 0, _a = Object.keys(data); _i < _a.length; _i++) {
            var roomId = _a[_i];
            for (var _b = 0, _c = Object.keys(data[roomId].users); _b < _c.length; _b++) {
                var userPseudo = _c[_b];
                if (data[roomId].users[userPseudo].socketId === socket.id) {
                    delete data[roomId].users[userPseudo];
                    io.in(roomId).emit('updateRoomData', data[roomId]);
                    if (userPseudo === data[roomId].creator && !data[roomId].autoRun) {
                        // The creator of the room left
                        data[roomId].hasFinished = true;
                    }
                }
            }
        }
    });
});
function startNewRound(roomId) {
    var room_images = data[roomId].images;
    if (room_images.length > 0) {
        console.log("New round in room ".concat(roomId, "."));
        var random_image_1 = room_images[Math.floor(Math.random() * room_images.length)];
        data[roomId].currentImage = random_image_1;
        // Remove the image from the list
        data[roomId].images = data[roomId].images.filter(function (img) { return img !== random_image_1; });
        // Emit the random image path to all clients in the room
        io.in(roomId).emit('newRound', random_image_1);
        // Reset votes and update users
        for (var _i = 0, _a = Object.keys(data[roomId].users); _i < _a.length; _i++) {
            var user_pseudo = _a[_i];
            data[roomId].users[user_pseudo].vote = null;
        }
        data[roomId].timer = data[roomId].roundDuration;
    }
    else {
        console.log("No more images in room ".concat(roomId, "."));
        data[roomId].hasFinished = true;
    }
    io.in(roomId).emit('updateRoomData', data[roomId]);
}
setInterval(function () {
    var _a;
    for (var _i = 0, _b = Object.keys(data); _i < _b.length; _i++) {
        var roomId = _b[_i];
        if (data[roomId].hasStarted && !data[roomId].hasFinished) {
            data[roomId].timer--;
            if (Object.values(data[roomId].users).map(function (user) { return user.vote; }).every(function (vote) { return vote !== null; })) {
                data[roomId].timer = 0;
            }
            if (data[roomId].timer <= 0) {
                var creator = data[roomId].creator;
                var creatorVote = null;
                if (data[roomId].autoRun) {
                    var currentImage = data[roomId].currentImage;
                    console.log(currentImage);
                    console.log(data[roomId].acceptedImages);
                    if (currentImage) {
                        creatorVote = data[roomId].acceptedImages.includes(currentImage) ? 1 : -1;
                    }
                    else {
                        console.log('CURRENT IMAGE IS NULL');
                    }
                }
                else {
                    creatorVote = data[roomId].users[creator].vote;
                }
                if (creatorVote != null) {
                    var usersPoints = {};
                    for (var _c = 0, _d = Object.keys(data[roomId].users); _c < _d.length; _c++) {
                        var userPseudo = _d[_c];
                        if (userPseudo !== creator) {
                            var userVote = (_a = data[roomId].users[userPseudo].vote) !== null && _a !== void 0 ? _a : 0;
                            var points = Math.round((1 - Math.abs(creatorVote - userVote)) * 100);
                            data[roomId].users[userPseudo].lastScore = points;
                            data[roomId].users[userPseudo].score += points;
                            usersPoints[userPseudo] = points;
                        }
                    }
                    io.in(roomId).emit('endOfRound', usersPoints, creatorVote);
                    // -----------------------------------------------------
                    startNewRound(roomId);
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
