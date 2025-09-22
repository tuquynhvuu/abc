const socket = io();

let formeElm = document.querySelector("#chatForm");
let msgInput = document.querySelector("#newMessage");
let nameInput = document.querySelector("#nameInput");
let chatList = document.querySelector("#chatList");

// listen for new msgs, send to server
formeElm.addEventListener("submit", newMessagesSubmitted);

function newMessagesSubmitted(event){
    //stop form element from refreshing the page
    event.preventDefault();

    let newMsg = msgInput.value.trim();
    if (!newMsg) return;

    // default name if not inputted
    let sender = nameInput.value || "traveler";


    // send the new message to the server:
    socket.emit("message", {sender: sender, message: newMsg});


    // clear out input:
    msgInput.value = "";

}



// listen for new msgs from server
socket.on("newMessage", function(data){
    console.log("received from server:", data);
    appendMessage(data.sender, data.message);
});


// append msgs
function appendMessage(sender, txt){

    // create new list item 
    let newListItem = document.createElement("li");

    // check if this is the current user
    // add a class for styling the system message
        if(sender === "System"){
            newListItem.classList.add("system-msg");
            newListItem.innerText = txt; // system messages don't need "who:"
        } else {
            newListItem.innerHTML = `<span class="who">${sender}:</span><span class="words">${txt}</span>`;

            if(sender === (nameInput.value || "traveler")){
                newListItem.classList.add("my-message"); // aligns right
            } else {
                newListItem.classList.add("other-message"); // aligns left
            }
        }

    // append new li to the list 
    chatList.append(newListItem);

    // scroll to bottom of textbox:
    chatList.scrollTop = chatList.scrollHeight;
}


appendMessage("System", "welcome to the vietnam travel chat!");

// emojis: click/tap to send
document.querySelectorAll(".sticker").forEach(sticker => {
  sticker.addEventListener("click", () => {
    let sender = nameInput.value || "traveler";
    let stickerIcon = sticker.textContent;

    // map emojis to premade text
    let emojiMessages = {
      "🍜": "let's eat pho!",
      "☕": "i want some authentic cà phê",
      "🏍️": "let's go ride on the motorbikes",
      "🛕": "Visiting the temple!",
      "🌆": "we should check out the city skyline",
      "🍻": "let's đi nhậu!",
      "🛍️": "wanna go shopping?"
    };

    // use mapped text if available, otherwise the emoji itself
    let txt = emojiMessages[stickerIcon] || stickerIcon;

    // emit to server; server will append to all clients
    socket.emit("message", { sender: sender, message: txt });
  });
});

