/* app.js - final release for your Calendar PWA
   - Keep index.html unchanged (expects modal inputs with IDs used below)
   - Works with the provided styles.css (3x4 year layout)
*/

/* helpers */
const $ = id => document.getElementById(id);
const pad = n => (n < 10 ? '0' + n : '' + n);
const isLeap = y => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));

/* state */
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text, hour?, birthday?}, ...] }

/* elements */
const views = { day: $('dayView'), week: $('weekView'), month: $('monthView'), year: $('yearView') };
const calendarArea = $('calendarArea');
const titleEl = $('title');
const subtitleEl = $('subtitle');
const prevBtn = $('prevBtn'), nextBtn = $('nextBtn'), todayBtn = $('todayBtn');
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));

const modal = $('eventModal');
const modalDate = $('modalDate');
const eventList = $('eventList');
const eventInput = $('eventInput');
const addEventBtn = $('addEventBtn');
const closeModalBtn = $('closeModalBtn');

const eventHourCheckbox = $('eventHourCheckbox');
const eventHourSelect = $('eventHour');
const eventBirthdayCheckbox = $('eventBirthdayCheckbox') || null; // may be absent in some HTML variants

/* util to parse stored keys */
function parseKey(k){ return k.split('-').map(x=>parseInt(x,10)); } // [y,m,d]
function dayKeyFromParts(y,m,d){ return `${y}-${m}-${d}`; }
function keyFromDate(date){ return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`; }

/* EASTER + Holidays (German) */
function calcEaster(year){
  const f = Math.floor;
  const a = year % 19, b = f(year/100), c = year % 100;
  const d = f(b/4), e = b % 4, g = f((8*b+13)/25);
  const h = (19*a + b - d - g + 15) % 30;
  const i = f(c/4), k = c % 4;
  const l = (32 + 2*e + 2*i - h - k) % 7;
  const m = f((a + 11*h + 22*l)/451);
  const month = f((h + l - 7*m + 114)/31);
  const day = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(year, month-1, day);
}
function germanHolidays(year){
  const fixed = [
    [1,1,"Neujahr"],
    [5,1,"Tag der Arbeit"],
    [10,3,"Tag der Deutschen Einheit"],
    [12,25,"1. Weihnachtstag"],
    [12,26,"2. Weihnachtstag"]
  ];
  const eas = calcEaster(year);
  const add = (offset,label) => { const d = new Date(eas); d.setDate(d.getDate()+offset); fixed.push([d.getMonth()+1, d.getDate(), label]); };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return fixed.map(([m,d,label]) => ({ date: `${year}-${m}-${d}`, label }));
}

/* ----------------- Recurring Birthday logic (display-only, not stored per-year) -----------------
   Behavior:
   - You store a birthday once: an entry on some key like "1990-5-14" with {text: "Max", birthday:true}
   - At render time we scan events for entries with birthday:true and render them for ANY year when month/day match.
   - For Feb 29 birthdays: when target year is not leap, we show on Feb 28.
   - We dedupe birthdays by lowercased text so user doesn't see duplicates.
*/
function getAllStoredBirthdays(){
  const out = []; // {text, origKey, om, od}
  for(const key in events){
    const arr = events[key];
    if(!Array.isArray(arr)) continue;
    const [oy, om, od] = parseKey(key);
    arr.forEach(ev => {
      if(ev && ev.birthday){
        out.push({ text: ev.text, origKey: key, om, od, oy });
      }
    });
  }
  return out;
}

function birthdaysForDateKey(ds){
  const [y, m, d] = parseKey(ds);
  const all = getAllStoredBirthdays();
  const seen = new Set();
  const res = [];
  all.forEach(b=>{
    // handle Feb29 fallback
    let showDay = b.od, showMonth = b.om;
    if(b.om === 2 && b.od === 29 && !isLeap(y)) showDay = 28;
    if(showMonth === m && showDay === d){
      const key = (b.text || '').trim().toLowerCase();
      if(key && !seen.has(key)){ seen.add(key); res.push({ text: b.text, origKey: b.origKey }); }
    }
  });
  return res; // array of {text, origKey}
}

/* ----------------- Helpers for events on a date ----------------- */
function normalEventsForDate(ds){
  return (events[ds] || []).filter(e => !e.birthday);
}

/* --------------- RENDER / VIEWS --------------- */

function setView(v){
  currentView = v;
  Object.values(views).forEach(el => { if(el){ el.classList.remove('active'); el.setAttribute('aria-hidden','true'); } });
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

/* ---------- MONTH ---------- */
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y,m,1), firstIdx = (first.getDay()+6)%7;
  const lastDate = new Date(y,m+1,0).getDate();
  const holidays = germanHolidays(y);
  const todayKey = keyFromDate(new Date());

  let html = `<div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>`<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid">`;
  for(let i=0;i<firstIdx;i++) html += `<div class="day-cell empty"></div>`;
  for(let d=1; d<=lastDate; d++){
    const ds = `${y}-${m+1}-${d}`;
    const hol = holidays.find(h=>h.date===ds);
    const isToday = (ds === todayKey);
    const normals = normalEventsForDate(ds);
    const bdays = birthdaysForDateKey(ds);
    let dots = '';
    if(normals.length) dots += `<div class="day-dot event" title="${normals.map(e=>e.text).join(', ')}"></div>`;
    if(bdays.length) dots += `<div class="day-dot birthday" title="${bdays.map(b=>b.text).join(', ')}"></div>`;
    // holiday = red number (no red dot)
    const numCls = hol ? 'holiday' : (isToday ? 'today' : '');
    html += `<div class="day-cell" data-date="${ds}" ${hol?`title="${hol.label}"`:''}>
      <div class="day-number ${numCls}">${d}</div>
      <div class="day-events">${dots}</div>
    </div>`;
  }
  // trailing blanks
  const total = firstIdx + lastDate; const rem = (7 - (total % 7)) % 7;
  for(let i=0;i<rem;i++) html += `<div class="day-cell empty"></div>`;
  html += `</div>`;
  if(views.month) views.month.innerHTML = html;

  // attach click handlers
  document.querySelectorAll('.day-cell[data-date]').forEach(cell => cell.addEventListener('click', ()=> openModal(cell.dataset.date)));
}

