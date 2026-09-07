import assert from "node:assert/strict";
import test from "node:test";
import { uprightPushupFrame, createUprightPushupTracker } from "../modes/upright-pushup.js";
import { createChainPushupScreen } from "../screens/chain-of-pain-pushups.js";
import { createRepCounter } from "../rep-counter.js";

function pose(y = 0.4) {
  const points = Array.from({length: 33}, () => ({x: 0.5, y: 0.5, visibility: 0}));
  for (const [i,x,py] of [[11,0.35,y],[12,0.65,y],[15,0.25,0.8],[16,0.75,0.8]]) points[i] = {x,y:py,visibility:0.99};
  return points;
}
function calibrate(tracker) {
  for (let t=0;t<=800;t+=100) tracker.sample(pose(),t);
  for (const t of [1100,1300,1500]) tracker.sample(pose(0.65),t);
  return tracker.sample(pose(),1900);
}

test("front-view frame uses both visible shoulders and planted hands, with aspect-correct scale", () => {
  const frame = uprightPushupFrame(pose(),2);
  assert.ok(Math.abs(frame.scale - 0.6) < 1e-9);
  for (const i of [11,12,15,16]) {
    const hidden = pose(); hidden[i].visibility = 0.2;
    assert.equal(uprightPushupFrame(hidden),null);
  }
  assert.equal(uprightPushupFrame(null),null);
  const invalid = pose(); invalid[11].x = NaN;
  assert.equal(uprightPushupFrame(invalid),null);
});

test("stationary setup and a single noisy frame cannot calibrate a pushup", () => {
  const tracker = createUprightPushupTracker();
  for(let t=0;t<=5000;t+=100) assert.notEqual(tracker.sample(pose(),t).status,"ready");
  tracker.sample(pose(0.7),5100);
  for(let t=5200;t<=6500;t+=100) assert.notEqual(tracker.sample(pose(),t).status,"ready");
});

test("one practice down/up establishes range without a rep; later full movements use the shared counter", () => {
  const tracker = createUprightPushupTracker();
  const result = calibrate(tracker);
  assert.equal(result.status,"ready");
  assert.ok(tracker.range >= 0.22);
  const counter = createRepCounter(result.thresholds);
  assert.equal(counter.count,0);
  for(const [t,y] of [[2000,0.4],[2300,0.65],[2500,0.65],[2800,0.4],[3000,0.4]]) {
    const frame = tracker.sample(pose(y),t);
    assert.equal(frame.status,"tracking");
    counter.advance(frame.ratio,t);
  }
  assert.equal(counter.count,1);
});

test("moving hands during calibration resets it; losing tracking rearms only at the top", () => {
  const moving = createUprightPushupTracker();
  for(let t=0;t<=800;t+=100) moving.sample(pose(),t);
  const shifted = pose(0.65); shifted[15].y = 0.6;
  assert.equal(moving.sample(shifted,1000).status,"lost");
  assert.equal(moving.sample(pose(),1100).status,"positioning");
  const tracker = createUprightPushupTracker(); calibrate(tracker);
  assert.equal(tracker.sample(null,2100).status,"lost");
  assert.equal(tracker.sample(pose(0.65),2200).status,"recovering");
  assert.equal(tracker.sample(pose(),2400).reacquired,true);
  assert.equal(tracker.sample(pose(),2500).reacquired,false);
});

test("later circuits reuse calibrated range after reacquiring a stable high plank", () => {
  const original = createUprightPushupTracker(); calibrate(original);
  const reused = createUprightPushupTracker(original.range);
  let last;
  for(let t=0;t<=800;t+=100) last = reused.sample(pose(),t);
  assert.equal(last.status,"ready");
  assert.equal(reused.range,original.range);
});

test("pushup screen waits for calibration, then reports motion and loss without restarting the timer", () => {
  const els = new Map();
  const $ = id => { if(!els.has(id)) els.set(id,{textContent:"",classList:{add(){},remove(){}}});return els.get(id); };
  let ready=0, samples=0, lost=0, reacquired=0;
  const screen = createChainPushupScreen({$,onReady:()=>ready++,onRatio:()=>samples++,onLost:()=>lost++,onReacquired:()=>reacquired++});
  for(let t=0;t<=800;t+=100) screen.sample(pose(),t,1);
  assert.match($("chainofpain-cal-instructions").textContent,/Lower your chest/);
  for(const t of [1100,1300,1500]) screen.sample(pose(0.65),t,1);
  screen.sample(pose(),1900,1);
  assert.equal(ready,1); assert.equal(samples,0);
  screen.sample(pose(),2000,1); screen.sample(null,2100,1); screen.sample(pose(),2400,1);
  assert.equal(ready,1); assert.equal(lost,1); assert.equal(reacquired,1); assert.equal(samples,2);
});
