const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Создаем папку data
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Инициализация файлов
function initFiles() {
  const files = {
    'teams.json': { teams: {} },
    'trips.json': { trips: [] },
    'timer.json': { active: false, endTime: null, startTime: null, duration: 0 }
  };
  
  for (const [file, data] of Object.entries(files)) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
  }
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function getTimer() {
  const timer = readJSON('timer.json');
  if (timer.active && timer.endTime && Date.now() >= timer.endTime) {
    timer.active = false;
    writeJSON('timer.json', timer);
  }
  return timer;
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '';
  
  console.log(`${req.method} ${pathname}`);
  
  // Статические файлы
  if (req.method === 'GET') {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    
    // Проверяем существование файла
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }
  
  // API endpoints
  if (pathname === '/api/timer/status' && req.method === 'GET') {
    const timer = getTimer();
    const timeLeft = timer.active && timer.endTime ? Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000)) : 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ active: timer.active, timeLeft }));
    return;
  }
  
  if (pathname === '/api/timer/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { minutes, seconds } = JSON.parse(body);
      const totalSeconds = (minutes * 60) + seconds;
      writeJSON('timer.json', {
        active: true,
        endTime: Date.now() + (totalSeconds * 1000),
        startTime: Date.now(),
        duration: totalSeconds
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }
  
  if (pathname === '/api/timer/stop' && req.method === 'POST') {
    writeJSON('timer.json', { active: false, endTime: null, startTime: null, duration: 0 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  if (pathname === '/api/timer/reset' && req.method === 'POST') {
    writeJSON('timer.json', { active: false, endTime: null, startTime: null, duration: 0 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  if (pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { teamCode } = JSON.parse(body);
      const teams = readJSON('teams.json');
      if (!teams.teams[teamCode]) {
        teams.teams[teamCode] = { name: `Команда ${teamCode}`, createdAt: new Date().toISOString() };
        writeJSON('teams.json', teams);
      }
      const trips = readJSON('trips.json');
      const teamTrips = trips.trips.filter(t => t.team === teamCode);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tripsHistory: teamTrips }));
    });
    return;
  }
  
  if (pathname.match(/^\/api\/team\/.+\/sync$/) && req.method === 'GET') {
    const teamCode = pathname.split('/')[3];
    const trips = readJSON('trips.json');
    const teamTrips = trips.trips.filter(t => t.team === teamCode);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, tripsHistory: teamTrips }));
    return;
  }
  
  if (pathname === '/api/trip' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { teamCode, address } = JSON.parse(body);
      const timer = getTimer();
      
      if (!timer.active) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, info: '⏰ Игровое время не активно!' }));
        return;
      }
      
      const results = ['Нашли важную улику!', 'Поговорили со свидетелем', 'Ничего интересного', 'Нашли секретный документ!'];
      const randomResult = results[Math.floor(Math.random() * results.length)];
      
      const trips = readJSON('trips.json');
      const newTrip = {
        team: teamCode,
        address: address,
        info: `${address} - ${randomResult}`,
        time: new Date().toLocaleString('ru-RU')
      };
      trips.trips.push(newTrip);
      writeJSON('trips.json', trips);
      
      const teamTrips = trips.trips.filter(t => t.team === teamCode);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, info: randomResult, tripsHistory: teamTrips }));
    });
    return;
  }
  
  if (pathname === '/api/admin/history' && req.method === 'GET') {
    const trips = readJSON('trips.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ allTrips: trips.trips }));
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('File not found');
});

initFiles();
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Данные хранятся в ${DATA_DIR}`);
  console.log(`🎮 Игра доступна по адресу: http://localhost:${PORT}/index.html`);
  console.log(`👑 Админка: http://localhost:${PORT}/admin.html`);
});
