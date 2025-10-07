/* app.js – Modern Calendar PWA
   Features:
   - Views: Day / Week / Month / Year
   - LocalStorage events
   - Birthdays (yearly recurring)
   - German holidays
   - Swipe navigation
   - Today button
*/

const $ = id => document.getElementById(id);

// ==== STATE ====
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [ {text, hour?, birthday?}, ... ] }

// ==== ELEMENTS ====
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

// ==== UTILITIES ====
const pad = n => (n < 10 ? '0' : '') + n;
const ymd = dt => `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;

function formatTitle(d) {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function formatSubtitle(d) {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// ==== HOLIDAYS ====
function germanHolidays(year) {
  const dates = [
    [1, 1, "Neujahr"],
    [5, 1, "Tag der Arbeit"],
    [10, 3, "Tag der Deutschen Einheit"],
    [12, 25, "1. Weihnachtstag"],
    [12, 26, "2. Weihnachtstag"]
  ];

  // Berechne Ostern + abhängige Feiertage
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

  return dates.map(([m, d, label]) => ({
    date: `${year}-${m}-${d}`,
    label
  }));
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

// ==== VIEW MANAGEMENT ====
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

function render() {
  titleEl.textContent = (currentView === 'year') ? currentDate.getFullYear() : formatTitle(currentDate);
  subtitleEl.textContent = (currentView === 'month') ? '' :
    (currentView === 'day' ? formatSubtitle(currentDate) : '');
  if (currentView === 'month') renderMonth();
  else if (currentView === 'week') renderWeek();
  else if (currentView === 'day') renderDay();
  else if (currentView === 'year') renderYear();
  adjustRowHeight();
}

// ==== MONTH VIEW ====
function renderMonth() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y, m, 1);
  const firstDayIndex = (first.getDay() + 6) % 7; // Montag = 0
  const lastDate = new Date(y, m + 1, 0).getDate();
  const holidays = germanHolidays(y);

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let html = `<div class="weekdays">${weekdays.map(w => `<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid" id="monthGrid">`;

  // leere Felder vor dem ersten Tag
  for (let i = 0; i < firstDayIndex; i++) html += `<div class="day-cell empty"></div>`;

  // Tage rendern
  for (let d = 1; d <= lastDate; d++) {
    const dt = new Date(y, m, d);
    const isToday = dt.toDateString() === (new Date()).toDateString();
    const ds = `${y}-${m + 1}-${d}`;
    const hasEvents = events[ds] && events[ds].length > 0;

    const holiday = holidays.find(h => h.date === ds);
    const dots = [];

    if (hasEvents) (events[ds] || []).forEach(ev => {
      if (ev.birthday) dots.push('<div class="day-dot birthday"></div>');
      else dots.push('<div class="day-dot event"></div>');
    });
    if (holiday) dots.push('<div class="day-dot holiday"></div>');

    html += `<div class="day-cell${holiday ? ' holiday' : ''}" data-date="${ds}" ${holiday ? `title="${holiday.label}"` : ''}>
      <div class="day-number ${isToday ? 'today' : ''} ${holiday ? 'holiday' : ''}">${d}</div>
      <div class="day-events">${dots.join('')}</div>
    </div>`;
  }

  // trailing blanks
  const totalCells = firstDayIndex + lastDate;
  const rem = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < rem; i++) html += `<div class="day-cell empty"></div>`;
  html += `</div>`;

  views.month.innerHTML = html;

  document.querySelectorAll('.day-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => openModal(cell.dataset.date));
  });
}

