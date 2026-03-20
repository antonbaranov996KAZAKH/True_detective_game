function updateHistory(history) {
  const ul = document.getElementById('tripsHistory');
  if (!ul) return;

  ul.innerHTML = '';

  // Показываем последние 30 поездок в хронологическом порядке
  const sortedHistory = history
    .slice(-30)
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  sortedHistory.forEach((h, index) => {
    const li = document.createElement('li');
    li.style.opacity = '0';
    li.style.animation = `fadeIn 0.2s ease ${Math.min(index * 0.05, 0.5)}s forwards`;

    // ПОЛНАЯ ИНФОРМАЦИЯ - без обрезания
    let displayInfo = h.info;
    // Заменяем переносы строк на <br> для корректного отображения
    displayInfo = displayInfo.replace(/\n/g, '<br>');

    if (!h.found && displayInfo.includes('нет информации')) {
      li.style.borderLeft = '4px solid #ff9800';
      li.style.backgroundColor = '#fff3e0';
      li.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong style="color:#ff9800; font-size: 16px;">📍 ${escapeHtml(h.address)}</strong>
        </div>
        <div style="font-size: 14px; color:#666; word-break:break-word; line-height:1.5; max-height: none; overflow: visible;">${displayInfo}</div>
        <div style="font-size: 11px; color:#999; margin-top: 12px;">🕒 ${escapeHtml(h.time)}</div>
      `;
    } else if (h.found) {
      li.style.borderLeft = '4px solid #4CAF50';
      li.style.backgroundColor = '#e8f5e9';
      li.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong style="color:#2196F3; font-size: 16px;">📍 ${escapeHtml(h.address)}</strong>
        </div>
        <div style="font-size: 14px; color:#333; word-break:break-word; line-height:1.5; max-height: none; overflow: visible;">${displayInfo}</div>
        <div style="font-size: 11px; color:#999; margin-top: 12px;">🕒 ${escapeHtml(h.time)}</div>
      `;
    } else {
      li.style.borderLeft = '4px solid #ccc';
      li.style.backgroundColor = '#ffffff';
      li.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong style="font-size: 16px;">${escapeHtml(h.address)}</strong>
        </div>
        <div style="font-size: 14px; color:#666; word-break:break-word; line-height:1.5;">${displayInfo}</div>
        <div style="font-size: 11px; color:#999; margin-top: 12px;">🕒 ${escapeHtml(h.time)}</div>
      `;
    }

    ul.appendChild(li);
  });

  // Автоскролл вниз
  const historyBox = document.getElementById('history-box');
  if (historyBox) {
    setTimeout(() => {
      historyBox.scrollTop = historyBox.scrollHeight;
    }, 100);
  }
}
