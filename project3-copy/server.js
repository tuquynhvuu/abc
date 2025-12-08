const express = require('express');
const https = require("https");
const fs = require("fs");
const app = express();
const portHTTPS = 3010;

app.use(express.static('public'));

const options = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

let HTTPSserver = https.createServer(options, app)
const { Server } = require('socket.io');
const io = new Server(HTTPSserver);

let drawings = []; // persistent drawings

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    // send all existing drawings
    socket.on("joinUser", ()=>{
      socket.emit("allDrawings", drawings);
    });

    // new drawing from user
    socket.on("newDrawing", (point)=>{
      drawings.push(point);
      io.emit("newDrawing", point); // broadcast to everyone
    });

    socket.on("updateLocation", (pos)=>{
      // could be used for future features
    });

    socket.on("disconnect", () => {
      console.log("user disconnected", socket.id);
    });
});

HTTPSserver.listen(portHTTPS, function () {
    console.log("HTTPS Server started at port", portHTTPS);
});
