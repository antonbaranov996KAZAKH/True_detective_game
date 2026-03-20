// ================= ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =================
let teamCode = '';
let tripCounter = 0;
let syncInterval = null;
let timerUpdateInterval = null;

// ================= УВЕДОМЛЕНИЯ =================
function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  if (!notification) return;
  
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';
  
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

// ================= ОБНОВЛЕНИЕ ТАЙМЕРА =================
function updateTimerDisplay() {
  fetch('/api/timer/status')
    .then(res => res.json())
    .then(data => {
      const timerDisplay = document.getElementById('timerDisplay');
      const timerValue = document.getElementById('timerValue');
      
      if (!timerDisplay || !timerValue) return;
      
      if (data.active && data.timeLeft > 0) {
        const minutes = Math.floor(data.timeLeft / 60);
        const seconds = data.timeLeft % 60;
        timerValue.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timerDisplay.className = 'timer-display active';
      } else {
        timerValue.textContent = '00:00';
        timerDisplay.className = 'timer-display inactive';
      }
    })
    .catch(err => console.warn('Ошибка обновления таймера:', err));
}

// ================= ЛОГИН =================
function login() {
  const code = document.getElementById('teamCode')?.value.trim().toUpperCase();
  const pass = document.getElementById('adminPass')?.value.trim();

  if (pass) {
    window.location.href = '/admin.html';
    return;
  }

  if (!code) {
    showNotification('Введите код команды', 'error');
    return;
  }
  
  teamCode = code;
  
  fetch('/api/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({teamCode})
  })
  .then(res => res.json())
  .then(data => {
    if(!data.success) {
      showNotification('Ошибка входа', 'error');
      return;
    }
    
    tripCounter = data.tripsHistory.length;
    document.getElementById('tripsLeft').textContent = tripCounter;
    document.getElementById('teamCodeDisplay').textContent = teamCode;
    updateHistory(data.tripsHistory);
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    
    showNotification(`Добро пожаловать, команда ${teamCode}!`, 'success');
    
    startSync();
    
    if (timerUpdateInterval) clearInterval(timerUpdateInterval);
    timerUpdateInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
  })
  .catch(err => showNotification('Ошибка связи с сервером', 'error'));
}

// ================= СИНХРОНИЗАЦИЯ =================
function startSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(syncTeamData, 3000);
}

function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (timerUpdateInterval) {
    clearInterval(timerUpdateInterval);
    timerUpdateInterval = null;
  }
}

function syncTeamData() {
  if (!teamCode) return;
  
  fetch(`/api/team/${teamCode}/sync`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const currentLength = document.getElementById('tripsHistory').children.length;
        if (data.tripsHistory.length !== currentLength) {
          updateHistory(data.tripsHistory);
          tripCounter = data.tripsHistory.length;
          document.getElementById('tripsLeft').textContent = tripCounter;
        }
      }
    })
    .catch(err => console.warn('Ошибка синхронизации:', err));
}

// ================= ПОЕЗДКА =================
function goTrip() {
  const address = document.getElementById('addressInput').value.trim();
  if(!address) {
    showNotification('❌ Введите адрес', 'error');
    return;
  }

  const goButton = document.querySelector('#main-info .input-group button:first-of-type');
  const originalText = goButton.textContent;
  goButton.disabled = true;
  goButton.textContent = '⏳ Отправка...';

  fetch('/api/timer/status')
    .then(res => res.json())
    .then(timerData => {
      if (!timerData.active || timerData.timeLeft <= 0) {
        showNotification('⏰ Игровое время не активно! Дождитесь запуска таймера.', 'error');
        throw new Error('Таймер не активен');
      }
      
      return fetch('/api/trip', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({teamCode, address})
      });
    })
    .then(res => {
      if (!res) return;
      return res.json();
    })
    .then(data => {
      if (!data) return;
      
      if(!data.success) {
        showNotification(data.info, 'error');
        return;
      }
      
      showNotification('✅ ' + (data.info.length > 100 ? data.info.substring(0, 100) + '...' : data.info), 'success');
      
      tripCounter = data.tripsHistory.length;
      const tripsEl = document.getElementById('tripsLeft');
      tripsEl.textContent = tripCounter;
      
      tripsEl.classList.remove('jump');
      void tripsEl.offsetWidth;
      tripsEl.classList.add('jump');
      
      updateHistory(data.tripsHistory);
      document.getElementById('addressInput').value = '';
      
      // Скрываем клавиатуру на мобильных
      document.getElementById('addressInput').blur();
    })
    .catch(err => {
      if (err.message !== 'Таймер не активен') {
        showNotification('❌ Ошибка связи с сервером', 'error');
      }
    })
    .finally(() => {
      goButton.disabled = false;
      goButton.textContent = originalText;
    });
}

