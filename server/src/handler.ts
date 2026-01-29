import type { APIGatewayProxyResult } from "aws-lambda";
import { JWTService } from "./services/JWTService";

/**
 * Minimal Lambda handler that returns a generated JWT.
 *
 * Works for API Gateway Proxy / Function URL style integrations.
 */
export const handler = async (): Promise<APIGatewayProxyResult> => {
  let token: string;
  try {
    const jwtService = new JWTService();
    token = jwtService.generateJWT();
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { "content-type": "text/plain" },
      body: "JWT generation failed: " + (e.message || e.toString())
    };
  }
  return {
    statusCode: 200,
    headers: {
      "content-type": "text/plain"
    },
    body: "JWT: " + token
  };
};
