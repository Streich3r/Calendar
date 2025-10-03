/* app.js - Calendar PWA
   - Multi-view: day/week/month/year
   - Monday-first, today circle, events (localStorage)
   - Swipe left/right for prev/next depending on view
   - JS computes month row heights so grid fills screen
*/

const $ = id => document.getElementById(id);

// State
let currentDate = new Date();
let currentView = 'month'; // day, week, month, year
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text,hour?,repeat?}, ...] }

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
const eventRepeatYearlyCheckbox = $('eventRepeatYearly'); // ✅ neu

// utilities
const pad = n => (n<10?'0':'')+n;
function ymd(dt){ return `${dt.getFullYear()}-${dt.getMonth()+1}-${dt.getDate()}`; }
function formatTitle(d){
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function formatSubtitle(d){
  return d.toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' });
}

// view toggling
function setView(v){
  currentView = v;
  Object.values(views).forEach(el=>{
    el.classList.remove('active');
    el.setAttribute('aria-hidden','true');
  });
  views[v].classList.add('active');
  views[v].setAttribute('aria-hidden','false');
  navBtns.forEach(b=>{
    b.classList.toggle('active', b.dataset.view===v);
    b.setAttribute('aria-pressed', b.dataset.view===v ? 'true' : 'false');
  });
  render();
}

// render entry
function render(){
  titleEl.textContent = (currentView==='year') ? currentDate.getFullYear() : formatTitle(currentDate);
  subtitleEl.textContent = (currentView==='month') ? '' : (currentView==='day'? formatSubtitle(currentDate) : '');
  if(currentView==='month') renderMonth();
  else if(currentView==='week') renderWeek();
  else if(currentView==='day') renderDay();
  else if(currentView==='year') renderYear();
  adjustRowHeight(); // make month grid fill
}

// german holidays func
function germanHolidays(year) {
  // Fixed holidays
  const dates = [
    [1,1,"Neujahr"],
    [5,1,"Tag der Arbeit"],
    [10,3,"Tag der Deutschen Einheit"],
    [12,25,"1. Weihnachtstag"],
    [12,26,"2. Weihnachtstag"]
  ];

  // Easter-based holidays
  const easter = calcEaster(year);
  const add = (offset,label)=>{
    const d = new Date(easter);
    d.setDate(d.getDate()+offset);
    dates.push([d.getMonth()+1, d.getDate(), label]);
  };
  add(1,"Ostermontag");
  add(39,"Christi Himmelfahrt");
  add(50,"Pfingstmontag");
  add(60,"Fronleichnam");

  return dates.map(([m,d,label])=>({date:`${year}-${m}-${d}`,label}));
}

// Computus algorithm for Easter Sunday
function calcEaster(y) {
  const f = Math.floor;
  const a = y % 19, b = f(y/100), c = y % 100, d = f(b/4), e = b % 4;
  const g = f((8*b+13)/25), h = (19*a+b-d-g+15)%30;
  const i = f(c/4), k = c % 4;
  const l = (32+2*e+2*i-h-k)%7;
  const m = f((a+11*h+22*l)/451);
  const month = f((h+l-7*m+114)/31);
  const day = ((h+l-7*m+114)%31)+1;
  return new Date(y, month-1, day);
}

// Hilfsfunktionen für Geburtstage
function isSameDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function isBirthdayEvent(event, viewDate) {
  if (event.repeat === "yearly") {
    const evDate = new Date(event.date);
    return (
      evDate.getDate() === viewDate.getDate() &&
      evDate.getMonth() === viewDate.getMonth()
    );
  }
  return false;
}

// MONTH (Monday-first)
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y,m,1);
  const firstDayIndex = (first.getDay()+6)%7; // Monday=0
  const lastDate = new Date(y,m+1,0).getDate();
  const holidays = germanHolidays(y);

  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html = `<div class="weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid" id="monthGrid">`;

  // blank cells before first day
  for(let i=0;i<firstDayIndex;i++) html += `<div class="day-cell empty"></div>`;

  for(let d=1; d<=lastDate; d++){
    const dt = new Date(y,m,d);
    const isToday = dt.toDateString() === (new Date()).toDateString();
    const ds = `${y}-${m+1}-${d}`;
    const hasEvents = (events[ds]||[]).some(ev=>true) || Object.values(events).flat().some(ev=>isBirthdayEvent(ev, dt));
    const dayOfWeek = dt.getDay();              
    const isWeekend = (dayOfWeek===0 || dayOfWeek===6);
    const holiday = holidays.find(h=>h.date===ds);

    html += `<div class="day-cell${isWeekend?' weekend':''}${holiday?' holiday':''}" 
                    data-date="${ds}" 
                    ${holiday?`title="${holiday.label}"`:''}>
              <div class="day-number ${isToday? 'today' : ''}">${d}</div>
              <div class="day-events">${ hasEvents ? '<div class="day-dot" title="Has events"></div>' : '' }</div>
            </div>`;
  }

  const totalCells = firstDayIndex + lastDate;
  const rem = (7 - (totalCells % 7)) % 7;
  for(let i=0;i<rem;i++) html += `<div class="day-cell empty"></div>`;

  html += `</div>`;
  views.month.innerHTML = html;

  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date));
  });
}

// WEEK view, DAY view, YEAR view bleiben **wie im Original**, nur bei Events beim Rendern folgendes verwenden:

