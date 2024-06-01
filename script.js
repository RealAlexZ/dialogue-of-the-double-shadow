// Create a context and listener
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const listener = audioCtx.listener;

// Set the listener's position
const posX = window.innerWidth / 2;
const posY = window.innerHeight / 2;
const posZ = 300;

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
const innerCone = 30;
const outerCone = 60;
const outerGain = 0.3;
const distanceModel = "linear";
const maxDistance = 10000;
const refDistance = 1;
const rollOff = 10;

// Create PannerNode for each sound source
const sources = [
    { positionX: posX - 500, positionY: posY + 500, positionZ: posZ }, // Channel 1
    { positionX: posX - 500, positionY: posY - 500, positionZ: posZ }, // Channel 2
    { positionX: posX + 1000, positionY: posY, positionZ: posZ }, // Channel 3
    { positionX: posX + 500, positionY: posY + 500, positionZ: posZ }, // Channel 4
    { positionX: posX + 500, positionY: posY - 500, positionZ: posZ }, // Channel 5
    { positionX: posX - 1000, positionY: posY, positionZ: posZ } // Channel 6
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

// Create GainNodes for each sound source and a master GainNode
const gainNodes = sources.map(() => new GainNode(audioCtx));
const masterGainNode = new GainNode(audioCtx);

// Set the audio context destination to support the maximum number of output channels
audioCtx.destination.channelCount = audioCtx.destination.maxChannelCount;
audioCtx.destination.channelCountMode = "explicit";

// Get the audio element
const audioElement = document.querySelector("audio");

// Pass it into the audio context
const track = audioCtx.createMediaElementSource(audioElement);

// Connect each panner node to its respective GainNode and then to the master GainNode and destination
panners.forEach((panner, index) => {
    track.connect(panner).connect(gainNodes[index]).connect(masterGainNode).connect(audioCtx.destination);
});

// Select our play button
const playButton = document.querySelector("button");

// Function to handle play/pause
function togglePlay() {
    // Check if context is in suspended state (autoplay policy)
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    // Play or pause track depending on state
    if (playButton.dataset.playing === "false") {
        audioElement.play();
        playButton.dataset.playing = "true";
    } else if (playButton.dataset.playing === "true") {
        audioElement.pause();
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

// I had to hard code this
masterGainNodeMaxGain = 0.20
masterGainNode.gain.value = masterGainNodeMaxGain
controlsContainer.appendChild(createSlider("Master Volume", masterGainNode, 0., masterGainNodeMaxGain));
