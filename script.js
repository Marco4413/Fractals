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

uniform vec3 baseColor;
uniform vec3 blendColor;

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

    float blend = float(iteration) / float(maxIterations) * float(iteration != maxIterations);

    // gl_FragColor = vec4(clamp(c, 0.0, 1.0) * blend, blend, 1.0);
    // gl_FragColor = vec4(0.03, 0.0, blend, 1.0);
    gl_FragColor = vec4(clamp(baseColor + blendColor * blend, 0.0, 1.0), 1.0);
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
        "juliaSetImaginary": { "value": 0 },
        "baseColor": { "value": [ 0.03, 0.0, 0.0 ] },
        "blendColor": { "value": [ 0.0, 0.0, 1.0 ] }
    }
});

/** @type {HTMLDivElement|null} */
let SETTINGS_PANEL = null;

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

const colorFromHex = (hex) => {
    const rawColor = Number.parseInt(hex, 16);
    if (Number.isNaN(rawColor))
        return null;
    return [
        ((rawColor & 0xff0000) >> 16) / 255,
        ((rawColor & 0x00ff00) >>  8) / 255,
        ((rawColor & 0x0000ff)      ) / 255,
    ];
};

const colorToHex = (color) => {
    const value = (
        (Math.max(Math.min(color[0] * 255, 255), 0) << 16) |
        (Math.max(Math.min(color[1] * 255, 255), 0) <<  8) |
        (Math.max(Math.min(color[2] * 255, 255), 0)      )
    );

    let hex = value.toString(16);
    if (hex.length < 6) {
        // Pad with zeroes
        const padding = 6 - hex.length;
        hex = "0".repeat(padding) + hex;
    }

    return hex;
};

window.addEventListener("load", () => {
    document.body.appendChild(THREE_CANVAS.getDomElement());
    THREE_CANVAS.startDrawing();
    SETTINGS_PANEL = document.getElementById("settings-panel");

    /** @type {HTMLInputElement} */
    const baseColor = document.getElementById("base-color");
    baseColor.value = `#${colorToHex(THREE_CANVAS.getUniform("baseColor"))}`;
    baseColor.addEventListener("change", () => {
        const color = colorFromHex(baseColor.value.slice(1));
        if (color != null)
            THREE_CANVAS.setUniform("baseColor", color)
    });

    /** @type {HTMLInputElement} */
    const blendColor = document.getElementById("blend-color");
    blendColor.value = `#${colorToHex(THREE_CANVAS.getUniform("blendColor"))}`;
    blendColor.addEventListener("change", () => {
        const color = colorFromHex(blendColor.value.slice(1));
        if (color != null)
            THREE_CANVAS.setUniform("blendColor", color)
    });
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
        break;
    case "h":
        SETTINGS_PANEL?.classList.toggle("hidden");
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
