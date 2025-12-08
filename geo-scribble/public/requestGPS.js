let GPS_GRANTED = false;
let GPS_options = {
    enableHighAccuracy: false,
    timeout: 5000,
    maximumAge: 0,
};

// Make it globally accessible
window.requestGPS = function() {
  navigator.permissions.query({ name: "geolocation" }).then((result) => {
    console.log(`Permission ${result.state}`);

    if (result.state === "granted") {
      GPS_GRANTED = true;
      console.log("GPS ready");
      
      // Start watching position
      navigator.geolocation.watchPosition(
        function(pos) {
          console.log("GPS position update (granted)");
          // Call the global function
          if (typeof window.handleNewPosition === 'function') {
            window.handleNewPosition(pos);
          }
        }, 
        function(error){
          console.log("ERROR GPS:", error)
        }, 
        GPS_options
      );
      
    } else if (result.state === "prompt") {
      // Request permission
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          GPS_GRANTED = true;
          console.log("GPS ready");
          
          // Call the global function
          if (typeof window.handleNewPosition === 'function') {
            window.handleNewPosition(pos);
          }
          
          // Start watching for updates
          navigator.geolocation.watchPosition(
            function(pos) {
              if (typeof window.handleNewPosition === 'function') {
                window.handleNewPosition(pos);
              }
            }, 
            function(error){
              console.log("ERROR GPS:", error)
            }, 
            GPS_options
          );
        },
        function(error) {
          console.log("GPS permission denied:", error);
          GPS_GRANTED = false;
        },
        GPS_options
      );
      
    } else if (result.state === "denied") {
      console.log("GPS access denied!");
      GPS_GRANTED = false;
      alert("GPS access denied! Please enable location services.");
    }
    
    result.addEventListener("change", () => {
      console.log(`Permission changed to ${result.state}`);
      if (result.state === "granted") {
        GPS_GRANTED = true;
        navigator.geolocation.watchPosition(
          function(pos) {
            if (typeof window.handleNewPosition === 'function') {
              window.handleNewPosition(pos);
            }
          }, 
          function(error){
            console.log("ERROR GPS:", error)
          }, 
          GPS_options
        );
      }
    });
  });
}

// Make these functions globally accessible
window.fixForChineseMap = function(pos){
    console.log("fixForChineseMap", pos)
    if (!pos || !pos.coords) return [0, 0];
    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;
    console.log("fixForChineseMap fixing:", lat, lon)
    return wgs84togcj02(lon, lat);
}

// GAODE and TENCENT maps map pooints didfferent here is conversion (from chatGPT)
// WGS-84 → GCJ-02 (skip if outside CN bbox)
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

console.log("GPS script loaded");