# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-component repo with two distinct areas:

1. **TypeScript AWS Lambda backend** (`server/`) — authenticates with Google API, reads Polish questions from Google Sheets, translates Polish→Russian via OpenAI GPT, writes translations back.
2. **Android vibration timer app** (`nativeapp/`) — native Android app (Kotlin) with a foreground service that keeps vibrating even when the screen is off.
3. **Web vibration timer** (`pages/vibro.html`) — mobile Chrome HTML page with the same functionality using the Vibration API + Wake Lock API.

## Components

- `server/` — Main Lambda (Node.js 20.x, TypeScript)
- `ws_server/` — WebSocket relay Lambda (tank controller); DynamoDB for connection tracking
- `controllers/` — HTML frontend controllers for tank testing
- `skatches/` — Arduino sketch (`tank.ino`)
- `pages/vibro.html` — Mobile web vibration timer (Custom + Trainer tabs)
- `nativeapp/` — Android Studio project (Kotlin, minSdk 26)
- Root HTML files — `streamer.html`, `viewer.html`

## Server Commands

All commands run from `server/`:

```bash
npm run build        # Clean + compile TypeScript → dist/
npm test             # Run unit tests (test/**/*.test.ts)
npm run test-int     # Run integration tests (test-int/**/*.test.ts)
npm run package      # test + build + zip → build/lambda.zip

vitest run test --config vitest.config.ts <file-pattern>
vitest run test-int --config vitest.config.int.ts <file-pattern>
```

## Android App Commands

Run from `nativeapp/`:

```bash
# Build release APK (output: app/build/outputs/apk/release/VibroTimer-<version>.apk)
build.cmd

# Or directly:
ANDROID_HOME=$LOCALAPPDATA/Android/Sdk java -classpath gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain assembleRelease
```

Signing keystore: `nativeapp/vibrotimer.keystore` (password: `vibrotimer123`, alias: `vibrotimer`).
Version is set in `app/build.gradle` (`versionCode` + `versionName`) and displayed in `activity_main.xml`.

## Environment Variables (server)

- `JWT_PRIVATE_KEY_JSON` — JSON string of Google service account credentials; falls back to `./jwt-private-key.json`
- `OPENAI_API_KEY` — Required by AIService for LangChain/OpenAI calls

## Server Architecture

### Service Layer (server/src/services/)

```
handler.ts
└─ JWTService             # RS256 JWT for Google service account
   └─ GoogleAuthService   # Exchanges JWT for OAuth2 token
      └─ GoogleSheetService  # Reads/writes rows as IPolishQuestion[]
         └─ TranslationService  # p-limit concurrency (max 5)
            └─ AIService   # LangChain + OpenAI gpt-5-nano, Polish→Russian
```

- **Types**: `IPolishQuestion` (`id`, `question`, `answer`, `rate`) in `src/types/`
- **Mapping**: `PolishQuestionMapper` in `src/utils/` converts sheet rows ↔ interface
- **Config**: env vars first, fallback to `jwt-private-key.json`; `dotenv` loaded in AIService

## Android App Architecture

Two Kotlin files:

- **`VibrationService.kt`** — Foreground service; holds `PARTIAL_WAKE_LOCK` to keep CPU alive when screen is off. Uses `Handler.postDelayed` to fire individual `VibrationEffect.createOneShot()` calls on each beat (repeating waveform approach was abandoned because Android cancels it on screen-off). Manages two modes: `custom` (fixed duration + bpm) and `trainer` (two configurable phases with duration in minutes and tempo in bpm). On phase switch, plays 3 long (2×) vibrations as a signal before resuming the new beat.
- **`MainActivity.kt`** — Two tabs (Custom / Trainer). Communicates with the service via `LocalBroadcastManager`. Trainer inputs are locked while a session runs.

### Key Android patterns

- Vibration timing is driven entirely by `Handler.postDelayed` + `PARTIAL_WAKE_LOCK`, not by `VibrationEffect` repeat — this is intentional to survive screen-off.
- Phase transitions are detected in the 500 ms `displayRunnable` tick; the `beatRunnable` is paused during the 3-pulse transition sequence.
- Session start time (`sessionStart`) is the single source of truth for trainer state; all phase/remaining/cycle values are derived from `System.currentTimeMillis() - sessionStart`.

## Web Vibration Timer (`pages/vibro.html`)

- Uses `navigator.vibrate(pattern)` with a large pre-built array (~1000 pulses) to delegate timing to the browser.
- On `visibilitychange` (tab returning to foreground), restarts the pattern from the correct offset using `Date.now() - sessionStart`.
- `navigator.wakeLock.request('screen')` prevents the screen from dimming (does not work when screen is manually turned off — use the Android app for that).
- Trainer tab params (phase duration + bpm) are configurable; inputs lock on start.
