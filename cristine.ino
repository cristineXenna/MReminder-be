#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels
#define OLED_RESET     4 // Reset pin # (or -1 if sharing Arduino reset pin)

// Replace these with your network credentials
const char* ssid = "Kitin";
const char* password = "susahbanget";

// Replace this with your server's IP address and port
const char* serverBaseUrl = "http://192.168.0.100:3000/"; // Replace with your actual server IP

// Timer variables
unsigned long previousMillis = 0;
const long interval = 5000;  // Interval in milliseconds (1 second)
String UID;
bool hasUID = false; // Flag to check if UID has been retrieved
const int buzzerPin = 1;

// Initialize WiFi client
WiFiClient client;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
int buttonState=0;

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 25200, 60000);

void setup() {
  // Start serial communication
//  Serial.begin(115200);
  Wire.begin(0,2);  
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);    
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(WHITE);
  display.setCursor(4,0);  display.println(F("M.REMINDER"));
  display.setCursor(9,25);  display.println(F("622018014"));
  display.display();

  pinMode(buzzerPin, OUTPUT);
//  digitalWrite(buzzerPin, HIGH);
  // Connect to WiFi
  WiFi.begin(ssid, password);
//  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
//    Serial.print(".");
  }
  display.clearDisplay();
  digitalWrite(buzzerPin, LOW);
  timeClient.begin();
  timeClient.update();
//  Serial.println("\nConnected to WiFi");
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= interval) {
    // Save the last time an HTTP request was sent
    previousMillis = currentMillis;

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;

      if (!hasUID) {
        // Retrieve UID from the /getUid endpoint
        String url = String(serverBaseUrl) + "getUid";
//        Serial.println("Requesting URL: " + url);
        http.begin(client, url);
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");
        
        int httpCode = http.GET();
        if (httpCode > 0) {
          String payload = http.getString();
//          Serial.println("HTTP Response code: " + String(httpCode));
//          Serial.println("Payload: " + payload);
          
          if (payload != "-") {
            UID = payload;
            hasUID = true; // Set flag to true after successful retrieval
//            Serial.println("UID retrieved: " + UID);
          }
        } else {
//          Serial.print("Error on HTTP request YUD, Error code: ");
//          Serial.println(httpCode);
        }
        http.end();
      } else {
        // Use UID to retrieve data from the /getData endpoint
        String url = String(serverBaseUrl) + "getData?uid=" + UID;
//        Serial.println("Requesting URL: " + url);
        http.begin(client, url);
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");
        
        int httpCode = http.GET();
        if (httpCode > 0) {
          String payload = http.getString();
//          Serial.println("HTTP Response code: " + String(httpCode));
//          Serial.println("Payload: " + payload);
          if (payload != "-") {
//            Serial.println("Minum obat: " + payload);
//           time to get medicine
            display.clearDisplay();
            display.setTextSize(2);
            display.setTextColor(WHITE);
            display.setCursor(0, 0);
            display.print("Minum Obat");
            display.setCursor(0, 20);
            display.print(payload);
            display.display();
            digitalWrite(buzzerPin, HIGH);
            delay(3000);                      
            digitalWrite(buzzerPin, LOW);  
//            delay(500);     
          }
          else{
            digitalWrite(buzzerPin, LOW);
          }
        } else {
//          Serial.print("Error on HTTP request get Data, Error code: ");
//          Serial.println(httpCode);
        }
        http.end();
      }
    } else {
//      Serial.println("Disconnected from WiFi");
    }
  }
  else{
    Clock();
  }
}

void Clock(){
  timeClient.update();

  time_t rawTime = timeClient.getEpochTime();
  struct tm * timeInfo = localtime(&rawTime);

  // Format the date
  char dateBuffer[11]; // Buffer to hold the date string
  strftime(dateBuffer, sizeof(dateBuffer), "%d-%m-%Y", timeInfo);
  
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(WHITE);
  display.setCursor(5, 0);
  display.print(dateBuffer);

  // Display the date
  display.setCursor(15, 25);
  display.setTextSize(2);
  display.setTextColor(WHITE);
  display.print(timeClient.getFormattedTime()); // You may need to format this according to your needs

  display.display();
}
