const socket = io();

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

    appendMessage(newMsg); // just for fun,
    // actuaally we need to
    // send the new message to 
    // the server first:
    socket.emit("message", newMsg);


    // clear out input:
    msgInput.value = "";

}



// LISTEN FOR NEW MESSAGES FROM SERVER
// APPEND THEM TO THE MESSAGE BOX
// AUTO SCROLL TO BOTTOM

// APPEND MESSAGES TO BOX
function appendMessage(txt){
    console.log(txt)
    // select list (ul) first
    let chatThreadList = document.querySelector("#threadWrapper ul");
    console.log(chatThreadList)

    // create new list item (li)
    let newListItem = document.createElement("li");
    newListItem.innerText = txt;

    // append new li to the list 
    chatThreadList.append(newListItem);

    // scroll to bottom of textbox:
    chatThreadList.scrollTop = chatThreadList.scrollHeight;
}


appendMessage("lalallalalalalalalala");


// OPTIONAL: LISTEN FOR NEW NAME
// SEND IT TO SERVER