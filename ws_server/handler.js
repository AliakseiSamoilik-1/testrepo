const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } = require('@aws-sdk/client-apigatewaymanagementapi');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

// Module-level cache survives across warm Lambda invocations
const connCache = new Map();

exports.handler = async (event) => {
  const { connectionId, routeKey, domainName, stage } = event.requestContext;
  console.log('[handler]', routeKey, connectionId);

  if (routeKey === '$connect') {
    const params = event.queryStringParameters || {};
    const role = params.role;
    const room = params.room || 'default';
    console.log('[connect] role:', role, '| room:', room);

    if (role !== 'car' && role !== 'controller') {
      console.warn('[connect] rejected — invalid role:', role);
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
    console.log('[connect] saved to DynamoDB — table:', TABLE);

    return { statusCode: 200, body: 'Connected' };
  }

  if (routeKey === '$disconnect') {
    console.log('[disconnect]', connectionId);
    connCache.delete(connectionId);
    await dynamo.send(new DeleteCommand({
      TableName: TABLE,
      Key: { connectionId },
    }));
    return { statusCode: 200, body: 'Disconnected' };
  }

  // $default — controller sends binary, forward to all cars in the same room
  let conn = connCache.get(connectionId);
  if (!conn) {
    console.log('[default] cache miss — fetching connection record...');
    const { Item } = await dynamo.send(new GetCommand({
      TableName: TABLE,
      Key: { connectionId },
    }));
    if (!Item) {
      console.warn('[default] unknown connectionId:', connectionId);
      return { statusCode: 410, body: 'Unknown connection' };
    }
    connCache.set(connectionId, Item);
    conn = Item;
  }
  console.log('[default] conn:', JSON.stringify(conn));

  if (conn.role !== 'controller') {
    console.warn('[default] rejected — role is not controller:', conn.role);
    return { statusCode: 403, body: 'Only controllers may send messages' };
  }

  console.log('[default] querying cars in room:', conn.room);
  const { Items: cars = [] } = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'RoomRoleIndex',
    KeyConditionExpression: '#room = :room AND #role = :role',
    ExpressionAttributeNames: { '#room': 'room', '#role': 'role' },
    ExpressionAttributeValues: { ':room': conn.room, ':role': 'car' },
  }));
  console.log('[default] cars found:', cars.length);

  if (cars.length === 0) return { statusCode: 200, body: 'No cars connected' };

  const data = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body);

  const apigw = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  await Promise.all(
    cars.map(car => {
      console.log('[default] sending to car:', car.connectionId);
      return apigw.send(new PostToConnectionCommand({ ConnectionId: car.connectionId, Data: data }))
        .catch(err => {
          if (err instanceof GoneException) {
            console.warn('[default] stale car connection:', car.connectionId);
            return;
          }
          console.error('[default] PostToConnection error:', err);
          throw err;
        });
    })
  );

  return { statusCode: 200, body: 'OK' };
};
