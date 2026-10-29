// Roadtrip map (docs/roadtrip-map-plan.md) — pure helpers, no DOM or d3, so
// the shading, fitting and label rules are unit-testable. app.js draws the
// SVG with the vendored d3-geo/topojson (vendor/), lazy-loaded.

// ISO-2 (what sessions store) → ISO-3166 numeric (world-atlas feature ids),
// limited to countries present in countries-110m. Source: i18n-iso-countries.
const ISO_PAIRS = "AF004AL008DZ012AO024AQ010AR032AM051AU036AT040AZ031BS044BD050BY112BE056BZ084BJ204BT064BO068BA070BW072BR076BN096BG100BF854BI108KH116CM120CA124CF140TD148CL152CN156CO170CG178CD180CR188CI384HR191CU192CY196CZ203DK208DJ262DO214EC218EG818SV222GQ226ER232EE233ET231FK238FJ242FI246FR250TF260GA266GM270GE268DE276GH288GR300GL304GT320GN324GW624GY328HT332HN340HU348IS352IN356ID360IR364IQ368IE372IL376IT380JM388JP392JO400KZ398KE404KP408KR410KW414KG417LA418LV428LB422LS426LR430LY434LT440LU442MG450MW454MY458ML466MR478MX484MD498MN496MA504MZ508MM104NA516NP524NL528NC540NZ554NI558NE562NG566MK807NO578OM512PK586PS275PA591PG598PY600PE604PH608PL616PT620PR630QA634RO642RU643RW646SA682SN686SL694SK703SI705SB090SO706ZA710ES724LK144SD729SR740SZ748SE752CH756SY760TW158TJ762TZ834TH764TL626TG768TT780TN788TR792TM795UG800UA804AE784GB826US840UY858UZ860VU548VE862VN704EH732YE887ZM894ZW716ME499RS688SS728";
export const ISO2_TO_NUMERIC = Object.fromEntries(
  Array.from({ length: ISO_PAIRS.length / 5 }, (_, i) => [ISO_PAIRS.slice(i * 5, i * 5 + 2), ISO_PAIRS.slice(i * 5 + 2, i * 5 + 5)]),
);

// 0 = no reps; otherwise 0.4–1 on a sqrt scale so one huge country doesn't
// wash every other active one out to near-invisible.
export function heatLevel(total, max) {
  if (!total || !max) return 0;
  return 0.4 + 0.6 * Math.sqrt(Math.min(total, max) / max);
}

// Scale + translate that fits projected bounds [[x0,y0],[x1,y1]] into a
// width×height viewport with padding, capped at maxScale so a tiny country
// doesn't zoom to a blur.
export function fitTransform([[x0, y0], [x1, y1]], width, height, { pad = 0.08, maxScale = 12 } = {}) {
  const w = Math.max(x1 - x0, 1);
  const h = Math.max(y1 - y0, 1);
  const k = Math.min(maxScale, (width * (1 - 2 * pad)) / w, (height * (1 - 2 * pad)) / h);
  return { k, tx: width / 2 - k * (x0 + w / 2), ty: height / 2 - k * (y0 + h / 2) };
}

export function unionBounds(list) {
  const valid = list.filter(Boolean);
  if (!valid.length) return null;
  return [
    [Math.min(...valid.map((b) => b[0][0])), Math.min(...valid.map((b) => b[0][1]))],
    [Math.max(...valid.map((b) => b[1][0])), Math.max(...valid.map((b) => b[1][1]))],
  ];
}

// Fit-to-activity, unless activity already spans most of the world — then
// the plain world view reads better than an awkward near-world crop.
export function shouldShowWorld(activityBounds, worldWidth, threshold = 0.55) {
  if (!activityBounds) return true;
  return activityBounds[1][0] - activityBounds[0][0] > worldWidth * threshold;
}

// Greedy label culling: biggest totals win, any later pill whose box would
// overlap a kept one is dropped. Boxes are { x, y, w, h } centred on x,y.
export function cullLabels(labels, gap = 2) {
  const kept = [];
  const overlaps = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w + gap * 2 && Math.abs(a.y - b.y) * 2 < a.h + b.h + gap * 2;
  for (const label of [...labels].sort((a, b) => b.total - a.total)) {
    if (!kept.some((other) => overlaps(label, other))) kept.push(label);
  }
  return kept;
}

// 5,009 → "5k", 14,421 → "14k", 950 → "950": pills stay short on a map.
export function compactCount(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}
