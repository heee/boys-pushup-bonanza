import assert from "node:assert/strict";
import test from "node:test";
import { createCameraController } from "../camera.js";

test("camera controller requests the existing constraints and stops every track", async () => {
  let constraints;
  let stopped = 0;
  const video = { srcObject: { stale: true } };
  const stream = { getTracks: () => [{ stop: () => { stopped += 1; } }, { stop: () => { stopped += 1; } }] };
  const camera = createCameraController({
    moduleUrl: "unused",
    wasmUrl: "unused",
    modelUrl: "unused",
    getVideo: () => video,
    getUserMedia: async (value) => { constraints = value; return stream; },
    onDetection: () => {},
    onNoDetection: () => {},
  });

  assert.equal(await camera.requestStream(), stream);
  assert.deepEqual(constraints, {
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  camera.stop();
  assert.equal(stopped, 2);
  assert.equal(video.srcObject, null);
});

test("camera controller preserves GPU detection and frame callback behavior", async () => {
  let frameCallback;
  let detected;
  const delegates = [];
  const video = {
    videoWidth: 640,
    requestVideoFrameCallback(callback) { frameCallback = callback; },
  };
  const detector = { detectForVideo: () => ({ detections: [{ boundingBox: { height: 200 } }] }) };
  const FaceDetector = {
    async createFromOptions(_vision, options) {
      delegates.push(options.baseOptions.delegate);
      return detector;
    },
  };
  const times = [100, 105];
  const camera = createCameraController({
    moduleUrl: "unused",
    wasmUrl: "wasm",
    modelUrl: "model",
    getVideo: () => video,
    now: () => times.shift(),
    loadVisionModule: async () => ({
      FaceDetector,
      FilesetResolver: { forVisionTasks: async () => ({}) },
    }),
    onDetection: (box, inferenceMs) => { detected = { box, inferenceMs }; },
    onNoDetection: () => {},
  });

  await camera.ensureDetector();
  camera.startDetection();
  frameCallback(30);
  assert.deepEqual(delegates, ["GPU"]);
  assert.deepEqual(detected, { box: { height: 200 }, inferenceMs: 5 });
});
