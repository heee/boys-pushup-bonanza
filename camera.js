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
    stream = await getUserMedia({
      video: { facingMode: { exact: "user" }, width: { ideal: 640 }, height: { ideal: 480 } },
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
    const onFrame = (frameNow) => {
      if (!running) return;
      if (frameNow - lastProcessed >= 25) {
        lastProcessed = frameNow;
        runDetectionOnce();
      }
      if (useVideoFrames) video.requestVideoFrameCallback(onFrame);
      else requestFrame(onFrame);
    };
    if (useVideoFrames) video.requestVideoFrameCallback(onFrame);
    else requestFrame(onFrame);
  }

  function stop() {
    running = false;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    getVideo().srcObject = null;
  }

  return { ensureDetector, requestStream, startDetection, stop };
}
