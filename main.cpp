#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <string>


// Definição dos pinos dos LEDs
#define LED1_PIN 4   // Verde
#define LED2_PIN 5   // Amarelo
#define LED3_PIN 12  // Vermelho


// UUIDs BLE
#define SERVICE_UUID   "12345678-1234-5678-1234-56789abcdef0"
#define CHAR_LED_UUID  "abcdefab-1234-5678-1234-56789abcdef1"


BLECharacteristic* ledChar = nullptr;
uint8_t estadoAtual = 0x00; // bitmask 3 bits


// ----------------------
// Função para atualizar LEDs
void atualizarLEDs(uint8_t estado) {
  // Lógica: HIGH liga, LOW desliga
  digitalWrite(LED1_PIN, (estado & 0x01) ? HIGH : LOW);
  digitalWrite(LED2_PIN, (estado & 0x02) ? HIGH : LOW);
  digitalWrite(LED3_PIN, (estado & 0x04) ? HIGH : LOW);


  estadoAtual = estado & 0x07; // só 3 bits
  Serial.printf("[LED UPDATE] Estado=0x%02X\n", estadoAtual);
}
// ----------------------


// Callback BLE
class LedWriteCB : public BLECharacteristicCallbacks {
public:
  void onWrite(BLECharacteristic* c) override {
    size_t len = c->getLength();
    const uint8_t* data = c->getData();


    if (data && len > 0) {
      // Recebeu byte(s)
      Serial.print("Recebido byte: ");
      for (size_t i = 0; i < len; i++) Serial.printf("0x%02X ", data[i]);
      Serial.println();


      uint8_t novoEstado = data[0];
      atualizarLEDs(novoEstado);


      if (ledChar) {
        ledChar->setValue(&estadoAtual, 1);
        ledChar->notify();
      }
      return;
    }


    // Recebeu string
    std::string v = c->getValue();
    if (!v.empty()) {
      Serial.print("Recebido string: ");
      Serial.println(v.c_str());


      // Converte string para byte, detecta base automaticamente
      uint8_t novoEstado = (uint8_t) strtol(v.c_str(), nullptr, 0);
      atualizarLEDs(novoEstado);


      if (ledChar) {
        ledChar->setValue(&estadoAtual, 1);
        ledChar->notify();
      }
    }
  }
};


void setup() {
  Serial.begin(115200);
  delay(100);


  // Configura pinos como saída
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(LED3_PIN, OUTPUT);
  atualizarLEDs(0x00); // inicial: tudo apagado


  // Inicializa BLE
  BLEDevice::init("ESP32-FactoryLED");
  BLEServer* server = BLEDevice::createServer();
  BLEService* service = server->createService(SERVICE_UUID);


  // Cria característica
  ledChar = service->createCharacteristic(
    CHAR_LED_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY |
    BLECharacteristic::PROPERTY_WRITE_NR
  );
  ledChar->addDescriptor(new BLE2902());
  ledChar->setCallbacks(new LedWriteCB());


  ledChar->setValue(&estadoAtual, 1);


  // Inicia serviço e advertising
  service->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();


  Serial.println("BLE pronto - escreva 0x01 liga LED1, 0x02 LED2, 0x04 LED3, etc.");
}


void loop() {

}