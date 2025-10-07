// app.js - fixed: today button, year layout, modal hour behavior & defensive checks

const $ = id => document.getElementById(id);

// State
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text, hour?, birthday?}, ...] }

// Elements (defensive: some pages may not include birthday checkbox; handle gracefully)
const views = { day: $('dayView'), week: $('weekView'), month: $('monthView'), year: $('yearView') };
const calendarArea = $('calendarArea');
const titleEl = $('title'), subtitleEl = $('subtitle');
const prevBtn = $('prevBtn'), nextBtn = $('nextBtn'), todayBtn = $('todayBtn');
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
const modal = $('eventModal'), modalDate = $('modalDate'), eventList = $('eventList');
const eventInput = $('eventInput'), addEventBtn = $('addEventBtn'), closeModalBtn = $('closeModalBtn');
const eventHourCheckbox = $('eventHourCheckbox'), eventHourSelect = $('eventHour');
const eventBirthdayCheckbox = $('eventBirthdayCheckbox') || null; // may be absent in some index variants

// basic helpers
const pad = n => (n < 10 ? '0' + n : '' + n);
const parseKey = k => k.split('-').map(Number);
const isLeap = y => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
const ymd = d => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
const sameDay = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

// Easter + German holidays
function calcEaster(y){
  const f = Math.floor, a = y%19, b = f(y/100), c = y%100;
  const d = f(b/4), e = b%4, g = f((8*b+13)/25);
  const h = (19*a + b - d - g + 15) % 30, i = f(c/4), k = c%4;
  const l = (32 + 2*e + 2*i - h - k) % 7, m = f((a + 11*h + 22*l)/451);
  const month = f((h + l - 7*m + 114)/31), day = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(y, month-1, day);
}
function germanHolidays(year){
  const fixed = [[1,1,"Neujahr"],[5,1,"Tag der Arbeit"],[10,3,"Tag der Deutschen Einheit"],[12,25,"1. Weihnachtstag"],[12,26,"2. Weihnachtstag"]];
  const eas = calcEaster(year);
  const add = (off,label)=>{ const d=new Date(eas); d.setDate(d.getDate()+off); fixed.push([d.getMonth()+1,d.getDate(),label]); };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return fixed.map(([m,d,label])=>({ date: `${year}-${m}-${d}`, label }));
}

// Recurring birthdays: find birthdays that should show on month/day in targetYear.
// Note: returns objects {text, origKey} (origKey used if we need to delete)
function getRecurringBirthdaysForMonthDay(month, day, targetYear){
  const out = [];
  for(const key in events){
    const arr = events[key];
    if(!Array.isArray(arr)) continue;
    const [oy, om, od] = parseKey(key);
    arr.forEach(ev=>{
      if(ev && ev.birthday){
        let showD = od, showM = om;
        if(om === 2 && od === 29 && !isLeap(targetYear)) showD = 28; // fallback for non-leap
        if(showM === month && showD === day){
          out.push({ text: ev.text, origKey: key });
        }
      }
    });
  }
  return out;
}

// Get birthdays for an exact date key (combine direct and recurring, dedupe by text)
function getBirthdaysForDate(ds){
  const [y, m, d] = parseKey(ds);
  const direct = (events[ds]||[]).filter(e=>e.birthday).map(e=>({ text: e.text, origKey: ds }));
  const recurring = getRecurringBirthdaysForMonthDay(m, d, y);
  const seen = new Set();
  const res = [];
  direct.concat(recurring).forEach(it=>{
    const k = (it.text || '').trim().toLowerCase();
    if(!seen.has(k) && k !== ''){
      seen.add(k);
      res.push({ text: it.text, origKey: it.origKey });
    }
  });
  return res;
}

// Normal (non-birthday) events for a date key
function getNormalEventsForDate(ds){
  return (events[ds]||[]).filter(e=>!e.birthday);
}

/* ------- RENDER/VIEW ------- */

