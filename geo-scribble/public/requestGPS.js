// Global variable
let GPS_GRANTED = false;
let GPS_options = {
    enableHighAccuracy: false,
    timeout: 5000,
    maximumAge: 0,
};

// Simple function like the working example
function requestGPS() {
    console.log("🔍 Checking GPS permissions...");
    
    // Direct fallback if permissions API not available
    if (!navigator.permissions) {
        console.log("⚠️ Permissions API not available, trying direct GPS");
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                console.log("✅ Got position directly");
                GPS_GRANTED = true;
                if (typeof handleNewPosition === 'function') {
                    handleNewPosition(pos);
                }
                // Start watching
                navigator.geolocation.watchPosition(
                    handleNewPosition,
                    function(error) {
                        console.log("GPS watch error:", error);
                    },
                    GPS_options
                );
            },
            function(error) {
                console.log("❌ Direct GPS failed:", error);
            },
            GPS_options
        );
        return;
    }

    navigator.permissions.query({ name: "geolocation" }).then((result) => {
        console.log("Permission state:", result.state);

        if (result.state === "granted") {
            console.log("✅ GPS already granted");
            GPS_GRANTED = true;
            
            // Start watching immediately
            navigator.geolocation.watchPosition(
                handleNewPosition,
                function(error) {
                    console.log("GPS error:", error);
                },
                GPS_options
            );
            
        } else if (result.state === "prompt") {
            console.log("🔄 Prompting for GPS...");
            GPS_GRANTED = true;
            
            // This will show the prompt
            navigator.geolocation.watchPosition(
                handleNewPosition,
                function(error) {
                    console.log("GPS error:", error);
                },
                GPS_options
            );
            
        } else if (result.state === "denied") {
            console.log("❌ GPS denied");
            GPS_GRANTED = false;
        }

        // Listen for changes
        result.addEventListener("change", () => {
            console.log("Permission changed to:", result.state);
            if (result.state === "granted") {
                GPS_GRANTED = true;
                navigator.geolocation.watchPosition(
                    handleNewPosition,
                    function(error) {
                        console.log("GPS error:", error);
                    },
                    GPS_options
                );
            }
        });
    }).catch(error => {
        console.log("Permissions query failed, trying direct:", error);
        // Fallback to direct request
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                GPS_GRANTED = true;
                if (typeof handleNewPosition === 'function') {
                    handleNewPosition(pos);
                }
            },
            function(err) {
                console.log("Fallback GPS failed:", err);
            },
            GPS_options
        );
    });
}

// Same conversion function as working example
function fixForChineseMap(pos){
    console.log("Converting coordinates...");
    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;
    console.log("Original:", lat, lon);
    return wgs84togcj02(lon, lat);
}

// Same conversion functions as working example
function wgs84togcj02(lng, lat){
    if (outOfChina(lng, lat)) return [lng, lat];
    const a = 6378245.0, ee = 0.00669342162296594323;
    let dLat = transformLat(lng-105.0, lat-35.0);
    let dLng = transformLng(lng-105.0, lat-35.0);
    const radLat = lat/180*Math.PI;
    let magic = 1 - ee*Math.sin(radLat)**2;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat*180)/((a*(1-ee))/(magic*sqrtMagic)*Math.PI);
    dLng = (dLng*180)/(a/ sqrtMagic * Math.cos(radLat)*Math.PI);
    return [lng + dLng, lat + dLat];
}
function outOfChina(lng, lat){
    return (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271);
}
function transformLat(x, y){
    let ret = -100.0+2.0*x+3.0*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x));
    ret += (20.0*Math.sin(6.0*x*Math.PI)+20.0*Math.sin(2.0*x*Math.PI))*2.0/3.0;
    ret += (20.0*Math.sin(y*Math.PI)+40.0*Math.sin(y/3.0*Math.PI))*2.0/3.0;
    ret += (160.0*Math.sin(y/12.0*Math.PI)+320*Math.sin(y*Math.PI/30.0))*2.0/3.0;
    return ret;
}
function transformLng(x, y){
    let ret = 300.0+x+2.0*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x));
    ret += (20.0*Math.sin(6.0*x*Math.PI)+20.0*Math.sin(2.0*x*Math.PI))*2.0/3.0;
    ret += (20.0*Math.sin(x*Math.PI)+40.0*Math.sin(x/3.0*Math.PI))*2.0/3.0;
    ret += (150.0*Math.sin(x/12.0*Math.PI)+300.0*Math.sin(x/30.0*Math.PI))*2.0/3.0;
    return ret;
}

console.log("📡 GPS script loaded");