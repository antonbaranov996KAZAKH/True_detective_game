const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Пути к JSON файлам
const DATA_DIR = path.join(__dirname, 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const TRIPS_FILE = path.join(DATA_DIR, 'trips.json');
const TIMER_FILE = path.join(DATA_DIR, 'timer.json');

// Создаем папку data если её нет
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// ========== ИНИЦИАЛИЗАЦИЯ ФАЙЛОВ ==========
function initDataFiles() {
  if (!fs.existsSync(TEAMS_FILE)) {
    fs.writeFileSync(TEAMS_FILE, JSON.stringify({ teams: {} }, null, 2));
  }
  
  if (!fs.existsSync(TRIPS_FILE)) {
    fs.writeFileSync(TRIPS_FILE, JSON.stringify({ trips: [] }, null, 2));
  }
  
  if (!fs.existsSync(TIMER_FILE)) {
    fs.writeFileSync(TIMER_FILE, JSON.stringify({
      active: false,
      endTime: null,
      startTime: null,
      duration: 0
    }, null, 2));
  }
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ДАННЫМИ ==========
function getTeams() {
  const data = fs.readFileSync(TEAMS_FILE, 'utf8');
  return JSON.parse(data);
}

function getTrips() {
  const data = fs.readFileSync(TRIPS_FILE, 'utf8');
  return JSON.parse(data);
}

function getTimer() {
  const data = fs.readFileSync(TIMER_FILE, 'utf8');
  const timer = JSON.parse(data);
  
  if (timer.active && timer.endTime) {
    const now = Date.now();
    if (now >= timer.endTime) {
      timer.active = false;
      saveTimer(timer);
    }
  }
  
  return timer;
}

function saveTeams(teamsData) {
  fs.writeFileSync(TEAMS_FILE, JSON.stringify(teamsData, null, 2));
}

function saveTrips(tripsData) {
  fs.writeFileSync(TRIPS_FILE, JSON.stringify(tripsData, null, 2));
}

function saveTimer(timerData) {
  fs.writeFileSync(TIMER_FILE, JSON.stringify(timerData, null, 2));
}

function getTeamTrips(teamCode) {
  const tripsData = getTrips();
  return tripsData.trips.filter(trip => trip.team === teamCode);
}

function addTrip(teamCode, address, info) {
  const tripsData = getTrips();
  const newTrip = {
    team: teamCode,
    address: address,
    info: info,
    time: new Date().toLocaleString('ru-RU')
  };
  tripsData.trips.push(newTrip);
  saveTrips(tripsData);
  return getTeamTrips(teamCode);
}

// ========== ОБРАБОТЧИК ЗАПРОСОВ ==========
const server = http.createServer((req, res) => {
  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Обработка статических файлов
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.php' || pathname === '/admin.php' || pathname === '/game.js' || pathname === '/style.css')) {
    let filePath = pathname === '/' ? '/index.php' : pathname;
    filePath = path.join(__dirname, filePath);
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      
      let contentType = 'text/html';
      if (filePath.endsWith('.js')) contentType = 'application/javascript';
      if (filePath.endsWith('.css')) contentType = 'text/css';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
    return;
  }
  
  // API endpoints
  if (pathname === '/api/timer/status' && req.method === 'GET') {
    const timer = getTimer();
    if (timer.active && timer.endTime) {
      const timeLeft = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ active: true, timeLeft: timeLeft }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ active: false, timeLeft: 0 }));
    }
    return;
  }
  
  if (pathname === '/api/timer/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { minutes, seconds } = JSON.parse(body);
      const totalSeconds = (minutes * 60) + seconds;
      
      if (totalSeconds <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неверное время' }));
        return;
      }
      
      const timerData = {
        active: true,
        endTime: Date.now() + (totalSeconds * 1000),
        startTime: Date.now(),
        duration: totalSeconds
      };
      
      saveTimer(timerData);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }
  
  if (pathname === '/api/timer/stop' && req.method === 'POST') {
    const timerData = {
      active: false,
      endTime: null,
      startTime: null,
      duration: 0
    };
    saveTimer(timerData);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  if (pathname === '/api/timer/reset' && req.method === 'POST') {
    const timerData = {
      active: false,
      endTime: null,
      startTime: null,
      duration: 0
    };
    saveTimer(timerData);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  if (pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { teamCode } = JSON.parse(body);
      const teams = getTeams();
      
      if (!teams.teams[teamCode]) {
        teams.teams[teamCode] = {
          name: `Команда ${teamCode}`,
          createdAt: new Date().toISOString()
        };
        saveTeams(teams);
      }
      
      const tripsHistory = getTeamTrips(teamCode);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tripsHistory: tripsHistory }));
    });
    return;
  }
  
  if (pathname.match(/^\/api\/team\/.+\/sync$/) && req.method === 'GET') {
    const teamCode = pathname.split('/')[3];
    const tripsHistory = getTeamTrips(teamCode);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, tripsHistory: tripsHistory }));
    return;
  }
  
  if (pathname === '/api/trip' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { teamCode, address } = JSON.parse(body);
      
      if (!teamCode || !address) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, info: 'Неверные данные' }));
        return;
      }
      
      // ПРОВЕРКА ТАЙМЕРА
      const timer = getTimer();
      if (!timer.active) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          info: '⏰ Игровое время не активно! Дождитесь запуска таймера администратором.' 
        }));
        return;
      }
      
      const timeLeft = Math.floor((timer.endTime - Date.now()) / 1000);
      if (timeLeft <= 0) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          info: '⏰ Время вышло! Игра остановлена.' 
        }));
        return;
      }
      
      const results = [
        'Нашли важную улику! +10 очков',
        'Поговорили со свидетелем, получили новую информацию',
        'Ничего интересного, но опыт получен',
        'Нашли секретный документ!',
        'Встретили подозрительного человека'
      ];
      
      const randomResult = results[Math.floor(Math.random() * results.length)];
      const tripInfo = `${address} - ${randomResult}`;
      
      const updatedHistory = addTrip(teamCode, address, tripInfo);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        info: tripInfo,
        tripsHistory: updatedHistory
      }));
    });
    return;
  }
  
  if (pathname === '/api/admin/history' && req.method === 'GET') {
    const tripsData = getTrips();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ allTrips: tripsData.trips }));
    return;
  }
  
  // 404 для всех остальных запросов
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ========== ЗАПУСК СЕРВЕРА ==========
initDataFiles();

server.listen(PORT, () => {
  console.log(`
  🚀 Сервер запущен на http://localhost:${PORT}
  📁 Данные хранятся в папке /data
  ⏱ Таймер активен
  `);
});
