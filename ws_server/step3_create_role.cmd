@echo off
setlocal

set ROLE_NAME=tank-ws-lambda-role
set POLICY_NAME=tank-ws-policy
set REGION=eu-central-1

(echo {"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}) > trust.json

(echo {"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["dynamodb:PutItem","dynamodb:DeleteItem","dynamodb:GetItem","dynamodb:Query"],"Resource":["arn:aws:dynamodb:%REGION%:*:table/tank-ws-server-connections","arn:aws:dynamodb:%REGION%:*:table/tank-ws-server-connections/index/*"]},{"Effect":"Allow","Action":"execute-api:ManageConnections","Resource":"arn:aws:execute-api:%REGION%:*:*/*/*/*"}]}) > inline_policy.json

aws iam create-role ^
  --role-name %ROLE_NAME% ^
  --assume-role-policy-document file://trust.json

aws iam attach-role-policy ^
  --role-name %ROLE_NAME% ^
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam put-role-policy ^
  --role-name %ROLE_NAME% ^
  --policy-name %POLICY_NAME% ^
  --policy-document file://inline_policy.json

del trust.json inline_policy.json

echo Done: role %ROLE_NAME% created.