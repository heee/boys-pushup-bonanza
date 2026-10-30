// One detector per (type, model), shared by every controller handed the same
// pool. Each MediaPipe detector boots its own copy of the ~9 MB WASM engine
// plus its model, and the API can't share an engine between detectors — so
// reusing detectors is what caps startups at one per type (face, pose)
// instead of one per mode, and per Holland/Chain of Pain exercise switch.
// Only one camera mode runs at a time, and every controller timestamps with
// the same monotonic clock, so VIDEO-mode timestamps stay increasing.
export function createDetectorPool() {
  return new Map();
}

export function createCameraController({
  moduleUrl,
  wasmUrl,
  modelUrl,
  // "face" (default) uses FaceDetector and reports the first face's bounding
  // box. "pose" uses PoseLandmarker and reports the first person's landmark
  // array — needed by squat mode, where the boy stands a couple meters back
  // and the short-range face model can't see him at all.
  detectorType = "face",
  // Shared detectors (createDetectorPool); omitted → this controller keeps
  // a private one.
  detectorPool = null,
  getVideo,
  now = () => performance.now(),
  requestFrame = (callback) => requestAnimationFrame(callback),
  getUserMedia = (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  loadVisionModule = () => import(moduleUrl),
  // Blank frame for the warm-up detection (null skips it, e.g. in Node).
  createWarmupFrame = () => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    return canvas;
  },
  onDetection,
  onNoDetection,
}) {
  let consecutiveFailures = 0;
  let stream = null;
  let running = false;

  const engineKey = `${detectorType}|${modelUrl}`;
  let privateEngine = null;
  function engine() {
    if (!detectorPool) return (privateEngine ??= createEngine());
    if (!detectorPool.has(engineKey)) detectorPool.set(engineKey, createEngine());
    return detectorPool.get(engineKey);
  }

  function createEngine() {
    return { detector: null, loading: null, vision: null, DetectorClass: null, delegate: null, rebuilding: false };
  }

  function buildDetector(vision, Detector, selectedDelegate) {
    if (detectorType === "pose") {
      return Detector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrl, delegate: selectedDelegate },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    }
    return Detector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelUrl, delegate: selectedDelegate },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    });
  }

  async function ensureDetector() {
    const e = engine();
    if (e.detector) return e.detector;
    if (e.loading) return e.loading;
    e.loading = (async () => {
      const visionModule = await loadVisionModule();
      const { FaceDetector, PoseLandmarker, FilesetResolver } = visionModule;
      const vision = await FilesetResolver.forVisionTasks(wasmUrl);
      e.vision = vision;
      e.DetectorClass = detectorType === "pose" ? PoseLandmarker : FaceDetector;
      // The face model is tiny: CPU runs it as fast as the GPU, and skips the
      // GPU's shader compile (~1s on the first detection in testing). The
      // heavier pose model still prefers the GPU.
      const [preferred, fallback] = detectorType === "pose" ? ["GPU", "CPU"] : ["CPU", "GPU"];
      let built;
      try {
        built = await buildDetector(vision, e.DetectorClass, preferred);
        e.delegate = preferred;
      } catch {
        built = await buildDetector(vision, e.DetectorClass, fallback);
        e.delegate = fallback;
      }
      warmUp(built);
      e.detector = built;
      return built;
    })();
    try {
      return await e.loading;
    } catch (error) {
      e.loading = null;
      throw error;
    }
  }

  // One throwaway detection while loading, so the first real frame doesn't
  // pay the one-time setup cost (GPU shader compile, CPU buffer allocation)
  // after the workout has already started.
  function warmUp(target) {
    try {
      const frame = createWarmupFrame();
      if (frame) target.detectForVideo(frame, now());
    } catch {
      // Best effort — the first real frame just pays the cost instead.
    }
  }

  async function rebuildOnCpu() {
    const e = engine();
    if (e.rebuilding || !e.vision) return;
    e.rebuilding = true;
    try {
      const replacement = await buildDetector(e.vision, e.DetectorClass, "CPU");
      const old = e.detector;
      e.detector = replacement;
      e.delegate = "CPU";
      try { old?.close?.(); } catch { /* ignore */ }
    } catch {
      // Keep the current detector if CPU initialization also fails.
    } finally {
      e.rebuilding = false;
    }
  }

  async function requestStream() {
    // Pose mode tracks a whole body several feet back, not a close-up face —
    // at the old 640x480 ideal, hip/knee landmarks routinely fell below the
    // visibility confidence floor, so the detector's bbox would shrink to
    // whatever few high-confidence points remained (jumping between a small
    // upper-body box and a large full-body one) and reps went uncounted.
    // More source pixels give the model enough detail to track the far-away
    // body confidently.
    const resolution = detectorType === "pose"
      ? { width: { ideal: 1280 }, height: { ideal: 960 } }
      : { width: { ideal: 640 }, height: { ideal: 480 } };
    stream = await getUserMedia({
      video: { facingMode: { exact: "user" }, ...resolution },
      audio: false,
    });
    return stream;
  }

  function runDetectionOnce() {
    const video = getVideo();
    const { detector, delegate, rebuilding } = engine();
    if (!detector || !video.videoWidth) return;
    const startedAt = now();
    let result;
    try {
      result = detector.detectForVideo(video, startedAt);
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures === 10 && delegate === "GPU" && !rebuilding) rebuildOnCpu();
      return;
    }
    const inferenceMs = now() - startedAt;
    if (detectorType === "pose") {
      if (result?.landmarks?.length) onDetection(result.landmarks[0], inferenceMs);
      else onNoDetection(inferenceMs, startedAt);
      return;
    }
    if (result?.detections?.length) {
      onDetection(result.detections[0].boundingBox, inferenceMs);
    } else {
      onNoDetection(inferenceMs, startedAt);
    }
  }

  function startDetection() {
    running = true;
    const video = getVideo();
    const useVideoFrames = typeof video.requestVideoFrameCallback === "function";
    let lastProcessed = 0;
    // Real wall-clock time, deliberately not the injectable `now` param —
    // this is a background safety net unrelated to per-frame inference
    // timing, and must not consume/interfere with a test's mocked clock.
    let lastFrameAt = Date.now();
    let usingFallback = false;

    // requestVideoFrameCallback only fires when the browser actually decodes
    // a new video frame — unlike requestAnimationFrame, it does not run on
    // its own schedule. If the stream stalls (observed on some sessions:
    // video technically playing, but frame delivery silently stops after
    // the very first frame — camera preview and any face/pose box freeze on
    // a single stale frame), rVFC simply never fires again and detection
    // halts forever with no error and no further callbacks of any kind, so
    // nothing downstream (including calibration hint text) can react. This
    // watchdog falls back to plain rAF polling — which doesn't require a
    // "new" frame, just samples whatever's currently in the video element —
    // if rVFC goes quiet for longer than a real camera frame gap ever should.
    const rafLoop = (frameNow) => {
      if (!running) return;
      if (frameNow - lastProcessed >= 25) {
        lastProcessed = frameNow;
        runDetectionOnce();
      }
      requestFrame(rafLoop);
    };

    const onFrame = (frameNow) => {
      if (!running || usingFallback) return;
      lastFrameAt = Date.now();
      if (frameNow - lastProcessed >= 25) {
        lastProcessed = frameNow;
        runDetectionOnce();
      }
      video.requestVideoFrameCallback(onFrame);
    };

    if (useVideoFrames) {
      video.requestVideoFrameCallback(onFrame);
      const watchdog = setInterval(() => {
        if (!running || usingFallback) { clearInterval(watchdog); return; }
        if (Date.now() - lastFrameAt > 1500) {
          usingFallback = true;
          clearInterval(watchdog);
          if (video.paused && typeof video.play === "function") video.play().catch(() => {});
          requestFrame(rafLoop);
        }
      }, 500);
      // Never keep a process alive on this timer alone — matters for the
      // Node test environment, harmless (unref is absent) in browsers.
      if (typeof watchdog.unref === "function") watchdog.unref();
    } else {
      requestFrame(rafLoop);
    }
  }

  function stop() {
    running = false;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    getVideo().srcObject = null;
  }

  return { ensureDetector, requestStream, startDetection, stop };
}