/* ---------- WEEK ---------- */
function renderWeek(){
  const start = new Date(currentDate);
  const dayIndex = (start.getDay()+6)%7;
  start.setDate(start.getDate() - dayIndex);
  const days = [];
  for(let i=0;i<7;i++){ const d = new Date(start); d.setDate(start.getDate()+i); days.push(d); }

  const holidays = germanHolidays(currentDate.getFullYear());
  let html = `<div class="week-grid">`;
  html += `<div></div>`; // corner
  // header
  for(let i=0;i<7;i++){
    const d = days[i];
    html += `<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}<br>${d.getDate()}</div>`;
  }

  // all-day row (small colored short labels, center)
  html += `<div class="hour-label">All Day</div>`;
  for(let i=0;i<7;i++){
    const ds = keyFromDate(days[i]);
    html += `<div class="all-day-cell" data-date="${ds}"></div>`;
  }

  // hourly rows
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    for(let i=0;i<7;i++){
      const ds = keyFromDate(days[i]);
      html += `<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
    }
  }
  html += `</div>`;
  if(views.week) views.week.innerHTML = html;

  // populate all-day cells with small colored labels (3 letters + ...)
  days.forEach(d=>{
    const ds = keyFromDate(d);
    const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
    if(!container) return;
    // holiday -> small red short label (use holiday label first 3 chars)
    const hol = germanHolidays(d.getFullYear()).find(h=>h.date===ds);
    if(hol){
      const el = document.createElement('div'); el.className = 'event holiday'; el.textContent = shortLabel(hol.label); container.appendChild(el);
    }
    // birthdays
    const bdays = birthdaysForDateKey(ds);
    bdays.forEach(b=>{
      const el = document.createElement('div'); el.className = 'event birthday'; el.textContent = shortLabel(b.text); container.appendChild(el);
    });
    // events without hour (all day events)
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour===undefined || ev.hour===null){
        if(!ev.birthday){
          const el = document.createElement('div'); el.className = 'event'; el.textContent = shortLabel(ev.text); container.appendChild(el);
        }
      }
    });
  });

  // populate hourly events (timed) -> show text
  for(const ds in events){
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour !== undefined && ev.hour !== null && !ev.birthday){
        const cell = document.querySelector(`.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`);
        if(cell){
          const el = document.createElement('div');
          el.className = 'event';
          el.textContent = ev.text;
          cell.appendChild(el);
        }
      }
    });
  }

  // attach click handlers (all-day & hours)
  document.querySelectorAll('.all-day-cell, .hour-cell').forEach(c => c.addEventListener('click', ()=> {
    const hr = c.dataset.hour ? parseInt(c.dataset.hour,10) : undefined;
    openModal(c.dataset.date, hr);
  }));
}

/* ---------- DAY ---------- */
function renderDay(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth(), d = currentDate.getDate();
  const ds = `${y}-${m+1}-${d}`;
  const yHols = germanHolidays(y);
  const hol = yHols.find(h=>h.date===ds);

  let html = `<div style="display:grid;grid-template-columns:60px 1fr">`;
  html += `<div class="hour-label">All Day</div><div class="all-day-cell" data-date="${ds}"></div>`;
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  if(views.day) views.day.innerHTML = html;

  const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
  if(container){
    if(hol){
      const el = document.createElement('div'); el.className = 'event holiday'; el.textContent = shortLabel(hol.label); container.appendChild(el);
    }
    const bdays = birthdaysForDateKey(ds);
    bdays.forEach(b=>{
      const el = document.createElement('div'); el.className = 'event birthday'; el.textContent = shortLabel(b.text); container.appendChild(el);
    });
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour===undefined || ev.hour===null){
        if(!ev.birthday){
          const el = document.createElement('div'); el.className = 'event'; el.textContent = shortLabel(ev.text); container.appendChild(el);
        }
      }
    });
  }

  // timed events
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour !== undefined && ev.hour !== null && !ev.birthday){
      const cell = document.querySelector(`.day-hour[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if(cell){
        const el = document.createElement('div'); el.className = 'event'; el.textContent = ev.text; cell.appendChild(el);
      }
    }
  });

  // clicks open modal
  document.querySelectorAll('.day-hour, .all-day-cell').forEach(c=> c.addEventListener('click', ()=> {
    const hr = c.dataset.hour ? parseInt(c.dataset.hour,10) : undefined;
    openModal(c.dataset.date, hr);
  }));
}

