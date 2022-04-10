import { ThreeShaderCanvas } from "./ThreeShaderCanvas/ThreeShaderCanvas.js";

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

window.addEventListener("load", () => {
    const threeCanvas = new ThreeShaderCanvas({
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

    window.addEventListener("keydown", ev => {
        switch (ev.key.toLowerCase()) {
        case "arrowup":
            threeCanvas.applyToUniform("setId", u => u + 1);
            break;
        case "arrowdown":
            threeCanvas.applyToUniform("setId", u => u - 1);
            break;
        case "j":
            threeCanvas.applyToUniform("juliaSet", u => !u);
        }
    });

    window.addEventListener("wheel", ev => {
        const newScale = threeCanvas.getUniform("scale") + Math.sign(ev.deltaY) * 0.1 * threeCanvas.getUniform("scale");
        if (newScale > 0) threeCanvas.setUniform("scale", newScale);
    });
    
    window.addEventListener("mousemove", ev => {
        const screenWidth = threeCanvas.getUniform("screenWidth");
        const screenHeight = threeCanvas.getUniform("screenHeight");

        if (ev.ctrlKey) {
            threeCanvas.setUniform("juliaSet", true);
            threeCanvas.setUniform(
                "juliaSetReal",
                (ev.pageX / screenWidth - 0.5) * threeCanvas.getUniform("scale")
                    + threeCanvas.getUniform("xOffset")
            );
            threeCanvas.setUniform(
                "juliaSetImaginary",
                (ev.pageY / screenHeight - 0.5) * threeCanvas.getUniform("scale")
                    + threeCanvas.getUniform("yOffset")
            );
        } else if (ev.buttons === 1) {
            const minScreenSize = Math.min(screenWidth, screenHeight);
            threeCanvas.applyToUniform(
                "xOffset", u => u - ev.movementX / minScreenSize * threeCanvas.getUniform("scale")
            );
            threeCanvas.applyToUniform(
                "yOffset", u => u - ev.movementY / minScreenSize * threeCanvas.getUniform("scale")
            );
        }
    });
});
