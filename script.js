/*--------------------Global Variables--------------------*/
var masterGainNodeDoubleMaxGain = 0.20;
var masterGainNodePremiereMaxGain = 0.40;
/*--------------------Global Variables--------------------*/



/*--------------------Web Audio Environment Setup--------------------*/
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
const listenerPos = { x: posX, y: posY, z: posZ };

// Default settings of the listener's orientation
listener.forwardX.value = 0;
listener.forwardY.value = 0;
listener.forwardZ.value = -1;
listener.upX.value = 0;
listener.upY.value = 1;
listener.upZ.value = 0;

// Load the impulse response; upon load, connect it to the audio output.
// IR response acquired from http://reverbjs.org/
const reverbUrl = "http://reverbjs.org/Library/MidiverbMark2Preset29.m4a";
const reverbNode = audioCtx.createConvolver();
fetch(reverbUrl)
    .then(response => response.arrayBuffer())
    .then(arraybuffer => audioCtx.decodeAudioData(arraybuffer))
    .then(decodedData => {
        // The reverb node is ready and now can be used in the audio routing below
        reverbNode.buffer = decodedData;
    })
    .catch(e => console.error("Error loading or decoding reverb file:", e));

// Constants for panner properties
const innerCone = 30;
const outerCone = 60;
const outerGain = 0.3;
const distanceModel = "inverse";
const maxDistance = 40;
const refDistance = 5;
const rollOff = 3;
/*--------------------Web Audio Environment Setup--------------------*/



/*--------------------Sound Source Panner Nodes and Effect Chain Setup--------------------*/
// Create PannerNode for each sound source
// PositionX: left (-) or right (+)
// PositionY: down (-) or up (+)
// PositionZ: back (-) or front (0)
const sources = [
    { positionX: posX - 1, positionY: posY, positionZ: posZ - 1.7321 }, // Channel 1
    { positionX: posX + 1, positionY: posY, positionZ: posZ - 1.7321 }, // Channel 2
    { positionX: posX + 2, positionY: posY, positionZ: posZ }, // Channel 3
    { positionX: posX + 1, positionY: posY, positionZ: posZ + 1.7321 }, // Channel 4
    { positionX: posX - 1, positionY: posY, positionZ: posZ + 1.7321 }, // Channel 5
    { positionX: posX - 2, positionY: posY, positionZ: posZ }, // Channel 6
    { positionX: posX, positionY: posY, positionZ: posZ - 0.5 } // Channel 7 (premiere)
];

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
console.log(audioCtx.destination.channelCount);
audioCtx.destination.channelCountMode = "explicit";
audioCtx.destination.channelInterpretation = "speakers";

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
        trackPremiere.connect(panner).connect(reverbNode).connect(gainNodes[index]).connect(masterGainNodePremiere).connect(audioCtx.destination);
    }
});
/*--------------------Sound Source Panner Nodes and Effect Chain Setup--------------------*/



/*--------------------Play/Pause Button and Sliders--------------------*/
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
    // slider.value = gainNode.gain.value;  // Set initial slider value based on the GainNode
    slider.value = max;
    slider.addEventListener("input", () => {
        gainNode.gain.value = parseFloat(slider.value);
    });
    container.appendChild(label);
    container.appendChild(slider);
    return { container, slider };  // Return both the container and the slider
}

// Create sliders for each GainNode and the master GainNode
const controlsContainer = document.getElementById("controls");
const sliders = [];  // Array to hold references to slider elements

gainNodes.forEach((gainNode, index) => {
    const { container, slider } = createSlider(`Source ${index + 1} Volume`, gainNode);
    controlsContainer.appendChild(container);
    sliders.push(slider);  // Store the slider reference
});

const { container: containerDouble, slider: sliderDouble } = createSlider("Double Master Volume", masterGainNodeDouble, 0., masterGainNodeDoubleMaxGain);
controlsContainer.appendChild(containerDouble);
sliders.push(sliderDouble);

const { container: containerPremiere, slider: sliderPremiere } = createSlider("Premiere Master Volume", masterGainNodePremiere, 0, masterGainNodePremiereMaxGain);
controlsContainer.appendChild(containerPremiere);
sliders.push(sliderPremiere);
/*--------------------Play/Pause Button and Sliders--------------------*/



/*--------------------Presets of Slider Values--------------------*/
// Function to set volumes for each channel according to preset configurations
function setVolumes(volumes) {
    gainNodes.forEach((gainNode, index) => {
        sliders[index].value = volumes[index] / 100;  // Update the slider value to reflect the change
        gainNode.gain.value = volumes[index] / 100;
    });
}

// Adding event listeners to preset buttons to control the volumes
document.getElementById('preset1').addEventListener('click', function() {
    // Preset 1: Channels 1 and 7 at 100%, others at 0%
    setVolumes([100, 0, 0, 0, 0, 0, 100]);
});

document.getElementById('preset2').addEventListener('click', function() {
    // Preset 2: Channels 2 and 7 at 100%, others at 0%
    setVolumes([0, 100, 0, 0, 0, 0, 100]);
});

document.getElementById('preset3').addEventListener('click', function() {
    // Preset 3: Channels 3 and 7 at 100%, others at 0%
    setVolumes([0, 0, 100, 0, 0, 0, 100]);
});

document.getElementById('preset4').addEventListener('click', function() {
    // Preset 1: Channels 4 and 7 at 100%, others at 0%
    setVolumes([0, 0, 0, 100, 0, 0, 100]);
});

