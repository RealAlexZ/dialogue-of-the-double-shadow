var masterGainNodeDoubleMaxGain = 0.20;
var masterGainNodePremiereMaxGain = 0.40;

// Create a context and listener
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const listener = audioCtx.listener;

// Set the listener's position
const posX = window.innerWidth / 2;
const posY = window.innerHeight / 2;
const posZ = 0;

listener.positionX.value = posX;
listener.positionY.value = posY;
listener.positionZ.value = posZ;

// Default settings of the listener's orientation
listener.forwardX.value = 0;
listener.forwardY.value = 0;
listener.forwardZ.value = -1;
listener.upX.value = 0;
listener.upY.value = 1;
listener.upZ.value = 0;

// Function to calculate orientation
function calculateOrientation(listenerPos, sourcePos) {
    const orientationX = listenerPos.x - sourcePos.x;
    const orientationY = listenerPos.y - sourcePos.y;
    const orientationZ = listenerPos.z - sourcePos.z;
    
    const length = Math.sqrt(orientationX ** 2 + orientationY ** 2 + orientationZ ** 2);
    
    return {
        orientationX: orientationX / length,
        orientationY: orientationY / length,
        orientationZ: orientationZ / length
    };
}

const listenerPos = { x: posX, y: posY, z: posZ };

// Constants for panner properties
const innerCone = 2;
const outerCone = 2;
const outerGain = 0;
const distanceModel = "inverse";
const maxDistance = 40;
const refDistance = 5;
const rollOff = 3;

// Create PannerNode for each sound source
const sources = [
    { positionX: posX - 0.1, positionY: posY + 3 , positionZ: posZ }, // Channel 1
    { positionX: posX + 0.1, positionY: posY + 3, positionZ: posZ }, // Channel 2
    { positionX: posX + 3, positionY: posY, positionZ: posZ }, // Channel 3
    { positionX: posX + 0.1, positionY: posY - 3, positionZ: posZ }, // Channel 4
    { positionX: posX - 0.1, positionY: posY - 3, positionZ: posZ }, // Channel 5
    { positionX: posX - 3, positionY: posY, positionZ: posZ }, // Channel 6
    { positionX: posX, positionY: posY, positionZ: posZ - 0.5 } // Channel 7 (premiere)
];

sources.forEach(source => {
    const orientation = calculateOrientation(listenerPos, {
        x: source.positionX,
        y: source.positionY,
        z: source.positionZ
    });
    
    source.orientationX = orientation.orientationX;
    source.orientationY = orientation.orientationY;
    source.orientationZ = orientation.orientationZ;
});

const panners = sources.map(source => {
    return new PannerNode(audioCtx, {
        panningModel: "HRTF", // Using HRTF model
        distanceModel,
        positionX: source.positionX,
        positionY: source.positionY,
        positionZ: source.positionZ,
        orientationX: source.orientationX,
        orientationY: source.orientationY,
        orientationZ: source.orientationZ,
        refDistance,
        maxDistance,
        rolloffFactor: rollOff,
        coneInnerAngle: innerCone,
        coneOuterAngle: outerCone,
        coneOuterGain: outerGain
    });
});

// Create GainNodes for each sound source and master GainNodes
const gainNodes = sources.map(() => new GainNode(audioCtx));
const masterGainNodeDouble = new GainNode(audioCtx, { gain: masterGainNodeDoubleMaxGain });
const masterGainNodePremiere = new GainNode(audioCtx, { gain: masterGainNodePremiereMaxGain });

// Set the audio context destination to support the maximum number of output channels
audioCtx.destination.channelCount = audioCtx.destination.maxChannelCount;
audioCtx.destination.channelCountMode = "explicit";

// Get the audio elements
const audioElementDouble = document.getElementById("double");
const audioElementPremiere = document.getElementById("premiere");

// Pass them into the audio context
const trackDouble = audioCtx.createMediaElementSource(audioElementDouble);
const trackPremiere = audioCtx.createMediaElementSource(audioElementPremiere);

// Connect each panner node to its respective GainNode and then to the master GainNodes and destination
panners.forEach((panner, index) => {
    if (index < 6) {
        trackDouble.connect(panner).connect(gainNodes[index]).connect(masterGainNodeDouble).connect(audioCtx.destination);
    } else {
        // Add a reverb placeholder effect?
        trackPremiere.connect(panner).connect(gainNodes[index]).connect(masterGainNodePremiere).connect(audioCtx.destination);
    }
});

