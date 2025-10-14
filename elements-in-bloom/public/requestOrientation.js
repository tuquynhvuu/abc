function requestOrientation() {
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === "granted") {
          window.addEventListener("deviceorientation", handleOrientation, true);
          const btn = document.getElementById("requestOrientationButton");
          if (btn) btn.remove();
        }
      })
      .catch(console.error);
  } else {
    window.addEventListener("deviceorientation", handleOrientation, true);
    const btn = document.getElementById("requestOrientationButton");
    if (btn) btn.remove();
  }
}