function setView(v){
  currentView = v;
  Object.values(views).forEach(el => { if(el) { el.classList.remove('active'); el.setAttribute('aria-hidden','true'); } });
  if(views[v]) { views[v].classList.add('active'); views[v].setAttribute('aria-hidden','false'); }
  navBtns.forEach(b => { b.classList.toggle('active', b.dataset.view === v); b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false'); });
  render();
}

function render(){
  titleEl.textContent = (currentView === 'year') ? currentDate.getFullYear() : currentDate.toLocaleDateString(undefined,{ month:'long', year:'numeric' });
  subtitleEl.textContent = (currentView === 'day') ? currentDate.toLocaleDateString(undefined,{ weekday:'short', day:'numeric', month:'short' }) : '';
  if(currentView === 'month') renderMonth();
  else if(currentView === 'week') renderWeek();
  else if(currentView === 'day') renderDay();
  else renderYear();
  adjustRowHeight();
}

/* ----- MONTH ----- */
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y,m,1);
  const firstIdx = (first.getDay()+6)%7;
  const lastDate = new Date(y,m+1,0).getDate();
  const holidays = germanHolidays(y);

  let html = `<div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>`<div>${w}</div>`).join('')}</div><div class="month-grid">`;
  for(let i=0;i<firstIdx;i++) html += `<div class="day-cell empty"></div>`;
  for(let d=1; d<=lastDate; d++){
    const dt = new Date(y,m,d);
    const ds = `${y}-${m+1}-${d}`;
    const isToday = sameDay(dt, new Date());
    const holiday = holidays.find(h=>h.date===ds);
    const normal = getNormalEventsForDate(ds);
    const bdays = getBirthdaysForDate(ds);
    let dots = '';
    if(normal.length) dots += `<span class="day-dot event" title="${normal.map(e=>e.text).join(', ')}"></span>`;
    if(bdays.length) dots += `<span class="day-dot birthday" title="${bdays.map(b=>b.text).join(', ')}"></span>`;
    const numClass = holiday ? 'holiday' : (isToday ? 'today' : '');
    html += `<div class="day-cell" data-date="${ds}" ${holiday?`title="${holiday.label}"`:''}>
      <div class="day-number ${numClass}">${d}</div>
      <div class="day-events">${dots}</div>
    </div>`;
  }
  const total = firstIdx + lastDate; const rem = (7 - (total % 7)) % 7;
  for(let i=0;i<rem;i++) html += `<div class="day-cell empty"></div>`;
  html += `</div>`;
  if(views.month) views.month.innerHTML = html;

  document.querySelectorAll('.day-cell[data-date]').forEach(el => el.addEventListener('click', () => openModal(el.dataset.date)));
}

/* ----- WEEK ----- */
function renderWeek(){
  const start = new Date(currentDate);
  const dayIndex = (start.getDay()+6)%7;
  start.setDate(start.getDate() - dayIndex);
  const holidays = germanHolidays(currentDate.getFullYear());
  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let html = `<div class="week-grid">`;
  html += `<div></div>`; // top-left empty
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate() + i);
    html += `<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${weekdays[i]}<br>${d.getDate()}</div>`;
  }

  // all-day row label + cells
  html += `<div class="all-day-label">All Day</div>`;
  const days = [];
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push(d);
    html += `<div class="all-day-cell" data-date="${ymd(d)}"></div>`;
  }

  // hourly rows
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    for(let i=0;i<7;i++){
      const d = days[i];
      html += `<div class="hour-cell" data-date="${ymd(d)}" data-hour="${h}"></div>`;
    }
  }

  html += `</div>`;
  if(views.week) views.week.innerHTML = html;

  // populate all-day cells (holidays, birthdays, all-day events)
  days.forEach(d=>{
    const ds = ymd(d);
    const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
    if(!container) return;
    const holidaysForYear = germanHolidays(d.getFullYear());
    const holiday = holidaysForYear.find(h => h.date === ds);
    if(holiday){
      const el = document.createElement('div'); el.className='all-day-badge holiday'; el.textContent = holiday.label; container.appendChild(el);
    }
    const bdays = getBirthdaysForDate(ds);
    bdays.forEach(b=>{ const el = document.createElement('div'); el.className='all-day-badge birthday'; el.textContent = b.text; container.appendChild(el); });
    // events without hour
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour === undefined || ev.hour === null){
        if(!ev.birthday){
          const el = document.createElement('div'); el.className='all-day-badge'; el.textContent = ev.text; container.appendChild(el);
        }
      }
    });
  });

  // populate hourly events (non-birthdays)
  for(const ds in events){
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour !== undefined && ev.hour !== null && !ev.birthday){
        const cell = document.querySelector(`.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`);
        if(cell){
          const el = document.createElement('div'); el.className='event'; el.textContent = ev.text; cell.appendChild(el);
        }
      }
    });
  }

  // attach click handlers
  document.querySelectorAll('.all-day-cell, .hour-cell').forEach(c => c.addEventListener('click', () => {
    const hr = c.dataset.hour ? parseInt(c.dataset.hour,10) : undefined;
    openModal(c.dataset.date, hr);
  }));
}

