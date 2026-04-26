const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } = require('@aws-sdk/client-apigatewaymanagementapi');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

doesexports.handler = async (event) => {
  const { connectionId, routeKey, domainName, stage } = event.requestContext;

  if (routeKey === '$connect') {
    const params = event.queryStringParameters || {};
    const role = params.role;
    const room = params.room || 'default';

    if (role !== 'car' && role !== 'controller') {
      return { statusCode: 400, body: 'Query param role must be "car" or "controller"' };
    }

    await dynamo.send(new PutCommand({
      TableName: TABLE,
      Item: {
        connectionId,
        role,
        room,
        ttl: Math.floor(Date.now() / 1000) + 86400,
      },
    }));

    return { statusCode: 200, body: 'Connected' };
  }

  if (routeKey === '$disconnect') {
    await dynamo.send(new DeleteCommand({
      TableName: TABLE,
      Key: { connectionId },
    }));
    return { statusCode: 200, body: 'Disconnected' };
  }

  // $default — controller sends binary, forward to all cars in the same room
  const { Item: conn } = await dynamo.send(new GetCommand({
    TableName: TABLE,
    Key: { connectionId },
  }));

  if (!conn) return { statusCode: 410, body: 'Unknown connection' };
  if (conn.role !== 'controller') return { statusCode: 403, body: 'Only controllers may send messages' };

  const { Items: cars = [] } = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'RoomRoleIndex',
    KeyConditionExpression: '#room = :room AND #role = :role',
    ExpressionAttributeNames: { '#room': 'room', '#role': 'role' },
    ExpressionAttributeValues: { ':room': conn.room, ':role': 'car' },
  }));

  if (cars.length === 0) return { statusCode: 200, body: 'No cars connected' };

  // Body is base64-encoded binary when isBase64Encoded is true, raw string otherwise.
  const data = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body);

  const apigw = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  await Promise.all(
    cars.map(car =>
      apigw.send(new PostToConnectionCommand({ ConnectionId: car.connectionId, Data: data }))
        .catch(err => {
          // Stale connection — ignore; TTL will clean DynamoDB up
          if (err instanceof GoneException) return;
          throw err;
        })
    )
  );

  return { statusCode: 200, body: 'OK' };
};