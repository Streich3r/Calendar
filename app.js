/* app.js - Calendar PWA with Birthdays, Holidays & Events */

const $ = id => document.getElementById(id);

// State
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text, hour?, birthday?}, ...] }

// Elements
const views = {
  day: $('dayView'),
  week: $('weekView'),
  month: $('monthView'),
  year: $('yearView')
};
const calendarArea = $('calendarArea');
const titleEl = $('title');
const subtitleEl = $('subtitle');
const prevBtn = $('prevBtn');
const nextBtn = $('nextBtn');
const todayBtn = $('todayBtn');
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
const modal = $('eventModal');
const modalDate = $('modalDate');
const eventList = $('eventList');
const eventInput = $('eventInput');
const addEventBtn = $('addEventBtn');
const closeModalBtn = $('closeModalBtn');
const eventHourCheckbox = $('eventHourCheckbox');
const eventHourSelect = $('eventHour');
const eventBirthdayCheckbox = $('eventBirthdayCheckbox');

// Utilities
const pad = n => (n < 10 ? '0' + n : n);
function ymd(dt) { return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`; }
function formatTitle(d) { return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
function formatSubtitle(d) { return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); }

// View management
function setView(v) {
  currentView = v;
  Object.values(views).forEach(el => {
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
  });
  views[v].classList.add('active');
  views[v].setAttribute('aria-hidden', 'false');
  navBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.view === v);
    b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false');
  });
  render();
}

// Render main
function render() {
  titleEl.textContent = currentView === 'year' ? currentDate.getFullYear() : formatTitle(currentDate);
  subtitleEl.textContent = currentView === 'month' ? '' : currentView === 'day' ? formatSubtitle(currentDate) : '';
  if (currentView === 'month') renderMonth();
  else if (currentView === 'week') renderWeek();
  else if (currentView === 'day') renderDay();
  else if (currentView === 'year') renderYear();
  adjustRowHeight();
}

// Holidays
function germanHolidays(year) {
  const fixed = [
    [1, 1, "Neujahr"],
    [5, 1, "Tag der Arbeit"],
    [10, 3, "Tag der Deutschen Einheit"],
    [12, 25, "1. Weihnachtstag"],
    [12, 26, "2. Weihnachtstag"]
  ];
  const easter = calcEaster(year);
  const add = (offset, label) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + offset);
    fixed.push([d.getMonth() + 1, d.getDate(), label]);
  };
  add(1, "Ostermontag");
  add(39, "Christi Himmelfahrt");
  add(50, "Pfingstmontag");
  add(60, "Fronleichnam");
  return fixed.map(([m, d, label]) => ({ date: `${year}-${m}-${d}`, label }));
}
function calcEaster(y) {
  const f = Math.floor, a = y % 19, b = f(y / 100), c = y % 100;
  const d = f(b / 4), e = b % 4, g = f((8 * b + 13) / 25);
  const h = (19 * a + b - d - g + 15) % 30, i = f(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = f((a + 11 * h + 22 * l) / 451);
  const month = f((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

// MONTH View
function renderMonth() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y, m, 1);
  const firstDayIndex = (first.getDay() + 6) % 7;
  const lastDate = new Date(y, m + 1, 0).getDate();
  const holidays = germanHolidays(y);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let html = `<div class="weekdays">${weekdays.map(w => `<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid">`;
  for (let i = 0; i < firstDayIndex; i++) html += `<div class="day-cell empty"></div>`;

  for (let d = 1; d <= lastDate; d++) {
    const dt = new Date(y, m, d);
    const ds = `${y}-${m + 1}-${d}`;
    const today = new Date();
    const isToday = dt.toDateString() === today.toDateString();
    const holiday = holidays.find(h => h.date === ds);
    const dayEvents = events[ds] || [];
    const hasEvent = dayEvents.some(e => !e.birthday);
    const hasBirthday = dayEvents.some(e => e.birthday);

    const dots = [];
    if (holiday && !isToday) { dots.push('<div class="day-dot holiday"></div>'); }
    if (hasEvent) { dots.push('<div class="day-dot event"></div>'); }
    if (hasBirthday) { dots.push('<div class="day-dot birthday"></div>'); }
    if (holiday && isToday) { dots.push('<div class="day-dot holiday"></div>'); }

    html += `<div class="day-cell${holiday ? ' holiday' : ''}" data-date="${ds}">
               <div class="day-number ${isToday ? 'today' : ''} ${holiday ? 'holiday' : ''}">${d}</div>
               <div class="day-events">${dots.join('')}</div>
             </div>`;
  }

  html += `</div>`;
  views.month.innerHTML = html;

  document.querySelectorAll('.day-cell[data-date]').forEach(cell =>
    cell.addEventListener('click', () => openModal(cell.dataset.date))
  );
}

// WEEK View
function renderWeek() {
  const start = new Date(currentDate);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);

  let html = `<div class="week-grid"><div class="all-day-label">All Day</div>`;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
    html += `<div class="all-day-cell" data-date="${ymd(d)}"></div>`;
  }
  for (let h = 0; h < 24; h++) {
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    for (let i = 0; i < 7; i++) {
      const d = days[i];
      html += `<div class="hour-cell" data-date="${ymd(d)}" data-hour="${h}"></div>`;
    }
  }
  html += `</div>`;
  views.week.innerHTML = html;

  // Populate all-day events
  days.forEach(d => {
    const ds = ymd(d);
    const dayEvents = events[ds] || [];
    const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
    dayEvents.forEach(e => {
      const el = document.createElement('div');
      el.className = 'event';
      if (e.birthday) el.classList.add('birthday');
      el.textContent = e.text;
      if (!e.hour) container.appendChild(el);
    });
  });

  // Populate hourly events
  for (const ds in events) {
    (events[ds] || []).forEach(e => {
      if (e.hour !== undefined) {
        const cell = document.querySelector(`.hour-cell[data-date="${ds}"][data-hour="${e.hour}"]`);
        if (cell) {
          const el = document.createElement('div');
          el.className = 'event';
          if (e.birthday) el.classList.add('birthday');
          el.textContent = e.text;
          cell.appendChild(el);
        }
      }
    });
  }

  document.querySelectorAll('.hour-cell, .all-day-cell').forEach(cell =>
    cell.addEventListener('click', () => openModal(cell.dataset.date, cell.dataset.hour ? parseInt(cell.dataset.hour, 10) : undefined))
  );
}

