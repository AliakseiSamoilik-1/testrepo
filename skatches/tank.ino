#include <ESP32Servo.h>
#include <WiFi.h>
#include <WebSocketsClient.h>

#define DBG_PRINT(x)    Serial.print(x)
#define DBG_PRINTLN(x)  Serial.println(x)

// #define DBG_PRINT(x)
// #define DBG_PRINTLN(x)

#define ESC_PIN1 16
#define ESC_PIN2 17

#define ESC_MIN     1000
#define ESC_MAX     2000
#define ESC_NEUTRAL 1500

const char* ssid     = "TP-Link_49C0";
const char* password = "63718096";

// AWS API Gateway WebSocket endpoint
const char* WS_HOST  = "9anarmdq5b.execute-api.eu-central-1.amazonaws.com";
const int   WS_PORT  = 443;
const char* WS_PATH  = "/prod/?role=car&room=tank1";

const unsigned long CONNECTION_TIMEOUT_MS = 3000;

WebSocketsClient webSocket;

uint16_t x = ESC_NEUTRAL;
uint16_t y = ESC_NEUTRAL;
unsigned long lastMessageTime = 0;

Servo esc1;
Servo esc2;

void setup() {
  Serial.begin(115200);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Wi-Fi connected — IP: ");
  Serial.println(WiFi.localIP());

  esc1.attach(ESC_PIN1, ESC_MIN, ESC_MAX);
  esc2.attach(ESC_PIN2, ESC_MIN, ESC_MAX);
  esc1.writeMicroseconds(ESC_NEUTRAL);
  esc2.writeMicroseconds(ESC_NEUTRAL);
  delay(3000); // wait for ESC arming beeps

  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  Serial.println("WebSocket client started");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    DBG_PRINTLN("[WiFi] Lost — reconnecting...");
    WiFi.disconnect();
    WiFi.begin(ssid, password);
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 10000) {
      delay(500);
      DBG_PRINT(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
      DBG_PRINTLN("[WiFi] Reconnected");
    } else {
      DBG_PRINTLN("[WiFi] Failed — will retry next loop");
    }
  }

  webSocket.loop();

  if (millis() - lastMessageTime > CONNECTION_TIMEOUT_MS) {
    x = ESC_NEUTRAL;
    y = ESC_NEUTRAL;
  }

  esc1.writeMicroseconds(x);
  esc2.writeMicroseconds(y);
  delay(1);
}

// Parse "1500;1500;" into x and y
bool parsePayload(uint8_t* payload, uint16_t& outX, uint16_t& outY) {
  char buf[32];
  strncpy(buf, (char*)payload, sizeof(buf) - 1);
  buf[sizeof(buf) - 1] = '\0';

  char* tok = strtok(buf, ";");
  if (!tok) return false;
  outX = (uint16_t)atoi(tok);

  tok = strtok(NULL, ";");
  if (!tok) return false;
  outY = (uint16_t)atoi(tok);

  return true;
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      DBG_PRINTLN("[WS] Connected to server");
      lastMessageTime = millis();
      break;

    case WStype_DISCONNECTED:
      DBG_PRINTLN("[WS] Disconnected");
      x = ESC_NEUTRAL;
      y = ESC_NEUTRAL;
      lastMessageTime = 0;
      break;

    case WStype_TEXT: {
      DBG_PRINT("[WS] Text: ");
      DBG_PRINTLN((char*)payload);

      uint16_t newX, newY;
      if (parsePayload(payload, newX, newY)) {
        x = constrain(newX, ESC_MIN, ESC_MAX);
        y = constrain(newY, ESC_MIN, ESC_MAX);
        DBG_PRINT("X="); DBG_PRINT(x);
        DBG_PRINT(" Y="); DBG_PRINTLN(y);
        lastMessageTime = millis();
      } else {
        DBG_PRINTLN("[WS] Failed to parse payload");
      }
      break;
    }

    case WStype_ERROR:
      DBG_PRINTLN("[WS] Error");
      break;

    default:
      break;
  }
}