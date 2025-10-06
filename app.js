/* app.js - updated
   - keeps your original events structure
   - adds 'birthdays' storage (MM-DD -> array)
   - migrates legacy birthday entries from events -> birthdays on startup
   - fixes day/week scrolling, hour toggles, all-day birthdays, centered dots, mini-month dots
*/

const $ = id => document.getElementById(id);

// state load
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [ {text, hour?, birthday?}, ... ] }
let birthdays = JSON.parse(localStorage.getItem('birthdays') || '{}'); // { "MM-DD": [ { id, text, year?, hour? }, ... ] }

const views = { day: $('dayView'), week: $('weekView'), month: $('monthView'), year: $('yearView') };
const calendarArea = $('calendarArea');
const titleEl = $('title'), subtitleEl = $('subtitle');
const prevBtn = $('prevBtn'), nextBtn = $('nextBtn'), todayBtn = $('todayBtn');
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));

const modal = $('eventModal'), modalDate = $('modalDate'), eventList = $('eventList'), eventInput = $('eventInput');
const addEventBtn = $('addEventBtn'), closeModalBtn = $('closeModalBtn');
const eventHourCheckbox = $('eventHourCheckbox'), eventHourSelect = $('eventHour');
const eventBirthdayCheckbox = $('eventBirthdayCheckbox');

let currentDate = new Date();
let currentView = 'month';
let modalOpenFor = null;

