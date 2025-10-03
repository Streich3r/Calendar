// ===============================
// Simple Calendar with Events
// ===============================

const views = {
  day: document.getElementById("dayView"),
  week: document.getElementById("weekView"),
  month: document.getElementById("monthView"),
  year: document.getElementById("yearView"),
};

const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");

let currentDate = new Date();
let currentView = "month";
let events = loadEvents(); // aus localStorage

// Modal Elements
const modal = document.getElementById("eventModal");
const modalDateEl = document.getElementById("modalDate");
const eventListEl = document.getElementById("eventList");
const eventInput = document.getElementById("eventInput");
const eventHourCheckbox = document.getElementById("eventHourCheckbox");
const eventHourSelect = document.getElementById("eventHour");
const repeatCheckbox = document.getElementById("eventRepeatYearly"); // NEU
const addEventBtn = document.getElementById("addEventBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

let selectedDate = null;

// ========== INIT ==========
function init() {
  // Buttons
  document.querySelectorAll(".nav-btn").forEach((btn) =>
    btn.addEventListener("click", () => setView(btn.dataset.view))
  );

  document.getElementById("prevBtn").onclick = () => changeDate(-1);
  document.getElementById("nextBtn").onclick = () => changeDate(1);
  document.getElementById("todayBtn").onclick = goToday;

  addEventBtn.onclick = addEvent;
  closeModalBtn.onclick = closeModal;
  eventHourCheckbox.onchange = () =>
    (eventHourSelect.disabled = !eventHourCheckbox.checked);

  // Stunden in Dropdown füllen
  for (let h = 0; h < 24; h++) {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h + ":00";
    eventHourSelect.appendChild(opt);
  }

  render();
}

function setView(view) {
  currentView = view;
  document.querySelectorAll(".nav-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.view === view)
  );
  render();
}

function changeDate(step) {
  if (currentView === "month") currentDate.setMonth(currentDate.getMonth() + step);
  if (currentView === "year") currentDate.setFullYear(currentDate.getFullYear() + step);
  if (currentView === "week") currentDate.setDate(currentDate.getDate() + step * 7);
  if (currentView === "day") currentDate.setDate(currentDate.getDate() + step);
  render();
}

function goToday() {
  currentDate = new Date();
  render();
}

// ========== RENDER ==========
function render() {
  Object.values(views).forEach((v) => (v.innerHTML = ""));
  Object.values(views).forEach((v) => v.classList.remove("active"));
  Object.keys(views).forEach((key) =>
    views[key].setAttribute("aria-hidden", true)
  );

  if (currentView === "day") renderDay();
  if (currentView === "week") renderWeek();
  if (currentView === "month") renderMonth();
  if (currentView === "year") renderYear();
}

// ---------- Day View ----------
function renderDay() {
  const view = views.day;
  view.classList.add("active");
  view.setAttribute("aria-hidden", false);

  titleEl.textContent = currentDate.toDateString();
  subtitleEl.textContent = "";

  const col = document.createElement("div");
  col.className = "day-column";

  for (let h = 0; h < 24; h++) {
    const row = document.createElement("div");
    row.className = "day-hour";
    row.textContent = h + ":00";
    col.appendChild(row);
  }

  // Events
  const todaysEvents = events.filter((ev) =>
    isEventOnDate(ev, currentDate)
  );
  todaysEvents.forEach((ev) => {
    const hour = ev.hour ? parseInt(ev.hour) : 12;
    const row = col.children[hour];
    const div = document.createElement("div");
    div.className = "event";
    div.textContent = ev.title + (ev.repeat === "yearly" ? " 🎂" : "");
    row.appendChild(div);
  });

  view.appendChild(col);
}

// ---------- Week View ----------
function renderWeek() {
  const view = views.week;
  view.classList.add("active");
  view.setAttribute("aria-hidden", false);

  const start = new Date(currentDate);
  start.setDate(start.getDate() - start.getDay());

  titleEl.textContent = "Week of " + start.toDateString();
  subtitleEl.textContent = "";

  const grid = document.createElement("div");
  grid.className = "week-grid";

  // Stunden
  for (let h = 0; h < 24; h++) {
    const lbl = document.createElement("div");
    lbl.className = "hour-label";
    lbl.textContent = h + ":00";
    grid.appendChild(lbl);
    for (let d = 0; d < 7; d++) {
      const cell = document.createElement("div");
      cell.className = "hour-cell";
      grid.appendChild(cell);
    }
  }

  // Events
  events.forEach((ev) => {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + d);
      if (isEventOnDate(ev, day)) {
        const row = ev.hour ? parseInt(ev.hour) : 12;
        const idx = row * 8 + (d + 1); // 8 Spalten (Stunden + 7 Tage)
        const cell = grid.children[idx];
        const div = document.createElement("div");
        div.className = "event";
        div.textContent = ev.title + (ev.repeat === "yearly" ? " 🎂" : "");
        cell.appendChild(div);
      }
    }
  });

  view.appendChild(grid);
}

