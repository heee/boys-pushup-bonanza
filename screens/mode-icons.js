// Stroke-only mode icons (24px grid, currentColor) for the Explore Modes list
// and the Home mode picker. Keyed by explore-mode id; anything missing falls
// back to that mode's emoji. Previewed in docs/mode-icons-preview.html.
const S = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const DOT = (x, y) => `<circle cx="${x}" cy="${y}" r="1.25" fill="currentColor" stroke="none"/>`;
export const MODE_ICONS = {
  // Pushup: diagonal body, straight arm, floor.
  classic: S('<circle cx="4.5" cy="8.5" r="2"/><path d="M7 10.5 21 15"/><path d="M8.5 11v6.5"/><path d="M3 18h19"/>'),
  countdown: S('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2"/><path d="M10 2.5h4"/><path d="M12 2.5V6"/>'),
  cards: S('<rect x="9" y="3" width="11" height="15" rx="2"/><path d="M6.2 6.5 4.1 17.4a2 2 0 0 0 1.6 2.3l7.4 1.4"/>'),
  dice: S('<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/>' + DOT(8.5, 8.5) + DOT(12, 12) + DOT(15.5, 15.5)),
  // Forearm plank: flat body, bent arm on the floor.
  plank: S('<circle cx="4.5" cy="9.5" r="2"/><path d="M7 11.5l14 4"/><path d="M8.5 12 7.5 18h4.5"/><path d="M3 18h19"/>'),
  squat: S('<circle cx="11" cy="3.8" r="2"/><path d="M11 6.5 9.5 12h6.5l-1 8"/><path d="M10.5 8.5H18"/><path d="M5 20.5h15"/>'),
  pullup: S('<path d="M2.5 3h19"/><path d="M7 3l3 8"/><path d="M17 3l-3 8"/><circle cx="12" cy="8.3" r="2"/><path d="M12 10.5V16"/><path d="m12 16-2 5"/><path d="m12 16 2 5"/>'),
  situp: S('<circle cx="5.5" cy="9.5" r="2"/><path d="M7.3 12 12 17.5 16 11.5l4 6"/><path d="M3 20.5h18"/>'),
  // Holland: windmill.
  holland: S('<path d="M9.5 21 11 11.5h2l1.5 9.5"/><path d="M7 21h10"/><path d="M5.5 3.5 18.5 15"/><path d="M18.5 3.5 5.5 15"/>' + DOT(12, 9.2)),
  chainofpain: S('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  ladder: S('<path d="M7 2.5v19"/><path d="M17 2.5v19"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/>'),
  // Folded cookie with a fortune slip poking out.
  chase: S('<path d="M3 7.5 5.5 17h13L21 7.5l-5 4.5L12 5l-4 7Z"/><path d="M5.5 20.5h13"/>'),
  poker: S('<path d="M12 3c-2.7 3.6-7.5 5.8-7.5 9.7a3.8 3.8 0 0 0 6.6 2.5"/><path d="M12 3c2.7 3.6 7.5 5.8 7.5 9.7a3.8 3.8 0 0 1-6.6 2.5"/><path d="m12 13.5-1.8 7.5h3.6Z"/>'),
  wheel: S('<circle cx="12" cy="13" r="8.5"/><circle cx="12" cy="13" r="1.8"/><path d="M12 4.5v6.7"/><path d="M12 14.8v6.7"/><path d="M3.5 13h6.7"/><path d="M13.8 13h6.7"/><path d="m10 1.5 2 3 2-3Z"/>'),
  sharpshooter: S('<circle cx="12" cy="12" r="8"/><path d="M12 2v5"/><path d="M12 17v5"/><path d="M2 12h5"/><path d="M17 12h5"/>' + DOT(12, 12)),
  pyramid: S('<path d="M12 3 22 20H2Z"/><path d="M5.5 14h13"/><path d="M8.5 9h7"/>'),
  pulse: S('<path d="M2 12h4l2.5-6 4 13 3-9 1.5 2H22"/>'),
  // Rooster: comb, beak, wattle, round body, sweeping tail, legs.
  cock: S('<path d="M8 4.8c-.2-1.3 1.2-2 2-1 .5-1 2.1-.7 2 .6"/><path d="M8.2 9.6V7a2.2 2.2 0 0 1 4.4 0v3.5c2 .9 4 .6 5.6-1.4"/><path d="M8.2 6.6 6 7.6l2.2 1"/><path d="M8.2 9.6c-.8 3.4.5 6.9 4.3 7.6 4 .7 7.6-2.4 7.3-7.7-.1-1.6-.6-3-1.4-4.2"/><path d="M18.4 5.3c-1.2 1.6-2.7 2.5-4.4 2.8"/><path d="m11.5 17.2-.8 3.8"/><path d="m14.5 17.2.6 3.8"/>'),
  zen: S('<path d="M12 20c-2.4-2-3.5-4.8-3.5-7.8S9.8 6.2 12 4c2.2 2.2 3.5 5.2 3.5 8.2S14.4 18 12 20Z"/><path d="M12 20c-3.8 0-7.3-2.3-8.7-6.3 2.6-.6 4.8-.1 6.3 1.2"/><path d="M12 20c3.8 0 7.3-2.3 8.7-6.3-2.6-.6-4.8-.1-6.3 1.2"/>'),
  // Horse: chess-knight silhouette.
  horse: S('<path d="M7 21h11"/><path d="M8.5 21c0-3.5 1-5.8 3.3-7.8-1.8.2-3.5.9-4.7 2.1L5 13.4c.7-3.5 2.9-6.6 6-8.4l.8-2 1.5 2c3.5 1.4 5.2 5 5.2 9.2V21"/>' + DOT(11.5, 8.3)),
  // Tug of war: rope pulled both ways with a centre flag.
  tow: S('<path d="M2.5 12h19"/><path d="m5.5 9-3 3 3 3"/><path d="m18.5 9 3 3-3 3"/><path d="M12 12v6.5"/><path d="M12 12.5h3.5L14.5 14l1 1.5H12"/>'),
  "kb-five-alive": S('<path d="M18 11V6a1.5 1.5 0 0 0-3 0"/><path d="M15 10V4.5a1.5 1.5 0 0 0-3 0V10"/><path d="M12 10V5.5a1.5 1.5 0 0 0-3 0V12"/><path d="M9 12V8.5a1.5 1.5 0 0 0-3 0V14a7 7 0 0 0 7 7h.5a6.5 6.5 0 0 0 4.5-1.8c1-1 1.6-2.4 2-3.7l1.3-4.2a1.5 1.5 0 0 0-2.8-1L18 13"/>'),
  "kb-throne-room": S('<path d="M7 11V4a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 17 4v7"/><path d="M5 11h14v4H5Z"/><path d="M6.5 15v6"/><path d="M17.5 15v6"/><path d="M5 11V9"/><path d="M19 11V9"/>'),
  // Iron Grip: clenched fist, knuckles up.
  "kb-iron-grip": S('<path d="M7 11V8.5a1.5 1.5 0 0 1 3 0V10"/><path d="M10 10V7.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 10V8a1.5 1.5 0 0 1 3 0v2"/><path d="M16 10.5V9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5A5.5 5.5 0 0 1 6 15.5V13a2 2 0 0 1 2-2h3.5a1.5 1.5 0 0 1 0 3H9.5"/>'),
  "kb-core-ten": S('<path d="M8.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5"/><path d="M7.5 9.5h9c1.6 1.4 2.5 3.5 2.5 5.7 0 2.3-1 4.3-2.6 5.8H7.6C6 19.5 5 17.5 5 15.2c0-2.2.9-4.3 2.5-5.7Z"/><path d="M10 13v5"/><circle cx="13.6" cy="15.5" r="1.6"/>'),
};

export function modeIconSvg(id) {
  return MODE_ICONS[id] || "";
}

// Home Type selector icons — the single-exercise types reuse their mode's
// drawing; Circuits gets a loop and Kettlebell a plain bell.
const TYPE_ICONS = {
  pushups: MODE_ICONS.classic,
  squats: MODE_ICONS.squat,
  pullups: MODE_ICONS.pullup,
  situps: MODE_ICONS.situp,
  planks: MODE_ICONS.plank,
  circuits: S('<path d="M20 11a8 8 0 0 0-14.9-4"/><path d="M4 3.5V7.5h4"/><path d="M4 13a8 8 0 0 0 14.9 4"/><path d="M20 20.5v-4h-4"/>'),
  kettlebell: S('<path d="M8.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5"/><path d="M7.5 9.5h9c1.6 1.4 2.5 3.5 2.5 5.7 0 2.3-1 4.3-2.6 5.8H7.6C6 19.5 5 17.5 5 15.2c0-2.2.9-4.3 2.5-5.7Z"/>'),
};

export function typeIconSvg(id) {
  return TYPE_ICONS[id] || "";
}