// helpers
const pad = n => (n < 10 ? '0' : '') + n;
function dateKeyFromDate(d){ return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; } // note: original format (no padding) kept
function dateKeyFromParts(y,m,d){ return `${y}-${m}-${d}`; }
function birthdayKeyFromParts(m,d){ return `${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function parseDateKey(key){ const [y,m,d] = key.split('-').map(Number); return new Date(y, m-1, d); }
function isLeap(y){ return (y%4===0 && (y%100!==0 || y%400===0)); }

// save helpers
function saveAll(){
  localStorage.setItem('events', JSON.stringify(events));
  localStorage.setItem('birthdays', JSON.stringify(birthdays));
}

// migrate legacy birthday entries stored inside events (ev.birthday=true) -> birthdays map
function migrateLegacyBirthdays(){
  let changed = false;
  for(const ds in {...events}){
    const arr = events[ds];
    if(!Array.isArray(arr)) continue;
    const keep = [];
    arr.forEach(ev=>{
      if(ev && (ev.birthday || ev.yearly)){
        // move to birthdays map
        const [y,m,d] = ds.split('-').map(Number);
        const key = birthdayKeyFromParts(m, d);
        if(!birthdays[key]) birthdays[key] = [];
        birthdays[key].push({ id: Date.now() + Math.random(), text: ev.text||'', year: y, hour: ev.hour });
        changed = true;
      } else {
        keep.push(ev);
      }
    });
    if(keep.length) events[ds] = keep;
    else delete events[ds];
  }
  if(changed) saveAll();
}
migrateLegacyBirthdays();

// german holidays (returns { date: "YYYY-M-D", label })
function germanHolidays(year){
  const dates = [
    [1,1,"Neujahr"],
    [5,1,"Tag der Arbeit"],
    [10,3,"Tag der Deutschen Einheit"],
    [12,25,"1. Weihnachtstag"],
    [12,26,"2. Weihnachtstag"]
  ];
  const easter = calcEaster(year);
  const add=(offset,label)=>{ const d=new Date(easter); d.setDate(d.getDate()+offset); dates.push([d.getMonth()+1, d.getDate(), label]); };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return dates.map(([m,d,label])=>({ date: `${year}-${m}-${d}`, label }));
}
function calcEaster(y) {
  const f=Math.floor, a=y%19,b=f(y/100),c=y%100,d=f(b/4),e=b%4;
  const g=f((8*b+13)/25),h=(19*a+b-d-g+15)%30,i=f(c/4),k=c%4;
  const l=(32+2*e+2*i-h-k)%7,m=f((a+11*h+22*l)/451);
  const month=f((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return new Date(y, month-1, day);
}

// UI: set view
function setView(v){
  currentView = v;
  Object.values(views).forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-hidden','true'); });
  views[v].classList.add('active'); views[v].setAttribute('aria-hidden','false');
  navBtns.forEach(b=>{ b.classList.toggle('active', b.dataset.view===v); b.setAttribute('aria-pressed', b.dataset.view===v ? 'true' : 'false'); });
  render();
}

// render entry
function render(){
  titleEl.textContent = (currentView==='year') ? currentDate.getFullYear() : currentDate.toLocaleDateString(undefined,{ month:'long', year:'numeric' });
  subtitleEl.textContent = (currentView==='month') ? '' : (currentView==='day'? currentDate.toLocaleDateString(undefined,{ weekday:'short', day:'numeric', month:'short' }) : '');
  if(currentView==='month') renderMonth();
  else if(currentView==='week') renderWeek();
  else if(currentView==='day') renderDay();
  else renderYear();
  adjustRowHeight();
}

/* ----- helpers to get events/birthdays for a date ----- */
function getEventsForDateKey(ds){
  // return array of event objects (non-birthday events stored in events map)
  return events[ds] ? [...events[ds]] : [];
}
function getBirthdaysForDateKey(ds){
  const [y,m,d] = ds.split('-').map(Number);
  const key = birthdayKeyFromParts(m, d);
  return birthdays[key] ? [...birthdays[key]] : [];
}

/* ---------- MONTH ---------- */
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y,m,1);
  const firstDayIndex = (first.getDay()+6)%7; // Monday=0
  const lastDate = new Date(y,m+1,0).getDate();
  const holidays = germanHolidays(y);

  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html = `<div class="weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid">`;

  for(let i=0;i<firstDayIndex;i++) html += `<div class="day-cell empty"></div>`;

  for(let d=1; d<=lastDate; d++){
    const dt = new Date(y,m,d);
    const ds = `${y}-${m+1}-${d}`; // keep original key format
    const isToday = dt.toDateString() === (new Date()).toDateString();
    const holiday = holidays.find(h=>h.date===ds);
    const normalEvents = getEventsForDateKey(ds).filter(ev=>!ev.birthday);
    const birthdaysForDay = getBirthdaysForDateKey(ds);

    // build dots (centered)
    let dotsHtml = '';
    // show normal events dot (blue)
    if(normalEvents.length) dotsHtml += `<div class="day-dot event" title="${normalEvents.map(e=>e.text).join(', ')}"></div>`;
    // birthday dot (green)
    if(birthdaysForDay.length) dotsHtml += `<div class="day-dot birthday" title="${birthdaysForDay.map(b=>b.text).join(', ')}"></div>`;
    // holiday: if it's today, we show a red dot (in addition to today's blue ring). If not today, mark the day number red (see class)
    let holidayClass = '';
    if(holiday){
      if(isToday){
        dotsHtml += `<div class="day-dot holiday" title="${holiday.label}"></div>`;
      } else {
        holidayClass = ' holiday';
      }
    }

    html += `<div class="day-cell${holidayClass}" data-date="${ds}" ${holiday?`title="${holiday.label}"`:''}>
      <div class="day-number ${isToday ? 'today' : ''}">${d}</div>
      <div class="day-events">${dotsHtml}</div>
    </div>`;
  }

  const totalCells = firstDayIndex + lastDate;
  const rem = (7 - (totalCells % 7)) % 7;
  for(let i=0;i<rem;i++) html += `<div class="day-cell empty"></div>`;

  html += `</div>`;
  views.month.innerHTML = html;

  // attach handlers
  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date));
  });
}

/* ---------- WEEK ---------- */
function renderWeek(){
  const start = new Date(currentDate);
  const dayIndex = (start.getDay()+6)%7;
  start.setDate(start.getDate() - dayIndex); // monday
  const holidays = germanHolidays(currentDate.getFullYear());

  // build header + all-day row + hour rows
  let html = `<div class="week-grid">`;
  // header day names
  html += `<div></div>`; // empty corner
  const days = [];
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    days.push(d);
    html += `<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}<br>${d.getDate()}</div>`;
  }

  // all-day label + cells
  html += `<div class="all-day-label">All-day</div>`;
  for(let i=0;i<7;i++){
    const d = days[i];
    const ds = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    // build small items for birthdays/events without hour and holiday (if holiday show label)
    let cellHtml = '<div class="all-day-cell">';
    // holidays
    const holiday = holidays.find(h=>h.date===ds);
    if(holiday) cellHtml += `<div class="event holiday" title="${holiday.label}">${holiday.label}</div>`;
    // birthdays (from birthdays map)
    const bkey = birthdayKeyFromParts(d.getMonth()+1, d.getDate());
    const bList = birthdays[bkey] || [];
    bList.forEach(b => {
      cellHtml += `<div class="event birthday" title="${b.text}">${b.text}</div>`;
    });
    // events without hour (all-day events stored in events[ds] with no hour)
    (events[ds]||[]).forEach(ev => {
      if(ev.hour===undefined || ev.hour===null){
        cellHtml += `<div class="event" title="${ev.text}">${ev.text}</div>`;
      }
    });
    cellHtml += '</div>';
    html += cellHtml;
  }

  // hourly rows
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    for(let i=0;i<7;i++){
      const d = days[i];
      const ds = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      html += `<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
    }
  }

  html += `</div>`;
  views.week.innerHTML = html;

  // populate hour cells with events that have hour (ignore birthdays for hour placement)
  const allHourCells = document.querySelectorAll('.hour-cell');
  allHourCells.forEach(cell=>{
    const ds = cell.dataset.date;
    const h = parseInt(cell.dataset.hour, 10);
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour!==undefined && ev.hour!==null && ev.hour===h){
        const el = document.createElement('div');
        el.className = 'event';
        el.textContent = ev.text;
        cell.appendChild(el);
      }
    });
    // if holiday for that day, show holiday label in the 00:00 slot also (but we already show in all-day)
    const d = parseDateKey(ds);
    const holidaysList = germanHolidays(d.getFullYear());
    const hol = holidaysList.find(hh=>hh.date===ds);
    if(hol && h===0){
      const el = document.createElement('div');
      el.className = 'event holiday';
      el.textContent = hol.label;
      cell.appendChild(el);
    }
    cell.addEventListener('click', ()=> openModal(ds, parseInt(cell.dataset.hour,10)));
  });
}

