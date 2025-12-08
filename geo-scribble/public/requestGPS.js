console.log("🚀 GPS SCRIPT LOADING on:", window.location.hostname);

let GPS_GRANTED = false;
let GPS_options = {
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 0,
};

// Make functions globally accessible
window.GPS_GRANTED = GPS_GRANTED;
window.requestGPS = requestGPS;
window.fixForChineseMap = fixForChineseMap;

function requestGPS() {
    console.log("🎯 requestGPS() called");
    
    if (!navigator.geolocation) {
        console.error("Geolocation not supported!");
        alert("Geolocation not supported!");
        return;
    }

    // DIRECT GPS REQUEST - skip permissions API
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            console.log("✅ GPS SUCCESS!", pos.coords);
            GPS_GRANTED = true;
            window.GPS_GRANTED = true;
            
            // Hide button
            let btn = document.getElementById("requestOrientationButton");
            if (btn) btn.style.display = 'none';
            
            // Call handleNewPosition
            if (typeof handleNewPosition === 'function') {
                console.log("📍 Calling handleNewPosition");
                handleNewPosition(pos);
            } else {
                console.error("handleNewPosition not found!");
            }
            
            // Start watching
            navigator.geolocation.watchPosition(
                function(pos2) {
                    if (typeof handleNewPosition === 'function') {
                        handleNewPosition(pos2);
                    }
                },
                function(err) {
                    console.log("GPS watch error:", err);
                },
                GPS_options
            );
        },
        function(err) {
            console.log("❌ GPS ERROR:", err.code, err.message);
            alert("GPS failed: " + err.message);
        },
        GPS_options
    );
}

function fixForChineseMap(pos) {
    if (!pos || !pos.coords) return [0, 0];
    
    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;
    console.log("Original coordinates:", lat, lon);
    
    // Use conversion if available
    if (typeof wgs84togcj02 === 'function') {
        return wgs84togcj02(lon, lat);
    }
    
    return [lon, lat];
}

// Conversion functions
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

console.log("📡 GPS ready! requestGPS =", typeof requestGPS);