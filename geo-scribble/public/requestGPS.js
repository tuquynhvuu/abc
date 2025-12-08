// In setup() or somewhere after GPS is granted:
function startGPSWatching() {
  if (GPS_GRANTED && navigator.geolocation) {
    navigator.geolocation.watchPosition(
      handleNewPosition,
      function(error) {
        console.log("GPS watch error:", error);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
    );
  }
}

// Then call it when GPS is granted (modify your auto-request GPS):
setTimeout(() => {
  if (!GPS_GRANTED && typeof requestGPS === 'function') {
    console.log("Auto-requesting GPS...");
    requestGPS();
    // Check every second if GPS was granted
    let checkInterval = setInterval(() => {
      if (GPS_GRANTED) {
        clearInterval(checkInterval);
        startGPSWatching();
      }
    }, 1000);
  }
}, 1000);