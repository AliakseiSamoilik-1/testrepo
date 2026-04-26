@echo off
setlocal

set REGION=eu-central-1
set API_NAME=tank-ws-api
set FUNCTION_NAME=tank-ws-handler
set STAGE=prod

for /f "tokens=*" %%a in ('aws sts get-caller-identity --query Account --output text') do set ACCOUNT_ID=%%a

set LAMBDA_ARN=arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:%FUNCTION_NAME%
set LAMBDA_URI=arn:aws:apigateway:%REGION%:lambda:path/2015-03-31/functions/%LAMBDA_ARN%/invocations

for /f "tokens=*" %%a in ('aws apigatewayv2 create-api --name %API_NAME% --protocol-type WEBSOCKET --route-selection-expression "$request.body.action" --region %REGION% --query ApiId --output text') do set API_ID=%%a
echo API ID: %API_ID%

for /f "tokens=*" %%a in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri %LAMBDA_URI% --region %REGION% --query IntegrationId --output text') do set INTEGRATION_ID=%%a

set TARGET=integrations/%INTEGRATION_ID%

aws apigatewayv2 create-route --api-id %API_ID% --route-key $connect    --target %TARGET% --region %REGION%
aws apigatewayv2 create-route --api-id %API_ID% --route-key $disconnect --target %TARGET% --region %REGION%
aws apigatewayv2 create-route --api-id %API_ID% --route-key $default    --target %TARGET% --region %REGION%

aws lambda add-permission ^
  --function-name %FUNCTION_NAME% ^
  --statement-id apigw-invoke ^
  --action lambda:InvokeFunction ^
  --principal apigateway.amazonaws.com ^
  --region %REGION%

aws apigatewayv2 create-stage --api-id %API_ID% --stage-name %STAGE% --auto-deploy --region %REGION%

echo.
echo WebSocket URL: wss://%API_ID%.execute-api.%REGION%.amazonaws.com/%STAGE%