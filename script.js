// =========================================
// JAVASCRIPT LOGICA - script.js (MULTI-TOWER)
// =========================================

const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

// Array om alle verbonden torens in op te slaan
let connectedTowers = [];

// Variabelen voor de verzend-wachtrij (voorkomt vastlopen van Bluetooth)
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

// --- VISUELE KNOP STATUS & COMMANDO STUREN ---
function setEffect(btnElement, command) {
  // 1. Verwijder de 'active' class van alle knoppen
  document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
  
  // 2. Voeg de 'active' class toe aan de geklikte knop
  btnElement.classList.add('active');
  
  // 3. Sla de actieve modus op in de cache
  localStorage.setItem('activeMode', command);

  // 4. Stuur het commando naar ALLE verbonden torens
  sendCommand(command);
}

// --- CACHING FUNCTIE: Laad opgeslagen waarden ---
window.addEventListener('DOMContentLoaded', () => {
  const savedColor = localStorage.getItem('diceColor');
  const savedBright = localStorage.getItem('diceBright');
  const savedSpeed = localStorage.getItem('diceSpeed');
  const savedMode = localStorage.getItem('activeMode'); 

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
  
  if (savedMode) {
    const activeBtn = document.querySelector(`.effect-btn[data-cmd="${savedMode}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }
});

// --- BLUETOOTH LOGICA (Multi-Tower Support) ---

// Verbinden met een (of meerdere) torens
async function connectBLE() {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'DiceTower_Skull' }], // Zorg dat beide torens deze naam hebben in de Arduino code
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
    
    // Luister of de toren de verbinding verbreekt (bijv. lege batterij of te ver weg)
    device.addEventListener('gattserverdisconnected', onDisconnected);

    updateConnectButton();
    alert(`Toren succesvol toegevoegd! Je bestuurt nu ${connectedTowers.length} toren(s).`);
  } catch (error) { 
    console.error("Verbinding mislukt of geannuleerd door gebruiker:", error); 
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
  // Let op: zorg dat je connect-knop in de HTML de class 'btn-connect' heeft, 
  // of verander '.btn-connect' hieronder naar het ID van je knop (bijv. '#

// --- NIEUW: LIJST MET TORENS GENEREREN ---
function renderTowersList() {
  const panel = document.getElementById('towers-panel');
  const list = document.getElementById('towers-list');
  
  // Als er geen torens zijn, verberg het paneel
  if (connectedTowers.length === 0) {
    panel.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  
  // Anders, laat het paneel zien
  panel.style.display = 'block';
  list.innerHTML = ''; // Maak leeg voor we opnieuw vullen
  
  connectedTowers.forEach((tower, index) => {
    const towerId = tower.device.id;
    const towerName = tower.device.name || "Dice Tower";
    
    // Voeg HTML toe voor elke verbonden toren
    list.innerHTML += `
      <div class="tower-item">
        <span>🎲 ${towerName} #${index + 1}</span>
        <div class="tower-actions">
          <button class="btn-small btn-identify" onclick="identifyTower('${towerId}')">👁️ ID</button>
          <button class="btn-small btn-disconnect" onclick="disconnectTower('${towerId}')">❌ Disconnect</button>
        </div>
      </div>
    `;
  });
}

// --- NIEUW: IDENTIFY COMMANDO (Oog-knop) ---
async function identifyTower(id) {
  // Zoek de juiste toren in de array
  const tower = connectedTowers.find(t => t.device.id === id);
  if (!tower) return;
  
  try {
    // Stuur het commando "IDENTIFY" specifiek naar deze éne toren (niet naar de hele groep!)
    const encoder = new TextEncoder();
    await tower.rxCharacteristic.writeValue(encoder.encode("IDENTIFY"));
  } catch (error) {
    console.error("Identify mislukt:", error);
  }
}

// --- NIEUW: DISCONNECT COMMANDO (Kruis-knop) ---
function disconnectTower(id) {
  const tower = connectedTowers.find(t => t.device.id === id);
  if (tower && tower.device.gatt.connected) {
    tower.device.gatt.disconnect(); // Verbreekt de Bluetooth connectie
    // De browser triggert nu automatisch je bestaande onDisconnected() functie!
  }
}
