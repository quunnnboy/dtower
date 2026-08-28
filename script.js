// =========================================
// JAVASCRIPT LOGICA - script.js
// =========================================

const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let rxCharacteristic = null;
let lastSendTime = 0; 
let isSending = false;       // Toegevoegd voor de wachtrij
let pendingCommand = null;   // Toegevoegd voor de wachtrij

// Registreer de Service Worker voor de PWA (Offline app)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker geregistreerd!', reg))
      .catch(err => console.error('Service Worker registratie mislukt:', err));
  });
}

// --- NIEUWE FUNCTIE: Visuele knop status & Commando sturen ---
function setEffect(btnElement, command) {
  // 1. Verwijder de 'active' class van alle knoppen
  document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
  
  // 2. Voeg de 'active' class toe aan de geklikte knop
  btnElement.classList.add('active');
  
  // 3. Sla de actieve modus op in de cache
  localStorage.setItem('activeMode', command);

  // 4. Stuur het commando naar de ESP32
  sendCommand(command);
}

// --- CACHING FUNCTIE AANGEPAST: Laad opgeslagen waarden en actieve knop ---
window.addEventListener('DOMContentLoaded', () => {
  const savedColor = localStorage.getItem('diceColor');
  const savedBright = localStorage.getItem('diceBright');
  const savedSpeed = localStorage.getItem('diceSpeed');
  const savedMode = localStorage.getItem('activeMode'); // Haal de laatste modus op

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
  
  // Zet de juiste knop op actief als je de app opent
  if (savedMode) {
    const activeBtn = document.querySelector(`.effect-btn[data-cmd="${savedMode}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
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

// Commando's doorsturen naar de ESP32 (Met ingebouwde wachtrij)
async function sendCommand(command) {
  if (!rxCharacteristic) return;

  // Als de Bluetooth-lijn bezet is, onthoud dan dit allernieuwste commando
  if (isSending) {
    pendingCommand = command;
    return;
  }

  isSending = true;
  try {
    const encoder = new TextEncoder();
    await rxCharacteristic.writeValue(encoder.encode(command));
  } catch (error) { 
    console.error("Fout bij verzenden:", error); 
  } finally {
    isSending = false;
    
    // Zodra het verzenden klaar is, checken of je inmiddels alweer een nieuwe kleur/waarde hebt gekozen
    if (pendingCommand) {
      const nextCommand = pendingCommand;
      pendingCommand = null;
      sendCommand(nextCommand); // Stuur direct de nieuwste waarde door
    }
  }
}

// --- EVENT LISTENERS (Inclusief Caching) ---

// Color Picker
document.getElementById('customColor').addEventListener('input', function(e) {
  const now = Date.now();
  if (now - lastSendTime > 20) { // Verlaagd naar 20 voor meer smoothness
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
  if (now - lastSendTime > 20) { // Verlaagd naar 20 voor meer smoothness
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
  if (now - lastSendTime > 30) { // Verlaagd naar 20 voor meer smoothness
    sendCommand("SP:" + e.target.value); 
    lastSendTime = now; 
  }
});
document.getElementById('speedSlider').addEventListener('change', (e) => {
  localStorage.setItem('diceSpeed', e.target.value); // Sla op in cache
  sendCommand("SP:" + e.target.value);
});