/* ---------- YEAR (3x4 fixed) ---------- */
function renderYear(){
  const y = currentDate.getFullYear();
  const holidays = germanHolidays(y);
  let html = `<div class="year-grid">`;
  for(let m=0;m<12;m++){
    const monthName = new Date(y,m,1).toLocaleString(undefined,{ month:'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}"><strong>${monthName}</strong><div class="year-mini">`;
    const last = new Date(y,m+1,0).getDate();
    const first = new Date(y,m,1);
    const firstIdx = (first.getDay()+6)%7;
    // blanks for first week
    for(let i=0;i<firstIdx;i++) html += `<div></div>`;
    for(let d=1; d<=last; d++){
      const ds = `${y}-${m+1}-${d}`;
      const normals = normalEventsForDate(ds);
      const bdays = birthdaysForDateKey(ds);
      const holiday = holidays.find(h=>h.date===ds);
      const isToday = (ds === keyFromDate(new Date()));
      // day number (holiday -> red number styling, today -> blue ring)
      let styleAttr = '';
      if(holiday) styleAttr = 'class="holiday"';
      const dots = [];
      if(normals.length) dots.push(`<span class="year-dot event"></span>`);
      if(bdays.length) dots.push(`<span class="year-dot birthday"></span>`);
      html += `<div ${styleAttr}>${d}${isToday ? `<div style="position:absolute;left:0;right:0;top:0;bottom:0;"></div>` : ''}${dots.length ? `<div class="year-dot-wrap">${dots.join('')}</div>` : ''}</div>`;
    }
    html += `</div></div>`;
  }
  html += `</div>`;
  if(views.year) views.year.innerHTML = html;

  // click month -> open month's view
  document.querySelectorAll('.year-month').forEach(el => {
    el.addEventListener('click', ()=>{
      const yy = parseInt(el.dataset.year,10);
      const mm = parseInt(el.dataset.month,10);
      currentDate = new Date(yy, mm, 1);
      setView('month');
    });
  });
}

/* ---------- Modal + CRUD ---------- */
let modalOpenFor = null;
function openModal(dateStr, hour){
  modalOpenFor = { date: dateStr, hour: hour };
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  modalDate.textContent = new Date(dateStr).toDateString() + (hour !== undefined ? ` ${pad(hour)}:00` : '');
  eventInput.value = '';
  // populate hour select
  if(eventHourSelect){
    eventHourSelect.innerHTML = '';
    for(let h=0; h<24; h++){ const opt=document.createElement('option'); opt.value=h; opt.text=`${pad(h)}:00`; eventHourSelect.appendChild(opt); }
    eventHourSelect.disabled = true;
  }
  if(eventHourCheckbox) eventHourCheckbox.checked = false;
  if(eventBirthdayCheckbox) eventBirthdayCheckbox.checked = false;
  renderEventList(dateStr);
}

function renderEventList(dateStr){
  eventList.innerHTML = '';
  const [y] = parseKey(dateStr);
  const holiday = germanHolidays(y).find(h=>h.date===dateStr);
  if(holiday){
    const li = document.createElement('li'); li.textContent = `📅 ${holiday.label}`; li.style.color = 'var(--holiday)'; li.style.fontWeight='bold'; eventList.appendChild(li);
  }
  // birthdays (deduped)
  const bdays = birthdaysForDateKey(dateStr);
  bdays.forEach((b, idx) => {
    const li = document.createElement('li'); li.textContent = `🎂 ${b.text}`;
    const del = document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', ()=>{
      // remove the stored birthday occurrence (search by lowercased text and birthday flag)
      const lower = b.text.trim().toLowerCase();
      outer: for(const key in events){
        const arr = events[key];
        for(let i = arr.length-1; i>=0; i--){
          const ev = arr[i];
          if(ev && ev.birthday && ev.text.trim().toLowerCase() === lower){
            arr.splice(i,1);
            if(arr.length===0) delete events[key];
            break outer;
          }
        }
      }
      localStorage.setItem('events', JSON.stringify(events));
      renderEventList(dateStr); render();
    });
    li.appendChild(del);
    eventList.appendChild(li);
  });

  // normal events stored at the exact key
  (events[dateStr] || []).forEach((e, idx) => {
    if(!e.birthday){
      const li = document.createElement('li');
      li.textContent = (e.hour !== undefined && e.hour !== null) ? `${pad(e.hour)}:00 — ${e.text}` : e.text;
      const del = document.createElement('button'); del.textContent = 'Delete';
      del.style.cssText = 'float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
      del.addEventListener('click', ()=>{
        events[dateStr].splice(idx,1);
        if(events[dateStr].length===0) delete events[dateStr];
        localStorage.setItem('events', JSON.stringify(events));
        renderEventList(dateStr); render();
      });
      li.appendChild(del); eventList.appendChild(li);
    }
  });
}

