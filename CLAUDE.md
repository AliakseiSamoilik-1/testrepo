# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript AWS Lambda backend that authenticates with Google API, reads Polish questions from Google Sheets, translates them Polish→Russian via OpenAI GPT, and writes translations back. Includes a WebSocket relay Lambda and HTML frontend controllers.

## Components

- `server/` — Main Lambda function (Node.js 20.x, TypeScript)
- `ws_server/` — WebSocket relay Lambda (tank controller); uses DynamoDB for connection tracking
- `controllers/` — HTML frontend controllers for tank testing
- `skatches/` — Arduino sketch (`tank.ino`)
- Root HTML files — `streamer.html`, `viewer.html`

## Commands

All commands run from `server/`:

```bash
npm run build        # Clean + compile TypeScript → dist/
npm test             # Run unit tests (test/**/*.test.ts)
npm run test-int     # Run integration tests (test-int/**/*.test.ts)
npm run package      # test + build + zip → build/lambda.zip

# Run a single test file
vitest run test --config vitest.config.ts <file-pattern>
vitest run test-int --config vitest.config.int.ts <file-pattern>
```

## Environment Variables

- `JWT_PRIVATE_KEY_JSON` — JSON string of Google service account credentials (`client_email` + `private_key`); falls back to `./jwt-private-key.json`
- `OPENAI_API_KEY` — Required by AIService for LangChain/OpenAI calls

## Architecture

### Service Layer (server/src/services/)

Class-based services with constructor dependency injection:

```
handler.ts
└─ JWTService          # RS256 JWT for Google service account (env var → file fallback)
   └─ GoogleAuthService   # Exchanges JWT for OAuth2 token
      └─ GoogleSheetService  # Reads/writes rows as IPolishQuestion[]
         └─ TranslationService  # Orchestrates translation with p-limit concurrency (max 5)
            └─ AIService       # LangChain + OpenAI gpt-5-nano, Polish→Russian
```

### Key Patterns

- **Configuration**: env vars first, fallback to `jwt-private-key.json`; `dotenv` loaded in AIService
- **Concurrency**: `p-limit` (max 5 parallel AI calls) in TranslationService
- **Types**: `IPolishQuestion` (`id`, `question`, `answer`, `rate`) defined in `src/types/`
- **Mapping**: `PolishQuestionMapper` utility in `src/utils/` converts sheet rows ↔ interface

### Lambda Handler

AWS Lambda entry point: `handler.handler` (configured in AWS console/CLI). Returns JWT for Google service account auth.

### Testing

- Unit tests: `test/` directory, run with `vitest.config.ts`
- Integration tests: `test-int/` directory, run with `vitest.config.int.ts`
- Test runner: Vitest