// DAY View
function renderDay() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth(), d = currentDate.getDate();
  const ds = `${y}-${m + 1}-${d}`;
  const holidays = germanHolidays(y);
  const holiday = holidays.find(h => h.date === ds);

  let html = `<div class="day-view">`;
  html += `<div class="all-day-label">All Day</div>`;
  html += `<div class="all-day-cell" data-date="${ds}"></div>`;

  for (let h = 0; h < 24; h++) {
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    html += `<div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;

  const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
  if (holiday) {
    const el = document.createElement('div');
    el.className = 'event holiday';
    el.textContent = holiday.label;
    container.appendChild(el);
  }

  (events[ds] || []).forEach(e => {
    const el = document.createElement('div');
    el.className = 'event';
    if (e.birthday) el.classList.add('birthday');
    if (!e.hour) {
      container.appendChild(el);
      el.textContent = e.text;
    } else {
      const cell = document.querySelector(`.day-hour[data-hour="${e.hour}"]`);
      if (cell) { el.textContent = e.text; cell.appendChild(el); }
    }
  });

  document.querySelectorAll('.day-hour, .all-day-cell').forEach(cell =>
    cell.addEventListener('click', () => openModal(cell.dataset.date, cell.dataset.hour ? parseInt(cell.dataset.hour, 10) : undefined))
  );
}

// YEAR View
function renderYear() {
  const y = currentDate.getFullYear();
  const holidays = germanHolidays(y);
  let html = `<div class="year-grid">`;
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(y, m, 1);
    const monthName = monthStart.toLocaleString(undefined, { month: 'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}">
               <strong>${monthName}</strong>
               <div>${renderMiniMonth(y, m, holidays)}</div>
             </div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;
  document.querySelectorAll('.year-month').forEach(el =>
    el.addEventListener('click', () => {
      currentDate = new Date(parseInt(el.dataset.year, 10), parseInt(el.dataset.month, 10), 1);
      setView('month');
    })
  );
}

function renderMiniMonth(y, m, holidays) {
  const first = new Date(y, m, 1);
  const firstIdx = (first.getDay() + 6) % 7;
  const lastDate = new Date(y, m + 1, 0).getDate();
  let mini = '<div style="display:grid;grid-template-columns:repeat(7,1fr);font-size:11px">';
  for (let i = 0; i < firstIdx; i++) mini += '<div></div>';
  for (let d = 1; d <= lastDate; d++) {
    const ds = `${y}-${m + 1}-${d}`;
    const holiday = holidays.find(h => h.date === ds);
    const dayEvents = events[ds] || [];
    const hasEvent = dayEvents.some(e => !e.birthday);
    const hasBirthday = dayEvents.some(e => e.birthday);
    let dots = '';
    if (hasEvent) dots += `<div class="day-dot event"></div>`;
    if (hasBirthday) dots += `<div class="day-dot birthday"></div>`;
    mini += `<div style="position:relative;padding:1px;${holiday ? 'color:#e84545;font-weight:bold;' : ''}">${d}${dots}</div>`;
  }
  mini += '</div>';
  return mini;
}

// Modal
let modalOpenFor = null;
function openModal(dateStr, hour) {
  modalOpenFor = { date: dateStr, hour: hour };
  modal.classList.remove('hidden');
  modalDate.textContent = new Date(dateStr).toDateString();
  eventInput.value = '';
  renderEventList(dateStr);
  eventHourSelect.innerHTML = '';
  for (let h = 0; h < 24; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.text = `${pad(h)}:00`;
    eventHourSelect.appendChild(opt);
  }
  if (hour !== undefined) {
    eventHourCheckbox.checked = true;
    eventHourSelect.disabled = false;
    eventHourSelect.value = hour;
  } else {
    eventHourCheckbox.checked = false;
    eventHourSelect.disabled = true;
  }
  eventBirthdayCheckbox.addEventListener('change', () => {
    eventHourCheckbox.disabled = eventBirthdayCheckbox.checked;
    if (eventBirthdayCheckbox.checked) eventHourCheckbox.checked = false;
  });
}

function renderEventList(dateStr) {
  eventList.innerHTML = '';
  const [y] = dateStr.split('-').map(Number);
  const holiday = germanHolidays(y).find(h => h.date === dateStr);
  if (holiday) {
    const li = document.createElement('li');
    li.textContent = holiday.label;
    li.style.color = '#e84545';
    li.style.fontWeight = 'bold';
    eventList.appendChild(li);
  }
  (events[dateStr] || []).forEach((e, idx) => {
    const li = document.createElement('li');
    li.textContent = (e.hour !== undefined ? `${pad(e.hour)}:00 — ` : '') + e.text;
    if (e.birthday) li.textContent += ' 🎂';
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.style.cssText = 'float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', () => {
      events[dateStr].splice(idx, 1);
      if (events[dateStr].length === 0) delete events[dateStr];
      localStorage.setItem('events', JSON.stringify(events));
      renderEventList(dateStr);
      render();
    });
    li.appendChild(del);
    eventList.appendChild(li);
  });
}

addEventBtn.addEventListener('click', () => {
  const txt = eventInput.value.trim();
  if (!txt) return alert('Enter event text');
  const dateStr = modalOpenFor.date;
  const useHour = eventHourCheckbox.checked ? parseInt(eventHourSelect.value, 10) : undefined;
  if (!events[dateStr]) events[dateStr] = [];
  const ev = { text: txt };
  if (eventBirthdayCheckbox.checked) ev.birthday = true;
  if (useHour !== undefined && !eventBirthdayCheckbox.checked) ev.hour = useHour;
  events[dateStr].push(ev);
  localStorage.setItem('events', JSON.stringify(events));
  modal.classList.add('hidden');
  render();
});

closeModalBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
});

eventHourCheckbox.addEventListener('change', () => {
  eventHourSelect.disabled = !eventHourCheckbox.checked;
});

// Navigation
navBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
todayBtn.addEventListener('click', () => {
  currentDate = new Date();
  setView('month');
});

function prev() {
  if (currentView === 'day') currentDate.setDate(currentDate.getDate() - 1);
  else if (currentView === 'week') currentDate.setDate(currentDate.getDate() - 7);
  else if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
  else if (currentView === 'year') currentDate.setFullYear(currentDate.getFullYear() - 1);
  render();
}
function next() {
  if (currentView === 'day') currentDate.setDate(currentDate.getDate() + 1);
  else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + 7);
  else if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
  else if (currentView === 'year') currentDate.setFullYear(currentDate.getFullYear() + 1);
  render();
}
prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);

// Swipe
let startX = 0;
calendarArea.addEventListener('touchstart', e => (startX = e.changedTouches[0].screenX), { passive: true });
calendarArea.addEventListener('touchend', e => {
  const diff = e.changedTouches[0].screenX - startX;
  if (Math.abs(diff) > 50) diff > 0 ? prev() : next();
});

// Auto height fix
function adjustRowHeight() {
  const h = window.innerHeight - document.querySelector('.footer').offsetHeight;
  document.querySelectorAll('.view').forEach(v => (v.style.height = `${h}px`));
}

// Init
render();