if(eventHourCheckbox) eventHourCheckbox.addEventListener('change', ()=> {
  if(eventHourSelect) eventHourSelect.disabled = !eventHourCheckbox.checked;
});

if(eventBirthdayCheckbox) eventBirthdayCheckbox.addEventListener('change', ()=> {
  if(eventBirthdayCheckbox.checked){
    if(eventHourCheckbox){ eventHourCheckbox.checked = false; eventHourCheckbox.disabled = true; }
    if(eventHourSelect) eventHourSelect.disabled = true;
  } else {
    if(eventHourCheckbox) eventHourCheckbox.disabled = false;
  }
});

addEventBtn.addEventListener('click', ()=>{
  const txt = eventInput.value.trim();
  if(!txt) { alert('Enter event text'); return; }
  const dateStr = modalOpenFor.date;
  if(!events[dateStr]) events[dateStr] = [];
  const ev = { text: txt };
  // if birthday checkbox exists and is checked -> birthday (no hour)
  if(eventBirthdayCheckbox && eventBirthdayCheckbox.checked){
    ev.birthday = true;
  } else if(eventHourCheckbox && eventHourCheckbox.checked){
    ev.hour = parseInt(eventHourSelect.value,10);
  }
  events[dateStr].push(ev);
  localStorage.setItem('events', JSON.stringify(events));
  modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
  render();
});

