if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
}

let map;
let directionsService;
let directionsRenderer;
let currentRouteData = null;
let currentFareData = 0;
let currentPhotoBase64 = null;
let cameraStreamTrack = null;
let routeOutline = null;
let routeFill = null;
let routeAlternatives = [];
let alternateLines = [];


let stops = [];
let selectedVehicle = "sedan";

const rates = {
    motorcycle: { base: 50, perKm: 10 },
    sedan: { base: 110, perKm: 18 },
    suv: { base: 140, perKm: 22 },
    van: { base: 250, perKm: 30 }
};

// INIT MAP
function initMap() {

    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: { lat: 14.5995, lng: 120.9842 },
        mapTypeControl: false
    });

    new google.maps.TrafficLayer().setMap(map);

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressPolylines: true
    });

    addStop(); // Start
    addStop(); // End

    
    if (document.body.classList.contains("dark")) {
        map.setOptions({ styles: darkMapStyle });
    }

}
window.onload = initMap;

// ADD STOP
function addStop() {
    const id = stops.length;
    const container = document.getElementById("stops");

    const div = document.createElement("div");
    div.innerHTML = `
        <input class="stop-input" id="stop-${id}" placeholder="${id==0?'Pickup':'Drop-off'} location">
    `;
    container.appendChild(div);

    stops.push(`stop-${id}`);

    new google.maps.places.Autocomplete(document.getElementById(`stop-${id}`));
}

// VEHICLE SELECT
function selectVehicle(v) {
    selectedVehicle = v;

    document.querySelectorAll(".vehicle-card").forEach(c => {
        c.style.border = "1px solid rgba(0,220,200,0.4)";
    });

    document.getElementById(`v-${v}`).style.border = "2px solid cyan";
}

// CALCULATE ROUTE
async function calculateRoute() {
    let validStops = [];
    stops.forEach(s => {
        const val = document.getElementById(s).value;
        if (val.trim() !== "") validStops.push(val);
    });

    if (validStops.length < 2) {
        return alert("Please enter at least a pickup and drop-off location.");
    }

    let waypoints = [];
    for (let i = 1; i < validStops.length - 1; i++) {
        waypoints.push({ location: validStops[i], stopover: true });
    }

    try {
        const result = await directionsService.route({
            origin: validStops[0],
            destination: validStops[validStops.length - 1],
            waypoints: waypoints,
            optimizeWaypoints: true,
            travelMode: 'DRIVING',
            drivingOptions: { departureTime: new Date() },
            provideRouteAlternatives: true 
        });

        routeAlternatives = result.routes;
        directionsRenderer.setDirections(result); 

        
        const optionsContainer = document.getElementById("routeOptions");
        optionsContainer.innerHTML = ""; 
        optionsContainer.style.display = "flex";

        routeAlternatives.forEach((route, index) => {
            let totalSeconds = 0;
            let totalMeters = 0;
            route.legs.forEach(leg => {
                totalSeconds += leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value;
                totalMeters += leg.distance.value;
            });

            const hrs = Math.floor(totalSeconds / 3600);
            const mins = Math.floor((totalSeconds % 3600) / 60);
            const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            const distStr = (totalMeters / 1000).toFixed(1) + " km";

            optionsContainer.innerHTML += `
                <div class="glass" id="routeCard-${index}" onclick="selectRoute(${index})" style="padding: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; flex-shrink: 0;">
                    <div style="font-weight: 600; font-size: 15px;">Route ${index + 1}</div>
                    <div style="text-align: right; font-size: 14px;">
                        <div style="color: #00c2a8; font-weight: 600;">⏱️ ${timeStr}</div>
                        <div style="opacity: 0.7;">📏 ${distStr}</div>
                    </div>
                </div>
            `;
        });

        
        selectRoute(0);

    } catch (err) {
        console.error("Routing error:", err);
        alert("Error finding route: " + err.message);
    }
}

