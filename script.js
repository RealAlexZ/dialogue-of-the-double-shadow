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
    slider.value = gainNode.gain.value;
    slider.addEventListener("input", () => {
        gainNode.gain.value = parseFloat(slider.value);
        drawVisualizationTop();
        drawVisualizationFront();
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
document.querySelectorAll('.preset-btn').forEach(button => {
    button.addEventListener('click', function() {
        const presetValues = this.getAttribute('data-preset').split(',').map(Number);
        setVolumes(presetValues);
        drawVisualizationTop();
        drawVisualizationFront();
    });
});

// Function to set volumes for each channel according to preset configurations
function setVolumes(volumes) {
    volumes.forEach((volume, index) => {
        if (gainNodes[index]) { // Check if the gainNode exists
            gainNodes[index].gain.value = volume / 100;
            sliders[index].value = volume / 100; // Update the slider value to reflect the change
        }
    });
}

document.addEventListener('keydown', function(event) {
    if (event.key >= '1' && event.key <= '6') {
        const index = event.key - 1;
        const presetButton = document.querySelectorAll('.preset-btn')[index];
        if (presetButton) {
            presetButton.click();
        }
    }
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
let activeCanvas = null;

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
        ctxTop.arc(x, y, gainNodes[index].gain.value * 5 + 5, 0, 2 * Math.PI);
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

        // Display the relative x, y, z values
        const relX = (source.positionX - posX).toFixed(2);
        const relY = (source.positionY - posY).toFixed(2);
        const relZ = (source.positionZ - posZ).toFixed(2);
        ctxFront.fillStyle = "rgb(0,200,0)";
        ctxFront.beginPath();
        ctxFront.arc(x, y, gainNodes[index].gain.value * 5 + 5, 0, 2 * Math.PI);
        ctxFront.fill();
        ctxFront.fillText(`Source ${index + 1}:`, x + 15, y);
        ctxFront.fillText(`${relX}, ${relY}, ${relZ}`, x + 15, y + 10);
    });
}


// Function to handle mousedown event for both canvases
function onMouseDown(event) {
    const rectTop = canvasTop.getBoundingClientRect();
    const xTop = event.clientX - rectTop.left;
    const yTop = event.clientY - rectTop.top;

    const rectFront = canvasFront.getBoundingClientRect();
    const xFront = event.clientX - rectFront.left;
    const yFront = event.clientY - rectFront.top;

    const centerXTop = canvasTop.width / 2;
    const centerYTop = canvasTop.height / 2;

    const centerXFront = canvasFront.width / 2;
    const centerYFront = canvasFront.height / 2;

    sources.forEach((source, index) => {
        const sourceXTop = centerXTop + (source.positionX - posX) * 50;
        const sourceYTop = centerYTop + (source.positionZ - posZ) * 50;

        const sourceXFront = centerXFront + (source.positionX - posX) * 50;
        const sourceYFront = centerYFront - (source.positionY - posY) * 50;

        if (Math.sqrt((xTop - sourceXTop) ** 2 + (yTop - sourceYTop) ** 2) < 10) {
            dragging = true;
            dragIndex = index;
            activeCanvas = 'top';
        } else if (Math.sqrt((xFront - sourceXFront) ** 2 + (yFront - sourceYFront) ** 2) < 10) {
            dragging = true;
            dragIndex = index;
            activeCanvas = 'front';
        }
    });
}

// Function to handle mousemove event for both canvases
function onMouseMove(event) {
    if (dragging && dragIndex !== -1) {
        if (activeCanvas === 'top') {
            const rectTop = canvasTop.getBoundingClientRect();
            const xTop = event.clientX - rectTop.left;
            const yTop = event.clientY - rectTop.top;

            const centerXTop = canvasTop.width / 2;
            const centerYTop = canvasTop.height / 2;

            // Update the x and z positions using the top view
            sources[dragIndex].positionX = posX + (xTop - centerXTop) / 50;
            sources[dragIndex].positionZ = posZ + (yTop - centerYTop) / 50;
        } else if (activeCanvas === 'front') {
            const rectFront = canvasFront.getBoundingClientRect();
            const xFront = event.clientX - rectFront.left;
            const yFront = event.clientY - rectFront.top;

            const centerXFront = canvasFront.width / 2;
            const centerYFront = canvasFront.height / 2;

            // Update the x and y positions using the front view
            sources[dragIndex].positionX = posX + (xFront - centerXFront) / 50;
            sources[dragIndex].positionY = posY - (yFront - centerYFront) / 50;
        }

        // Recalculate orientation for the source
        const orientation = calculateOrientation(listenerPos, {
            x: sources[dragIndex].positionX,
            y: sources[dragIndex].positionY,
            z: sources[dragIndex].positionZ
        });

        // Update the panner node values
        panners[dragIndex].positionX.value = sources[dragIndex].positionX;
        panners[dragIndex].positionY.value = sources[dragIndex].positionY;
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
        activeCanvas = null;
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
