# TypeScript AWS Lambda: returns OK

Minimal TypeScript AWS Lambda function that responds with HTTP 200 and body `OK`.

## What you get

- `src/handler.ts` → Lambda handler
- TypeScript compile to `dist/`
- `vitest` unit test
- `build/lambda.zip` packaging output

## Setup

```powershell
cd C:\training\react\my-projects\testrepo
npm install
```

## Build

```powershell
npm run build
```

Compiled JS will be in `dist/`.

## Test

```powershell
npm test
```

## Package a deployment zip

```powershell
npm run package
```

This creates `build/lambda.zip` containing the compiled files from `dist/`.

## Deploy to AWS Lambda (AWS CLI)

Assuming you already created a Lambda function with runtime `nodejs20.x` (or similar) and configured AWS credentials:

```powershell
aws lambda update-function-code `
  --function-name YOUR_FUNCTION_NAME `
  --zip-file fileb://build/lambda.zip
```

### Lambda configuration

- **Runtime**: `nodejs20.x` (recommended)
- **Handler**: `handler.handler`
  - because the output file is `dist/handler.js` and it exports `handler`

If you create the function via CLI, you can use:

```powershell
aws lambda create-function `
  --function-name YOUR_FUNCTION_NAME `
  --runtime nodejs20.x `
  --role YOUR_LAMBDA_EXECUTION_ROLE_ARN `
  --handler handler.handler `
  --zip-file fileb://build/lambda.zip
```

(Replace the placeholders with your values.)

