import test from "node:test";
import assert from "node:assert/strict";

test("disabling voice releases the persistent iOS audio route", async (t) => {
  const originalWindow = globalThis.window;
  const originalAudio = globalThis.Audio;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  let audioElement;
  let audioContext;
  const audioSession = { type: "auto" };

  class FakeAudioContext {
    constructor() {
      audioContext = this;
      this.currentTime = 0;
      this.destination = {};
      this.sampleRate = 44100;
      this.state = "suspended";
      this.suspendCalls = 0;
    }

    createGain() {
      return { connect() {} };
    }

    createBuffer() {
      return {};
    }

    createBufferSource() {
      return { connect() {}, start() {}, stop() {} };
    }

    resume() {
      this.state = "running";
      return Promise.resolve();
    }

    suspend() {
      this.state = "suspended";
      this.suspendCalls += 1;
      return Promise.resolve();
    }
  }

  class FakeAudio {
    constructor() {
      audioElement = this;
      this.currentTime = 12;
      this.pauseCalls = 0;
      this.playCalls = 0;
    }

    setAttribute() {}

    play() {
      this.playCalls += 1;
      return Promise.resolve();
    }

    pause() {
      this.pauseCalls += 1;
    }
  }

  globalThis.window = { AudioContext: FakeAudioContext };
  globalThis.Audio = FakeAudio;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ clips: { one: "one.mp3" } }),
  });
  globalThis.localStorage = { getItem: () => null };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { audioSession },
  });

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.Audio = originalAudio;
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete globalThis.navigator;
    }
  });

  const { deactivateVoice, initVoice, unlockVoice } = await import(`../voice.js?test=${Date.now()}`);
  assert.equal(await initVoice(), true);
  assert.equal(audioSession.type, "auto");

  unlockVoice();
  assert.equal(audioSession.type, "auto");
  assert.equal(audioElement.playCalls, 1);
  assert.equal(audioContext.state, "running");

  deactivateVoice();
  assert.equal(audioElement.pauseCalls, 1);
  assert.equal(audioElement.currentTime, 0);
  assert.equal(audioContext.suspendCalls, 1);
  assert.equal(audioContext.state, "suspended");
});

test("installed iOS app keeps the proven Web Audio voice route", async (t) => {
  const originalWindow = globalThis.window;
  const originalAudio = globalThis.Audio;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  const audioElements = [];
  let webAudioStarts = 0;
  const audioSession = { type: "auto" };

  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      this.sampleRate = 44100;
      this.state = "suspended";
    }

    createGain() { return { connect() {} }; }
    createBuffer() { return {}; }
    createBufferSource() {
      return {
        connect() {},
        start() { webAudioStarts += 1; },
        stop() {},
      };
    }
    resume() {
      this.state = "running";
      return Promise.resolve();
    }
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    }
  }

  class FakeAudio {
    constructor(src) {
      audioElements.push(this);
      this.src = src;
      this.currentTime = 0;
      this.loop = false;
      this.volume = 1;
      this.playCalls = 0;
    }

    setAttribute() {}
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    }
    pause() {}
  }

  globalThis.window = {
    AudioContext: FakeAudioContext,
    matchMedia: () => ({ matches: true }),
    addEventListener() {},
  };
  globalThis.Audio = FakeAudio;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ clips: { "let's go": "lets-go.mp3", one: "one.mp3" } }),
  });
  globalThis.localStorage = { getItem: () => null };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      audioSession,
      standalone: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    },
  });

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.Audio = originalAudio;
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete globalThis.navigator;
    }
  });

  const { initVoice, unlockVoice } = await import(`../voice.js?ios-media-test=${Date.now()}`);
  assert.equal(await initVoice(), true);
  unlockVoice();
  assert.equal(audioElements.length, 1, "only the established silent unlock element should be created");
  assert.equal(webAudioStarts, 1, "the established Web Audio graph should be unlocked");
  assert.equal(audioSession.type, "auto");
});

