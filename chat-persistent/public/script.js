function getOrCreateUserId() {
    // check if we have a userID already in local storage
    // if yes, return it
    // if not, create one and return it
    let id = localStorage.getItem("chat-user-id");
    if (id == undefined){
        id = "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        localStorage.setItem("chat-user-id", id);
        //making id and storing it
    }
    return id;
}
const myUserId = getOrCreateUserId();
console.log('My userId:', myUserId);

let nameInput = document.querySelector("#nameInput");

//check if we have a username already
let myUsername = localStorage.getItem("chat-username");

if(myUsername != undefined){
    console.log("my user name is", myUsername);
    nameInput.value = myUsername;
}else{
        myUsername = "";
    }

// start socket
if(location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')){
  socket = io({path: "/YOURPATH-and-PORT/socket.io"});  // yields '/leon/port-4100/socket.io' or '/socket.io'
}else{
  socket = io();
}
let myInfo = {
    userId: myUserId,
    username: myUsername
}

// "login" to server, sending out identity
socket.emit("identify", myInfo);

//handle username change
nameInput.addEventListener("change", function(){
    console.log("changed name", nameInput.value)
    // locally
    localStorage.setItem("chat-username", nameInput.value);
    // tell server about it
    socket.emit("name-change", {
        newUsername: nameInput.value
    })
})

let formeElm = document.querySelector("#chatForm");
console.log(formeElm);

let msgInput = document.querySelector("#newMessage");
console.log(msgInput)

// LISTEN FOR NEWLY TYPED MESSAGES,
// SEND THEM TO THE SERVER
formeElm.addEventListener("submit", newMessagesSubmitted);

function newMessagesSubmitted(event){
    console.log(event);

    //stop form element from refreshing the page
    event.preventDefault();
    let newMsg = msgInput.value
    console.log(newMsg);

    // appendMessage(newMsg); // just for fun,
    // actuaally we need to
    // send the new message to
    // the server first:
    socket.emit("message-from-client", {
        message: newMsg
    } );

    // clear out input:
    msgInput.value = "";
}

socket.on("message-from-server", function(data){
    // waht do to with the messaeg from server
    console.log("got message", data)
    appendMessage(data)
})

socket.on("chat-history", function(data){
    // deal with chat history
    console.log(data);
    for(let i = 0; i < data.length; i++){
        let messageData = data[i];
        appendMessage(messageData);
    }
})

// APPEND MESSAGES TO BOX
function appendMessage(data){
    // console.log(data)
    // select list (ul) first
    let chatThreadList = document.querySelector("#threadWrapper ul");

    // console.log(chatThreadList)
    // create new list item (li)
    let newListItem = document.createElement("li");

    // class name if message is out own message
    if (data.sender.userId == myUserId){
        newListItem.className = "fromMe";
    } else{
        newListItem.className = "fromOthers";
    }

    //sender
    let who = document.createElement("span");
    who.className = "who";
    who.innerText = data.sender.username;
    newListItem.append(who);

    //messsage
    let words = document.createElement("span");
    words.className = "words";
    words.innerText = data.message;
    newListItem.append(words);

    // append new li to the list
    chatThreadList.append(newListItem);

    // scroll to bottom of textbox:
    chatThreadList.scrollTop = chatThreadList.scrollHeight;
}