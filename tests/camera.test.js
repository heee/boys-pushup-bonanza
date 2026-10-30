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
    video: { facingMode: { exact: "user" }, width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  camera.stop();
  assert.equal(stopped, 2);
  assert.equal(video.srcObject, null);
});

test("pose detector requests a higher-resolution stream than the default face detector", async () => {
  let constraints;
  const video = { srcObject: null };
  const stream = { getTracks: () => [] };
  const camera = createCameraController({
    moduleUrl: "unused",
    wasmUrl: "unused",
    modelUrl: "unused",
    detectorType: "pose",
    getVideo: () => video,
    getUserMedia: async (value) => { constraints = value; return stream; },
    onDetection: () => {},
    onNoDetection: () => {},
  });

  await camera.requestStream();
  assert.deepEqual(constraints, {
    video: { facingMode: { exact: "user" }, width: { ideal: 1280 }, height: { ideal: 960 } },
    audio: false,
  });
});

test("face detector builds on CPU and keeps frame callback behavior", async () => {
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
  assert.deepEqual(delegates, ["CPU"]);
  assert.deepEqual(detected, { box: { height: 200 }, inferenceMs: 5 });
});

test("pose detector prefers the GPU and falls back to CPU", async () => {
  const delegates = [];
  const PoseLandmarker = {
    async createFromOptions(_vision, options) {
      delegates.push(options.baseOptions.delegate);
      if (options.baseOptions.delegate === "GPU") throw new Error("no webgl");
      return { detectForVideo: () => ({}) };
    },
  };
  const camera = createCameraController({
    moduleUrl: "unused", wasmUrl: "wasm", modelUrl: "model", detectorType: "pose",
    getVideo: () => ({}),
    loadVisionModule: async () => ({ PoseLandmarker, FilesetResolver: { forVisionTasks: async () => ({}) } }),
    onDetection: () => {}, onNoDetection: () => {},
  });
  await camera.ensureDetector();
  assert.deepEqual(delegates, ["GPU", "CPU"]);
});

test("detector runs one warm-up detection on a blank frame while loading", async () => {
  const frames = [];
  const frame = { blank: true };
  const camera = createCameraController({
    moduleUrl: "unused", wasmUrl: "wasm", modelUrl: "model",
    getVideo: () => ({}),
    now: () => 1,
    createWarmupFrame: () => frame,
    loadVisionModule: async () => ({
      FaceDetector: { createFromOptions: async () => ({ detectForVideo: (input) => { frames.push(input); throw new Error("ignored"); } }) },
      FilesetResolver: { forVisionTasks: async () => ({}) },
    }),
    onDetection: () => {}, onNoDetection: () => {},
  });
  await camera.ensureDetector();
  assert.deepEqual(frames, [frame]);
});
