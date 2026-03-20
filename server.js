const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

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
    fs.writeFileSync(TEAMS_FILE, JSON.stringify({
      teams: {}
    }, null, 2));
  }
  
  if (!fs.existsSync(TRIPS_FILE)) {
    fs.writeFileSync(TRIPS_FILE, JSON.stringify({
      trips: []
    }, null, 2));
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
  
  // Проверяем, не истек ли активный таймер
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

// Получить историю поездок команды
function getTeamTrips(teamCode) {
  const tripsData = getTrips();
  return tripsData.trips.filter(trip => trip.team === teamCode);
}

// Добавить поездку
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

// ========== API ЭНДПОИНТЫ ==========

// Статус таймера
app.get('/api/timer/status', (req, res) => {
  const timer = getTimer();
  if (timer.active && timer.endTime) {
    const timeLeft = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
    res.json({
      active: true,
      timeLeft: timeLeft
    });
  } else {
    res.json({
      active: false,
      timeLeft: 0
    });
  }
});

// Запуск таймера
app.post('/api/timer/start', (req, res) => {
  const { minutes, seconds } = req.body;
  const totalSeconds = (minutes * 60) + seconds;
  
  if (totalSeconds <= 0) {
    return res.status(400).json({ success: false, error: 'Неверное время' });
  }
  
  const timerData = {
    active: true,
    endTime: Date.now() + (totalSeconds * 1000),
    startTime: Date.now(),
    duration: totalSeconds
  };
  
  saveTimer(timerData);
  res.json({ success: true });
});

// Остановка таймера
app.post('/api/timer/stop', (req, res) => {
  const timerData = {
    active: false,
    endTime: null,
    startTime: null,
    duration: 0
  };
  saveTimer(timerData);
  res.json({ success: true });
});

// Сброс таймера
app.post('/api/timer/reset', (req, res) => {
  const timerData = {
    active: false,
    endTime: null,
    startTime: null,
    duration: 0
  };
  saveTimer(timerData);
  res.json({ success: true });
});

// Логин команды
app.post('/api/login', (req, res) => {
  const { teamCode } = req.body;
  const teams = getTeams();
  
  // Если команда не существует, создаем её
  if (!teams.teams[teamCode]) {
    teams.teams[teamCode] = {
      name: `Команда ${teamCode}`,
      createdAt: new Date().toISOString()
    };
    saveTeams(teams);
  }
  
  const tripsHistory = getTeamTrips(teamCode);
  res.json({
    success: true,
    tripsHistory: tripsHistory
  });
});

// Синхронизация данных команды
app.get('/api/team/:teamCode/sync', (req, res) => {
  const { teamCode } = req.params;
  const tripsHistory = getTeamTrips(teamCode);
  res.json({
    success: true,
    tripsHistory: tripsHistory
  });
});

// Совершить поездку
app.post('/api/trip', async (req, res) => {
  const { teamCode, address } = req.body;
  
  if (!teamCode || !address) {
    return res.status(400).json({ success: false, info: 'Неверные данные' });
  }
  
  // ПРОВЕРКА ТАЙМЕРА
  const timer = getTimer();
  if (!timer.active) {
    return res.status(403).json({ 
      success: false, 
      info: '⏰ Игровое время не активно! Дождитесь запуска таймера администратором.' 
    });
  }
  
  const timeLeft = Math.floor((timer.endTime - Date.now()) / 1000);
  if (timeLeft <= 0) {
    return res.status(403).json({ 
      success: false, 
      info: '⏰ Время вышло! Игра остановлена.' 
    });
  }
  
  // Генерация случайного результата поездки
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
  const updatedHistory = addTrip(teamCode, address, tripInfo);
  
  res.json({
    success: true,
    info: tripInfo,
    tripsHistory: updatedHistory
  });
});

// Получить всю историю (для админа)
app.get('/api/admin/history', (req, res) => {
  const tripsData = getTrips();
  res.json({
    allTrips: tripsData.trips
  });
});

// Админский вход
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = 'admin123'; // Смените на свой пароль
  
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Неверный пароль' });
  }
});

// ========== ЗАПУСК СЕРВЕРА ==========
initDataFiles();

app.listen(PORT, () => {
  console.log(`
  🚀 Сервер запущен на http://localhost:${PORT}
  📁 Данные хранятся в папке /data
  ⏱ Таймер активен
  🔑 Админ пароль: admin123
  `);
});