// DRAW COLOR‑CODED ROUTE
function drawTrafficAwareRoute(route) {
    const legs = route.legs;
    let fullPath = [];

    
    let totalNormalDuration = 0;
    let totalTrafficDuration = 0;
    let totalDistanceInMeters = 0;

    legs.forEach(leg => {
        totalNormalDuration += leg.duration.value;
        totalTrafficDuration += leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value;
        totalDistanceInMeters += leg.distance.value;

        leg.steps.forEach(step => {
            step.path.forEach(latlng => {
                fullPath.push(latlng);
            });
        });
    });

    
    if (routeOutline) routeOutline.setMap(null);
    if (routeFill) routeFill.setMap(null);

    let trafficColor = "#2ed573"; 

    
    if (route.legs[0].duration_in_traffic) {
        const delayRatio = totalTrafficDuration / totalNormalDuration;
        if (delayRatio > 1.35) trafficColor = "#ff4757"; 
        else if (delayRatio > 1.15) trafficColor = "#ffa502"; 
        else trafficColor = "#2ed573"; 
        const speedKmh = (totalDistanceInMeters / totalNormalDuration) * 3.6;
        if (speedKmh < 12) trafficColor = "#ff4757"; 
        else if (speedKmh < 22) trafficColor = "#ffa502"; 
        else trafficColor = "#2ed573"; 
    }

    
    const isDarkMode = document.body.classList.contains("dark");
    const outlineColor = isDarkMode ? "#ffffff" : "#111111";

    
    routeOutline = new google.maps.Polyline({
        path: fullPath,
        strokeWeight: 12,
        strokeColor: outlineColor,
        strokeOpacity: 0.8,
        map: map
    });

    
    routeFill = new google.maps.Polyline({
        path: fullPath,
        strokeWeight: 6,
        strokeColor: trafficColor,
        strokeOpacity: 1.0,
        map: map
    });
}

function computeFare(route) {
    
    const km = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000;

    
    let totalSeconds = 0;
    route.legs.forEach(leg => {
        totalSeconds += leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value;
    });

    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    let timeText = "";
    if (hours > 0) timeText += `${hours} hr `;
    timeText += `${minutes} min`;

    
    const r = rates[selectedVehicle];
    const fare = r.base + km * r.perKm;

    
    document.getElementById("fareCard").innerHTML = `
        <div style="font-size: 15px; font-weight: 400; opacity: 0.9; margin-bottom: 4px;">⏱️ Est. Time: ${timeText}</div>
        <div>💳 Fare: ₱${fare.toFixed(0)}</div>
    `;

    
    currentRouteData = route;
    currentFareData = fare;

    
    document.getElementById("startDeliveryBtn").style.display = "block";
}


async function saveRecord(route, fare, photoData) {
    const start = route.legs[0].start_address;
    const end = route.legs[route.legs.length-1].end_address;

    await fetch("/api/trip", {
        method:"POST",
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            start,
            end,
            fare,
            date: Date.now(),
            proofPhoto: photoData 
        })
    });
}


const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];


function toggleDark() {
    document.body.classList.toggle("dark");
    
    const isDark = document.body.classList.contains("dark");
    
    
    localStorage.setItem("theme", isDark ? "dark" : "light");
    
    
    if (typeof map !== 'undefined' && map) {
        if (isDark) {
            map.setOptions({ styles: darkMapStyle });
        } else {
            map.setOptions({ styles: [] }); 
        }
    }
}


function logout() {
    localStorage.removeItem("token");
    window.location = "login.html";
}

function startDelivery() {
    document.getElementById("stops").style.display = "none";
    document.querySelector(".add-stop").style.display = "none";
    document.querySelector(".vehicle-grid").style.display = "none";
    document.querySelector("h3").style.display = "none"; 
    document.querySelector("button[onclick='calculateRoute()']").style.display = "none";
    document.getElementById("startDeliveryBtn").style.display = "none";

    document.getElementById("deliveryPanel").style.display = "block";
    
    
    startCamera();
}

async function startCamera() {
    try {
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        
        const video = document.getElementById('cameraStream');
        video.srcObject = stream;
        
        
        cameraStreamTrack = stream.getTracks()[0]; 
    } catch (err) {
        console.error("Camera access denied: ", err);
        alert("Please allow camera permissions to take proof of delivery.");
    }
}

