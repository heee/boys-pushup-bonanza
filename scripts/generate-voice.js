// ===========================================================
// Pre-render every line the app can speak into assets/voice/**/*.mp3, for
// whichever voice preset you pick.
//
//   set OPENAI_API_KEY=sk-...                       (PowerShell: $env:OPENAI_API_KEY="sk-...")
//   node scripts/generate-voice.js --dry-run               # list the corpus + cost, write nothing
//   node scripts/generate-voice.js                         # generate anything missing (default preset)
//   node scripts/generate-voice.js --preset drill-de        # generate the German drill instructor preset
//   node scripts/generate-voice.js --preset sultry          # generate the sultry drill instructor preset
//   node scripts/generate-voice.js --preset sultry --sample # generate only a small preview batch
//
// Clip filenames are hashed over preset + voice + model + instructions + text,
// so changing any of those produces new filenames; stale ones are pruned.
// Reruns with the same settings are free — existing clips are skipped.
//
// Real teammate names from a private D1 export can be added to every
// preset's corpus automatically — Ladder rival callouts and Chase leader
// lines interpolate a real username at runtime, and pre-recording each
// current player's actual name is what lets those lines splice together
// entirely in the custom voice instead of falling back to the browser's
// robotic speechSynthesis for just that one word.
//
// Runs sequentially with a ~6.5s gap between requests by default (--delay-ms),
// since new/low-usage OpenAI orgs can be capped as low as 10 requests/min for
// audio models. If the run hits the account's per-day cap, it stops
// immediately (no manifest written) rather than retrying into an exhausted
// bucket — just rerun the same command once the cap resets; already-generated
// clips are skipped.
// ===========================================================

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { buildCorpus, normalizeSpoken } from "../voice-lines.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = process.env.BPB_PRIVATE_DATA_PATH ? path.resolve(process.env.BPB_PRIVATE_DATA_PATH) : "";
const API_URL = "https://api.openai.com/v1/audio/speech";

// Round 4 confirmed the respelling technique (below) nails the accent
// itself — user feedback: "intonation is great." Rounds 3-5 kept easing off
// a flat/deadpan Terminator framing toward more speed, but user feedback on
// round 5 was still "not energetic and not stereotypical enough" — round 6
// leans much harder into both: added the word-initial ST/SP -> SHT/SHP
// substitution (a very recognizable, authentic German-accent marker — see
// "How to do a German accent" by Feli from Germany, a native speaker, and
// a dialect-coach "Advanced German accent" tutorial the user linked as
// reference), and rewrote the energy framing to match the default preset's
// screaming-drill-sergeant intensity instead of a more contained "fast".
const GERMAN_ACCENT_RULES = [
  "You are an exaggerated, cartoonish stereotype of a German bodybuilder/action-movie drill",
  "instructor — an Arnold-Schwarzenegger-style caricature — with a thick, unmistakable stereotypical",
  "Austrian-German accent applied to every single word, never a neutral American read.",
  "Apply these sound substitutions on every single word, constantly: every \"W\" becomes a \"V\"",
  "(\"with\" sounds like \"vith\"); every soft \"TH\" becomes a hard \"Z\" or \"D\" (\"the\" sounds like",
  "\"zuh\", \"this\" sounds like \"zis\"); words starting \"ST\"/\"SP\" get a hissing \"SH\" in front",
  "(\"straight\" sounds like \"shtraight\", \"speed\" sounds like \"shpeed\"); every \"R\" is rolled and",
  "guttural; vowels are heavy and elongated, not clipped. The accent stays exactly this thick at any",
  "speed or energy level — never let it soften or thin out when things get fast and intense.",
];

