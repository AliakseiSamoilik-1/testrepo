@echo off
setlocal

set REGION=eu-central-1
set FUNCTION_NAME=tank-ws-handler
set ROLE_NAME=tank-ws-lambda-role
set TABLE_NAME=tank-ws-server-connections

for /f "tokens=*" %%a in ('aws sts get-caller-identity --query Account --output text') do set ACCOUNT_ID=%%a

aws lambda create-function ^
  --region %REGION% ^
  --function-name %FUNCTION_NAME% ^
  --runtime nodejs20.x ^
  --handler handler.handler ^
  --zip-file fileb://handler.zip ^
  --role arn:aws:iam::%ACCOUNT_ID%:role/%ROLE_NAME% ^
  --environment "Variables={TABLE_NAME=%TABLE_NAME%}"

echo Done: Lambda %FUNCTION_NAME% created.