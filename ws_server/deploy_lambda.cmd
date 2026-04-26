@echo off
setlocal

set REGION=eu-central-1
set FUNCTION_NAME=tank-ws-handler

call build.cmd

aws lambda update-function-code ^
  --region %REGION% ^
  --function-name %FUNCTION_NAME% ^
  --zip-file fileb://handler.zip

echo Done: %FUNCTION_NAME% updated.