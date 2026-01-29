import type { APIGatewayProxyResult } from "aws-lambda";

/**
 * Minimal Lambda handler that returns "OK".
 *
 * Works for API Gateway Proxy / Function URL style integrations.
 */
export const handler = async (): Promise<APIGatewayProxyResult> => {

  const value = process.env.JWT_PRIVATE_KEY;
  return {
    statusCode: 200,
    headers: {
      "content-type": "text/plain"
    },
    body: "OK:" + value
  };
};