// ---------- Month View ----------
function renderMonth() {
  const view = views.month;
  view.classList.add("active");
  view.setAttribute("aria-hidden", false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  titleEl.textContent = currentDate.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  subtitleEl.textContent = "";

  const grid = document.createElement("div");
  grid.className = "month-grid";

  // Leerfelder vor dem 1.
  for (let i = 0; i < first.getDay(); i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell";
    grid.appendChild(empty);
  }

  // Tage
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d);
    const cell = document.createElement("div");
    cell.className = "day-cell";
    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = d;
    if (isToday(date)) num.classList.add("today");
    cell.appendChild(num);

    // Events
    const todaysEvents = events.filter((ev) => isEventOnDate(ev, date));
    if (todaysEvents.length) {
      const dots = document.createElement("div");
      dots.className = "day-events";
      todaysEvents.forEach((ev) => {
        const dot = document.createElement("div");
        dot.className = "day-dot";
        dot.title = ev.title + (ev.repeat === "yearly" ? " 🎂" : "");
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
    }

    cell.onclick = () => openModal(date);
    grid.appendChild(cell);
  }

  view.appendChild(grid);
}

// ---------- Year View ----------
function renderYear() {
  const view = views.year;
  view.classList.add("active");
  view.setAttribute("aria-hidden", false);

  const year = currentDate.getFullYear();
  titleEl.textContent = year;
  subtitleEl.textContent = "";

  const wrapper = document.createElement("div");
  wrapper.className = "year-grid";

  for (let m = 0; m < 12; m++) {
    const monthDiv = document.createElement("div");
    monthDiv.className = "year-month";
    monthDiv.innerHTML = `<strong>${new Date(year, m).toLocaleString(undefined, {
      month: "long",
    })}</strong>`;
    wrapper.appendChild(monthDiv);
  }

  view.appendChild(wrapper);
}

// ========== EVENTS ==========

function openModal(date) {
  selectedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD
  modalDateEl.textContent = date.toDateString();
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", false);

  eventListEl.innerHTML = "";
  const todaysEvents = events.filter((ev) =>
    isEventOnDate(ev, date)
  );
  todaysEvents.forEach((ev) => {
    const li = document.createElement("li");
    li.textContent = ev.title + (ev.repeat === "yearly" ? " 🎂" : "");
    eventListEl.appendChild(li);
  });

  eventInput.value = "";
  repeatCheckbox.checked = false;
}

function closeModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", true);
}

function addEvent() {
  const title = eventInput.value.trim();
  if (!title) return;

  const newEvent = {
    title,
    date: selectedDate,
    hour: eventHourCheckbox.checked ? eventHourSelect.value : null,
    repeat: repeatCheckbox.checked ? "yearly" : null,
  };

  events.push(newEvent);
  saveEvents();
  closeModal();
  render();
}

// ========== STORAGE ==========

function saveEvents() {
  localStorage.setItem("calendarEvents", JSON.stringify(events));
}
function loadEvents() {
  return JSON.parse(localStorage.getItem("calendarEvents") || "[]");
}

// ========== HELPERS ==========

function isToday(d) {
  const t = new Date();
  return (
    d.getDate() === t.getDate() &&
    d.getMonth() === t.getMonth() &&
    d.getFullYear() === t.getFullYear()
  );
}

function isEventOnDate(event, dateObj) {
  const evDate = new Date(event.date);

  if (event.repeat === "yearly") {
    return (
      evDate.getDate() === dateObj.getDate() &&
      evDate.getMonth() === dateObj.getMonth()
    );
  } else {
    return evDate.toDateString() === dateObj.toDateString();
  }
}

// Start
init();
