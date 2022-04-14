import { ThreeShaderCanvas } from "./ThreeShaderCanvas/ThreeShaderCanvas.js";

const _SET_COUNT = 3;
const _FRACTAL_FRAGMENT_SHADER = `
vec2 complexMultiply(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 complexDivide(vec2 a, vec2 b) {
    return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) * 1.0 / (b.x * b.x + b.y * b.y);
}

vec2 complexSquare(vec2 c) {
    return complexMultiply(c, c);
}

vec2 complexCube(vec2 c) {
    return complexMultiply(complexMultiply(c, c), c);
}

vec2 complexAbs(vec2 c) {
    return vec2(abs(c.x), abs(c.y));
}

uniform int maxIterations;
uniform float infinity;

uniform float scale;
uniform float xOffset;
uniform float yOffset;

uniform int setId;

uniform bool juliaSet;
uniform float juliaSetReal;
uniform float juliaSetImaginary;

// These can also be integers but for math reasons we'll store them as floats
uniform float screenWidth;
uniform float screenHeight;

in vec2 fUv;

void main() {
    // This keeps the aspect ratio of a square
    float minScreenSize = min(screenWidth, screenHeight);
    vec2 normalizedPosition = vec2(
        (fUv.x - 0.5) * screenWidth / minScreenSize,
        (fUv.y - 0.5) * screenHeight / minScreenSize
    );

    vec2 complexPixelPosition = vec2(
        normalizedPosition.x * scale + xOffset,
        normalizedPosition.y * scale + yOffset
    );

    vec2 c0 = juliaSet ? vec2(
        juliaSetReal, juliaSetImaginary
    ) : complexPixelPosition;

    vec2 c = complexPixelPosition;

    int iteration = 0;
    for (; iteration < maxIterations && abs(c.x * c.x + c.y * c.y) <= infinity; iteration++) {
        switch (setId) {
        default:
        case 0: { // Mandlebrot
            c = complexSquare(c) + c0;
            break;
        }
        case 1: { // Burning Ship
            c = complexSquare(complexAbs(c)) + c0;
            break;
        }
        case 2: { // Feather
            c = complexDivide(complexCube(c), vec2(1.0, 0.0) + c * c) + c0;
        }
        }
    }

    float grayScale = float(iteration) / float(maxIterations) * float(iteration != maxIterations);

    // gl_FragColor = vec4(clamp(c, 0.0, 1.0) * grayScale, grayScale, 1.0);
    gl_FragColor = vec4(0.03, 0.0, grayScale, 1.0);
}
`;

/**
 * Loops the specified Number
 * 
 * Examples:
 *  - (-1, 0, 3) => 2
 *  - ( 3, 0, 3) => 0
 * @param {Number} value
 * @param {Number} minValue
 * @param {Number} maxValue
 * @returns {Number}
 */
const loopNumber = (value, minValue, maxValue) => {
    const valueDelta = (value - minValue) % (maxValue - minValue);
    return valueDelta < 0 ? maxValue + valueDelta : minValue + valueDelta;
};

const THREE_CANVAS = new ThreeShaderCanvas({
    "autoAppend": false,
    "autoStart": false,
    "fragmentShader": _FRACTAL_FRAGMENT_SHADER,
    "uniforms": {
        "maxIterations": { "value": 100 },
        "infinity": { "value": 4 },
        "setId": { "value": 0 },
        "scale": { "value": 1 },
        "xOffset": { "value": 0 },
        "yOffset": { "value": 0 },
        "juliaSet": { "value": false },
        "juliaSetReal": { "value": 0 },
        "juliaSetImaginary": { "value": 0 }
    }
});

const _ZOOM_SPEED = 0.1;

/**
 * @param {Number} direction
 */
const changeZoom = (direction) => {
    const newScale = THREE_CANVAS.getUniform("scale") + Math.sign(direction) * _ZOOM_SPEED * THREE_CANVAS.getUniform("scale");
    if (newScale > 0) THREE_CANVAS.setUniform("scale", newScale);
};

/**
 * @param {Number} deltaX
 * @param {Number} deltaY
 */
const moveOffset = (deltaX, deltaY) => {
    const screenWidth = THREE_CANVAS.getUniform("screenWidth");
    const screenHeight = THREE_CANVAS.getUniform("screenHeight");
    const minScreenSize = Math.min(screenWidth, screenHeight);

    THREE_CANVAS.applyToUniform(
        "xOffset", u => u - deltaX / minScreenSize * THREE_CANVAS.getUniform("scale")
    );

    THREE_CANVAS.applyToUniform(
        "yOffset", u => u - deltaY / minScreenSize * THREE_CANVAS.getUniform("scale")
    );
};

/**
 * @param {Number} indexOffset
 */
const changeSet = (indexOffset) => {
    THREE_CANVAS.applyToUniform("setId", u => loopNumber(u + indexOffset, 0, _SET_COUNT));
};

/**
 * @param {Boolean} [newState]
 */
const toggleJuliaSet = (newState = null) => {
    if (newState == null)
        THREE_CANVAS.applyToUniform("juliaSet", u => !u);
    else THREE_CANVAS.setUniform("juliaSet", newState);
};

/**
 * @param {Number} pageX
 * @param {Number} pageY
 * @param {Boolean} [enableJulia]
 */
const setJuliaCoords = (pageX, pageY, enableJulia = false) => {
    const screenWidth = THREE_CANVAS.getUniform("screenWidth");
    const screenHeight = THREE_CANVAS.getUniform("screenHeight");
    const minScreenSize = Math.min(screenWidth, screenHeight);

    if (enableJulia) THREE_CANVAS.setUniform("juliaSet", true);

    THREE_CANVAS.setUniform(
        "juliaSetReal",
        // With (posX / screenWidth) being the UV coordinate
        // This formula is equivalent to:
        //  (posX / screenWidth - 0.5) * screenWidth / minScreenSize * scale + xOffset
        // Which is the one used in the shader to get the actual position of the pixels
        (pageX - 0.5 * screenWidth) / minScreenSize * THREE_CANVAS.getUniform("scale")
            + THREE_CANVAS.getUniform("xOffset")
    );

    THREE_CANVAS.setUniform(
        "juliaSetImaginary",
        (pageY - 0.5 * screenHeight) / minScreenSize * THREE_CANVAS.getUniform("scale")
            + THREE_CANVAS.getUniform("yOffset")
    );
};

window.addEventListener("load", () => {
    document.body.appendChild(THREE_CANVAS.getDomElement());
    THREE_CANVAS.startDrawing();
});

window.addEventListener("keydown", ev => {
    switch (ev.key.toLowerCase()) {
    case "arrowup":
        changeSet(1);
        break;
    case "arrowdown":
        changeSet(-1);
        break;
    case "j":
        toggleJuliaSet();
    }
});

window.addEventListener("wheel", ev => {
    changeZoom(ev.deltaY);
});
    
window.addEventListener("pointermove", ev => {
    if (ev.ctrlKey) {
        setJuliaCoords(ev.pageX, ev.pageY, true);
    } else if (ev.buttons === 1) {
        moveOffset(ev.movementX, ev.movementY);
    }
});