// Rounds 1-3 tried to describe the accent in prose and asked the model to
// execute the phonetic transformation itself — three escalating attempts
// that never reliably produced an accent at all. Reliable TTS accent/
// pronunciation control is normally done by respelling the actual input
// text so the model's ordinary grapheme-to-phoneme reading naturally
// produces the target sound, rather than asking it to perform a phonetic
// transformation on the fly. This respells ONLY the text sent to the TTS
// API for synthesis — the corpus key/manifest lookup the app uses always
// stays the original English spelling, so this is invisible to app.js.
const GERMAN_NUMBER_OVERRIDES = {
  one: "vun", // spelled without the "w" a German accent would otherwise hear in "one"
};
function germanRespell(text) {
  return text.replace(/[A-Za-z']+/g, (word) => {
    const lower = word.toLowerCase();
    if (GERMAN_NUMBER_OVERRIDES[lower]) {
      const replacement = GERMAN_NUMBER_OVERRIDES[lower];
      return word[0] === word[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
    }
    let w = word;
    // German V is pronounced like English F ("very" -> "fery").
    w = w.replace(/v/g, "f").replace(/V/g, "F");
    // German W is pronounced like English V ("with" -> "vith").
    w = w.replace(/w/g, "v").replace(/W/g, "V");
    // Both English "th" sounds collapse to a hard Z in the stereotype
    // ("the" -> "ze", "this" -> "zis").
    w = w.replace(/th/g, "z").replace(/Th/g, "Z").replace(/TH/g, "Z");
    // German phonology pronounces syllable-initial "st"/"sp" as "sht"/"shp"
    // ("straight" -> "shtraight", "speed" -> "shpeed") — a strong, authentic
    // accent marker (per the reference videos), not just a comedy affectation.
    w = w.replace(/^st/, "sht").replace(/^St/, "Sht").replace(/^ST/, "SHT");
    w = w.replace(/^sp/, "shp").replace(/^Sp/, "Shp").replace(/^SP/, "SHP");
    // Word-final obstruent devoicing ("good" -> "goot", "big" -> "bik").
    const devoice = { d: "t", b: "p", g: "k", D: "T", B: "P", G: "K" };
    const last = w[w.length - 1];
    if (devoice[last]) w = w.slice(0, -1) + devoice[last];
    return w;
  });
}

// Round 2 leaned into a slow, breathy, husky noir femme-fatale — the user
// wants the opposite energy now: much younger, quirkier, and far higher
// energy, while keeping the flirty/teasing sultry edge. Fast, bright,
// bouncy, and playful instead of slow and languid.
const SULTRY_STYLE_RULES = [
  "You are an exaggerated, over-the-top caricature of a young, quirky, hyper-energetic flirty",
  "character — think a bubbly, playful, mischievous younger woman with huge personality, teasing",
  "and winking through every line, NOT a slow sultry noir voice. High energy, bright, bouncy, and",
  "a little unhinged in an excitable, giggly way. Apply these qualities constantly: fast, lively",
  "pace with real bounce and rhythm, never slow or drawn-out; bright, perky, youthful tone with",
  "wide pitch variation — let your voice jump and swoop playfully rather than staying flat; a",
  "teasing, flirty, confident wink in the delivery, like you're grinning the whole time; a little",
  "breathless with excitement, like you can barely contain the energy. This should read as young,",
  "quirky, and electric — if in doubt, push the energy, speed, and playful bounce further, not less.",
];

// ----------------------------------------------------------------
// Voice presets. "default" keeps writing to the original flat assets/voice/
// location so existing clips/manifest stay valid with zero migration; the
// two new personas each get their own subfolder + manifest. Same corpus,
// same text, every preset — only the voice/delivery instructions differ
// (per user decision: no persona-specific flavor text).
// ----------------------------------------------------------------
const PRESETS = {
  default: {
    label: "Default",
    voice: "ash",
    outDir: path.join(ROOT, "assets", "voice"),
    instructionsByTone: {
      number: [
        "You are a drill sergeant screaming a single rep count directly into a recruit's ear — pure",
        "volume and aggression compressed into one word. It is a single explosive shout, sharp and",
        "loud from the very first syllable, like a gunshot or a hard bark — NOT a raspy scream, NOT",
        "husky, NOT a calm read. Full aggressive intensity packed into a split second. Never trail off,",
        "never soften, never let the volume drop even slightly toward the end of the word.",
      ].join(" "),
      hype: [
        "You are a screaming, red-faced drill sergeant at the absolute breaking point of your patience,",
        "shouting directly in a recruit's face with terrifying rage — a raw, rasping scream that sounds",
        "like it's tearing your throat apart. This is furious, guttural aggression: spit-flying,",
        "vein-bulging, nose-to-nose intimidation, not motivational hype. Zero polish or control in your",
        "voice — almost feral, like you might snap. Bark every syllable as a violent, clipped shout.",
        "Numbers are screamed with escalating fury and volume as the count rises, like each rep is a",
        "personal insult you're furious about.",
        "CRITICAL — PACE: this is rapid-fire and breathless, not a slow dramatic tirade. Attack the very",
        "first word immediately with zero wind-up. Clip every syllable short and punch through the whole",
        "line fast, like you're too furious to slow down — no lingering, no drawn-out vowels, no",
        "theatrical pauses between words. Speed and aggression together, never a slow burn.",
      ].join(" "),
      calm: [
        "You are a screaming drill sergeant pushing a recruit through the hardest set of their life.",
        "FULL INTENSITY — loud, explosive, in-your-face aggression. Every word is barked, not spoken.",
        "No warmth, no calm, no conversational tone whatsoever — pure command and fury.",
        "Numbers are screamed count-offs, like a sergeant counting reps inches from someone's face.",
        "Make it sound like you'd lose your voice if you kept this up all day.",
      ].join(" "),
      // Deliberately the opposite of every other tone here — Zen mode's one
      // completion line wants a hushed, unhurried character, not a scream.
      zen: [
        "You are a calm, quiet voice guiding someone through a slow, mindful bodyweight practice.",
        "Speak softly and warmly, unhurried, like a meditation instructor — no shouting, no",
        "intensity, no drill-sergeant energy at all. Gentle, grounded, at peace.",
      ].join(" "),
      name: [
        "You are a drill sergeant barking a single person's name during roll call — sharp, loud,",
        "and commanding, like calling them out in front of the whole platoon. One clean, aggressive",
        "utterance of the name, no trailing off, no softening at the end.",
      ].join(" "),
    },
    speedByTone: { number: 1.15, hype: 1.35, calm: 1.05, zen: 0.85, name: 1.1 },
  },
  "drill-de": {
    label: "German Drill Instructor",
    voice: "onyx",
    outDir: path.join(ROOT, "assets", "voice", "drill-de"),
    respell: germanRespell,
    instructionsByTone: {
      // Explicit phonetic-substitution rules, not just "thick accent" —
      // the vague version produced no discernible accent at all. Naming the
      // actual sound swaps (W->V, TH->Z/S, rolled R) gives the model
      // something concrete to execute instead of a vibe to approximate.
      number: [
        ...GERMAN_ACCENT_RULES,
        "You are SCREAMING a single rep count number directly into a recruit's ear — pure explosive",
        "volume and rage compressed into one word, like a gunshot. Full aggressive intensity packed",
        "into a split second, never trailing off. Do not add any extra words — perform ONLY the exact",
        "text given, transformed through the accent.",
      ].join(" "),
      hype: [
        ...GERMAN_ACCENT_RULES,
        "You are a screaming, red-faced German drill instructor at the absolute breaking point of your",
        "patience — a raw, furious, spit-flying, vein-bulging performance, nose-to-nose intimidation,",
        "zero polish or control, almost feral, like you might snap. Bark every syllable as a violent,",
        "clipped shout. CRITICAL — PACE: rapid-fire and breathless, not a slow tirade. Attack the very",
        "first word immediately with zero wind-up, punch through the whole line as fast as you can",
        "physically talk — the thick accent stays completely intact at this speed, never softening.",
        "Do not add any extra words, exclamations, or ad-libs — perform ONLY the exact text given,",
        "transformed through the accent.",
      ].join(" "),
      calm: [
        ...GERMAN_ACCENT_RULES,
        "A short status word, still loud, fast, and full of aggressive energy — the accent and",
        "intensity stay just as thick as at full volume.",
      ].join(" "),
      zen: [
        ...GERMAN_ACCENT_RULES,
        "A rare quieter, slower moment — the one exception to the usual screaming energy — but the",
        "thick accent never changes.",
      ].join(" "),
      name: [
        ...GERMAN_ACCENT_RULES,
        "SCREAM a single person's name during roll call — explosive, furious, full volume and speed,",
        "like a drill sergeant who has completely lost his patience. Do not add extra words.",
      ].join(" "),
    },
    speedByTone: { number: 1.3, hype: 1.4, calm: 1.2, zen: 0.85, name: 1.3 },
  },
  sultry: {
    label: "Sultry Drill Instructor",
    voice: "nova",
    outDir: path.join(ROOT, "assets", "voice", "sultry"),
    instructionsByTone: {
      number: [
        ...SULTRY_STYLE_RULES,
        "Blurt out a single rep count number with a bright, excited, teasing bounce — quick and",
        "energetic, like you can't contain your excitement, but still land clearly as that exact",
        "number.",
      ].join(" "),
      hype: [
        ...SULTRY_STYLE_RULES,
        "This is a full, campy, larger-than-life performance — a young, quirky, hyper-energetic",
        "character bursting with excitable, teasing, flirty energy. Never slow, never monotone,",
        "never restrained — lean all the way into the bouncy, playful chaos.",
      ].join(" "),
      calm: [
        ...SULTRY_STYLE_RULES,
        "A short status word, but still bright, quick, and bursting with quirky personality — never",
        "flatten into a neutral read.",
      ].join(" "),
      zen: [
        ...SULTRY_STYLE_RULES,
        "A rare quieter moment — still warm, bright, and a little playful, but genuinely relaxed now:",
        "a satisfied, happy little sigh of approval after a job well done. Softer, not performative,",
        "but the youthful, quirky brightness never fully disappears.",
      ].join(" "),
      name: [
        ...SULTRY_STYLE_RULES,
        "Blurt out a single person's name with a bright, teasing, excited bounce — quick and playful,",
        "but still clear and unmistakable as that exact name. Do not add extra words.",
      ].join(" "),
    },
    speedByTone: { number: 1.2, hype: 1.3, calm: 1.15, zen: 1.0, name: 1.2 },
  },
};

function parseArgs(argv) {
  const opts = {
    preset: "default",
    model: "gpt-4o-mini-tts",
    voice: null, // null = use the preset's own voice
    speed: null, // null = use the preset's own SPEED_BY_TONE; a number forces one value for everything
    concurrency: 1,
    delayMs: 6500,
    force: false,
    dryRun: false,
    keepOrphans: false,
    // --sample generates only a small representative batch (one clip per
    // tone plus a couple of hype lines) so a brand-new persona's vibe can be
    // approved before committing to the full ~300+ clip corpus.
    sample: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") opts.force = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--keep-orphans") opts.keepOrphans = true;
    else if (arg === "--sample") opts.sample = true;
    else if (arg === "--preset") opts.preset = argv[++i];
    else if (arg === "--voice") opts.voice = argv[++i];
    else if (arg === "--model") opts.model = argv[++i];
    else if (arg === "--speed") opts.speed = Number(argv[++i]);
    else if (arg === "--concurrency") opts.concurrency = Number(argv[++i]);
    else if (arg === "--delay-ms") opts.delayMs = Number(argv[++i]);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  if (!PRESETS[opts.preset]) {
    console.error(`Unknown preset "${opts.preset}". Known presets: ${Object.keys(PRESETS).join(", ")}`);
    process.exit(1);
  }
  return opts;
}

// Real teammate names, so Ladder rival callouts and Chase leader lines can
// splice in a real username entirely through the custom voice. Small, known
// friend-group roster — rerun generation whenever someone new joins/renames.
async function loadUsernames() {
  if (!DATA_PATH) return [];
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const data = JSON.parse(raw);
    const names = new Set();
    for (const session of data.sessions || []) {
      if (session && typeof session.user === "string" && session.user.trim()) {
        names.add(session.user.trim());
      }
    }
    return [...names];
  } catch (e) {
    console.warn(`Could not read the private dataset for usernames (${e.message}) — proceeding without them.`);
    return [];
  }
}

