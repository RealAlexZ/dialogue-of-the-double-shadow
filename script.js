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
const innerCone = 60;
const outerCone = 150;
const outerGain = 0.3;
const distanceModel = "linear";
const maxDistance = 10000;
const refDistance = 1;
const rollOff = 10;

// Create PannerNode for each sound source
const sources = [
    { positionX: posX-500, positionY: posY+500, positionZ: posZ }, // Channel 1
    { positionX: posX-500, positionY: posY-500, positionZ: posZ }, // Channel 2
    { positionX: posX+1000, positionY: posY, positionZ: posZ }, // Channel 3
    { positionX: posX+500, positionY: posY+500, positionZ: posZ }, // Channel 4
    { positionX: posX+500, positionY: posY-500, positionZ: posZ }, // Channel 5
    { positionX: posX-1000, positionY: posY, positionZ: posZ } // Channel 6
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

// Set the audio context destination to support the maximum number of output channels
audioCtx.destination.channelCount = audioCtx.destination.maxChannelCount;
audioCtx.destination.channelCountMode = "explicit";

// Get the audio element
const audioElement = document.querySelector("audio");

// Pass it into the audio context
const track = audioCtx.createMediaElementSource(audioElement);

// Connect each panner node to the track and destination
panners.forEach(panner => {
    track.connect(panner).connect(audioCtx.destination);
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
