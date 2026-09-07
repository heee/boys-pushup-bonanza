export function createCameraController({
  moduleUrl,
  wasmUrl,
  modelUrl,
  // "face" (default) uses FaceDetector and reports the first face's bounding
  // box. "pose" uses PoseLandmarker and reports the first person's landmark
  // array — needed by squat mode, where the boy stands a couple meters back
  // and the short-range face model can't see him at all.
  detectorType = "face",
  getVideo,
  now = () => performance.now(),
  requestFrame = (callback) => requestAnimationFrame(callback),
  getUserMedia = (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  loadVisionModule = () => import(moduleUrl),
  onDetection,
  onNoDetection,
}) {
  let detector = null;
  let detectorLoading = null;
  let detectorVision = null;
  let DetectorClass = null;
  let delegate = null;
  let rebuilding = false;
  let consecutiveFailures = 0;
  let stream = null;
  let running = false;

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
    if (detector) return detector;
    if (detectorLoading) return detectorLoading;
    detectorLoading = (async () => {
      const visionModule = await loadVisionModule();
      const { FaceDetector, PoseLandmarker, FilesetResolver } = visionModule;
      const vision = await FilesetResolver.forVisionTasks(wasmUrl);
      detectorVision = vision;
      DetectorClass = detectorType === "pose" ? PoseLandmarker : FaceDetector;
      try {
        detector = await buildDetector(vision, DetectorClass, "GPU");
        delegate = "GPU";
      } catch {
        detector = await buildDetector(vision, DetectorClass, "CPU");
        delegate = "CPU";
      }
      return detector;
    })();
    try {
      return await detectorLoading;
    } catch (error) {
      detectorLoading = null;
      throw error;
    }
  }

  async function rebuildOnCpu() {
    if (rebuilding || !detectorVision) return;
    rebuilding = true;
    try {
      const replacement = await buildDetector(detectorVision, DetectorClass, "CPU");
      const old = detector;
      detector = replacement;
      delegate = "CPU";
      try { old?.close?.(); } catch { /* ignore */ }
    } catch {
      // Keep the current detector if CPU initialization also fails.
    } finally {
      rebuilding = false;
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
