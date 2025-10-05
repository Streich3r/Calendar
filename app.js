// === Utility Functions ===
const today = new Date();
let currentView = 'month';
let currentDate = new Date();

const events = JSON.parse(localStorage.getItem('events') || '[]');

// Feiertage (Deutschland, fix + variabel)
function getGermanHolidays(year) {
  const holidays = [];

  // Feste Feiertage
  const fixed = [
    [1, 1, "Neujahr"],
    [5, 1, "Tag der Arbeit"],
    [10, 3, "Tag der Deutschen Einheit"],
    [12, 25, "1. Weihnachtstag"],
    [12, 26, "2. Weihnachtstag"],
  ];
  fixed.forEach(([m, d, name]) => holidays.push({ date: new Date(year, m - 1, d), name }));

  // Bewegliche Feiertage (Ostern etc.)
  const easter = getEasterDate(year);
  const addDays = (base, days) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  holidays.push({ date: addDays(easter, -2), name: "Karfreitag" });
  holidays.push({ date: addDays(easter, 1), name: "Ostermontag" });
  holidays.push({ date: addDays(easter, 39), name: "Christi Himmelfahrt" });
  holidays.push({ date: addDays(easter, 50), name: "Pfingstmontag" });

  return holidays;
}

function getEasterDate(year) {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J;
  const month = 3 + f((L + 40) / 44);
  const day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

// === UI Updates ===
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${view}-view`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === view)
  );
  currentView = view;

  if (view === 'month') renderMonth();
  if (view === 'week') renderWeek();
  if (view === 'day') renderDay();
  if (view === 'year') renderYear();
}

document.querySelectorAll('.nav-btn').forEach(btn =>
  btn.addEventListener('click', () => switchView(btn.dataset.view))
);

// === Rendering ===
function renderMonth() {
  const grid = document.querySelector('.month-grid');
  const title = document.querySelector('.title');
  grid.innerHTML = '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const holidays = getGermanHolidays(year);

  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  title.textContent = `${firstDay.toLocaleString('de-DE', { month: 'long' })} ${year}`;

  // Blank cells
  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement('div');
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    const number = document.createElement('div');
    number.className = 'day-number';

    // Feiertag check
    const holiday = holidays.find(h =>
      h.date.getDate() === d && h.date.getMonth() === month
    );
    if (holiday) number.classList.add('holiday');

    // Heute check
    const isToday =
      date.toDateString() === today.toDateString();
    if (isToday) number.classList.add('today');

    number.textContent = d;
    const dots = document.createElement('div');
    dots.className = 'day-events';

    // Events, Birthdays, Feiertage Punkte
    const dayEvents = events.filter(e => isSameDay(e.date, date));
    const hasBirthday = dayEvents.some(e => e.type === 'birthday');
    const hasEvent = dayEvents.some(e => e.type === 'event');
    const hasHoliday = !!holiday;

    if (hasEvent) dots.appendChild(makeDot('event'));
    if (hasBirthday) dots.appendChild(makeDot('birthday'));
    if (hasHoliday && isToday) dots.appendChild(makeDot('holiday'));
    else if (hasHoliday && !isToday) number.classList.add('holiday');

    cell.appendChild(number);
    cell.appendChild(dots);
    cell.addEventListener('click', () => openModal(date, holiday?.name));
    grid.appendChild(cell);
  }
}

function makeDot(type) {
  const dot = document.createElement('div');
  dot.className = `day-dot ${type}`;
  return dot;
}

function isSameDay(a, b) {
  const da = new Date(a);
  return da.getFullYear() === b.getFullYear() &&
         da.getMonth() === b.getMonth() &&
         da.getDate() === b.getDate();
}

// === Week View ===
function renderWeek() {
  const container = document.querySelector('.week-grid');
  container.innerHTML = '';
  const title = document.querySelector('.title');

  const start = new Date(currentDate);
  start.setDate(start.getDate() - start.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  title.textContent = `Woche ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;

  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

  hours.forEach(h => {
    const label = document.createElement('div');
    label.className = 'hour-label';
    label.textContent = h;
    container.appendChild(label);

    for (let i = 0; i < 7; i++) {
      const cell = document.createElement('div');
      cell.className = 'hour-cell';
      const date = new Date(start);
      date.setDate(start.getDate() + i);

      const dayEvents = events.filter(e => isSameDay(e.date, date));
      const holidays = getGermanHolidays(date.getFullYear());
      const holiday = holidays.find(hh => isSameDay(hh.date, date));

      if (holiday && h === '00:00') {
        const ev = document.createElement('div');
        ev.className = 'event holiday';
        ev.textContent = holiday.name;
        cell.appendChild(ev);
      }

      dayEvents.forEach(e => {
        const ev = document.createElement('div');
        ev.className = `event ${e.type}`;
        ev.textContent = e.title;
        cell.appendChild(ev);
      });
      container.appendChild(cell);
    }
  });
}

