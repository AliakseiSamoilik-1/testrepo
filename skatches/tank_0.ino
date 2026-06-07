#include <ESP32Servo.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <WebSockets.h>   // needed for WStype_t
//#include <ArduinoJson.h>


#define DBG_PRINT(x)    Serial.print(x)
#define DBG_PRINTLN(x)  Serial.println(x)

//#define DBG_PRINT(x)
//#define DBG_PRINTLN(x)



#define ESC_PIN1       18
#define ESC_PIN2       19
#define FIRE_PIN       23
#define FIRE_SERVO_PIN 22

#define ESC_MIN 1000     // минимальный импульс (обратная)
#define ESC_MAX 2000     // максимальный импульс (прямая)
#define ESC_NEUTRAL 1500 // нейтраль / стоп

// Одна кнопка включает вращение двигателя вперед
// Вторая кнопка включает вращение двигателя назад
// Задание: переименовать понятным образом (например BUTTON_FORWARD)

const char* ssid = "TP-Link_49C0";
const char* password = "63718096";

WebSocketsServer webSocket = WebSocketsServer(82);

unsigned long lastMessageTime = 0;
const unsigned long CONNECTION_TIMEOUT_MS = 3000;

uint16_t x=ESC_NEUTRAL;
uint16_t y=ESC_NEUTRAL;
uint16_t fire=0;

Servo esc1;
Servo esc2;
Servo fireServo;

// Fire servo cycle: 0=idle, 1=sweeping to 180°, 2=returning to 0°
uint8_t       firePhase      = 0;
unsigned long firePhaseStart = 0;
bool          firePrev       = false; // edge detect: trigger only on 0→1
void setup() {

  Serial.begin(115200);

  int n = WiFi.scanNetworks();
  if (n == 0) {
    Serial.println("No networks found");
  } else {
    Serial.print(n);
    Serial.println(" networks found:");
    for (int i = 0; i < n; ++i) {
      Serial.print(i + 1);
      Serial.print(": ");
      Serial.print(WiFi.SSID(i));
      Serial.print(" (RSSI: ");
      Serial.print(WiFi.RSSI(i));
      Serial.print(" dBm) ");
      Serial.print((WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "Open" : "Secured");
      Serial.println();
    }
  }

  esc1.writeMicroseconds(ESC_NEUTRAL);
  esc2.writeMicroseconds(ESC_NEUTRAL);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("Wi-Fi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.println("WebSocket server started on port 82");

  esc1.attach(ESC_PIN1, ESC_MIN, ESC_MAX);
  esc2.attach(ESC_PIN2, ESC_MIN, ESC_MAX);
  fireServo.attach(FIRE_SERVO_PIN);
  fireServo.write(0);

  delay(3000); // ждём сигналы бипов
  Serial.println("Arming ESC...");
  esc1.writeMicroseconds(ESC_NEUTRAL);
  esc2.writeMicroseconds(ESC_NEUTRAL);

}

void loop() {
  webSocket.loop();
  if (millis() - lastMessageTime > CONNECTION_TIMEOUT_MS) {
    x    = ESC_NEUTRAL;
    y    = ESC_NEUTRAL;
    fire = 0;
  }
  esc1.writeMicroseconds(x);
  esc2.writeMicroseconds(y);

  // Fire servo: start a new cycle only on rising edge of fire, while idle
  bool fireNow = (fire != 0);
  if (fireNow && !firePrev && firePhase == 0) {
    firePhase      = 1;
    firePhaseStart = millis();
    fireServo.write(180);
  }
  firePrev = fireNow;

  unsigned long elapsed = millis() - firePhaseStart;
  if (firePhase == 1 && elapsed >= 250) {
    firePhase      = 2;
    firePhaseStart = millis();
    fireServo.write(0);
  } else if (firePhase == 2 && elapsed >= 250) {
    firePhase = 0;
  }

  delay(1);
}


//Event handler
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_CONNECTED:
      Serial.printf("Client %u connected\n", num);
      webSocket.sendTXT(num, "Hello from server!");
      break;
    case WStype_DISCONNECTED:
      Serial.printf("Client %u disconnected\n", num);
      x    = ESC_NEUTRAL;
      y    = ESC_NEUTRAL;
      fire = 0;
      lastMessageTime = 0;
      break;
    case WStype_BIN:{
      DBG_PRINTLN("BINARY message received!");
      x    = payload[0] | (payload[1] << 8);
      y    = payload[2] | (payload[3] << 8);
      fire = (length >= 6) ? (payload[4] | (payload[5] << 8)) : 0;
      DBG_PRINT("X:"); DBG_PRINTLN(x);
      DBG_PRINT("Y:"); DBG_PRINTLN(y);
      DBG_PRINT("Fire:"); DBG_PRINTLN(fire);
      lastMessageTime = millis();
      break;
    }
    case WStype_TEXT:
      Serial.println("PayLoad");
      //DBG_PRINTLN(payload);
      uint16_t *data = (uint16_t*)payload;  // reinterpret cast
      x = data[0];
      y = data[1];

      DBG_PRINT("JsonData X:");
      DBG_PRINTLN(x);
      DBG_PRINT("JsonData Y:");
      DBG_PRINTLN(y);
      lastMessageTime = millis();

      break;
  }
}
