const views = {
  day: document.getElementById("dayView"),
  week: document.getElementById("weekView"),
  month: document.getElementById("monthView"),
  year: document.getElementById("yearView")
};
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const navBtns = document.querySelectorAll(".nav-btn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const todayBtn = document.getElementById("todayBtn");

const modal = document.getElementById("eventModal");
const modalDate = document.getElementById("modalDate");
const eventList = document.getElementById("eventList");
const eventInput = document.getElementById("eventInput");
const eventHourCheckbox = document.getElementById("eventHourCheckbox");
const eventHour = document.getElementById("eventHour");
const birthdayCheckbox = document.getElementById("birthdayCheckbox");
const addEventBtn = document.getElementById("addEventBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

let currentView = "month";
let currentDate = new Date();
let events = JSON.parse(localStorage.getItem("events") || "[]");

// Feiertage (Deutschland Beispiel)
const holidays = {
  "01-01": "Neujahr",
  "05-01": "Tag der Arbeit",
  "10-03": "Tag der Deutschen Einheit",
  "12-25": "1. Weihnachtstag",
  "12-26": "2. Weihnachtstag"
};

// Stundenoptionen
for (let h = 0; h < 24; h++) {
  const opt = document.createElement("option");
  opt.value = h;
  opt.textContent = `${String(h).padStart(2, "0")}:00`;
  eventHour.appendChild(opt);
}

// Uhrzeit aktivieren/deaktivieren
eventHourCheckbox.addEventListener("change", () => {
  eventHour.disabled = !eventHourCheckbox.checked;
});

// Modal öffnen
function openModal(dateStr) {
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  modalDate.textContent = dateStr;
  eventInput.value = "";
  eventHourCheckbox.checked = false;
  eventHour.disabled = true;
  birthdayCheckbox.checked = false;
  renderEventList(dateStr);
}

// Modal schließen
function closeModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

// Event hinzufügen
addEventBtn.addEventListener("click", () => {
  const text = eventInput.value.trim();
  if (!text) return;
  const dateStr = modalDate.textContent;
  const atHour = eventHourCheckbox.checked;
  const hour = atHour ? parseInt(eventHour.value) : null;
  const isBirthday = birthdayCheckbox.checked;

  const event = { date: dateStr, text, hour, isBirthday };

  // Geburtstage sollen jährlich wiederholt werden
  if (isBirthday) event.yearly = true;

  events.push(event);
  saveEvents();
  closeModal();
  render();
});

closeModalBtn.addEventListener("click", closeModal);

function saveEvents() {
  localStorage.setItem("events", JSON.stringify(events));
}

// Kalender neu rendern
function render() {
  updateTitle();
  for (let key in views) views[key].classList.remove("active");
  views[currentView].classList.add("active");
  views[currentView].setAttribute("aria-hidden", "false");

  switch (currentView) {
    case "day": renderDay(); break;
    case "week": renderWeek(); break;
    case "month": renderMonth(); break;
    case "year": renderYear(); break;
  }
}

// Titel aktualisieren
function updateTitle() {
  const options = { month: "long", year: "numeric" };
  titleEl.textContent = currentDate.toLocaleDateString(undefined, options);
  subtitleEl.textContent = "";
}

// -------------------- MONTH VIEW --------------------
function renderMonth() {
  const view = views.month;
  view.innerHTML = "";

  const now = new Date();
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekdays = document.createElement("div");
  weekdays.className = "weekdays";
  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(d => {
    const el = document.createElement("div");
    el.textContent = d;
    weekdays.appendChild(el);
  });
  view.appendChild(weekdays);

  const grid = document.createElement("div");
  grid.className = "month-grid";
  view.appendChild(grid);

  const totalCells = Math.ceil((daysInMonth + startDay) / 7) * 7;
  const todayStr = formatDate(now);

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const dayNum = document.createElement("div");
    dayNum.className = "day-number";

    const dateNum = i - startDay + 1;
    if (dateNum > 0 && dateNum <= daysInMonth) {
      const date = new Date(year, month, dateNum);
      const dateStr = formatDate(date);
      dayNum.textContent = dateNum;

      const monthDayKey = `${String(month + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;
      const holiday = holidays[monthDayKey];

      const dayEvents = getEventsForDate(dateStr);

      const dots = document.createElement("div");
      dots.className = "day-events";

      // Feiertag?
      if (holiday) {
        if (dateStr === todayStr) {
          const redDot = document.createElement("div");
          redDot.className = "day-dot holiday";
          dots.appendChild(redDot);
        } else {
          dayNum.classList.add("holiday");
        }
      }

      // Heute?
      if (dateStr === todayStr) {
        dayNum.classList.add("today");
      }

      // Events / Birthdays
      let hasEvent = false, hasBirthday = false;
      dayEvents.forEach(ev => {
        if (ev.isBirthday) hasBirthday = true;
        else hasEvent = true;
      });

      if (hasEvent) {
        const dot = document.createElement("div");
        dot.className = "day-dot event";
        dots.appendChild(dot);
      }
      if (hasBirthday) {
        const dot = document.createElement("div");
        dot.className = "day-dot birthday";
        dots.appendChild(dot);
      }

      cell.addEventListener("click", () => openModal(dateStr));
      cell.appendChild(dayNum);
      cell.appendChild(dots);
    }
    grid.appendChild(cell);
  }
}

// -------------------- DAY VIEW --------------------
function renderDay() {
  const view = views.day;
  view.innerHTML = "";
  const dateStr = formatDate(currentDate);

  const header = document.createElement("h3");
  header.textContent = currentDate.toDateString();
  view.appendChild(header);

  const hours = document.createElement("div");
  hours.className = "day-column";

  for (let h = 0; h < 24; h++) {
    const hourDiv = document.createElement("div");
    hourDiv.className = "day-hour";
    hourDiv.textContent = `${String(h).padStart(2, "0")}:00`;

    getEventsForDate(dateStr).forEach(ev => {
      if ((ev.hour === h) || (!ev.hour && ev.isBirthday)) {
        const el = document.createElement("div");
        el.className = "event " + (ev.isBirthday ? "birthday" : "event");
        el.textContent = ev.text;
        hourDiv.appendChild(el);
      }
    });
    hours.appendChild(hourDiv);
  }
  view.appendChild(hours);
}

// -------------------- WEEK VIEW --------------------
function renderWeek() {
  const view = views.week;
  view.innerHTML = "";
  const startOfWeek = getMonday(currentDate);

  const grid = document.createElement("div");
  grid.className = "week-grid";

  for (let h = 0; h < 24; h++) {
    const label = document.createElement("div");
    label.className = "hour-label";
    label.textContent = `${String(h).padStart(2, "0")}:00`;
    grid.appendChild(label);

    for (let d = 0; d < 7; d++) {
      const cell = document.createElement("div");
      cell.className = "hour-cell";
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + d);
      const dateStr = formatDate(date);

      getEventsForDate(dateStr).forEach(ev => {
        if ((ev.hour === h) || (!ev.hour && ev.isBirthday)) {
          const el = document.createElement("div");
          el.className = "event " + (ev.isBirthday ? "birthday" : "event");
          el.textContent = ev.text;
          cell.appendChild(el);
        }
      });

      grid.appendChild(cell);
    }
  }

  view.appendChild(grid);
}

// -------------------- YEAR VIEW --------------------
function renderYear() {
  const view = views.year;
  view.innerHTML = "";

  const year = currentDate.getFullYear();
  const grid = document.createElement("div");
  grid.className = "year-grid";

  for (let m = 0; m < 12; m++) {
    const monthBox = document.createElement("div");
    monthBox.className = "year-month";

    const strong = document.createElement("strong");
    strong.textContent = new Date(year, m).toLocaleString(undefined, { month: "long" });
    monthBox.appendChild(strong);

    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const ul = document.createElement("ul");
    for (let d = 1; d <= daysInMonth; d++) {
      const li = document.createElement("li");
      const mdKey = `${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (holidays[mdKey]) li.classList.add("holiday");
      li.textContent = d;
      ul.appendChild(li);
    }
    monthBox.appendChild(ul);
    grid.appendChild(monthBox);
  }

  view.appendChild(grid);
}

// Hilfsfunktionen
function getEventsForDate(dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  return events.filter(ev => {
    if (ev.date === dateStr) return true;
    if (ev.yearly) {
      let [ey,em,ed] = ev.date.split("-").map(Number);
      if (em === m && ed === d) return true;
      // Schaltjahr-Logik
      if (em === 2 && ed === 29 && m === 2 && d === 28 && !isLeapYear(y)) return true;
    }
    return false;
  });
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  return new Date(d.setDate(diff));
}

function isLeapYear(y){return (y%4===0 && y%100!==0)||y%400===0;}
function formatDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}

// Navigation
prevBtn.onclick=()=>{changeDate(-1);}
nextBtn.onclick=()=>{changeDate(1);}
todayBtn.onclick=()=>{currentDate=new Date();render();}

function changeDate(step){
  switch(currentView){
    case"day":currentDate.setDate(currentDate.getDate()+step);break;
    case"week":currentDate.setDate(currentDate.getDate()+step*7);break;
    case"month":currentDate.setMonth(currentDate.getMonth()+step);break;
    case"year":currentDate.setFullYear(currentDate.getFullYear()+step);break;
  }
  render();
}

navBtns.forEach(btn=>{
  btn.addEventListener("click",()=>{
    navBtns.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    currentView=btn.dataset.view;
    render();
  });
});

// Initial render
render();
