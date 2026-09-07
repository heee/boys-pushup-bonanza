import { createUprightPushupTracker } from "../modes/upright-pushup.js";

const HINTS = {
  positioning: "Leave the phone upright. Face it in a high plank with both shoulders and hands visible. Hold still briefly.",
  lower: "Lower your chest for one slow practice pushup. The workout timer is waiting.",
  return: "Push back up to finish calibration. This practice rep won’t count.",
  lost: "Keep both shoulders and hands in view, and keep your hands planted. Move yourself to fit the frame.",
  recovering: "Return to the top of your pushup to resume tracking.",
};

export function createChainPushupScreen({ $, savedRange, onReady, onRatio, onLost, onReacquired }) {
  const tracker = createUprightPushupTracker(savedRange);
  let ready = false;
  $("chainofpain-cal-stage").classList.remove("hidden");
  $("chainofpain-count-stage").classList.add("hidden");
  $("chainofpain-cal-title").textContent = "Find your pushup range";
  $("chainofpain-cal-instructions").textContent = HINTS.positioning;
  $("chainofpain-cal-error").classList.add("hidden");
  $("btn-chainofpain-face-tracker").classList.remove("hidden");
  return {
    sample(landmarks, now, aspect) {
      const result = tracker.sample(landmarks, now, aspect);
      if (result.status === "ready") {
        ready = true;
        $("btn-chainofpain-face-tracker").classList.add("hidden");
        onReady(result.thresholds, tracker.range);
      } else if (result.status === "tracking") {
        if (result.reacquired) onReacquired(result.thresholds);
        onRatio(result.ratio);
      } else {
        if (!ready) $("chainofpain-cal-instructions").textContent = HINTS[result.status];
        else onLost(HINTS[result.status]);
      }
      return result;
    },
  };
}
