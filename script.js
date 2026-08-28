// =========================================
// JAVASCRIPT LOGICA - script.js
// =========================================

const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let rxCharacteristic = null;
let lastSendTime = 0; 

// Registreer de Service Worker voor de PWA (Offline app)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker geregistreerd!', reg))
      .catch(err => console.error('Service Worker registratie mislukt:', err));
  });
}

// --- CACHING FUNCTIE: Laad opgeslagen waarden bij het openen van de app ---
window.addEventListener('DOMContentLoaded', () => {
  const savedColor = localStorage.getItem('diceColor');
  const savedBright = localStorage.getItem('diceBright');
  const savedSpeed = localStorage.getItem('diceSpeed');

  if (savedColor) {
    document.getElementById('customColor').value = savedColor;
  }
  if (savedBright) {
    document.getElementById('brightnessSlider').value = savedBright;
    document.getElementById('brightVal').innerText = Math.round((savedBright / 255) * 100);
  }
  if (savedSpeed) {
    document.getElementById('speedSlider').value = savedSpeed;
    document.getElementById('speedVal').innerText = savedSpeed;
  }
});

// --- BLUETOOTH LOGICA ---

// Verbinden met de toren
async function connectBLE() {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'DiceTower_Skull' }],
      optionalServices: [SERVICE_UUID]
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    rxCharacteristic = await service.getCharacteristic(RX_CHAR_UUID);
    alert("Succesvol verbonden!");
  } catch (error) { 
    console.error("Verbinding mislukt:", error); 
  }
}

// Commando's doorsturen naar de ESP32
async function sendCommand(command) {
  if (!rxCharacteristic) return;
  try {
    const encoder = new TextEncoder();
    await rxCharacteristic.writeValue(encoder.encode(command));
  } catch (error) { 
    console.error("Fout bij verzenden:", error); 
  }
}

// --- EVENT LISTENERS (Inclusief Caching) ---

// Color Picker
document.getElementById('customColor').addEventListener('input', function(e) {
  const now = Date.now();
  if (now - lastSendTime > 50) { 
    sendCommand(e.target.value.toUpperCase());
    lastSendTime = now;
  }
});
document.getElementById('customColor').addEventListener('change', (e) => {
  localStorage.setItem('diceColor', e.target.value); // Sla op in cache
  sendCommand(e.target.value.toUpperCase());
});

// Helderheid Slider
document.getElementById('brightnessSlider').addEventListener('input', function(e) {
  document.getElementById('brightVal').innerText = Math.round((e.target.value / 255) * 100);
  const now = Date.now();
  if (now - lastSendTime > 50) { 
    sendCommand("BR:" + e.target.value); 
    lastSendTime = now; 
  }
});
document.getElementById('brightnessSlider').addEventListener('change', (e) => {
  localStorage.setItem('diceBright', e.target.value); // Sla op in cache
  sendCommand("BR:" + e.target.value);
});

// Snelheid Slider
document.getElementById('speedSlider').addEventListener('input', function(e) {
  document.getElementById('speedVal').innerText = e.target.value;
  const now = Date.now();
  if (now - lastSendTime > 50) { 
    sendCommand("SP:" + e.target.value); 
    lastSendTime = now; 
  }
});
document.getElementById('speedSlider').addEventListener('change', (e) => {
  localStorage.setItem('diceSpeed', e.target.value); // Sla op in cache
  sendCommand("SP:" + e.target.value);
});