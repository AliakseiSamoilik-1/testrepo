const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } = require('@aws-sdk/client-apigatewaymanagementapi');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

// Module-level caches — survive across warm Lambda invocations
const connCache = new Map(); // connectionId → { role, room }
const carCache  = new Map(); // room → [{ connectionId }]
let apigw = null;

exports.handler = async (event) => {
  const { connectionId, routeKey, domainName, stage } = event.requestContext;
  console.log('[handler]', routeKey, connectionId);

  // Reuse ApiGatewayManagementApiClient across invocations
  if (!apigw) {
    apigw = new ApiGatewayManagementApiClient({
      endpoint: `https://${domainName}/${stage}`,
    });
  }

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
      Item: { connectionId, role, room, ttl: Math.floor(Date.now() / 1000) + 86400 },
    }));

    connCache.set(connectionId, { role, room });
    if (role === 'car') carCache.delete(room); // invalidate so next query picks up this car
    console.log('[connect] saved — table:', TABLE);

    return { statusCode: 200, body: 'Connected' };
  }

  if (routeKey === '$disconnect') {
    console.log('[disconnect]', connectionId);
    const conn = connCache.get(connectionId);
    if (conn?.role === 'car') carCache.delete(conn.room); // invalidate car list for room
    connCache.delete(connectionId);
    await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: { connectionId } }));
    return { statusCode: 200, body: 'Disconnected' };
  }

  // $default — controller sends text, forward to all cars in the same room
  let conn = connCache.get(connectionId);
  if (!conn) {
    console.log('[default] cache miss — fetching connection record...');
    const { Item } = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { connectionId } }));
    if (!Item) {
      console.warn('[default] unknown connectionId:', connectionId);
      return { statusCode: 410, body: 'Unknown connection' };
    }
    connCache.set(connectionId, Item);
    conn = Item;
  }

  if (conn.role !== 'controller') {
    console.warn('[default] rejected — role is not controller:', conn.role);
    return { statusCode: 403, body: 'Only controllers may send messages' };
  }

  let cars = carCache.get(conn.room);
  if (!cars) {
    console.log('[default] car cache miss — querying room:', conn.room);
    const { Items = [] } = await dynamo.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'RoomRoleIndex',
      KeyConditionExpression: '#room = :room AND #role = :role',
      ExpressionAttributeNames: { '#room': 'room', '#role': 'role' },
      ExpressionAttributeValues: { ':room': conn.room, ':role': 'car' },
    }));
    carCache.set(conn.room, Items);
    cars = Items;
    console.log('[default] cars found:', cars.length);
  }

  if (cars.length === 0) return { statusCode: 200, body: 'No cars connected' };

  const data = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body);

  await Promise.all(
    cars.map(car =>
      apigw.send(new PostToConnectionCommand({ ConnectionId: car.connectionId, Data: data }))
        .catch(err => {
          if (err instanceof GoneException) {
            console.warn('[default] stale car connection:', car.connectionId);
            carCache.delete(conn.room); // force re-query next time
            return;
          }
          console.error('[default] PostToConnection error:', err);
          throw err;
        })
    )
  );

  return { statusCode: 200, body: 'OK' };
};