/* ----- DAY ----- */
function renderDay(){
  const ds = ymd(currentDate);
  let html = `<div class="day-view">`;
  html += `<div class="hour-label all-day-label">All Day</div><div class="all-day-cell" data-date="${ds}"></div>`;
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  if(views.day) views.day.innerHTML = html;

  const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
  if(container){
    const holiday = germanHolidays(currentDate.getFullYear()).find(h=>h.date===ds);
    if(holiday){
      const el = document.createElement('div'); el.className='all-day-badge holiday'; el.textContent = holiday.label; container.appendChild(el);
    }
    const bdays = getBirthdaysForDate(ds);
    bdays.forEach(b=>{ const el = document.createElement('div'); el.className='all-day-badge birthday'; el.textContent = b.text; container.appendChild(el); });
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour === undefined || ev.hour === null){
        if(!ev.birthday){
          const el = document.createElement('div'); el.className='all-day-badge'; el.textContent = ev.text; container.appendChild(el);
        }
      }
    });
  }

  (events[ds]||[]).forEach(ev=>{
    if(ev.hour !== undefined && ev.hour !== null && !ev.birthday){
      const cell = document.querySelector(`.day-hour[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if(cell){
        const el = document.createElement('div'); el.className='event'; el.textContent = ev.text; cell.appendChild(el);
      }
    }
  });

  document.querySelectorAll('.all-day-cell, .day-hour').forEach(c => c.addEventListener('click', () => {
    const hr = c.dataset.hour ? parseInt(c.dataset.hour,10) : undefined;
    openModal(c.dataset.date, hr);
  }));
}

/* ----- YEAR ----- */
function renderYear(){
  const y = currentDate.getFullYear();
  const holidays = germanHolidays(y);
  let html = `<div class="year-grid">`;
  for(let m=0;m<12;m++){
    const name = new Date(y,m,1).toLocaleString(undefined,{ month:'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}"><strong>${name}</strong>${renderMiniMonth(y,m,holidays)}</div>`;
  }
  html += `</div>`;
  if(views.year) views.year.innerHTML = html;

  // month click -> open month
  document.querySelectorAll('.year-month').forEach(el => el.addEventListener('click', () => {
    currentDate = new Date(parseInt(el.dataset.year,10), parseInt(el.dataset.month,10), 1);
    setView('month');
  }));
}

function renderMiniMonth(y,m,holidays){
  const first = new Date(y,m,1);
  const firstIdx = (first.getDay()+6)%7;
  const last = new Date(y,m+1,0).getDate();
  let mini = `<div class="year-mini" style="display:grid;grid-template-columns:repeat(7,1fr);">`;
  for(let i=0;i<firstIdx;i++) mini += `<div></div>`;
  for(let d=1; d<=last; d++){
    const ds = `${y}-${m+1}-${d}`;
    const normal = getNormalEventsForDate(ds);
    const bdays = getBirthdaysForDate(ds);
    const holiday = holidays.find(h=>h.date===ds);
    let dots = '';
    if(normal.length) dots += `<span class="mini-dot" style="background:var(--event)"></span>`;
    if(bdays.length) dots += `<span class="mini-dot" style="background:var(--birthday)"></span>`;
    mini += `<div class="mini-day"><div style="font-size:11px;color:${holiday?'var(--holiday)':'inherit'}">${d}</div>${dots ? `<div class="mini-dots">${dots}</div>` : ''}</div>`;
  }
  mini += `</div>`;
  return mini;
}

/* ------- MODAL ------- */
let modalOpenFor = null;

function openModal(dateStr, hour){
  modalOpenFor = { date: dateStr, hour: hour };
  modal.classList.remove('hidden');
  modalDate.textContent = new Date(dateStr).toDateString() + (hour !== undefined ? ` ${pad(hour)}:00` : '');
  eventInput.value = '';
  // populate hours
  eventHourSelect.innerHTML = '';
  for(let h=0; h<24; h++){ const opt = document.createElement('option'); opt.value = h; opt.text = `${pad(h)}:00`; eventHourSelect.appendChild(opt); }
  // set hour checkbox/select
  if(hour !== undefined && hour !== null){
    eventHourCheckbox.checked = true;
    eventHourSelect.disabled = false;
    eventHourSelect.value = hour;
  } else {
    eventHourCheckbox.checked = false;
    eventHourSelect.disabled = true;
  }
  // if birthday checkbox exists, ensure it disables hour controls
  if(eventBirthdayCheckbox){
    // reset
    eventBirthdayCheckbox.checked = false;
    eventHourCheckbox.disabled = false;
    eventBirthdayCheckbox.onchange = () => {
      if(eventBirthdayCheckbox.checked){
        eventHourCheckbox.checked = false;
        eventHourCheckbox.disabled = true;
        eventHourSelect.disabled = true;
      } else {
        eventHourCheckbox.disabled = false;
      }
    };
  }
  renderEventList(dateStr);
}

function renderEventList(dateStr){
  eventList.innerHTML = '';
  const [y] = parseKey(dateStr);
  const holiday = germanHolidays(y).find(h => h.date === dateStr);
  if(holiday){
    const li = document.createElement('li'); li.textContent = `📅 ${holiday.label}`; li.style.color = 'var(--holiday)'; li.style.fontWeight='bold'; eventList.appendChild(li);
  }
  // birthdays (deduped)
  const bdays = getBirthdaysForDate(dateStr);
  bdays.forEach((b, idx) => {
    const li = document.createElement('li'); li.textContent = `🎂 ${b.text}`;
    const del = document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', ()=>{
      // remove first occurrence of this birthday in stored events
      const lower = b.text.trim().toLowerCase();
      outer: for(const key in events){
        const arr = events[key];
        for(let i=arr.length-1;i>=0;i--){
          if(arr[i] && arr[i].birthday && arr[i].text.trim().toLowerCase() === lower){
            arr.splice(i,1);
            if(arr.length===0) delete events[key];
            break outer;
          }
        }
      }
      localStorage.setItem('events', JSON.stringify(events));
      renderEventList(dateStr);
      render();
    });
    li.appendChild(del);
    eventList.appendChild(li);
  });

  // normal events stored at this exact date
  (events[dateStr] || []).forEach((e, idx) => {
    if(!e.birthday){
      const li = document.createElement('li'); li.textContent = (e.hour !== undefined && e.hour !== null ? `${pad(e.hour)}:00 — ` : '') + e.text;
      const del = document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
      del.addEventListener('click', ()=>{
        events[dateStr].splice(idx,1); if(events[dateStr].length===0) delete events[dateStr];
        localStorage.setItem('events', JSON.stringify(events));
        renderEventList(dateStr); render();
      });
      li.appendChild(del); eventList.appendChild(li);
    }
  });
}