// Select our play button
const playButton = document.querySelector("button");

// Function to handle play/pause
function togglePlay() {
    // Check if context is in suspended state (autoplay policy)
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    // Play or pause tracks depending on state
    if (playButton.dataset.playing === "false") {
        audioElementDouble.play();
        audioElementPremiere.play();
        playButton.dataset.playing = "true";
    } else if (playButton.dataset.playing === "true") {
        audioElementDouble.pause();
        audioElementPremiere.pause();
        playButton.dataset.playing = "false";
    }
}

// Add click event listener to the play button
playButton.addEventListener("click", togglePlay);

// Function to create sliders for gain control
function createSlider(labelText, gainNode, min = 0., max = 1.) {
    const container = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = labelText;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.step = 0.01;
    slider.value = max;
    slider.addEventListener("input", () => {
        gainNode.gain.value = slider.value;
    });
    container.appendChild(label);
    container.appendChild(slider);
    return container;
}

// Create sliders for each GainNode and the master GainNode
const controlsContainer = document.getElementById("controls");
gainNodes.forEach((gainNode, index) => {
    controlsContainer.appendChild(createSlider(`Source ${index + 1} Volume`, gainNode));
});

controlsContainer.appendChild(createSlider("Double Master Volume", masterGainNodeDouble, 0., masterGainNodeDoubleMaxGain));
controlsContainer.appendChild(createSlider("Premiere Master Volume", masterGainNodePremiere, 0, masterGainNodePremiereMaxGain));

// Get canvas element and context
const canvas = document.getElementById('audioVisualizer');
const ctx = canvas.getContext('2d');

let dragging = false;
let dragIndex = -1;

// Function to draw the visualization
function drawVisualization() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

    // Draw the listener at the center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillText('Listener', centerX + 15, centerY);

    // Draw each source
    sources.forEach((source, index) => {
        const x = centerX + (source.positionX - posX) * 50; // Scale for visualization
        const y = centerY + (source.positionY - posY) * 50; // Scale for visualization
        ctx.fillStyle = "rgb(0,200,0)";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillText(`Source ${index + 1}`, x + 15, y);
    });
}

// Function to handle mousedown event
function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    sources.forEach((source, index) => {
        const sx = centerX + (source.positionX - posX) * 50;
        const sy = centerY + (source.positionY - posY) * 50;
        if (Math.sqrt((x - sx) ** 2 + (y - sy) ** 2) < 8) {
            dragging = true;
            dragIndex = index;
            canvas.classList.add('dragging');
        }
    });
}

// Function to handle mousemove event
function onMouseMove(event) {
    if (dragging && dragIndex > -1) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        sources[dragIndex].positionX = posX + (x - centerX) / 50;
        sources[dragIndex].positionY = posY + (y - centerY) / 50;

        const orientation = calculateOrientation(listenerPos, {
            x: sources[dragIndex].positionX,
            y: sources[dragIndex].positionY,
            z: sources[dragIndex].positionZ
        });

        sources[dragIndex].orientationX = orientation.orientationX;
        sources[dragIndex].orientationY = orientation.orientationY;
        sources[dragIndex].orientationZ = orientation.orientationZ;

        panners[dragIndex].positionX.value = sources[dragIndex].positionX;
        panners[dragIndex].positionY.value = sources[dragIndex].positionY;
        panners[dragIndex].positionZ.value = sources[dragIndex].positionZ;
        panners[dragIndex].orientationX.value = sources[dragIndex].orientationX;
        panners[dragIndex].orientationY.value = sources[dragIndex].orientationY;
        panners[dragIndex].orientationZ.value = sources[dragIndex].orientationZ;

        drawVisualization();
    }
}

// Function to handle mouseup event
function onMouseUp() {
    dragging = false;
    dragIndex = -1;
    canvas.classList.remove('dragging');
}

// Add event listeners to canvas
canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mouseup', onMouseUp);
canvas.addEventListener('mouseout', onMouseUp);

// Initial draw
drawVisualization();

// Redraw visualization whenever window is resized to ensure positions are scaled correctly
window.addEventListener('resize', () => {
    listener.positionX.value = window.innerWidth / 2;
    listener.positionY.value = window.innerHeight / 2;
    drawVisualization();
});
