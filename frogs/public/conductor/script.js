const CUT = 1;
const parts = location.pathname.replace(/\/+$/,'').split('/').filter(Boolean);
// const base  = parts.length ? '/' + parts.slice(0, -CUT).join('/') : ''; // on SERVER...
const base  = parts.length ? parts.slice(0, -CUT).join('/') : '';
console.log(base);
const socket = io({ path: base + '/socket.io' });  // yields '/leon/port-4100/socket.io' or '/socket.io'


// let readyButton = document.querySelector("#ready");
let mainWrapper = document.querySelector(".main-wrapper")
let w = window.innerWidth;
let h = window.innerHeight;
let frogs = []

// socket communication

socket.emit("my-role", {role: "conductor"});

socket.on("all-frogs", function(data){
    console.log(data);
    for(let i = 0; i < data.length; i++){
        let frog = data[i];
        addFrog(frog.id, frog.frogIdx);
    }
});

socket.on("new-frog", function(frog){
    console.log(frog);
    addFrog(frog.id, frog.frogIdx)
});

socket.on('delete-frog', function(data){
    //delete frog from page
    console.log(data);
    document.querySelector("#A"+data).remove();
})


// addFrog("sdfobjweq", 0); // function test

function addFrog(socketID, frogIdx){
    let imgWrapper = document.createElement("div");
    imgWrapper.className = "img-wrap"
    imgWrapper.id = "A"+socketID;
    imgElm = document.createElement("img");
    imgElm.src = "../imgs/frog"+frogIdx+".png";
    imgWrapper.append(imgElm)
    mainWrapper.append(imgWrapper);


    // button socket communication:
    imgElm.addEventListener("click", function(){
        document.querySelector("#"+socketID).style.opacity = 0.3;
        setTimeout(function(){
            document.querySelector("#"+socketID).style.opacity = 1;
        }, 500)
        socket.emit("trigger-frog", socketID);
    })
}
