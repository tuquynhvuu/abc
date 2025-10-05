const express = require('express');
// const http = require("http");
const https = require("https");
// to read certificates from the filesystem (fs)
const fs = require("fs");

const app = express(); // the server "app", the server behaviour
// const portHTTP = 3000; // port for http
// const portHTTPS = 3001; 
const portHTTPS = 4260; 


// returning to the client anything that is
// inside the public folder
app.use(express.static('public'));


// creating object of key and certificate for SSL
const options = {
    key: fs.readFileSync("keys-for-local-https/localhost-key.pem"),
    cert: fs.readFileSync("keys-for-local-https/localhost.pem"),
};

let HTTPSserver = https.createServer(options, app);

const { Server } = require('socket.io'); //include library
const io = new Server(HTTPSserver); // start socket.io

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  socket.on("message", function(incomingMessage){
    console.log("go new msg:", incomingMessage);

    //receiving a msg from any one client, -> send them to all other clients:
    let messageToAllClients = {
        sender: incomingMessage.sender || "unknown",
        message: incomingMessage.message || incomingMessage
    }

    io.emit("newMessage", messageToAllClients);
  });


  socket.on("disconnect", function(){
    console.log("someone disconnected", socket.id);
  });


});




// creating servers and make it listen at their port:
HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});





