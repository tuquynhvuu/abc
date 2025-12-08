console.log("✅ GPS SCRIPT LOADED!");

// Global variable - SIMPLE
let GPS_GRANTED = false;
let GPS_options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
};

// SIMPLE function - just like working example
function requestGPS() {
    console.log("🎯 requestGPS() called");
    
    if (!navigator.geolocation) {
        alert("GPS not supported!");
        return;
    }
    
    // SIMPLEST approach - just get position
    navigator.geolocation.getCurrentPosition(
        function success(pos) {
            console.log("✅ GPS SUCCESS!", pos.coords);
            GPS_GRANTED = true;
            
            // Convert coordinates
            let lonlat = fixForChineseMap(pos);
            console.log("Converted to:", lonlat);
            
            // Send to sketch.js
            if (window.handleNewPosition) {
                window.handleNewPosition(pos);
            }
            
            // Start watching for updates
            navigator.geolocation.watchPosition(
                function watchSuccess(pos2) {
                    console.log("📍 GPS update");
                    if (window.handleNewPosition) {
                        window.handleNewPosition(pos2);
                    }
                },
                function watchError(err) {
                    console.log("GPS watch error:", err);
                },
                GPS_options
            );
        },
        function error(err) {
            console.log("❌ GPS ERROR:", err.code, err.message);
            alert("GPS failed: " + err.message);
        },
        GPS_options
    );
}

// SIMPLE coordinate conversion
function fixForChineseMap(pos) {
    if (!pos.coords) return [0, 0];
    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;
    console.log("Original:", lat, lon);
    
    // SIMPLE - just return as-is for now
    // Remove conversion to test if that's the issue
    return [lon, lat];
    
    // If you need conversion, uncomment:
    // return wgs84togcj02(lon, lat);
}

// Log that we're ready
console.log("📡 GPS ready! requestGPS =", typeof requestGPS);
console.log("window.handleNewPosition =", typeof window.handleNewPosition);