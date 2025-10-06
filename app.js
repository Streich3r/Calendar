const $ = id => document.getElementById(id);

// State
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}');

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
const pad = n => (n < 10 ? '0' : '') + n;
function ymd(dt) {
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}
function formatTitle(d) {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function formatSubtitle(d) {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// Easter & German Holidays
function germanHolidays(year) {
  const dates = [
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
    dates.push([d.getMonth() + 1, d.getDate(), label]);
  };
  add(1, "Ostermontag");
  add(39, "Christi Himmelfahrt");
  add(50, "Pfingstmontag");
  add(60, "Fronleichnam");
  return dates.map(([m, d, label]) => ({ date: `${year}-${m}-${d}`, label }));
}
function calcEaster(y) {
  const f = Math.floor;
  const a = y % 19, b = f(y / 100), c = y % 100, d = f(b / 4), e = b % 4;
  const g = f((8 * b + 13) / 25), h = (19 * a + b - d - g + 15) % 30;
  const i = f(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = f((a + 11 * h + 22 * l) / 451);
  const month = f((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

// Birthday helpers
function getBirthdaysForDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Object.values(events)
    .flat()
    .filter(e => e.birthday && parseInt(e.month) === m && parseInt(e.day) === d);
}
function getEventsForDateKey(key) {
  return events[key] || [];
}

// View switching
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

// Render entry
function render() {
  titleEl.textContent = (currentView === 'year') ? currentDate.getFullYear() : formatTitle(currentDate);
  subtitleEl.textContent = (currentView === 'month') ? '' : (currentView === 'day' ? formatSubtitle(currentDate) : '');
  if (currentView === 'month') renderMonth();
  else if (currentView === 'week') renderWeek();
  else if (currentView === 'day') renderDay();
  else if (currentView === 'year') renderYear();
  adjustRowHeight();
}

// Month
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
    const isToday = dt.toDateString() === new Date().toDateString();
    const holiday = holidays.find(h => h.date === ds);
    const normalEvents = getEventsForDateKey(ds).filter(ev => !ev.birthday);
    const birthdays = getBirthdaysForDateKey(ds);

    let dots = '';
    if (normalEvents.length) dots += `<div class="day-dot event"></div>`;
    if (birthdays.length) dots += `<div class="day-dot birthday"></div>`;

    const numberClass = holiday ? 'holiday' : '';
    html += `<div class="day-cell" data-date="${ds}" ${holiday ? `title="${holiday.label}"` : ''}>
      <div class="day-number ${isToday ? 'today' : numberClass}">${d}</div>
      <div class="day-events">${dots}</div>
    </div>`;
  }

  const totalCells = firstDayIndex + lastDate;
  const rem = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < rem; i++) html += `<div class="day-cell empty"></div>`;
  html += `</div>`;
  views.month.innerHTML = html;

  document.querySelectorAll('.day-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => openModal(cell.dataset.date));
  });
}

// Week
function renderWeek() {
  const start = new Date(currentDate);
  const dayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayIndex);
  const days = [];

  let html = `<div class="week-grid"><div></div>`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
    html += `<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}<br>${d.getDate()}</div>`;
  }

  for (let h = 0; h < 24; h++) {
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    for (let i = 0; i < 7; i++) {
      const d = days[i];
      const ds = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      html += `<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
    }
  }

  html += `</div>`;
  views.week.innerHTML = html;

  for (const ds in events) {
    (events[ds] || []).forEach(ev => {
      const sel = `.hour-cell[data-date="${ds}"]`;
      const cell = document.querySelector(sel);
      if (cell) {
        const el = document.createElement('div');
        el.className = 'event';
        if (ev.birthday) el.classList.add('birthday');
        el.textContent = ev.text;
        cell.appendChild(el);
      }
    });
  }

  document.querySelectorAll('.hour-cell').forEach(cell => {
    cell.addEventListener('click', () => openModal(cell.dataset.date, parseInt(cell.dataset.hour, 10)));
  });
}

// Day
function renderDay() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth(), d = currentDate.getDate();
  const ds = `${y}-${m + 1}-${d}`;
  let html = `<div style="display:grid;grid-template-columns:60px 1fr">`;
  for (let h = 0; h < 24; h++) {
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    html += `<div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;

  (events[ds] || []).forEach(ev => {
    const hour = ev.hour !== undefined ? ev.hour : 0;
    const cell = document.querySelector(`.day-hour[data-hour="${hour}"]`);
    if (cell) {
      const el = document.createElement('div');
      el.className = 'event';
      if (ev.birthday) el.classList.add('birthday');
      el.textContent = ev.text;
      cell.appendChild(el);
    }
  });

  document.querySelectorAll('.day-hour').forEach(cell => {
    cell.addEventListener('click', () => openModal(ds, parseInt(cell.dataset.hour, 10)));
  });
}

// Year
function renderYear() {
  const y = currentDate.getFullYear();
  let html = `<div class="year-grid">`;
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(y, m, 1);
    const monthName = monthStart.toLocaleString(undefined, { month: 'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}">
      <strong>${monthName}</strong>
      <div style="font-size:12px;margin-top:6px">${renderMiniMonth(y, m)}</div>
    </div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;

  document.querySelectorAll('.year-month').forEach(el => {
    el.addEventListener('click', () => {
      const yy = parseInt(el.dataset.year, 10);
      const mm = parseInt(el.dataset.month, 10);
      currentDate = new Date(yy, mm, 1);
      setView('month');
    });
  });
}

function renderMiniMonth(y, m) {
  const first = new Date(y, m, 1);
  const firstIdx = (first.getDay() + 6) % 7;
  const lastDate = new Date(y, m + 1, 0).getDate();
  const holidays = germanHolidays(y);
  let mini = '<div style="display:grid;grid-template-columns:repeat(7,1fr);font-size:11px;">';
  for (let i = 0; i < firstIdx; i++) mini += `<div></div>`;
  for (let d = 1; d <= lastDate; d++) {
    const ds = `${y}-${m + 1}-${d}`;
    const hol = holidays.find(h => h.date === ds);
    const style = hol ? 'style="color: var(--holiday); font-weight: bold;"' : '';
    mini += `<div ${style}>${d}</div>`;
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
  eventHourSelect.innerHTML = '';
  renderEventList(dateStr);

  for (let h = 0; h < 24; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.text = `${pad(h)}:00`;
    eventHourSelect.appendChild(opt);
  }

  eventBirthdayCheckbox.checked = false;
  eventHourCheckbox.checked = false;
  eventHourSelect.disabled = true;
}

function renderEventList(dateStr) {
  eventList.innerHTML = '';
  const y = parseInt(dateStr.split('-')[0], 10);
  const holiday = germanHolidays(y).find(h => h.date === dateStr);

  if (holiday) {
    const li = document.createElement('li');
    li.textContent = `${holiday.label}`;
    li.style.color = '#e84545';
    li.style.fontWeight = 'bold';
    eventList.appendChild(li);
  }

  (events[dateStr] || []).forEach((e, idx) => {
    const li = document.createElement('li');
    li.textContent = e.hour !== undefined ? `${pad(e.hour)}:00 — ${e.text}` : e.text;
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

  if (!events[dateStr]) events[dateStr] = [];

  const ev = { text: txt };

  if (eventBirthdayCheckbox.checked) {
    const [y, m, d] = dateStr.split('-').map(Number);
    ev.birthday = true;
    ev.month = m;
    ev.day = d;
  } else if (eventHourCheckbox.checked) {
    ev.hour = parseInt(eventHourSelect.value, 10);
  }

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

eventBirthdayCheckbox.addEventListener('change', () => {
  if (eventBirthdayCheckbox.checked) {
    eventHourCheckbox.disabled = true;
    eventHourSelect.disabled = true;
    eventHourCheckbox.checked = false;
  } else {
    eventHourCheckbox.disabled = false;
  }
});

// Navigation
navBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
todayBtn.addEventListener('click', () => { currentDate = new Date(); setView('month'); });
prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);

function prev() {
  if (currentView === 'day') currentDate.setDate(currentDate.getDate() - 1);
  else if (currentView === 'week') currentDate.setDate(currentDate.getDate() - 7);
  else if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
  else currentDate.setFullYear(currentDate.getFullYear() - 1);
  render();
}
function next() {
  if (currentView === 'day') currentDate.setDate(currentDate.getDate() + 1);
  else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + 7);
  else if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
  else currentDate.setFullYear(currentDate.getFullYear() + 1);
  render();
}

// Swipe
let touchStartX = 0;
let touchEndX = 0;
calendarArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; });
calendarArea.addEventListener('touchend', e => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); });
function handleSwipe() {
  const dx = touchEndX - touchStartX;
  if (Math.abs(dx) > 40) {
    if (dx > 0) prev(); else next();
  }
}

// Adjust row height dynamically
function adjustRowHeight() {
  const footer = document.querySelector('.footer');
  const vh = window.innerHeight - footer.offsetHeight;
  const grid = document.querySelector('.month-grid');
  if (grid) {
    const rows = Math.ceil(grid.children.length / 7);
    grid.style.setProperty('--row-height', `${(vh - 34) / rows}px`);
  }
}

window.addEventListener('resize', adjustRowHeight);
render();
