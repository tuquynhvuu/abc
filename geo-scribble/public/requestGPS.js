// Minimal GPS script that definitely works
window.GPS_GRANTED = false;

window.requestGPS = function() {
  console.log("Requesting GPS...");
  
  if (!navigator.geolocation) {
    alert("Geolocation not supported!");
    return;
  }
  
  // Simple direct request
  navigator.geolocation.getCurrentPosition(
    function(position) {
      console.log("GPS success!", position);
      window.GPS_GRANTED = true;
      
      // Hide button
      let btn = document.getElementById("requestOrientationButton");
      if (btn) btn.style.display = "none";
      
      // Call sketch.js function
      if (typeof window.handleNewPosition === 'function') {
        window.handleNewPosition(position);
      }
      
      // Start watching
      navigator.geolocation.watchPosition(
        function(pos) {
          if (typeof window.handleNewPosition === 'function') {
            window.handleNewPosition(pos);
          }
        },
        function(err) {
          console.log("GPS watch error:", err);
        }
      );
    },
    function(error) {
      console.log("GPS error:", error);
      alert("GPS error: " + error.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

console.log("GPS script loaded");