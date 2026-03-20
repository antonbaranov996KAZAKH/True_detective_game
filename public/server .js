const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= СОСТОЯНИЕ =================
let teams = {};
let gameState = {
  endTime: null
};

const STATE_FILE = path.join(__dirname, 'game-state.json');

// ================= СОХРАНЕНИЕ =================
function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    teams,
    gameState
  }, null, 2));
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    const data = JSON.parse(fs.readFileSync(STATE_FILE));
    teams = data.teams || {};
    gameState = data.gameState || { endTime: null };
  }
}

loadState();

// ================= АДРЕСА =================
const ADDRESS_FILE = path.join(__dirname, 'data', 'address.json');
let addressMap = new Map();

if (fs.existsSync(ADDRESS_FILE)) {
  const addresses = JSON.parse(fs.readFileSync(ADDRESS_FILE));
  addresses.forEach(item => {
    addressMap.set(item.address.toLowerCase().trim(), item.info);
  });
}

// ================= ЛОГИКА =================
function isGameActive() {
  return gameState.endTime && Date.now() < gameState.endTime;
}

// ================= API =================

// Логин
app.post('/api/login', (req, res) => {
  const { teamCode } = req.body;

  if (!teamCode) return res.json({ success: false });

  if (!teams[teamCode]) {
    teams[teamCode] = { tripsHistory: [] };
  }

  res.json({
    success: true,
    tripsHistory: teams[teamCode].tripsHistory
  });
});

// Поездка
app.post('/api/trip', (req, res) => {
  const { teamCode, address } = req.body;

  if (!teams[teamCode]) {
    return res.json({ success: false, info: 'Команда не найдена' });
  }

  if (!isGameActive()) {
    return res.json({ success: false, info: '⛔ Игра не запущена' });
  }

  const info = addressMap.get(address.toLowerCase().trim()) 
    || 'Ничего не найдено';

  const trip = {
    time: new Date().toLocaleTimeString(),
    address,
    info,
    timestamp: Date.now()
  };

  teams[teamCode].tripsHistory.push(trip);

  saveState();

  res.json({
    success: true,
    info,
    tripsHistory: teams[teamCode].tripsHistory
  });
});

// Статус игры
app.get('/api/status', (req, res) => {
  const active = isGameActive();

  res.json({
    active,
    timeLeft: active ? gameState.endTime - Date.now() : 0
  });
});

// ================= АДМИН =================

// старт
app.post('/api/admin/start', (req, res) => {
  const { minutes } = req.body;

  const duration = minutes * 60 * 1000;

  gameState.endTime = Date.now() + duration;

  saveState();

  res.json({ success: true });
});

// стоп
app.post('/api/admin/stop', (req, res) => {
  gameState.endTime = null;
  saveState();

  res.json({ success: true });
});

// история
app.get('/api/admin/history', (req, res) => {
  let allTrips = [];

  Object.keys(teams).forEach(team => {
    teams[team].tripsHistory.forEach(trip => {
      allTrips.push({ team, ...trip });
    });
  });

  allTrips.sort((a, b) => b.timestamp - a.timestamp);

  res.json({
    allTrips,
    totalTeams: Object.keys(teams).length
  });
});

// ================= FRONT =================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= СТАРТ =================
app.listen(PORT, () => {
  console.log('🚀 Сервер запущен на порту', PORT);
});
