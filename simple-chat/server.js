const express = require('express');
// const http = require("http");
const https = require("https");
// to read certificates from the filesystem (fs)
const fs = require("fs");

const app = express(); // the server "app", the server behaviour
// const portHTTP = 3000; // port for http
const portHTTPS = 3001; // port for https

// returning to the client anything that is
// inside the public folder
app.use(express.static('public'));


// Creating object of key and certificate
// for SSL
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

    //after receiving a msg from any one client,
    // we send them to all other clients:
    let messageToAllClients = {
        sender: "unknown",
        message: incomingMessage
    }
    io.emit("newMessage", messageToAllClients);
  });

  //listen for new messages from server
  //apend them to the message box
  //auto scroll to bottom
  socket.on("newMessage", function(data){
    console.log(data);
  });

  socket.on("disconnect", function(){
    console.log("someone disconnected", socket.id);
  });


});




// Creating servers and make them listen at their ports:
// http.createServer(app).listen(portHTTP, function (req, res) {
//     console.log("HTTP Server started at port", portHTTP);
// });
HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});





