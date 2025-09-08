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
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text,hour?}, ...] }

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

// MONTH (Monday-first)
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y,m,1);
  // compute Monday-first index
  const firstDayIndex = (first.getDay()+6)%7; // Monday=0
  const lastDate = new Date(y,m+1,0).getDate();

  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html = `<div class="weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid" id="monthGrid">`;

  // blank cells before first day
  for(let i=0;i<firstDayIndex;i++) html += `<div class="day-cell empty"></div>`;

  for(let d=1; d<=lastDate; d++){
    const dt = new Date(y,m,d);
    const isToday = dt.toDateString() === (new Date()).toDateString();
    const ds = `${y}-${m+1}-${d}`;
    const hasEvents = events[ds] && events[ds].length>0;
    html += `<div class="day-cell" data-date="${ds}">
              <div class="day-number ${isToday? 'today' : ''}">${d}</div>
              <div class="day-events">${ hasEvents ? '<div class="day-dot" title="Has events"></div>' : '' }</div>
            </div>`;
  }

  // fill trailing blanks to complete full weeks (optional)
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

// WEEK view: 24 rows x Mon-Sun
function renderWeek(){
  // compute start-of-week (Monday)
  const start = new Date(currentDate);
  const dayIndex = (start.getDay()+6)%7; // Monday=0
  start.setDate(start.getDate() - dayIndex);
  // header row
  let html = `<div class="week-grid"><div></div>`;
  const days = [];
  for(let i=0;i<7;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    days.push(d);
    html += `<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}<br>${d.getDate()}</div>`;
  }
  // hours
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

  // place events
  for(const ds in events){
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour!==undefined){
        const sel = `.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`;
        const cell = document.querySelector(sel);
        if(cell){
          const el = document.createElement('div');
          el.className = 'event';
          el.textContent = ev.text;
          cell.appendChild(el);
        }
      }
    });
  }

  // handlers to open modal (hour cells)
  document.querySelectorAll('.hour-cell').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date, parseInt(cell.dataset.hour,10)));
  });
}

// DAY view: single column with 24 hourly rows
function renderDay(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth(), d = currentDate.getDate();
  const ds = `${y}-${m+1}-${d}`;
  let html = `<div style="display:grid;grid-template-columns:60px 1fr">`;
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    html += `<div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;

  // populate events for this date
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour!==undefined){
      const cell = document.querySelector(`.day-hour[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if(cell){
        const el = document.createElement('div');
        el.className='event';
        el.textContent = ev.text;
        cell.appendChild(el);
      }
    } else {
      // full-day event - show at top
      const cell = document.querySelector(`.day-hour[data-date="${ds}"][data-hour="0"]`);
      if(cell){
        const el = document.createElement('div');
        el.className='event';
        el.textContent = ev.text + ' (all day)';
        cell.appendChild(el);
      }
    }
  });

  // click handlers to add event
  document.querySelectorAll('.day-hour').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date, parseInt(cell.dataset.hour,10)));
  });
}



/* --- YEAR VIEW --- */
function renderYear(){
  const y = currentDate.getFullYear();
  let html = `<div class="year-grid">`;
  for(let m=0;m<12;m++){
    const monthStart = new Date(y,m,1);
    const monthName = monthStart.toLocaleString(undefined,{month:'long'});
    html += `<div class="year-month" data-month="${m}" data-year="${y}">
               <strong>${monthName}</strong>
               <div style="font-size:12px;margin-top:6px">${renderMiniMonth(y,m)}</div>
             </div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;

  document.querySelectorAll('.year-month').forEach(el=>{
    el.addEventListener('click', ()=>{
      const yy = parseInt(el.dataset.year,10), mm = parseInt(el.dataset.month,10);
      currentDate = new Date(yy, mm, 1);
      setView('month');
    });
  });
}
function renderMiniMonth(y, m) {
  const first = new Date(y, m, 1);
  const firstIdx = (first.getDay() + 6) % 7;
  const lastDate = new Date(y, m + 1, 0).getDate();

  let mini = `<div class="mini-month">`;

  // Empty slots before the first day
  for (let i = 0; i < firstIdx; i++) {
    mini += `<div></div>`;
  }

  // Days
  for (let d = 1; d <= lastDate; d++) {
    const ds = `${y}-${m+1}-${d}`;
    const dateObj = new Date(y, m, d);
    const isWeekend = (dateObj.getDay() === 0 || dateObj.getDay() === 6);
    const dot = (events[ds] && events[ds].length > 0)
      ? `<span class="event-dot"></span>`
      : '';

    mini += `<div class="mini-month-day${isWeekend ? ' weekend' : ''}">${d}${dot}</div>`;
  }

  mini += `</div>`;
  return mini;
}




/* Modal for adding/viewing events */
let modalOpenFor = null; // {dateStr, hour?}

function openModal(dateStr, hour){
  modalOpenFor = {date: dateStr, hour: hour};
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  modalDate.textContent = new Date(dateStr).toDateString() + (hour!==undefined?` ${pad(hour)}:00`:'');
  eventInput.value = '';
  eventList.innerHTML = '';

  // populate hours dropdown
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

  (events[dateStr]||[]).forEach((e, idx)=>{
    const li = document.createElement('li');
    li.textContent = e.hour!==undefined ? `${pad(e.hour)}:00 — ${e.text}` : e.text;
    // delete button
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.style.cssText = 'float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', ()=>{
      events[dateStr].splice(idx,1);
      if(events[dateStr].length===0) delete events[dateStr];
      localStorage.setItem('events', JSON.stringify(events));
      openModal(dateStr,hour); // refresh modal
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
  events[dateStr].push(ev);
  localStorage.setItem('events', JSON.stringify(events));
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
  render();
});
closeModalBtn.addEventListener('click', ()=>{ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); });

eventHourCheckbox.addEventListener('change', ()=>{
  eventHourSelect.disabled = !eventHourCheckbox.checked;
});

/* Navigation controls */
navBtns.forEach(b=> b.addEventListener('click', ()=>{
  const view = b.dataset.view;
  setView(view);
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
let touchStartX = 0, touchStartY=0;
let touchEndX = 0, touchEndY=0;
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
let isDown=false, startX=0;
calendarArea.addEventListener('mousedown', e=>{ isDown=true; startX=e.screenX; }, {passive:true});
calendarArea.addEventListener('mouseup', e=>{ if(!isDown) return; isDown=false; const diff = e.screenX - startX; if(Math.abs(diff)>60){ if(diff>0) prev(); else next(); }});

function handleSwipe(){
  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;
  if(Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return; // ignore vertical swipes
  if(dx > 0) prev(); else next();
}

/* Make month grid rows fill the available height between header & footer */
function adjustRowHeight(){
  // find footer height
  const footer = document.querySelector('.footer');
  const footerRect = footer.getBoundingClientRect();
  const available = window.innerHeight - footerRect.height;
  // subtract weekdays header height if present
  const weekdays = document.querySelector('.weekdays');
  const weekdaysH = weekdays ? weekdays.getBoundingClientRect().height : 0;
  // determine rows (max 6 weeks visible)
  const rows = 6;
  const rowHeight = Math.max(60, Math.floor((available - weekdaysH - 8) / rows));
  document.documentElement.style.setProperty('--row-height', rowHeight + 'px');
}

/* Initialize */
window.addEventListener('resize', adjustRowHeight);
setView('month'); // initial view uses setView which calls render