function takeSnapshot() {
    const video = document.getElementById('cameraStream');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');

    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    
    currentPhotoBase64 = canvas.toDataURL('image/jpeg', 0.8);

    
    document.getElementById("cameraContainer").style.display = "none";
    
    const img = document.getElementById("photoPreview");
    img.src = currentPhotoBase64;
    img.style.display = "block";
    
    document.getElementById("retakeBtn").style.display = "block";

    
    const btn = document.getElementById("completeBtn");
    btn.style.background = "#00c2a8";
    btn.style.cursor = "pointer";
    btn.disabled = false;
    
    
    if (cameraStreamTrack) cameraStreamTrack.stop();
}


function retakePhoto() {
    currentPhotoBase64 = null;
    
    
    document.getElementById("photoPreview").style.display = "none";
    document.getElementById("retakeBtn").style.display = "none";
    document.getElementById("cameraContainer").style.display = "block";
    
   
    const btn = document.getElementById("completeBtn");
    btn.style.background = "#999";
    btn.style.cursor = "not-allowed";
    btn.disabled = true;

    
    startCamera();
}



async function completeDelivery() {
    if (!currentPhotoBase64) return alert("Please upload a photo proof of delivery!");

    // Update your saveRecord call to include the photo data
    await saveRecord(currentRouteData, currentFareData, currentPhotoBase64);

    alert("Delivery Completed! Proof uploaded successfully.");
    window.location.reload(); // Reset the app for the next delivery
}


function selectRoute(index) {
    
    routeAlternatives.forEach((_, i) => {
        const card = document.getElementById(`routeCard-${i}`);
        if (card) {
            card.style.borderColor = (i === index) ? '#00c2a8' : 'rgba(255,255,255,0.2)';
            card.style.boxShadow = (i === index) ? '0 0 12px rgba(0,220,200,0.3)' : 'none';
            card.style.background = (i === index) ? 'rgba(0, 194, 168, 0.1)' : 'rgba(255,255,255,0.1)';
        }
    });

    directionsRenderer.setRouteIndex(index);

    
    alternateLines.forEach(line => line.setMap(null));
    alternateLines = [];

   
    routeAlternatives.forEach((route, i) => {
        if (i !== index) {
            drawGrayAlternateRoute(route, i);
        }
    });

    
    drawTrafficAwareRoute(routeAlternatives[index]);
    computeFare(routeAlternatives[index]);
}


function drawGrayAlternateRoute(route, index) {
    let fullPath = [];
    route.legs.forEach(leg => {
        leg.steps.forEach(step => {
            step.path.forEach(latlng => fullPath.push(latlng));
        });
    });

    const isDarkMode = document.body.classList.contains("dark");
    const grayColor = isDarkMode ? "#555555" : "#999999";

    let grayLine = new google.maps.Polyline({
        path: fullPath,
        strokeWeight: 6,
        strokeColor: grayColor,
        strokeOpacity: 0.5,
        map: map,
        zIndex: 0 
    });

    alternateLines.push(grayLine);
    
    
    google.maps.event.addListener(grayLine, 'click', function() {
        selectRoute(index);
    });
}

async function generateSmartRoute() {
    const promptText = document.getElementById("smartPrompt").value.trim();
    const btn = document.getElementById("aiBtn");

    if (!promptText) {
        return alert("Please paste a message or instructions for the AI to read.");
    }

    // UI Feedback: Change button to a loading state
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = "⏳ AI is thinking...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    try {
        // 1. Send the text to your REAL backend server
        const res = await fetch("/api/smart-route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: promptText })
        });

        if (!res.ok) throw new Error("Server or AI error");
        
        // 2. Get the clean array of addresses back from the AI
        const extractedAddresses = await res.json(); 

        if (!Array.isArray(extractedAddresses) || extractedAddresses.length < 2) {
            throw new Error("AI couldn't find enough valid addresses.");
        }

        // 3. THE FIX: Target "stops" instead of "stopsList"
        document.getElementById("stops").innerHTML = "";
        stops = []; // Reset your global stops array
        stopCounter = 0; // Reset your global counter

        // 4. Create new input boxes and fill them
        extractedAddresses.forEach(() => addStop());
        extractedAddresses.forEach((address, index) => {
            document.getElementById(stops[index]).value = address;
        });

        // 5. Automatically trigger Google Maps to draw the route
        calculateRoute();

    } catch (err) {
        alert("AI encountered an error: " + err.message);
        console.error(err);
    } finally {
        // Reset the button
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
        btn.style.opacity = "1";
    }
}