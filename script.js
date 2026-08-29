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
      filters: [{ name: 'DiceTower_Skull' }], 
      optionalServices: [SERVICE_UUID]
    });

    // Check of we deze toren al verbonden hebben
    if (connectedTowers.find(t => t.device.id === device.id)) {
      alert("Deze toren is al verbonden!");
      return;
    }

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const rxChar = await service.getCharacteristic(RX_CHAR_UUID);
    
    // Voeg de nieuwe toren toe aan onze lijst
    connectedTowers.push({ device: device, rxCharacteristic: rxChar });
    
    // Luister of de toren de verbinding verbreekt
    device.addEventListener('gattserverdisconnected', onDisconnected);

    updateConnectButton();
    renderTowersList(); // Zorgt dat de nieuwe toren in het lijstje verschijnt
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
  renderTowersList(); // Zorgt dat de toren uit het lijstje verdwijnt
  console.log(`Toren ontkoppeld. Nog ${connectedTowers.length} over.`);
}

// Past de tekst op je knop aan zodat je ziet hoeveel torens meedoen
function updateConnectButton() {
  const btn = document.querySelector('.btn-connect'); 
  if (btn) {
    if (connectedTowers.length === 0) {
      btn.innerText = "🔗 Connect your device";
    } else {
      btn.innerText = `🔗 Connect another (${connectedTowers.length} connected)`;
    }
  }
}

// --- NIEUW: LIJST MET TORENS GENEREREN ---
function renderTowersList() {
  const panel = document.getElementById('towers-panel');
  const list = document.getElementById('towers-list');
  
  if (!panel || !list) return;
  
  // Als er geen torens zijn, verberg het paneel
  if (connectedTowers.length === 0) {
    panel.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  
  // Anders, laat het paneel zien
  panel.style.display = 'block';
  list.innerHTML = ''; 
  
  connectedTowers.forEach((tower, index) => {
    const towerId = tower.device.id;
    const towerName = `Dice Tower #${index + 1}`; 
    
    // Voeg HTML toe voor elke verbonden toren
    list.innerHTML += `
      <div class="tower-item">
        <span>🎲 ${towerName}</span>
        <div class="tower-actions">
          <button class="btn-small btn-identify" onclick="identifyTower('${towerId}')">👁️ ID</button>
          <button class="btn-small btn-disconnect" onclick="disconnectTower('${towerId}')">❌ Disconnect</button>
        </div>
      </div>
    `;
  });
}

// --- NIEUW: DISCONNECT COMMANDO (Kruis-knop) ---
function disconnectTower(id) {
  const tower = connectedTowers.find(t => t.device.id === id);
  if (tower && tower.device.gatt.connected) {
    tower.device.gatt.disconnect(); // Verbreekt de connectie, triggert onDisconnected()
  }
}

// --- NIEUW: IDENTIFY COMMANDO (Zonder Arduino code aan te passen!) ---
async function identifyTower(id) {
  // Zoek de juiste toren in de lijst
  const tower = connectedTowers.find(t => t.device.id === id);
  if (!tower) return;
  
  try {
    const encoder = new TextEncoder();
    
    // 1. Haal de huidige instellingen op
    const savedMode = localStorage.getItem('activeMode') || 'SOLID';
    const savedColor = localStorage.getItem('diceColor') || '#FF0000';

    // 2. Forceer deze ene toren naar fel BLAUW
    await tower.rxCharacteristic.writeValue(encoder.encode("#0000FF"));
    await new Promise(r => setTimeout(r, 50)); 
    await tower.rxCharacteristic.writeValue(encoder.encode("SOLID"));

    // 3. Wacht 2 seconden in JavaScript
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Herstel de oude instellingen specifiek voor deze toren
    await tower.rxCharacteristic.writeValue(encoder.encode(savedColor.toUpperCase()));
    await new Promise(r => setTimeout(r, 50));
    await tower.rxCharacteristic.writeValue(encoder.encode(savedMode));

  } catch (error) {
    console.error("Identify mislukt:", error);
  }
}

// --- COMMANDO'S VERZENDEN NAAR DE HELE GROEP ---
async function sendCommand(command) {
  if (connectedTowers.length === 0) return; 

  if (isSending) {
    pendingCommand = command;
    return;
  }

  isSending = true;
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(command);
    
    const sendPromises = connectedTowers.map(tower => 
      tower.rxCharacteristic.writeValue(data).catch(err => console.error("Fout bij een toren:", err))
    );
    
    await Promise.all(sendPromises);
    
  } catch (error) { 
    console.error("Fout bij verzenden naar groep:", error); 
  } finally {
    isSending = false;
    
    if (pendingCommand) {
      const nextCommand = pendingCommand;
      pendingCommand = null;
      sendCommand(nextCommand);
    }
  }
}

// --- EVENT LISTENERS (Sliders & Colorpicker) ---

document.getElementById('customColor').addEventListener('input', function(e) {
  const now = Date.now();
  if (now - lastSendTime > 40) { 
    sendCommand(e.target.value.toUpperCase());
    lastSendTime = now;
  }
});
document.getElementById('customColor').addEventListener('change', (e) => {
  localStorage.setItem('diceColor', e.target.value); 
  sendCommand(e.target.value.toUpperCase());
});

document.getElementById('brightnessSlider').addEventListener('input', function(e) {
  document.getElementById('brightVal').innerText = Math.round((e.target.value / 255) * 100);
  const now = Date.now();
  if (now - lastSendTime > 40) { 
    sendCommand("BR:" + e.target.value); 
    lastSendTime = now; 
  }
});
document.getElementById('brightnessSlider').addEventListener('change', (e) => {
  localStorage.setItem('diceBright', e.target.value); 
  sendCommand("BR:" + e.target.value);
});

document.getElementById('speedSlider').addEventListener('input', function(e) {
  document.getElementById('speedVal').innerText = e.target.value;
  const now = Date.now();
  if (now - lastSendTime > 40) { 
    sendCommand("SP:" + e.target.value); 
    lastSendTime = now; 
  }
});
document.getElementById('speedSlider').addEventListener('change', (e) => {
  localStorage.setItem('diceSpeed', e.target.value); 
  sendCommand("SP:" + e.target.value);
});
