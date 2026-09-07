import { createUprightPushupTracker } from "../modes/upright-pushup.js";

const HINTS = {
  positioning: "Start pushing. Keep both shoulders and hands in view.",
  lower: "Lower your chest — your first complete pushup counts.",
  return: "Push back up to complete your first rep.",
  lost: "Keep both shoulders and hands in view, and keep your hands planted. Move yourself to fit the frame.",
  recovering: "Return to the top of your pushup to resume tracking.",
};

export function createChainPushupScreen({ $, savedRange, onReady, onFirstRep, onRatio, onLost, onReacquired }) {
  const tracker = createUprightPushupTracker(savedRange);
  let ready = false;
  $("chainofpain-cal-stage").classList.add("hidden");
  $("chainofpain-count-stage").classList.remove("hidden");
  $("chainofpain-status-banner").textContent = HINTS.positioning;
  $("chainofpain-status-banner").classList.remove("hidden");
  $("chainofpain-status-banner").classList.add("chainofpain-learning");
  $("chainofpain-cal-error").classList.add("hidden");
  $("chainofpain-camera-overlay").appendChild($("btn-chainofpain-face-tracker"));
  $("btn-chainofpain-face-tracker").classList.remove("hidden");
  return {
    sample(landmarks, now, aspect) {
      const result = tracker.sample(landmarks, now, aspect);
      if (result.status === "ready") {
        ready = true;
        $("btn-chainofpain-face-tracker").classList.add("hidden");
        onReady(result.thresholds, tracker.range);
        $("chainofpain-status-banner").classList.add("hidden");
        $("chainofpain-status-banner").classList.remove("chainofpain-learning");
        if (result.counted) onFirstRep?.();
      } else if (result.status === "tracking") {
        if (result.reacquired) onReacquired(result.thresholds);
        onRatio(result.ratio);
      } else {
        if (!ready) $("chainofpain-status-banner").textContent = HINTS[result.status];
        else onLost(HINTS[result.status]);
      }
      return result;
    },
  };
}