test("route releases after a grace period of silence and re-claims on the next unlockVoice()", async (t) => {
  const originalWindow = globalThis.window;
  const originalAudio = globalThis.Audio;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalSpeechSynthesis = globalThis.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;

  let audioElement;
  let audioContext;
  const audioSession = { type: "auto" };

  class FakeAudioContext {
    constructor() {
      audioContext = this;
      this.currentTime = 0;
      this.destination = {};
      this.sampleRate = 44100;
      this.state = "suspended";
      this.suspendCalls = 0;
    }

    createGain() {
      return { connect() {} };
    }

    createBuffer() {
      return {};
    }

    createBufferSource() {
      return { connect() {}, start() {}, stop() {} };
    }

    resume() {
      this.state = "running";
      return Promise.resolve();
    }

    suspend() {
      this.state = "suspended";
      this.suspendCalls += 1;
      return Promise.resolve();
    }
  }

  class FakeAudio {
    constructor() {
      audioElement = this;
      this.currentTime = 0;
      this.paused = true;
      this.pauseCalls = 0;
      this.playCalls = 0;
    }

    setAttribute() {}

    play() {
      this.playCalls += 1;
      this.paused = false;
      return Promise.resolve();
    }

    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    }
  }

  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.onend = null;
    }
  }

  const fakeSpeechSynthesis = {
    speaking: false,
    pending: false,
    cancel() {},
    speak() { /* onend is only fired if the test triggers it explicitly */ },
  };

  globalThis.window = { AudioContext: FakeAudioContext, speechSynthesis: fakeSpeechSynthesis };
  globalThis.Audio = FakeAudio;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ clips: { one: "one.mp3" } }),
  });
  globalThis.localStorage = { getItem: () => null };
  globalThis.speechSynthesis = fakeSpeechSynthesis;
  globalThis.SpeechSynthesisUtterance = FakeUtterance;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { audioSession },
  });

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.Audio = originalAudio;
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete globalThis.navigator;
    }
    if (originalSpeechSynthesis === undefined) delete globalThis.speechSynthesis;
    else globalThis.speechSynthesis = originalSpeechSynthesis;
    if (originalUtterance === undefined) delete globalThis.SpeechSynthesisUtterance;
    else globalThis.SpeechSynthesisUtterance = originalUtterance;
  });

  t.mock.timers.enable({ apis: ["setTimeout"] });

  const { initVoice, unlockVoice, speakFallback } = await import(`../voice.js?route-release-test=${Date.now()}`);
  assert.equal(await initVoice(), true);

  unlockVoice();
  assert.equal(audioElement.paused, false);
  assert.equal(audioContext.state, "running");

  // speakFallback's onend never fires in this mock, so only the 15s safety-net
  // schedule applies; add the 12s release grace on top.
  speakFallback("nice work");
  t.mock.timers.tick(15000 + 12000);

  assert.equal(audioElement.paused, true, "unlockAudioEl should be paused once the route releases");
  assert.equal(audioElement.pauseCalls, 1);
  assert.equal(audioContext.suspendCalls, 1);
  assert.equal(audioContext.state, "suspended");

  unlockVoice();
  assert.equal(audioElement.paused, false, "the next unlockVoice() should re-claim the same element");
  assert.equal(audioElement.playCalls, 2);
  assert.equal(audioContext.state, "running");
});

test("squat start/cheer/record lines and a squat fun-message resolve to clips instead of falling back", async (t) => {
  const originalWindow = globalThis.window;
  const originalAudio = globalThis.Audio;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  // A decoded clip whose head/tail samples sit above the silence threshold,
  // so trimSilence() returns it unchanged without needing a second fake
  // buffer from createBuffer().
  class FakeAudioBuffer {
    constructor() {
      this.numberOfChannels = 1;
      this.sampleRate = 44100;
      this.duration = 0.5;
      this._data = new Float32Array(64).fill(0.5);
    }
    getChannelData() { return this._data; }
  }

  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      this.sampleRate = 44100;
      this.state = "suspended";
    }

    createGain() { return { connect() {} }; }
    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, start() {}, stop() {} }; }
    resume() { this.state = "running"; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve(new FakeAudioBuffer()); }
  }

  class FakeAudio {
    constructor() {
      this.currentTime = 0;
      this.playCalls = 0;
    }
    setAttribute() {}
    play() { this.playCalls += 1; return Promise.resolve(); }
    pause() {}
  }

  globalThis.window = { AudioContext: FakeAudioContext };
  globalThis.Audio = FakeAudio;
  globalThis.localStorage = { getItem: () => null };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { audioSession: { type: "auto" } },
  });

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.Audio = originalAudio;
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete globalThis.navigator;
    }
  });

  const { buildCorpus, FUN_MESSAGES_SQUAT, SQUAT_CHEER_LINES, SQUAT_RECORD_LINE, SQUAT_START_LINES } =
    await import(`../voice-lines.js?squat-resolution-lines=${Date.now()}`);

  // A manifest generated for the full corpus (as scripts/generate-voice.js
  // would produce it) — resolution only needs the key to be present, not a
  // real audio file, since speakClips reports success synchronously once it
  // finds a matching key and kicks off the (here-unmocked, best-effort) fetch.
  const manifestClips = Object.fromEntries(
    buildCorpus().map((entry) => [entry.key, `${entry.key.replace(/[^a-z0-9]+/g, "-")}.mp3`])
  );
  globalThis.fetch = async (url) => {
    if (String(url).includes("manifest.json")) return { ok: true, json: async () => ({ clips: manifestClips }) };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };

  const { initVoice, speakClips, unlockVoice } = await import(`../voice.js?squat-resolution=${Date.now()}`);
  assert.equal(await initVoice(), true);
  unlockVoice();

  const sampleLines = [SQUAT_START_LINES[0], SQUAT_CHEER_LINES[0], SQUAT_RECORD_LINE, FUN_MESSAGES_SQUAT[0](12)];
  for (const text of sampleLines) {
    assert.equal(speakClips(text), true, `expected "${text}" to resolve to pre-rendered clips`);
  }

  // Let the in-flight clip fetch/decode promises settle while the mocks are
  // still installed, so nothing resolves after t.after() tears them down.
  await new Promise((resolve) => setTimeout(resolve, 20));
});
