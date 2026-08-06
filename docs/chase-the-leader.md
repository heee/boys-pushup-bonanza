# Chase the Leader

## Open voice item

Chase callouts are wired through the app's existing pre-rendered OpenAI TTS system with browser `speechSynthesis` fallback. The fixed Chase lines in `voice-lines.js` have generated OpenAI TTS clips. Dynamic callouts containing leader names, periods, and live point gaps currently use the fallback.

After adding more fixed lines, run:

```text
node scripts/generate-voice.js
```

Commit the updated `assets/voice/` output. A future improvement can generate or compose the dynamic Chase fragments so names and live gaps use the same OpenAI voice.
