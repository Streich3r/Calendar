let currentDate = new Date();
let currentView = 'day';
const calendarEl = document.getElementById('calendar');

function setView(view) {
  currentView = view;
  renderCalendar();
}

function renderCalendar() {
  calendarEl.innerHTML = '';
  if (currentView === 'day') renderDayView();
  else if (currentView === 'week') renderWeekView();
  else if (currentView === 'month') renderMonthView();
  else if (currentView === 'year') renderYearView();
}

// DAY VIEW
function renderDayView() {
  const dayEl = document.createElement('div');
  dayEl.className = 'day today';
  dayEl.textContent = currentDate.toDateString();
  calendarEl.appendChild(dayEl);
}

// WEEK VIEW
function renderWeekView() {
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dayEl = document.createElement('div');
    dayEl.className = 'week-day' + (isToday(d) ? ' today' : '');
    dayEl.textContent = d.toDateString();
    calendarEl.appendChild(dayEl);
  }
}

// MONTH VIEW
function renderMonthView() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  calendarEl.style.gridTemplateColumns = 'repeat(7, 1fr)';

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const day = new Date(year, month, i);
    const dayEl = document.createElement('div');
    dayEl.className = 'day' + (isToday(day) ? ' today' : '');
    dayEl.textContent = i;
    calendarEl.appendChild(dayEl);
  }
}

// YEAR VIEW
function renderYearView() {
  calendarEl.className = 'month-grid';
  for (let m = 0; m < 12; m++) {
    const monthEl = document.createElement('div');
    monthEl.className = 'month-cell';
    monthEl.textContent = new Date(currentDate.getFullYear(), m, 1).toLocaleString('default', { month: 'long' });
    if (m === currentDate.getMonth()) monthEl.classList.add('today');
    calendarEl.appendChild(monthEl);
  }
}

// Helper
function isToday(d) {
  const today = new Date();
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
}

// Automatic update at midnight
setInterval(() => {
  const now = new Date();
  if (now.getDate() !== currentDate.getDate()) {
    currentDate = now;
    renderCalendar();
  }
}, 60000); // checks every minute