/* ---------- DAY ---------- */
function renderDay(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth(), d = currentDate.getDate();
  const ds = `${y}-${m+1}-${d}`;
  const holidaysList = germanHolidays(y);
  const holiday = holidaysList.find(h=>h.date===ds);

  // all-day row + hours
  let html = '';
  html += `<div class="all-day-row"><div class="all-day-label">All-day</div><div class="all-day-cell">`;
  // holiday
  if(holiday) html += `<div class="event holiday">${holiday.label}</div>`;
  // birthdays
  const bkey = birthdayKeyFromParts(m+1, d);
  (birthdays[bkey]||[]).forEach(b => { html += `<div class="event birthday" title="${b.text}">${b.text}</div>`; });
  // all-day events (events[ds] with no hour)
  (events[ds]||[]).forEach(ev => { if(ev.hour===undefined || ev.hour===null) html += `<div class="event">${ev.text}</div>`; });
  html += `</div></div>`;

  // hours grid
  html += `<div style="display:grid;grid-template-columns:60px 1fr">`;
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;

  views.day.innerHTML = html;

  // populate hour events (only non-birthday events with hour)
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour!==undefined && ev.hour!==null){
      const cell = document.querySelector(`.day-hour[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if(cell){
        const el = document.createElement('div');
        el.className = 'event';
        el.textContent = ev.text;
        cell.appendChild(el);
      }
    }
  });

  // clicking hour or day hours opens modal
  document.querySelectorAll('.day-hour').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date, parseInt(cell.dataset.hour,10)));
  });
}

/* ---------- YEAR ---------- */
function renderYear(){
  const y = currentDate.getFullYear();
  let html = `<div class="year-grid">`;
  for(let m=0;m<12;m++){
    html += `<div class="year-month" data-month="${m}" data-year="${y}">`;
    html += `<strong>${new Date(y,m,1).toLocaleString(undefined,{month:'long'})}</strong>`;
    html += `<div style="font-size:12px;margin-top:6px">${renderMiniMonth(y,m)}</div>`;
    html += `</div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;

  document.querySelectorAll('.year-month').forEach(el=>{
    el.addEventListener('click', ()=>{
      currentDate = new Date(parseInt(el.dataset.year,10), parseInt(el.dataset.month,10), 1);
      setView('month');
    });
  });
}
function renderMiniMonth(y,m){
  const first = new Date(y,m,1);
  const firstIdx = (first.getDay()+6)%7;
  const lastDate = new Date(y,m+1,0).getDate();
  const holidays = germanHolidays(y);

  let mini = '<div style="position:relative;">';
  mini += `<div style="display:grid;grid-template-columns:repeat(7,1fr);font-size:11px;position:relative;">`;
  for(let i=0;i<firstIdx;i++) mini += `<div></div>`;
  for(let d=1; d<=lastDate; d++){
    const ds = `${y}-${m+1}-${d}`;
    const hol = holidays.find(h=>h.date===ds);
    const dayEv = events[ds]||[];
    const hasE = dayEv.some(e=>e.hour!==undefined && e.hour!==null); // events with hour
    const hasAllDayE = dayEv.some(e=>e.hour===undefined || e.hour===null);
    const bkey = birthdayKeyFromParts(m+1,d);
    const hasB = (birthdays[bkey]||[]).length>0;

    // number cell with mini-dots container
    mini += `<div style="position:relative;padding:2px;">${d}`;
    // dots container (center bottom)
    let dots = '';
    if(hasE) dots += `<span class="mini-dot" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--event') || '#8ab4f8'}"></span>`;
    if(hasB) dots += `<span class="mini-dot" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--birthday') || '#34a853'}"></span>`;
    if(hol) dots += `<span class="mini-dot" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--holiday') || '#e84545'}"></span>`;
    if(dots) mini += `<div class="mini-dots">${dots}</div>`;
    mini += `</div>`;
  }
  mini += '</div></div>';
  return mini;
}

/* ---------- Modal handling ---------- */
function openModal(dateStr, hour){
  modalOpenFor = { date: dateStr, hour: hour };
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');

  // display readable date
  const [y,m,d] = dateStr.split('-').map(Number);
  modalDate.textContent = new Date(y, m-1, d).toDateString() + (hour!==undefined ? ` ${pad(hour)}:00` : '');

  eventInput.value = '';
  eventHourSelect.innerHTML = '';
  for(let h=0; h<24; h++){
    const o = document.createElement('option'); o.value = h; o.text = `${pad(h)}:00`; eventHourSelect.appendChild(o);
  }
  eventHourCheckbox.checked = false;
  eventHourSelect.disabled = true;
  eventBirthdayCheckbox.checked = false;

  renderEventList(dateStr);
}

function renderEventList(dateStr){
  eventList.innerHTML = '';
  const [y,m,d] = dateStr.split('-').map(Number);
  const holidaysList = germanHolidays(y);
  const hol = holidaysList.find(h=>h.date===dateStr);
  if(hol){
    const li = document.createElement('li');
    li.textContent = `📅 ${hol.label}`;
    li.style.color = '#e84545';
    li.style.fontWeight = 'bold';
    eventList.appendChild(li);
  }

  // birthdays from birthdays map
  const bkey = birthdayKeyFromParts(m, d);
  const bList = birthdays[bkey] || [];
  bList.forEach((b, idx) => {
    const li = document.createElement('li');
    li.textContent = `🎂 ${b.text}` + (b.hour!==undefined && b.hour!==null ? ` — ${pad(b.hour)}:00 (stored)` : '');
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.style.cssText = 'float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.onclick = () => {
      birthdays[bkey].splice(idx,1);
      if(birthdays[bkey].length===0) delete birthdays[bkey];
      saveAll();
      renderEventList(dateStr);
      render();
    };
    li.appendChild(del);
    eventList.appendChild(li);
  });

  // events from events map
  (events[dateStr]||[]).forEach((e, idx) => {
    const li = document.createElement('li');
    li.textContent = (e.hour!==undefined && e.hour!==null ? `${pad(e.hour)}:00 — ${e.text}` : e.text);
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.style.cssText = 'float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.onclick = () => {
      events[dateStr].splice(idx,1);
      if(events[dateStr].length===0) delete events[dateStr];
      saveAll();
      renderEventList(dateStr);
      render();
    };
    li.appendChild(del);
    eventList.appendChild(li);
  });
}

