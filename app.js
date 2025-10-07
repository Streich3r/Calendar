const $ = id => document.getElementById(id);

// State
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text,hour?,birthday?,holiday?}, ...] }

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

// util
const pad = n => (n < 10 ? '0' + n : n);
const ymd = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// holidays
function germanHolidays(year) {
  const fixed = [
    [1, 1, 'Neujahr'],
    [5, 1, 'Tag der Arbeit'],
    [10, 3, 'Tag der Deutschen Einheit'],
    [12, 25, '1. Weihnachtstag'],
    [12, 26, '2. Weihnachtstag']
  ];
  const easter = calcEaster(year);
  const add = (offset, name) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + offset);
    fixed.push([d.getMonth() + 1, d.getDate(), name]);
  };
  add(1, 'Ostermontag');
  add(39, 'Christi Himmelfahrt');
  add(50, 'Pfingstmontag');
  add(60, 'Fronleichnam');
  return fixed.map(([m, d, label]) => ({ date: `${year}-${m}-${d}`, label }));
}
function calcEaster(y) {
  const f = Math.floor;
  const a = y % 19,
    b = f(y / 100),
    c = y % 100,
    d = f(b / 4),
    e = b % 4,
    g = f((8 * b + 13) / 25),
    h = (19 * a + b - d - g + 15) % 30,
    i = f(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = f((a + 11 * h + 22 * l) / 451),
    month = f((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

// helpers
function filterUniqueBirthdays(list) {
  const seen = new Set();
  return list.filter(e => {
    if (!e.birthday) return true;
    const key = e.text.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---- Render Core ----
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
  titleEl.textContent = currentView === 'year'
    ? currentDate.getFullYear()
    : currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  subtitleEl.textContent = currentView === 'day'
    ? currentDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
    : '';
  if (currentView === 'month') renderMonth();
  else if (currentView === 'week') renderWeek();
  else if (currentView === 'day') renderDay();
  else renderYear();
}

// ---- Month View ----
function renderMonth() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const first = new Date(y, m, 1);
  const firstIdx = (first.getDay() + 6) % 7;
  const last = new Date(y, m + 1, 0).getDate();
  const holidays = germanHolidays(y);
  let html = `<div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<div>${x}</div>`).join('')}</div><div class="month-grid">`;
  for (let i = 0; i < firstIdx; i++) html += `<div class="day-cell empty"></div>`;
  for (let d = 1; d <= last; d++) {
    const dt = new Date(y, m, d);
    const ds = `${y}-${m+1}-${d}`;
    const isToday = sameDay(dt, new Date());
    const dayEvents = filterUniqueBirthdays(events[ds] || []);
    const holiday = holidays.find(h => h.date === ds);
    const hasEv = dayEvents.some(e => !e.birthday);
    const hasBd = dayEvents.some(e => e.birthday);
    let dots = '';
    if (hasEv) dots += `<span class="day-dot event"></span>`;
    if (hasBd) dots += `<span class="day-dot birthday"></span>`;
    const numClass = holiday ? 'holiday' : (isToday ? 'today' : '');
    html += `<div class="day-cell" data-date="${ds}" ${holiday?`title="${holiday.label}"`:''}>
      <div class="day-number ${numClass}">${d}</div>
      <div class="day-events">${dots}</div>
    </div>`;
  }
  html += `</div>`;
  views.month.innerHTML = html;
  document.querySelectorAll('.day-cell[data-date]').forEach(el => el.addEventListener('click', () => openModal(el.dataset.date)));
}

// ---- Week View ----
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

  let html = `<div class="week-grid"><div class="all-day-label">All Day</div>`;
  days.forEach(d => html += `<div class="all-day-cell" data-date="${ymd(d)}"></div>`);
  for (let h = 0; h < 24; h++) {
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    days.forEach(d => html += `<div class="hour-cell" data-date="${ymd(d)}" data-hour="${h}"></div>`);
  }
  html += `</div>`;
  views.week.innerHTML = html;

  days.forEach(d => {
    const ds = ymd(d);
    const dayEvents = filterUniqueBirthdays(events[ds] || []);
    dayEvents.forEach(ev => {
      if (ev.birthday || ev.hour === undefined) {
        const cell = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
        if (cell) {
          const b = document.createElement('div');
          b.className = `all-day-badge ${ev.birthday ? 'birthday' : ''}`;
          b.textContent = ev.text;
          cell.appendChild(b);
        }
      } else {
        const c = document.querySelector(`.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`);
        if (c) {
          const e = document.createElement('div');
          e.className = 'event';
          if (ev.birthday) e.classList.add('birthday');
          e.textContent = ev.text;
          c.appendChild(e);
        }
      }
    });
  });

  document.querySelectorAll('.all-day-cell, .hour-cell').forEach(c => {
    c.addEventListener('click', () => openModal(c.dataset.date, parseInt(c.dataset.hour)));
  });
}

// ---- Day View ----
function renderDay() {
  const ds = ymd(currentDate);
  let html = `<div class="day-view"><div class="hour-label all-day-label">All Day</div><div class="all-day-cell" data-date="${ds}"></div>`;
  for (let h = 0; h < 24; h++) {
    html += `<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;

  const dayEvents = filterUniqueBirthdays(events[ds] || []);
  dayEvents.forEach(ev => {
    if (ev.birthday || ev.hour === undefined) {
      const cell = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
      if (cell) {
        const e = document.createElement('div');
        e.className = `all-day-badge ${ev.birthday ? 'birthday' : ''}`;
        e.textContent = ev.text;
        cell.appendChild(e);
      }
    } else {
      const c = document.querySelector(`.day-hour[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if (c) {
        const e = document.createElement('div');
        e.className = 'event';
        e.textContent = ev.text;
        c.appendChild(e);
      }
    }
  });
  document.querySelectorAll('.all-day-cell, .day-hour').forEach(c => c.addEventListener('click', () => openModal(c.dataset.date, parseInt(c.dataset.hour))));
}

// ---- Year View ----
function renderYear() {
  const y = currentDate.getFullYear();
  const holidays = germanHolidays(y);
  let html = `<div class="year-grid">`;
  for (let m = 0; m < 12; m++) {
    const name = new Date(y, m, 1).toLocaleString(undefined, { month: 'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}"><strong>${name}</strong>${renderMiniMonth(y, m, holidays)}</div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;
  document.querySelectorAll('.year-month').forEach(el =>
    el.addEventListener('click', () => {
      currentDate = new Date(parseInt(el.dataset.year), parseInt(el.dataset.month), 1);
      setView('month');
    })
  );
}

function renderMiniMonth(y, m, holidays) {
  const first = new Date(y, m, 1);
  const firstIdx = (first.getDay() + 6) % 7;
  const last = new Date(y, m + 1, 0).getDate();
  let mini = `<div class="year-mini" style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;">`;
  for (let i = 0; i < firstIdx; i++) mini += `<div></div>`;
  for (let d = 1; d <= last; d++) {
    const ds = `${y}-${m + 1}-${d}`;
    const evs = filterUniqueBirthdays(events[ds] || []);
    const hasEv = evs.some(e => !e.birthday);
    const hasBd = evs.some(e => e.birthday);
    const holiday = holidays.find(h => h.date === ds);
    mini += `<div style="position:relative;">
      <span style="color:${holiday ? 'var(--holiday)' : 'inherit'}">${d}</span>
      <div class="mini-dots">${hasEv ? '<span class="mini-dot" style="background:var(--event)"></span>' : ''}${hasBd ? '<span class="mini-dot" style="background:var(--birthday)"></span>' : ''}</div>
    </div>`;
  }
  mini += `</div>`;
  return mini;
}

// ---- Modal ----
let modalOpenFor = null;
function openModal(ds, hour) {
  modalOpenFor = { date: ds, hour };
  modal.classList.remove('hidden');
  modalDate.textContent = new Date(ds).toDateString() + (hour !== undefined ? ` ${pad(hour)}:00` : '');
  eventInput.value = '';
  eventHourCheckbox.checked = !!hour;
  eventHourSelect.disabled = !hour;
  renderEventList(ds);
}
function renderEventList(ds) {
  eventList.innerHTML = '';
  const evs = filterUniqueBirthdays(events[ds] || []);
  evs.forEach((e, i) => {
    const li = document.createElement('li');
    li.textContent = (e.hour !== undefined ? `${pad(e.hour)}:00 — ` : '') + e.text + (e.birthday ? ' 🎂' : '');
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.style.cssText = 'float:right;background:#900;color:#fff;border:none;padding:3px 6px;border-radius:4px;';
    del.onclick = () => {
      evs.splice(i, 1);
      events[ds] = evs;
      localStorage.setItem('events', JSON.stringify(events));
      renderEventList(ds);
      render();
    };
    li.appendChild(del);
    eventList.appendChild(li);
  });
}
addEventBtn.onclick = () => {
  const txt = eventInput.value.trim();
  if (!txt) return alert('Enter event text');
  const { date } = modalOpenFor;
  const hour = eventBirthdayCheckbox.checked ? undefined : (eventHourCheckbox.checked ? parseInt(eventHourSelect.value) : undefined);
  const ev = { text: txt };
  if (hour !== undefined) ev.hour = hour;
  if (eventBirthdayCheckbox.checked) ev.birthday = true;
  if (!events[date]) events[date] = [];
  events[date].push(ev);
  localStorage.setItem('events', JSON.stringify(events));
  modal.classList.add('hidden');
  render();
};
closeModalBtn.onclick = () => modal.classList.add('hidden');
eventHourCheckbox.onchange = () => (eventHourSelect.disabled = !eventHourCheckbox.checked);

// ---- Navigation ----
prevBtn.onclick = () => {
  if (currentView === 'day') currentDate.setDate(currentDate.getDate() - 1);
  else if (currentView === 'week') currentDate.setDate(currentDate.getDate() - 7);
  else if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
  else currentDate.setFullYear(currentDate.getFullYear() - 1);
  render();
};
nextBtn.onclick = () => {
  if (currentView === 'day') currentDate.setDate(currentDate.getDate() + 1);
  else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + 7);
  else if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
  else currentDate.setFullYear(currentDate.getFullYear() + 1);
  render();
};
todayBtn.onclick = () => {
  currentDate = new Date();
  render();
};
navBtns.forEach(b => b.onclick = () => setView(b.dataset.view));

// Swipe
let startX = 0, endX = 0;
calendarArea.addEventListener('touchstart', e => startX = e.touches[0].clientX);
calendarArea.addEventListener('touchend', e => {
  endX = e.changedTouches[0].clientX;
  if (Math.abs(endX - startX) > 50) (endX > startX ? prevBtn.onclick() : nextBtn.onclick());
});

// Init
render();
