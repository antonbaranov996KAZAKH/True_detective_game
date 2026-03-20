const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Пути к папкам и файлам
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

// Файлы данных
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const TRIPS_FILE = path.join(DATA_DIR, 'trips.json');
const TIMER_FILE = path.join(DATA_DIR, 'timer.json');

// Создаем папки если их нет
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// ========== ИНИЦИАЛИЗАЦИЯ ФАЙЛОВ ==========
function initDataFiles() {
  // teams.json
  if (!fs.existsSync(TEAMS_FILE)) {
    fs.writeFileSync(TEAMS_FILE, JSON.stringify({ teams: {} }, null, 2));
  }
  
  // trips.json
  if (!fs.existsSync(TRIPS_FILE)) {
    fs.writeFileSync(TRIPS_FILE, JSON.stringify({ trips: [] }, null, 2));
  }
  
  // timer.json
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
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Ошибка чтения ${filePath}:`, err);
    return {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getTimer() {
  const timer = readJSON(TIMER_FILE);
  if (timer.active && timer.endTime && Date.now() >= timer.endTime) {
    timer.active = false;
    writeJSON(TIMER_FILE, timer);
  }
  return timer;
}

// ========== СОЗДАЕМ СЕРВЕР ==========
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
  
  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '';
  
  console.log(`${req.method} ${pathname}`);
  
  // ========== СТАТИЧЕСКИЕ ФАЙЛЫ ИЗ ПАПКИ PUBLIC ==========
  if (req.method === 'GET') {
    // Определяем какой файл запрошен
    let filePath;
    
    if (pathname === '/' || pathname === '/index.html') {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    } else if (pathname === '/admin.html') {
      filePath = path.join(PUBLIC_DIR, 'admin.html');
    } else if (pathname === '/game.js') {
      filePath = path.join(PUBLIC_DIR, 'game.js');
    } else if (pathname === '/script.js') {
      filePath = path.join(PUBLIC_DIR, 'script.js');
    } else if (pathname === '/style.css') {
      filePath = path.join(PUBLIC_DIR, 'style.css');
    } else {
      // Пытаемся найти файл в public
      filePath = path.join(PUBLIC_DIR, pathname);
    }
    
    // Проверяем существует ли файл
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }
  
  // ========== API ЭНДПОИНТЫ ==========
  
  // Статус таймера
  if (pathname === '/api/timer/status' && req.method === 'GET') {
    const timer = getTimer();
    const timeLeft = timer.active && timer.endTime 
      ? Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000)) 
      : 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ active: timer.active, timeLeft }));
    return;
  }
  
  // Запуск таймера
  if (pathname === '/api/timer/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
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
        
        writeJSON(TIMER_FILE, timerData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }
  
  // Остановка таймера
  if (pathname === '/api/timer/stop' && req.method === 'POST') {
    writeJSON(TIMER_FILE, {
      active: false,
      endTime: null,
      startTime: null,
      duration: 0
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  // Сброс таймера
  if (pathname === '/api/timer/reset' && req.method === 'POST') {
    writeJSON(TIMER_FILE, {
      active: false,
      endTime: null,
      startTime: null,
      duration: 0
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  // Логин команды
  if (pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { teamCode } = JSON.parse(body);
        const teams = readJSON(TEAMS_FILE);
        
        if (!teams.teams[teamCode]) {
          teams.teams[teamCode] = {
            name: `Команда ${teamCode}`,
            createdAt: new Date().toISOString()
          };
          writeJSON(TEAMS_FILE, teams);
        }
        
        const trips = readJSON(TRIPS_FILE);
        const teamTrips = trips.trips.filter(t => t.team === teamCode);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tripsHistory: teamTrips }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }
  
  // Синхронизация команды
  if (pathname.match(/^\/api\/team\/.+\/sync$/) && req.method === 'GET') {
    const teamCode = pathname.split('/')[3];
    const trips = readJSON(TRIPS_FILE);
    const teamTrips = trips.trips.filter(t => t.team === teamCode);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, tripsHistory: teamTrips }));
    return;
  }
  
  // Совершить поездку
  if (pathname === '/api/trip' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { teamCode, address } = JSON.parse(body);
        const timer = getTimer();
        
        // Проверка таймера
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
        
        // Результаты поездки
        const results = [
          'Нашли важную улику! +10 очков',
          'Поговорили со свидетелем, получили новую информацию',
          'Ничего интересного, но опыт получен',
          'Нашли секретный документ!',
          'Встретили подозрительного человека'
        ];
        
        const randomResult = results[Math.floor(Math.random() * results.length)];
        const tripInfo = `${address} - ${randomResult}`;
        
        // Сохраняем поездку
        const trips = readJSON(TRIPS_FILE);
        const newTrip = {
          team: teamCode,
          address: address,
          info: tripInfo,
          time: new Date().toLocaleString('ru-RU')
        };
        trips.trips.push(newTrip);
        writeJSON(TRIPS_FILE, trips);
        
        const teamTrips = trips.trips.filter(t => t.team === teamCode);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          info: randomResult,
          tripsHistory: teamTrips
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }
  
  // История всех поездок (для админа)
  if (pathname === '/api/admin/history' && req.method === 'GET') {
    const trips = readJSON(TRIPS_FILE);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ allTrips: trips.trips }));
    return;
  }
  
  // 404 - файл не найден
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('File not found');
});

// ========== ЗАПУСК СЕРВЕРА ==========
initDataFiles();

server.listen(PORT, () => {
  console.log(`
  🚀 Сервер запущен на порту ${PORT}
  📁 Статические файлы: ${PUBLIC_DIR}
  📁 Данные хранятся в: ${DATA_DIR}
  🎮 Игра: http://localhost:${PORT}/
  👑 Админка: http://localhost:${PORT}/admin.html
  `);
});