// add event
addEventBtn.addEventListener('click', ()=>{
  const txt = eventInput.value.trim();
  if(!txt) return alert('Enter event text');
  const ds = modalOpenFor.date;
  const atHour = eventHourCheckbox.checked;
  const hour = atHour ? parseInt(eventHourSelect.value,10) : null;
  const isBirthday = eventBirthdayCheckbox.checked;

  if(isBirthday){
    // store in birthdays map (recurring)
    const [y,m,d] = ds.split('-').map(Number);
    const bkey = birthdayKeyFromParts(m, d);
    if(!birthdays[bkey]) birthdays[bkey] = [];
    const entry = { id: Date.now() + Math.random(), text: txt };
    if(hour!==null) entry.hour = hour; // stored but not used for placement in calendar (all-day)
    // optional: store birthyear if wanted; we store the year of the date user picked
    entry.year = y;
    birthdays[bkey].push(entry);
    saveAll();
    renderEventList(ds);
    render();
    modal.classList.add('hidden');
    return;
  }

  // normal event -> store under exact date
  if(!events[ds]) events[ds] = [];
  const ev = { text: txt };
  if(hour!==null) ev.hour = hour;
  events[ds].push(ev);
  saveAll();
  renderEventList(ds);
  render();
  modal.classList.add('hidden');
});

