export function createCameraController({
  moduleUrl,
  wasmUrl,
  modelUrl,
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

  function buildDetector(vision, FaceDetector, selectedDelegate) {
    return FaceDetector.createFromOptions(vision, {
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
      const { FaceDetector, FilesetResolver } = visionModule;
      const vision = await FilesetResolver.forVisionTasks(wasmUrl);
      detectorVision = vision;
      DetectorClass = FaceDetector;
      try {
        detector = await buildDetector(vision, FaceDetector, "GPU");
        delegate = "GPU";
      } catch {
        detector = await buildDetector(vision, FaceDetector, "CPU");
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
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
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