document.getElementById('preset5').addEventListener('click', function() {
    // Preset 2: Channels 5 and 7 at 100%, others at 0%
    setVolumes([0, 0, 0, 0, 100, 0, 100]);
});

document.getElementById('preset6').addEventListener('click', function() {
    // Preset 3: Channels 6 and 7 at 100%, others at 0%
    setVolumes([0, 0, 0, 0, 0, 100, 100]);
});
/*--------------------Presets of Slider Values--------------------*/



// /*--------------------Canvas Display of Sound Source Positions--------------------*/
// Get canvas elements and contexts
const canvasTop = document.getElementById('audioVisualizerTop');
const ctxTop = canvasTop.getContext('2d');

const canvasFront = document.getElementById('audioVisualizerFront');
const ctxFront = canvasFront.getContext('2d');

let dragging = false;
let dragIndex = -1;

// Redraw visualizations to reflect any changes
function drawVisualizationTop() {
    ctxTop.clearRect(0, 0, canvasTop.width, canvasTop.height); // Clear the canvas first

    const centerX = canvasTop.width / 2;
    const centerY = canvasTop.height / 2;

    // Draw the listener at the center
    ctxTop.fillStyle = 'red';
    ctxTop.beginPath();
    ctxTop.arc(centerX, centerY, 10, 0, 2 * Math.PI);
    ctxTop.fill();
    ctxTop.fillText('Listener', centerX + 15, centerY);

    // Draw each source
    sources.forEach((source, index) => {
        const x = centerX + (source.positionX - posX) * 50;
        const y = centerY + (source.positionZ - posZ) * 50;

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

function drawVisualizationFront() {
    ctxFront.clearRect(0, 0, canvasFront.width, canvasFront.height); // Clear the canvas first

    const centerX = canvasFront.width / 2;
    const centerY = canvasFront.height / 2;

    // Draw the listener at the center
    ctxFront.fillStyle = 'red';
    ctxFront.beginPath();
    ctxFront.arc(centerX, centerY, 10, 0, 2 * Math.PI);
    ctxFront.fill();
    ctxFront.fillText('Listener', centerX + 15, centerY);

    // Draw each source
    sources.forEach((source, index) => {
        const x = centerX + (source.positionX - posX) * 50;
        const y = centerY - (source.positionY - posY) * 50;

        ctxFront.fillStyle = "rgb(0,200,0)";
        ctxFront.beginPath();
        ctxFront.arc(x, y, 10, 0, 2 * Math.PI);
        ctxFront.fill();
        ctxFront.fillText(`Source ${index + 1}`, x + 15, y + 15);
    });
}

// Function to handle mousedown event
function onMouseDown(event) {
    const rectTop = canvasTop.getBoundingClientRect();
    const xTop = event.clientX - rectTop.left;
    const yTop = event.clientY - rectTop.top;

    // Calculate the center of the canvas for reference
    const centerXTop = canvasTop.width / 2;
    const centerYTop = canvasTop.height / 2;

    sources.forEach((source, index) => {
        // Calculate the display position of the source
        const sourceX = centerXTop + (source.positionX - posX) * 50;
        const sourceY = centerYTop + (source.positionZ - posZ) * 50;

        // Check if the mouse down event is close enough to consider it as dragging
        if (Math.sqrt((xTop - sourceX) ** 2 + (yTop - sourceY) ** 2) < 10) { // Assuming a radius of 10 for dragging proximity
            dragging = true;
            dragIndex = index;
        }
    });
}

// Function to handle mousemove event
function onMouseMove(event) {
    if (dragging && dragIndex !== -1) {
        const rectTop = canvasTop.getBoundingClientRect();
        const xTop = event.clientX - rectTop.left;
        const yTop = event.clientY - rectTop.top;

        const centerXTop = canvasTop.width / 2;
        const centerYTop = canvasTop.height / 2;

        // Update the position of the source being dragged based on mouse coordinates
        sources[dragIndex].positionX = posX + (xTop - centerXTop) / 50;
        sources[dragIndex].positionZ = posZ + (yTop - centerYTop) / 50;

        // Recalculate orientation for the source
        const orientation = calculateOrientation(listenerPos, {
            x: sources[dragIndex].positionX,
            y: sources[dragIndex].positionY,
            z: sources[dragIndex].positionZ
        });

        // Update the panner node values
        panners[dragIndex].positionX.value = sources[dragIndex].positionX;
        panners[dragIndex].positionZ.value = sources[dragIndex].positionZ;
        panners[dragIndex].orientationX.value = orientation.orientationX;
        panners[dragIndex].orientationY.value = orientation.orientationY;
        panners[dragIndex].orientationZ.value = orientation.orientationZ;

        drawVisualizationTop();
        drawVisualizationFront();
    }
}

// Function to handle mouseup event
function onMouseUp() {
    if (dragging) {
        dragging = false;
        dragIndex = -1;
    }
}

canvasTop.addEventListener('mousedown', onMouseDown);
canvasTop.addEventListener('mousemove', onMouseMove);
canvasTop.addEventListener('mouseup', onMouseUp);
canvasTop.addEventListener('mouseout', onMouseUp);

canvasFront.addEventListener('mousedown', onMouseDown);
canvasFront.addEventListener('mousemove', onMouseMove);
canvasFront.addEventListener('mouseup', onMouseUp);
canvasFront.addEventListener('mouseout', onMouseUp);

drawVisualizationTop();
drawVisualizationFront();

// /*--------------------Canvas Display of Sound Source Positions--------------------*/