// add event
addEventBtn.addEventListener('click', ()=>{
  const txt = eventInput.value.trim();
  if(!txt) return alert('Enter event text');
  const ds = modalOpenFor.date;
  if(!events[ds]) events[ds] = [];
  const ev = { text: txt };
  if(eventBirthdayCheckbox && eventBirthdayCheckbox.checked){
    ev.birthday = true;
    // birthday stored on chosen key (so orig year kept)
  } else if(eventHourCheckbox && eventHourCheckbox.checked){
    ev.hour = parseInt(eventHourSelect.value, 10);
  }
  events[ds].push(ev);
  localStorage.setItem('events', JSON.stringify(events));
  modal.classList.add('hidden');
  render();
});

// close modal
closeModalBtn.addEventListener('click', ()=> modal.classList.add('hidden'));

// hour checkbox toggles select
if(eventHourCheckbox){
  eventHourCheckbox.addEventListener('change', ()=> { eventHourSelect.disabled = !eventHourCheckbox.checked; });
}

// navigation
navBtns.forEach(b => b.addEventListener('click', ()=> setView(b.dataset.view)));

// today button: reliably set today and re-render (keep current view)
todayBtn.addEventListener('click', ()=> { currentDate = new Date(); render(); });

// prev/next
prevBtn.addEventListener('click', ()=> {
  if(currentView === 'day') currentDate.setDate(currentDate.getDate()-1);
  else if(currentView === 'week') currentDate.setDate(currentDate.getDate()-7);
  else if(currentView === 'month') currentDate.setMonth(currentDate.getMonth()-1);
  else currentDate.setFullYear(currentDate.getFullYear()-1);
  render();
});
nextBtn.addEventListener('click', ()=> {
  if(currentView === 'day') currentDate.setDate(currentDate.getDate()+1);
  else if(currentView === 'week') currentDate.setDate(currentDate.getDate()+7);
  else if(currentView === 'month') currentDate.setMonth(currentDate.getMonth()+1);
  else currentDate.setFullYear(currentDate.getFullYear()+1);
  render();
});

// swipe nav
let startX = 0;
calendarArea.addEventListener('touchstart', e => startX = e.touches[0].clientX, {passive:true});
calendarArea.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - startX;
  if(Math.abs(dx) > 50){
    if(dx > 0) prevBtn.click(); else nextBtn.click();
  }
}, {passive:true});

// adjust heights & month row height
function adjustRowHeight(){
  const footer = document.querySelector('.footer');
  const footerH = footer ? footer.getBoundingClientRect().height : 0;
  const available = window.innerHeight - footerH;
  document.querySelectorAll('.view').forEach(v => v.style.height = `${available}px`);
  const mg = document.querySelector('.month-grid');
  if(mg){
    const rows = Math.ceil(mg.children.length / 7);
    const headerH = document.querySelector('.weekdays') ? document.querySelector('.weekdays').getBoundingClientRect().height : 34;
    const rh = Math.max(56, Math.floor((available - headerH - 8) / rows));
    document.documentElement.style.setProperty('--row-height', `${rh}px`);
  }
}

window.addEventListener('resize', adjustRowHeight);

// init
setView('month');