closeModalBtn.addEventListener('click', ()=> { modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); });

/* ---------------- nav / today / prev-next ---------------- */
navBtns.forEach(b => b.addEventListener('click', ()=> setView(b.dataset.view)));

todayBtn.addEventListener('click', ()=> {
  // keep view but set date focus to today
  currentDate = new Date();
  render();
});

prevBtn.addEventListener('click', ()=> {
  if(currentView === 'day') currentDate.setDate(currentDate.getDate() - 1);
  else if(currentView === 'week') currentDate.setDate(currentDate.getDate() - 7);
  else if(currentView === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
  else if(currentView === 'year') currentDate.setFullYear(currentDate.getFullYear() - 1);
  render();
});
nextBtn.addEventListener('click', ()=> {
  if(currentView === 'day') currentDate.setDate(currentDate.getDate() + 1);
  else if(currentView === 'week') currentDate.setDate(currentDate.getDate() + 7);
  else if(currentView === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
  else if(currentView === 'year') currentDate.setFullYear(currentDate.getFullYear() + 1);
  render();
});

// swipe left/right to switch prev/next (keeps view)
let tsX = 0, tsY = 0;
calendarArea.addEventListener('touchstart', e=> { tsX = e.changedTouches[0].screenX; tsY = e.changedTouches[0].screenY; }, {passive:true});
calendarArea.addEventListener('touchend', e=> {
  const dx = e.changedTouches[0].screenX - tsX, dy = e.changedTouches[0].screenY - tsY;
  if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)){ if(dx > 0) prevBtn.click(); else nextBtn.click(); }
}, {passive:true});

/* ---------------- Layout adjustments --------------- */
function adjustRowHeight(){
  const footer = document.querySelector('.footer');
  const footerH = footer ? footer.getBoundingClientRect().height : 0;
  const available = window.innerHeight - footerH;
  document.querySelectorAll('.view').forEach(v => { if(v) v.style.height = `${available}px`; });
  // month row height
  const mg = document.querySelector('.month-grid');
  if(mg){
    const weekdayH = document.querySelector('.weekdays') ? document.querySelector('.weekdays').getBoundingClientRect().height : 34;
    const rows = Math.ceil(mg.children.length / 7);
    const rowH = Math.max(56, Math.floor((available - weekdayH - 8) / rows));
    document.documentElement.style.setProperty('--row-height', `${rowH}px`);
  }
  // year: keep 3x4 fixed via CSS; height handled by CSS; allow vertical scroll if content grows
}

window.addEventListener('resize', adjustRowHeight);

/* --------------- small helpers --------------- */
function shortLabel(txt){
  // first 3 chars uppercase + "..." if longer
  if(!txt) return '';
  const s = txt.trim();
  if(s.length <= 3) return s;
  return (s.slice(0,3)) + '...';
}

/* init */
setView('month');
window.addEventListener('load', ()=> { adjustRowHeight(); render(); });