function speedFor(opts, preset, entry) {
  return opts.speed ?? preset.speedByTone[entry.tone] ?? 1;
}

function instructionsFor(preset, entry) {
  return preset.instructionsByTone[entry.tone] || preset.instructionsByTone.hype;
}

// The text actually sent to the TTS API — respelled per preset.respell if
// one exists (see germanRespell), otherwise the entry's own text unchanged.
// The corpus key/manifest lookup the app uses always stays the original
// spelling; only this synthesis-time input differs.
function spokenTextFor(preset, entry) {
  return preset.respell ? preset.respell(entry.text) : entry.text;
}

// Deliberately does NOT include opts.preset: each preset writes to its own
// output directory, so there's no cross-preset collision risk, and the
// audio itself is fully determined by model/voice/speed/instructions/text
// anyway. Leaving preset out means the default preset's ~240 already-shipped
// clips keep their existing filenames/hashes untouched by this refactor —
// only genuinely new corpus entries need synthesizing.
function clipFilename(opts, preset, voice, entry) {
  // Presets without a respell function keep the exact original fingerprint
  // formula (entry.key) so the default preset's ~240 already-shipped clips
  // never get invalidated by unrelated changes elsewhere in this file.
  const textComponent = preset.respell ? spokenTextFor(preset, entry) : entry.key;
  const fingerprint = [opts.model, voice, speedFor(opts, preset, entry), instructionsFor(preset, entry), textComponent].join(" ");
  return crypto.createHash("sha1").update(fingerprint).digest("hex").slice(0, 16) + ".mp3";
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Set once a per-day cap is hit. Retrying against an exhausted daily bucket
// can't succeed and just spends more of it — once we see one, every
// remaining item in this run fails fast without calling the API again.
class DailyCapError extends Error {}
let dailyCapHit = false;

async function synthesize(opts, preset, voice, entry, attempt = 0) {
  const text = entry.text;
  const spokenText = spokenTextFor(preset, entry);
  if (dailyCapHit) throw new DailyCapError(`daily request cap already hit, skipping "${text}"`);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      voice,
      input: spokenText,
      instructions: instructionsFor(preset, entry),
      speed: speedFor(opts, preset, entry),
      response_format: "mp3",
    }),
  });

  if (res.ok) return Buffer.from(await res.arrayBuffer());

  const body = await res.text().catch(() => "");

  if (res.status === 429 && /requests per day/i.test(body)) {
    dailyCapHit = true;
    throw new DailyCapError(`daily request cap hit: ${body.slice(0, 300)}`);
  }

  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < 4) {
    const wait = 1000 * Math.pow(2, attempt);
    console.warn(`  ${res.status} on "${text}" — retrying in ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
    return synthesize(opts, preset, voice, entry, attempt + 1);
  }
  throw new Error(`TTS failed (${res.status}) for "${text}": ${body.slice(0, 300)}`);
}

// Simple N-at-a-time worker pool with a fixed delay between requests so we
// stay under the account's requests-per-minute cap by construction, rather
// than bursting and relying on 429 retries to sort it out.
async function pool(items, size, delayMs, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.max(1, size) }, async () => {
    while (index < items.length) {
      const i = index++;
      if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

// A small, representative slice of the corpus — one line per tone plus a
// couple of hype lines — used for --sample previews of a brand-new persona.
function sampleCorpus(corpus) {
  const byTone = new Map();
  const picked = [];
  for (const entry of corpus) {
    const count = byTone.get(entry.tone) || 0;
    if (count >= (entry.tone === "hype" ? 4 : 2)) continue;
    byTone.set(entry.tone, count + 1);
    picked.push(entry);
  }
  return picked;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const preset = PRESETS[opts.preset];
  const voice = opts.voice || preset.voice;
  const outDir = preset.outDir;
  const manifestPath = path.join(outDir, "manifest.json");

  const usernames = await loadUsernames();
  const corpus = buildCorpus();
  const seenKeys = new Set(corpus.map((c) => c.key));
  for (const name of usernames) {
    const key = normalizeSpoken(name);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    corpus.push({ key, text: name, tone: "name" });
  }

  const activeCorpus = opts.sample ? sampleCorpus(corpus) : corpus;
  const totalChars = activeCorpus.reduce((sum, c) => sum + c.text.length, 0);

  console.log(`Preset: ${preset.label} (${opts.preset})`);
  console.log(`Corpus: ${activeCorpus.length}${opts.sample ? ` (sample of ${corpus.length})` : ""} clips, ${totalChars} characters, ${usernames.length} real username(s) included`);
  console.log(`Voice:  ${voice} (${opts.model}, speed ${opts.speed ?? "per-tone: " + JSON.stringify(preset.speedByTone)})`);
  console.log(`Output: ${outDir}`);

  if (opts.dryRun) {
    for (const { key, text, tone } of activeCorpus) console.log(`  [${tone.padEnd(6)}] ${key.padEnd(38)} <- ${text}`);
    console.log(`\nDry run — nothing written. Roughly ${(totalChars / 1000).toFixed(1)}k characters of audio.`);
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set.");
    process.exit(1);
  }

  await fs.mkdir(outDir, { recursive: true });

  // The manifest is scoped to whatever's actually generated this run — for
  // --sample that's just the preview slice, so the full clips map (and
  // "already generated" accounting below) is intentionally not the full
  // corpus while sampling.
  let existingManifest = { clips: {} };
  try {
    existingManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (e) { /* no manifest yet */ }

  const clips = { ...existingManifest.clips };
  const todo = [];
  for (const entry of activeCorpus) {
    const file = clipFilename(opts, preset, voice, entry);
    clips[entry.key] = file;
    if (opts.force || !(await exists(path.join(outDir, file)))) todo.push({ ...entry, file });
  }

  console.log(`${activeCorpus.length - todo.length} already generated, ${todo.length} to synthesize.\n`);
  if (opts.concurrency > 1) {
    console.warn(`Note: --delay-ms paces each worker independently; with concurrency > 1 the effective rate is roughly delayMs / concurrency, not delayMs.`);
  }

  let done = 0;
  const failures = [];
  await pool(todo, opts.concurrency, opts.delayMs, async (entry) => {
    try {
      const audio = await synthesize(opts, preset, voice, entry);
      await fs.writeFile(path.join(outDir, entry.file), audio);
      done++;
      console.log(`  [${done}/${todo.length}] ${entry.text}`);
    } catch (e) {
      failures.push({ entry, message: e.message, dailyCap: e instanceof DailyCapError });
      if (!(e instanceof DailyCapError)) console.error(`  FAILED ${entry.text}: ${e.message}`);
    }
  });

  if (failures.length) {
    const cappedCount = failures.filter((f) => f.dailyCap).length;
    if (cappedCount) {
      console.error(
        `\nHit the account's daily request cap after ${done} new clip(s) this run ` +
        `(${activeCorpus.length - todo.length + done}/${activeCorpus.length} total done). ` +
        `${cappedCount} clip(s) skipped without calling the API. Manifest not written.\n` +
        `Rerun the same command later (check https://platform.openai.com/account/rate-limits for reset timing) — ` +
        `already-generated clips are skipped automatically.`
      );
    } else {
      console.error(`\n${failures.length} clip(s) failed. Manifest not written — rerun to retry just those.`);
    }
    process.exit(1);
  }

  if (!opts.sample) {
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          version: 1,
          preset: opts.preset,
          label: preset.label,
          model: opts.model,
          voice,
          speed: opts.speed ?? preset.speedByTone,
          instructionsByTone: preset.instructionsByTone,
          generatedAt: new Date().toISOString(),
          clips,
        },
        null,
        2
      ) + "\n"
    );
  }

  if (!opts.keepOrphans && !opts.sample) {
    const keep = new Set(Object.values(clips));
    const present = await fs.readdir(outDir);
    let pruned = 0;
    for (const name of present) {
      if (!/^[0-9a-f]{16}\.mp3$/.test(name) || keep.has(name)) continue;
      await fs.unlink(path.join(outDir, name));
      pruned++;
    }
    if (pruned) console.log(`Pruned ${pruned} stale clip(s).`);
  }

  const bytes = (
    await Promise.all(
      todo.map((entry) => fs.stat(path.join(outDir, entry.file)).then((s) => s.size).catch(() => 0))
    )
  ).reduce((a, b) => a + b, 0);

  console.log(`\nWrote ${todo.length} new clip(s) (${(bytes / 1024).toFixed(0)} KB)${opts.sample ? "" : " + manifest.json"}`);
  if (!opts.sample) console.log("Remember to bump CACHE_NAME in sw.js.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