// ==== YEAR VIEW ====
function renderYear() {
  const y = currentDate.getFullYear();
  let html = `<div class="year-grid">`;
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(y, m, 1);
    const name = monthStart.toLocaleString(undefined, { month: 'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}">
      <strong>${name}</strong>
      <div style="font-size:11px;margin-top:4px">${renderMiniMonth(y, m)}</div>
    </div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;

  document.querySelectorAll('.year-month').forEach(el => {
    el.addEventListener('click', () => {
      const yy = parseInt(el.dataset.year), mm = parseInt(el.dataset.month);
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
  let mini = '<div style="display:grid;grid-template-columns:repeat(7,1fr);font-size:11px">';
  for (let i = 0; i < firstIdx; i++) mini += `<div></div>`;
  for (let d = 1; d <= lastDate; d++) {
    const ds = `${y}-${m + 1}-${d}`;
    const holiday = holidays.find(h => h.date === ds);
    mini += `<div class="year-day${holiday ? ' holiday' : ''}">
      <span class="${holiday ? 'holiday' : ''}">${d}</span>
    </div>`;
  }
  mini += '</div>';
  return mini;
}

// ==== DAY & WEEK VIEWS ====
function renderWeek() {
  const start = new Date(currentDate);
  const dayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayIndex);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  let html = `<div class="week-grid">`;
  html += `<div class="all-day-label">All Day</div>`;
  days.forEach(() => html += `<div class="all-day-cell"></div>`);

  for (let h = 0; h < 24; h++) {
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    days.forEach(d => {
      const ds = ymd(d);
      html += `<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
    });
  }
  html += `</div>`;
  views.week.innerHTML = html;
  fillWeekEvents(days);
}

function fillWeekEvents(days) {
  days.forEach(d => {
    const ds = ymd(d);
    (events[ds] || []).forEach(ev => {
      if (ev.hour !== undefined) {
        const sel = `.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`;
        const cell = document.querySelector(sel);
        if (cell) {
          const e = document.createElement('div');
          e.className = `event ${ev.birthday ? 'birthday' : ''}`;
          e.textContent = ev.text;
          cell.appendChild(e);
        }
      } else {
        const idx = days.findIndex(x => ymd(x) === ds);
        const cell = document.querySelectorAll('.all-day-cell')[idx];
        if (cell) {
          const bar = document.createElement('div');
          bar.className = `event-bar ${ev.birthday ? 'birthday' : ev.holiday ? 'holiday' : ''}`;
          bar.textContent = ev.text.length > 10 ? ev.text.slice(0, 8) + '…' : ev.text;
          cell.appendChild(bar);
        }
      }
    });
  });
}

function renderDay() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth(), d = currentDate.getDate();
  const ds = `${y}-${m + 1}-${d}`;
  let html = `<div class="day-grid">`;
  html += `<div class="all-day-label">All Day</div><div class="all-day-cell" data-date="${ds}"></div>`;
  for (let h = 0; h < 24; h++) {
    html += `<div class="hour-label">${pad(h)}:00</div><div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;

  (events[ds] || []).forEach(ev => {
    if (ev.hour !== undefined) {
      const cell = document.querySelector(`.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if (cell) {
        const e = document.createElement('div');
        e.className = `event ${ev.birthday ? 'birthday' : ''}`;
        e.textContent = ev.text;
        cell.appendChild(e);
      }
    } else {
      const cell = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
      if (cell) {
        const e = document.createElement('div');
        e.className = `event-bar ${ev.birthday ? 'birthday' : ev.holiday ? 'holiday' : ''}`;
        e.textContent = ev.text.length > 12 ? ev.text.slice(0, 10) + '…' : ev.text;
        cell.appendChild(e);
      }
    }
  });
}

// ==== MODAL ====
let modalOpenFor = null;
function openModal(dateStr, hour) {
  modalOpenFor = { date: dateStr, hour };
  modal.classList.remove('hidden');
  modalDate.textContent = new Date(dateStr).toDateString() + (hour !== undefined ? ` ${pad(hour)}:00` : '');
  eventInput.value = '';
  eventBirthdayCheckbox.checked = false;
  eventHourCheckbox.checked = hour !== undefined;
  eventHourSelect.disabled = !eventHourCheckbox.checked;
  eventHourSelect.innerHTML = Array.from({ length: 24 }, (_, i) => `<option value="${i}">${pad(i)}:00</option>`).join('');
  if (hour !== undefined) eventHourSelect.value = hour;
  renderEventList(dateStr);
}

function renderEventList(dateStr) {
  eventList.innerHTML = "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const holiday = germanHolidays(y).find(h => h.date === dateStr);
  if (holiday) {
    const li = document.createElement("li");
    li.textContent = `${holiday.label}`;
    li.style.color = "#e84545";
    li.style.fontWeight = "bold";
    eventList.appendChild(li);
  }
  (events[dateStr] || []).forEach((e, idx) => {
    const li = document.createElement('li');
    li.textContent = e.hour !== undefined ? `${pad(e.hour)}:00 — ${e.text}` : e.text;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.style.cssText = 'float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', () => {
      events[dateStr].splice(idx, 1);
      if (!events[dateStr].length) delete events[dateStr];
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
  const isBirthday = eventBirthdayCheckbox.checked;
  const useHour = eventHourCheckbox.checked && !isBirthday ? parseInt(eventHourSelect.value, 10) : undefined;

  if (!events[dateStr]) events[dateStr] = [];
  const ev = { text: txt };
  if (useHour !== undefined) ev.hour = useHour;
  if (isBirthday) ev.birthday = true;

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

// ==== NAVIGATION ====
navBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

todayBtn.addEventListener('click', () => {
  currentDate = new Date();
  render(); // bleib in aktueller View, zeige Heute
});

// ==== PREV / NEXT ====
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

// ==== SWIPE NAVIGATION ====
let touchStartX = 0, touchEndX = 0;
calendarArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
calendarArea.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  const dx = touchEndX - touchStartX;
  if (Math.abs(dx) > 60) { if (dx > 0) prev(); else next(); }
}, { passive: true });

// ==== LAYOUT ====
function adjustRowHeight() {
  const footer = document.querySelector('.footer');
  const footerH = footer ? footer.getBoundingClientRect().height : 0;
  const available = window.innerHeight - footerH;
  const weekdays = document.querySelector('.weekdays');
  const weekdaysH = weekdays ? weekdays.getBoundingClientRect().height : 0;
  const rows = 6;
  const rowHeight = Math.max(60, Math.floor((available - weekdaysH - 8) / rows));
  document.documentElement.style.setProperty('--row-height', rowHeight + 'px');
}

// ==== INIT ====
window.addEventListener('resize', adjustRowHeight);
setView('month');
