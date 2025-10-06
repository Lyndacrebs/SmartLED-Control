// UUIDs devem ser os mesmos que você usou no ESP32
const UUID_SERVICO = '12345678-1234-5678-1234-56789abcdef0';
const UUID_CARAC_LED = 'abcdefab-1234-5678-1234-56789abcdef1';

let dispositivo = null;
let servidorGatt = null;
let caractLed = null;
let estadoAtual = 0; // bitmask com 3 bits

const botaoConectar = document.getElementById('btnConnect');
const botaoAllOn = document.getElementById('btnAllOn');
const botaoAllOff = document.getElementById('btnAllOff');
const botoesToggle = document.querySelectorAll('.toggle');
const rotuloStatus = document.getElementById('status');

function ajustarUIConectado(conectado, nome = '') {
  botaoConectar.textContent = conectado ? 'Desconectar' : 'Conectar';
  botaoAllOn.disabled = !conectado;
  botaoAllOff.disabled = !conectado;
  botoesToggle.forEach(b => b.disabled = !conectado);
  rotuloStatus.textContent = conectado ? `Conectado${nome ? ' a ' + nome : ''}` : 'Desconectado';
}

function atualizarLEDsUI() {
  for (let i = 0; i < 3; i++) {
    const ledEl = document.getElementById('led' + i);
    const ligado = (estadoAtual >> i) & 1;
    ledEl.style.background = ligado ? [ "var(--green)", "var(--yellow)", "var(--red)" ][i] : "#444";
  }
}

function exigirWebBluetooth() {
  if (!('bluetooth' in navigator)) {
    alert('Este navegador não suporta Web Bluetooth. Use Chrome/Edge em HTTPS ou localhost.');
    throw new Error('Web Bluetooth não suportado');
  }
}

async function conectarOuDesconectar() {
  if (dispositivo?.gatt?.connected) {
    try { dispositivo.gatt.disconnect(); } catch {}
    aoDesconectar();
    return;
  }
  exigirWebBluetooth();
  try {
    dispositivo = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'ESP32-FactoryLED' }], // ajuste para o nome do seu ESP32
      optionalServices: [UUID_SERVICO]
    });
    dispositivo.addEventListener('gattserverdisconnected', aoDesconectar);
    servidorGatt = await dispositivo.gatt.connect();
    const servico = await servidorGatt.getPrimaryService(UUID_SERVICO);
    caractLed = await servico.getCharacteristic(UUID_CARAC_LED);

    // tenta ler estado atual
    try {
      const val = await caractLed.readValue();
      if (val && val.byteLength >= 1) {
        estadoAtual = val.getUint8(0);
        atualizarLEDsUI();
      }
    } catch {}

    // habilita notificações
    try {
      await caractLed.startNotifications();
      caractLed.addEventListener('characteristicvaluechanged', (ev) => {
        estadoAtual = ev.target.value.getUint8(0);
        atualizarLEDsUI();
      });
    } catch {}

    ajustarUIConectado(true, dispositivo.name || '');
  } catch (erro) {
    console.error('Falha ao conectar:', erro);
    aoDesconectar();
  }
}

function aoDesconectar() {
  ajustarUIConectado(false);
  dispositivo = null;
  servidorGatt = null;
  caractLed = null;
  estadoAtual = 0;
  atualizarLEDsUI();
}

async function escreverEstado(novoEstado) {
  if (!caractLed) return;
  estadoAtual = novoEstado & 0x07;
  atualizarLEDsUI();
  const dados = new Uint8Array([estadoAtual]);
  try {
    if ('writeValueWithResponse' in caractLed) {
      await caractLed.writeValueWithResponse(dados);
    } else {
      await caractLed.writeValue(dados);
    }
  } catch (e) {
    console.error('Falha na escrita (WRITE):', e);
  }
}

botaoConectar.addEventListener('click', conectarOuDesconectar);
botaoAllOn.addEventListener('click', () => escreverEstado(0x07));
botaoAllOff.addEventListener('click', () => escreverEstado(0x00));

botoesToggle.forEach(btn => {
  btn.addEventListener('click', () => {
    const bit = parseInt(btn.dataset.bit);
    const novoEstado = estadoAtual ^ (1 << bit);
    escreverEstado(novoEstado);
  });
});

ajustarUIConectado(false);
atualizarLEDsUI();