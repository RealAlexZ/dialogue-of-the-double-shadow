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

// Get canvas elements and contexts
const canvasTop = document.getElementById('audioVisualizerTop');
const ctxTop = canvasTop.getContext('2d');

const canvasFront = document.getElementById('audioVisualizerFront');
const ctxFront = canvasFront.getContext('2d');

let dragging = false;
let dragIndex = -1;

// Function to draw the top view visualization
function drawVisualizationTop() {
    ctxTop.clearRect(0, 0, canvasTop.width, canvasTop.height); // Clear the canvas

    // Draw the listener at the center
    const centerX = canvasTop.width / 2;
    const centerY = canvasTop.height / 2;
    ctxTop.fillStyle = 'red';
    ctxTop.beginPath();
    ctxTop.arc(centerX, centerY, 10, 0, 2 * Math.PI);
    ctxTop.fill();
    ctxTop.fillText('Listener', centerX + 15, centerY);

    // Draw each source
    sources.forEach((source, index) => {
        const x = centerX + (source.positionX - posX) * 50; // Scale for visualization
        const y = centerY + (source.positionY - posY) * 50; // Scale for visualization
        // Display the relative x, y, z values
        const relX = (source.positionX - posX).toFixed(2);
        const relY = (source.positionY - posY).toFixed(2);
        const relZ = (source.positionZ - posZ).toFixed(2);
        ctxTop.fillStyle = "rgb(0,200,0)";
        ctxTop.beginPath();
        ctxTop.arc(x, y, 8, 0, 2 * Math.PI);
        ctxTop.fill();
        ctxTop.fillText(`Source ${index + 1}:`, x + 15, y);
        ctxTop.fillText(`${relX}, ${relY}, ${relZ}`, x + 15, y + 10);
    });
}

// Function to draw the front view visualization
function drawVisualizationFront() {
    ctxFront.clearRect(0, 0, canvasFront.width, canvasFront.height); // Clear the canvas

    // Draw the listener at the center
    const centerX = canvasFront.width / 2;
    const centerY = canvasFront.height / 2;
    ctxFront.fillStyle = 'red';
    ctxFront.beginPath();
    ctxFront.arc(centerX, centerY, 10, 0, 2 * Math.PI);
    ctxFront.fill();
    ctxFront.fillText('Listener', centerX + 15, centerY);

    // Draw each source
    sources.forEach((source, index) => {
        const x = centerX + (source.positionX - posX) * 50; // Scale for visualization
        const y = centerY + (source.positionZ - posZ) * 50; // Scale for visualization
        // Display the relative x, z values
        const relX = (source.positionX - posX).toFixed(2);
        const relZ = (source.positionZ - posZ).toFixed(2);
        ctxFront.fillStyle = "rgb(0,200,0)";
        ctxFront.beginPath();
        ctxFront.arc(x, y, 8, 0, 2 * Math.PI);
        ctxFront.fill();
        ctxFront.fillText(`Source ${index + 1}:`, x + 15, y);
        ctxFront.fillText(`${relX}, 0, ${relZ}`, x + 15, y + 10);
    });
}

// Function to handle mousedown event
function onMouseDown(event) {
    const rectTop = canvasTop.getBoundingClientRect();
    const xTop = event.clientX - rectTop.left;
    const yTop = event.clientY - rectTop.top;
    const centerXTop = canvasTop.width / 2;
    const centerYTop = canvasTop.height / 2;

    const rectFront = canvasFront.getBoundingClientRect();
    const xFront = event.clientX - rectFront.left;
    const yFront = event.clientY - rectFront.top;
    const centerXFront = canvasFront.width / 2;
    const centerYFront = canvasFront.height / 2;

    sources.forEach((source, index) => {
        const sxTop = centerXTop + (source.positionX - posX) * 50;
        const syTop = centerYTop + (source.positionY - posY) * 50;
        const sxFront = centerXFront + (source.positionX - posX) * 50;
        const syFront = centerYFront + (source.positionZ - posZ) * 50;
        if (Math.sqrt((xTop - sxTop) ** 2 + (yTop - syTop) ** 2) < 8 || Math.sqrt((xFront - sxFront) ** 2 + (yFront - syFront) ** 2) < 8) {
            dragging = true;
            dragIndex = index;
            canvasTop.classList.add('dragging');
            canvasFront.classList.add('dragging');
        }
    });
}

// Function to handle mousemove event
function onMouseMove(event) {
    if (dragging && dragIndex > -1) {
        const rectTop = canvasTop.getBoundingClientRect();
        const xTop = event.clientX - rectTop.left;
        const yTop = event.clientY - rectTop.top;
        const centerXTop = canvasTop.width / 2;
        const centerYTop = canvasTop.height / 2;

        const rectFront = canvasFront.getBoundingClientRect();
        const xFront = event.clientX - rectFront.left;
        const yFront = event.clientY - rectFront.top;
        const centerXFront = canvasFront.width / 2;
        const centerYFront = canvasFront.height / 2;

        if (Math.sqrt((xTop - (centerXTop + (sources[dragIndex].positionX - posX) * 50)) ** 2 + (yTop - (centerYTop + (sources[dragIndex].positionY - posY) * 50)) ** 2) < 8) {
            sources[dragIndex].positionX = posX + (xTop - centerXTop) / 50;
            sources[dragIndex].positionY = posY + (yTop - centerYTop) / 50;
        } else if (Math.sqrt((xFront - (centerXFront + (sources[dragIndex].positionX - posX) * 50)) ** 2 + (yFront - (centerYFront + (sources[dragIndex].positionZ - posZ) * 50)) ** 2) < 8) {
            sources[dragIndex].positionX = posX + (xFront - centerXFront) / 50;
            sources[dragIndex].positionZ = posZ + (yFront - centerYFront) / 50;
        }

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

        drawVisualizationTop();
        drawVisualizationFront();
    }
}

// Function to handle mouseup event
function onMouseUp() {
    dragging = false;
    dragIndex = -1;
    canvasTop.classList.remove('dragging');
    canvasFront.classList.remove('dragging');
}

// Add event listeners to canvases
canvasTop.addEventListener('mousedown', onMouseDown);
canvasTop.addEventListener('mousemove', onMouseMove);
canvasTop.addEventListener('mouseup', onMouseUp);
canvasTop.addEventListener('mouseout', onMouseUp);

canvasFront.addEventListener('mousedown', onMouseDown);
canvasFront.addEventListener('mousemove', onMouseMove);
canvasFront.addEventListener('mouseup', onMouseUp);
canvasFront.addEventListener('mouseout', onMouseUp);

// Initial draw
drawVisualizationTop();
drawVisualizationFront();

// Redraw visualizations whenever window is resized to ensure positions are scaled correctly
window.addEventListener('resize', () => {
    listener.positionX.value = window.innerWidth / 2;
    listener.positionY.value = window.innerHeight / 2;
    drawVisualizationTop();
    drawVisualizationFront();
});
