// =========================================
// JAVASCRIPT LOGICA - script.js
// =========================================

const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let rxCharacteristic = null;

let connectedTowers = [];
let lastSendTime = 0; 
let isSending = false;       
let pendingCommand = null;   

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


// --- BLUETOOTH LOGICA (Multi-Tower Support) ---
// Verbinden met een (of meerdere) torens
async function connectBLE() {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'DiceTower_Skull' }],
      optionalServices: [SERVICE_UUID]
    });

    // Check of we deze toren al verbonden hebben (voorkom dubbele verbindingen)
    if (connectedTowers.find(t => t.device.id === device.id)) {
      alert("Deze toren is al verbonden!");
      return;
    }

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const rxChar = await service.getCharacteristic(RX_CHAR_UUID);
    
    // Voeg de nieuwe toren toe aan onze lijst
    connectedTowers.push({ device: device, rxCharacteristic: rxChar });
    
    // Luister of de toren de verbinding verbreekt (bijv. lege batterij)
    device.addEventListener('gattserverdisconnected', onDisconnected);

    updateConnectButton();
    alert(`Toren succesvol toegevoegd! Je bestuurt nu ${connectedTowers.length} toren(s).`);
  } catch (error) { 
    console.error("Verbinding mislukt:", error); 
  }
}

// Wordt opgeroepen als een toren uitschakelt of buiten bereik is
function onDisconnected(event) {
  const device = event.target;
  // Haal de toren uit de lijst
  connectedTowers = connectedTowers.filter(t => t.device.id !== device.id);
  updateConnectButton();
  console.log(`Toren ontkoppeld. Nog ${connectedTowers.length} over.`);
}

// Past de tekst op je knop aan zodat je ziet hoeveel torens meedoen
function updateConnectButton() {
  const btn = document.querySelector('.btn-connect');
  if (connectedTowers.length === 0) {
    btn.innerText = "🔗 Connect your device";
  } else {
    btn.innerText = `🔗 Connect another (${connectedTowers.length} connected)`;
  }
}

// Commando's doorsturen naar ALLE verbonden torens (Met wachtrij)
async function sendCommand(command) {
  if (connectedTowers.length === 0) return; // Doe niets als er geen torens zijn

  // Als we nog aan het zenden zijn, bewaar dit commando
  if (isSending) {
    pendingCommand = command;
    return;
  }

  isSending = true;
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(command);
    
    // Vuur het commando razendsnel af naar elke toren in de lijst
    const sendPromises = connectedTowers.map(tower => 
      tower.rxCharacteristic.writeValue(data).catch(err => console.error("Fout bij een toren:", err))
    );
    
    // Wacht tot alle torens het commando hebben ontvangen
    await Promise.all(sendPromises);
    
  } catch (error) { 
    console.error("Fout bij verzenden naar groep:", error); 
  } finally {
    isSending = false;
    
    // Zodra het verzenden klaar is, stuur eventuele nieuwe commando's
    if (pendingCommand) {
      const nextCommand = pendingCommand;
      pendingCommand = null;
      sendCommand(nextCommand);
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