// ================= ИСТОРИЯ =================
function updateHistory(history) {
  const ul = document.getElementById('tripsHistory');
  if (!ul) return;

  ul.innerHTML = '';

  const sortedHistory = history
    .slice(-30)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  sortedHistory.forEach((h, index) => {
    const li = document.createElement('li');
    li.style.opacity = '0';
    li.style.animation = `fadeIn 0.2s ease ${Math.min(index * 0.05, 0.5)}s forwards`;

    // Сокращаем очень длинный текст для мобильных
    let displayInfo = h.info;
    const maxLength = 300;
    if (displayInfo.length > maxLength) {
      displayInfo = displayInfo.substring(0, maxLength) + '...\n\n[Продолжение следует]';
    }
    displayInfo = displayInfo.replace(/\n/g, '<br>');

    if (!h.found && displayInfo.includes('нет информации')) {
      li.style.borderLeft = '4px solid #ff9800';
      li.style.backgroundColor = '#fff3e0';
      li.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong style="color:#ff9800;">📍 ${escapeHtml(h.address)}</strong>
        </div>
        <div style="font-size: 13px; color:#666; word-break:break-word;">${displayInfo}</div>
        <div style="font-size: 10px; color:#999; margin-top: 8px;">${escapeHtml(h.time)}</div>
      `;
    } else if (h.found) {
      li.style.borderLeft = '4px solid #4CAF50';
      li.style.backgroundColor = '#e8f5e9';
      li.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong style="color:#2196F3;">📍 ${escapeHtml(h.address)}</strong>
        </div>
        <div style="font-size: 13px; color:#333; word-break:break-word; line-height:1.5;">${displayInfo}</div>
        <div style="font-size: 10px; color:#999; margin-top: 8px;">${escapeHtml(h.time)}</div>
      `;
    } else {
      li.style.borderLeft = '4px solid #ccc';
      li.style.backgroundColor = '#ffffff';
      li.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong>${escapeHtml(h.address)}</strong>
        </div>
        <div style="font-size: 13px; color:#666; word-break:break-word;">${displayInfo}</div>
        <div style="font-size: 10px; color:#999; margin-top: 8px;">${escapeHtml(h.time)}</div>
      `;
    }

    ul.appendChild(li);
  });

  const historyBox = document.getElementById('history-box');
  if (historyBox) historyBox.scrollTop = historyBox.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ================= ВЫХОД =================
function logout() {
  stopSync();
  teamCode = '';
  tripCounter = 0;
  
  document.getElementById('game').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('teamCode').value = '';
  document.getElementById('adminPass').value = '';
  document.getElementById('addressInput').value = '';
  
  showNotification('Вы вышли из системы', 'info');
}

// ================= ИНИЦИАЛИЗАЦИЯ =================
window.addEventListener('load', () => {
  console.log('🚀 Детективная игра загружена (мобильная версия)');
  
  // Добавляем стили для анимаций если их нет
  if (!document.querySelector('#mobile-styles')) {
    const style = document.createElement('style');
    style.id = 'mobile-styles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Автофокус на поле ввода кода
  setTimeout(() => {
    const teamCodeInput = document.getElementById('teamCode');
    if (teamCodeInput) teamCodeInput.focus();
  }, 100);
});

window.addEventListener('beforeunload', () => {
  stopSync();
});