// === Day View ===
function renderDay() {
  const container = document.querySelector('.day-column');
  container.innerHTML = '';
  const title = document.querySelector('.title');

  const date = new Date(currentDate);
  title.textContent = date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const holidays = getGermanHolidays(date.getFullYear());
  const holiday = holidays.find(h => isSameDay(h.date, date));
  const dayEvents = events.filter(e => isSameDay(e.date, date));

  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
  hours.forEach(h => {
    const cell = document.createElement('div');
    cell.className = 'day-hour';

    if (holiday && h === '00:00') {
      const ev = document.createElement('div');
      ev.className = 'event holiday';
      ev.textContent = holiday.name;
      cell.appendChild(ev);
    }

    dayEvents.forEach(e => {
      const ev = document.createElement('div');
      ev.className = `event ${e.type}`;
      ev.textContent = e.title;
      cell.appendChild(ev);
    });

    container.appendChild(cell);
  });
}

// === Year View ===
function renderYear() {
  const grid = document.querySelector('.year-grid');
  grid.innerHTML = '';
  const title = document.querySelector('.title');
  const year = currentDate.getFullYear();
  title.textContent = `${year}`;
  const holidays = getGermanHolidays(year);

  for (let m = 0; m < 12; m++) {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'year-month';
    const label = document.createElement('strong');
    label.textContent = new Date(year, m, 1).toLocaleString('de-DE', { month: 'long' });
    monthDiv.appendChild(label);

    const days = new Date(year, m + 1, 0).getDate();
    const wrap = document.createElement('div');

    for (let d = 1; d <= days; d++) {
      const date = new Date(year, m, d);
      const span = document.createElement('span');
      const holiday = holidays.find(h => isSameDay(h.date, date));
      if (holiday) span.classList.add('holiday');
      span.textContent = d + ' ';
      wrap.appendChild(span);
    }
    monthDiv.appendChild(wrap);
    grid.appendChild(monthDiv);
  }
}

// === Modal ===
function openModal(date, holidayName) {
  const modal = document.querySelector('.modal');
  modal.classList.remove('hidden');
  document.getElementById('event-date').value = date.toISOString().split('T')[0];
  document.getElementById('event-title').value = holidayName || '';
  document.getElementById('event-type').value = holidayName ? 'holiday' : 'event';
  document.getElementById('event-type').disabled = !!holidayName;
  document.getElementById('event-time').disabled = document.getElementById('event-type').value === 'birthday';
}

document.getElementById('event-type').addEventListener('change', e => {
  document.getElementById('event-time').disabled = e.target.value === 'birthday';
});

document.querySelector('.btn.save').addEventListener('click', () => {
  const title = document.getElementById('event-title').value.trim();
  const date = document.getElementById('event-date').value;
  const type = document.getElementById('event-type').value;

  if (!title || !date) return;

  const newEvent = { title, date, type };
  if (type === 'birthday') {
    // Automatisch jedes Jahr (Schaltjahr beachten)
    const base = new Date(date);
    for (let y = base.getFullYear(); y < base.getFullYear() + 50; y++) {
      let d = new Date(y, base.getMonth(), base.getDate());
      if (base.getMonth() === 1 && base.getDate() === 29 && d.getDate() !== 29) {
        d = new Date(y, 1, 28);
      }
      events.push({ title, date: d.toISOString(), type });
    }
  } else {
    events.push(newEvent);
  }

  localStorage.setItem('events', JSON.stringify(events));
  document.querySelector('.modal').classList.add('hidden');
  switchView(currentView);
});

document.querySelector('.btn.cancel').addEventListener('click', () => {
  document.querySelector('.modal').classList.add('hidden');
});

// Initial Render
switchView('month');