// close modal
closeModalBtn.addEventListener('click', ()=>{
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
});

// hour checkbox toggle
eventHourCheckbox.addEventListener('change', ()=> {
  eventHourSelect.disabled = !eventHourCheckbox.checked;
});
// note: per your request we allow storing an hour with birthdays in modal,
// but birthdays are displayed as all-day in the calendar (not placed in hours).

/* Navigation */
navBtns.forEach(b => b.addEventListener('click', ()=> setView(b.dataset.view)));
todayBtn.addEventListener('click', ()=> { currentDate = new Date(); setView('month'); });

function change(dir){
  if(currentView==='day') currentDate.setDate(currentDate.getDate()+dir);
  else if(currentView==='week') currentDate.setDate(currentDate.getDate()+7*dir);
  else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()+dir);
  else currentDate.setFullYear(currentDate.getFullYear()+dir);
  render();
}
prevBtn.addEventListener('click', ()=> change(-1));
nextBtn.addEventListener('click', ()=> change(1));

/* swipe for mobile */
let touchStartX=0;
calendarArea.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, {passive:true});
calendarArea.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].screenX - touchStartX;
  if(Math.abs(dx) > 60) { dx > 0 ? change(-1) : change(1); }
}, {passive:true});

/* row height adjust (month grid fill) */
function adjustRowHeight(){
  const footer = document.querySelector('.footer');
  const footerRect = footer ? footer.getBoundingClientRect() : { height: 0 };
  const available = window.innerHeight - footerRect.height;
  const weekdays = document.querySelector('.weekdays');
  const weekdaysH = weekdays ? weekdays.getBoundingClientRect().height : 0;
  const rows = 6;
  const rh = Math.max(60, Math.floor((available - weekdaysH - 8) / rows));
  document.documentElement.style.setProperty('--row-height', rh + 'px');
}
window.addEventListener('resize', adjustRowHeight);

// initial
setView('month');
