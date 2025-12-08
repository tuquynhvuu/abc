// GPS Module for GEO-SCRIBBLE
window.GPS_GRANTED = false;
window.GPS_options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
};

// Make this function globally accessible
window.requestGPS = function() {
    console.log("requestGPS called");
    
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        // Success callback
        function(position) {
            console.log("GPS permission granted!");
            GPS_GRANTED = true;
            
            // Convert coordinates for Chinese map
            let lonlat = fixForChineseMap(position);
            // Update global variables for sketch.js to use
            if (typeof currentLongitude !== 'undefined') currentLongitude = lonlat[0];
            if (typeof currentLatitude !== 'undefined') currentLatitude = lonlat[1];
            
            console.log("Updated position:", currentLatitude, currentLongitude);
            
            // Hide the GPS button
            let btn = document.getElementById("requestOrientationButton");
            if (btn) btn.style.display = "none";
            
            // Call a global position handler if it exists
            if (typeof window.handleNewPosition === 'function') {
                window.handleNewPosition(position);
            }
            
            // Start watching for position updates
            navigator.geolocation.watchPosition(
                function(pos) {
                    let newLonlat = fixForChineseMap(pos);
                    if (typeof currentLongitude !== 'undefined') currentLongitude = newLonlat[0];
                    if (typeof currentLatitude !== 'undefined') currentLatitude = newLonlat[1];
                    console.log("Position updated:", currentLatitude, currentLongitude);
                    
                    if (typeof window.handleNewPosition === 'function') {
                        window.handleNewPosition(pos);
                    }
                },
                function(err) {
                    console.log("GPS watch error:", err);
                },
                GPS_options
            );
        },
        // Error callback
        function(error) {
            console.log("GPS error:", error);
            GPS_GRANTED = false;
            alert("Could not get your location. Please enable location services.");
        },
        GPS_options
    );
};

// Coordinate conversion functions (keep your existing ones)
function fixForChineseMap(pos) {
    console.log("fixForChineseMap", pos);
    if (!pos || !pos.coords) return [0, 0];
    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;
    console.log("fixForChineseMap fixing:", lat, lon);
    return wgs84togcj02(lon, lat);
}

// Convert WGS-84 → GCJ-02 (China maps)
function wgs84togcj02(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    const a = 6378245.0, ee = 0.00669342162296594323;
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180 * Math.PI;
    let magic = 1 - ee * Math.sin(radLat) ** 2;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
    dLng = (dLng * 180) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
    return [lng + dLng, lat + dLat];
}

function outOfChina(lng, lat) {
    return (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271);
}

function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
    return ret;
}

function transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
    return ret;
}

// Auto-center button on load
window.addEventListener("load", () => {
    let btn = document.getElementById("requestOrientationButton");
    if (btn) {
        btn.style.position = "absolute";
        btn.style.left = (window.innerWidth / 2 - btn.offsetWidth / 2) - 10 + "px";
        btn.style.top = (window.innerHeight / 2 - btn.offsetHeight / 2) + 100 + "px";
    }
    console.log("GPS script loaded - requestGPS available:", typeof requestGPS !== 'undefined');
});

// Make the function globally accessible via window object
window.requestGPS = window.requestGPS || requestGPS;