function getEventsForDate(date) {
  const ds = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
  const normalEvents = events[ds] || [];
  const birthdayEvents = Object.values(events).flat().filter(ev => isBirthdayEvent(ev, date));
  return [...normalEvents, ...birthdayEvents];
}

// === Modal / Add Event ===
let modalOpenFor = null;

function openModal(dateStr, hour){
  modalOpenFor = {date: dateStr, hour: hour};
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  modalDate.textContent = new Date(dateStr).toDateString() + (hour!==undefined?` ${pad(hour)}:00`:'');

  eventInput.value = '';
  eventHourSelect.innerHTML = '';
  for(let h=0; h<24; h++){
    const opt = document.createElement('option');
    opt.value = h; opt.text = `${pad(h)}:00`;
    eventHourSelect.appendChild(opt);
  }

  if(hour!==undefined){
    eventHourCheckbox.checked = true;
    eventHourSelect.disabled = false;
    eventHourSelect.value = hour;
  } else {
    eventHourCheckbox.checked = false;
    eventHourSelect.disabled = true;
  }
  eventRepeatYearlyCheckbox.checked = false;

  renderEventList(dateStr);
}

function renderEventList(dateStr){
  eventList.innerHTML = "";
  const [y,m,d] = dateStr.split("-").map(Number);
  const holiday = germanHolidays(y).find(h=>h.date===dateStr);

  if(holiday){
    const li = document.createElement("li");
    li.textContent = "📅 " + holiday.label;
    li.style.color = "#e84545";
    li.style.fontWeight = "bold";
    eventList.appendChild(li);
  }

  (events[dateStr]||[]).forEach((e, idx)=>{
    const li = document.createElement('li');
    li.textContent = e.hour!==undefined ? `${pad(e.hour)}:00 — ${e.text}` : e.text;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.style.cssText = 'float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', ()=>{
      events[dateStr].splice(idx,1);
      if(events[dateStr].length===0) delete events[dateStr];
      localStorage.setItem('events', JSON.stringify(events));
      renderEventList(dateStr);
      render();
    });
    li.appendChild(del);
    eventList.appendChild(li);
  });
}

addEventBtn.addEventListener('click', ()=>{
  const txt = eventInput.value.trim();
  if(!txt) return alert('Enter event text');
  const dateStr = modalOpenFor.date;
  const useHour = eventHourCheckbox.checked ? parseInt(eventHourSelect.value,10) : modalOpenFor.hour;
  if(!events[dateStr]) events[dateStr]=[];
  const ev = useHour!==undefined ? { text: txt, hour: useHour } : { text: txt };
  if(eventRepeatYearlyCheckbox.checked) ev.repeat = "yearly";
  events[dateStr].push(ev);
  localStorage.setItem('events', JSON.stringify(events));
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
  render();
});

closeModalBtn.addEventListener('click', ()=>{
  modal.classList.add('hidden'); 
  modal.setAttribute('aria-hidden','true'); 
});

eventHourCheckbox.addEventListener('change', ()=>{
  eventHourSelect.disabled = !eventHourCheckbox.checked;
});

/* Navigation */
navBtns.forEach(b=> b.addEventListener('click', ()=>{
  setView(b.dataset.view);
}));

todayBtn.addEventListener('click', ()=>{
  currentDate = new Date();
  setView('month');
});

function prev(){
  if(currentView==='day') currentDate.setDate(currentDate.getDate()-1);
  else if(currentView==='week') currentDate.setDate(currentDate.getDate()-7);
  else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()-1);
  else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()-1);
  render();
}
function next(){
  if(currentView==='day') currentDate.setDate(currentDate.getDate()+1);
  else if(currentView==='week') currentDate.setDate(currentDate.getDate()+7);
  else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()+1);
  else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()+1);
  render();
}
prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);

/* Swipe left/right for prev/next and basic mouse drag */
let touchStartX = 0, touchStartY = 0;
let touchEndX = 0, touchEndY = 0;

calendarArea.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, {passive:true});

calendarArea.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
}, {passive:true});

// mouse fallback for desktop
let isDown = false, startX = 0;
calendarArea.addEventListener('mousedown', e => {
  isDown = true;
  startX = e.screenX;
}, {passive:true});

calendarArea.addEventListener('mouseup', e => {
  if (!isDown) return;
  isDown = false;
  const diff = e.screenX - startX;
  if (Math.abs(diff) > 60) {
    if (diff > 0) prev(); else next();
  }
});

function handleSwipe(){
  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return; // ignore vertical swipes
  if (dx > 0) prev(); else next();
}

/* Make month grid rows fill the available height between header & footer */
function adjustRowHeight(){
  const footer = document.querySelector('.footer');
  const footerRect = footer ? footer.getBoundingClientRect() : { height: 0 };
  const available = window.innerHeight - footerRect.height;

  const weekdays = document.querySelector('.weekdays');
  const weekdaysH = weekdays ? weekdays.getBoundingClientRect().height : 0;

  const rows = 6; // maximum weeks
  const rowHeight = Math.max(60, Math.floor((available - weekdaysH - 8) / rows));
  document.documentElement.style.setProperty('--row-height', rowHeight + 'px');
}

/* Initialize */
window.addEventListener('resize', adjustRowHeight);
setView('month'); // initial view
