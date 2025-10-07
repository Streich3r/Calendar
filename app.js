/* app.js - final corrected version
   - Multi-view calendar: day / week / month / year
   - Birthdays are recurring (computed at render) — stored once with birthday:true
   - Holidays (German) are shown; special today/holiday visuals
   - Week all-day shows colored markers (no long text), Day all-day shows badges
   - Today button keeps current view and focuses current date
*/

const $ = id => document.getElementById(id);

// State
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text, hour?, birthday?}, ...] }

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
const eventBirthdayCheckbox = $('eventBirthdayCheckbox') || null; // defensive

// Helpers
const pad = n => (n < 10 ? '0' + n : '' + n);
const parseKey = k => k.split('-').map(Number);
const isLeap = y => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
const ymd = d => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
const dateKey = (y,m,d) => `${y}-${m}-${d}`;
const sameDay = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

// Easter + German holidays
function calcEaster(y){
  const f=Math.floor;
  const a=y%19, b=f(y/100), c=y%100, d=f(b/4), e=b%4;
  const g=f((8*b+13)/25), h=(19*a+b-d-g+15)%30, i=f(c/4), k=c%4;
  const l=(32+2*e+2*i-h-k)%7, m=f((a+11*h+22*l)/451);
  const month=f((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return new Date(y, month-1, day);
}
function germanHolidays(year){
  const list = [
    [1,1,"Neujahr"], [5,1,"Tag der Arbeit"], [10,3,"Tag der Deutschen Einheit"],
    [12,25,"1. Weihnachtstag"], [12,26,"2. Weihnachtstag"]
  ];
  const eas = calcEaster(year);
  const add = (off,label) => { const d=new Date(eas); d.setDate(d.getDate()+off); list.push([d.getMonth()+1,d.getDate(),label]); };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return list.map(([m,d,label]) => ({ date: `${year}-${m}-${d}`, label }));
}

// Recurring birthdays (computed at render time):
// - iterate stored events; for each birthday entry, compare original month/day to target
// - handle Feb 29 -> show on Feb 28 if target year is not leap
function getRecurringBirthdaysForMonthDay(targetMonth, targetDay, targetYear){
  const out = [];
  for(const key in events){
    const arr = events[key];
    if(!Array.isArray(arr)) continue;
    const [oy, om, od] = parseKey(key);
    arr.forEach(ev=>{
      if(ev && ev.birthday){
        let showD = od, showM = om;
        if(om === 2 && od === 29 && !isLeap(targetYear)) showD = 28; // fallback
        if(showM === targetMonth && showD === targetDay){
          out.push({ text: ev.text, origKey:key });
        }
      }
    });
  }
  return out;
}

// For a specific date key (YYYY-M-D) return deduped birthdays (direct + recurring)
function getBirthdaysForDate(ds){
  const [y,m,d] = parseKey(ds);
  const direct = (events[ds]||[]).filter(e=>e.birthday).map(e=>({ text:e.text, origKey: ds }));
  const recurring = getRecurringBirthdaysForMonthDay(m, d, y);
  const seen = new Set();
  const res = [];
  direct.concat(recurring).forEach(item=>{
    const k = (item.text||'').trim().toLowerCase();
    if(k && !seen.has(k)){ seen.add(k); res.push({ text: item.text, origKey: item.origKey }); }
  });
  return res;
}

// Normal (non-birthday) events for a date
function getNormalEventsForDate(ds){
  return (events[ds]||[]).filter(e=>!e.birthday);
}

// Render control
function setView(v){
  currentView = v;
  Object.values(views).forEach(el=>{
    el.classList.remove('active');
    el && el.setAttribute('aria-hidden','true');
  });
  views[v].classList.add('active');
  views[v].setAttribute('aria-hidden','false');
  navBtns.forEach(b=>{ b.classList.toggle('active', b.dataset.view===v); b.setAttribute('aria-pressed', b.dataset.view===v? 'true' : 'false'); });
  render();
}

function render(){
  titleEl.textContent = (currentView==='year') ? currentDate.getFullYear() : currentDate.toLocaleDateString(undefined,{ month:'long', year:'numeric' });
  subtitleEl.textContent = (currentView==='day') ? currentDate.toLocaleDateString(undefined,{ weekday:'short', day:'numeric', month:'short' }) : '';
  if(currentView==='month') renderMonth();
  else if(currentView==='week') renderWeek();
  else if(currentView==='day') renderDay();
  else renderYear();
  adjustRowHeight();
}

/* MONTH */
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y,m,1), firstIdx = (first.getDay()+6)%7;
  const lastDate = new Date(y,m+1,0).getDate();
  const holidays = germanHolidays(y);
  const todayKey = ymd(new Date());

  let html = `<div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>`<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid">`;
  for(let i=0;i<firstIdx;i++) html += `<div class="day-cell empty"></div>`;

  for(let d=1; d<=lastDate; d++){
    const dt = new Date(y,m,d), ds = `${y}-${m+1}-${d}`;
    const holiday = holidays.find(h=>h.date===ds);
    const isToday = (ds === ymd(new Date()));
    const normals = getNormalEventsForDate(ds);
    const bdays = getBirthdaysForDate(ds);
    let dots = '';
    if(normals.length) dots += `<div class="day-dot event" title="${normals.map(e=>e.text).join(', ')}"></div>`;
    if(bdays.length) dots += `<div class="day-dot birthday" title="${bdays.map(b=>b.text).join(', ')}"></div>`;
    // For month view we keep holiday as styled number (no extra red dot)
    const numCls = holiday ? 'holiday' : (isToday ? 'today' : '');
    html += `<div class="day-cell" data-date="${ds}" ${holiday?`title="${holiday.label}"`:''}>
      <div class="day-number ${numCls}">${d}</div>
      <div class="day-events">${dots}</div>
    </div>`;
  }

  // trailing blanks
  const totalCells = firstIdx + lastDate;
  const rem = (7 - (totalCells % 7)) % 7;
  for(let i=0;i<rem;i++) html += `<div class="day-cell empty"></div>`;
  html += `</div>`;

  views.month.innerHTML = html;

  // attach handlers
  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date));
  });
}

/* WEEK */
function renderWeek(){
  const start = new Date(currentDate);
  const dayIndex = (start.getDay()+6)%7; start.setDate(start.getDate() - dayIndex);
  const days = []; for(let i=0;i<7;i++){ const d=new Date(start); d.setDate(start.getDate()+i); days.push(d); }

  const holidays = germanHolidays(currentDate.getFullYear());
  let html = `<div class="week-grid"><div></div>`;
  // header
  for(let i=0;i<7;i++){
    const d = days[i];
    html += `<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}<br>${d.getDate()}</div>`;
  }

  // all-day row (show small colored markers only)
  html += `<div class="hour-label">All Day</div>`;
  for(let i=0;i<7;i++){
    const ds = ymd(days[i]);
    html += `<div class="hour-cell allday" data-date="${ds}" data-day-index="${i}"></div>`;
  }

  // hourly rows
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    for(let i=0;i<7;i++){
      const ds = ymd(days[i]);
      html += `<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
    }
  }

  html += `</div>`;
  views.week.innerHTML = html;

  // populate all-day markers (small dots) - holidays, birthdays, all-day events
  days.forEach(d=>{
    const ds = ymd(d);
    const container = document.querySelector(`.hour-cell.allday[data-date="${ds}"]`);
    if(!container) return;
    // holiday marker (red dot)
    const holiday = germanHolidays(d.getFullYear()).find(h=>h.date===ds);
    if(holiday){
      const el = document.createElement('div'); el.className='event holiday allday'; el.title = holiday.label; container.appendChild(el);
    }
    // birthdays (green small dots)
    const bdays = getBirthdaysForDate(ds);
    bdays.forEach(b=>{
      const el = document.createElement('div'); el.className='event birthday allday'; el.title = b.text; container.appendChild(el);
    });
    // events without hour -> blue small dots
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour===undefined || ev.hour===null){
        if(!ev.birthday){
          const el = document.createElement('div'); el.className='event allday'; el.title = ev.text; container.appendChild(el);
        }
      }
    });
  });

  // populate hour events (text) for timed events
  for(const ds in events){
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour!==undefined && ev.hour!==null && !ev.birthday){
        const cell = document.querySelector(`.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`);
        if(cell){
          const el = document.createElement('div'); el.className='event'; el.textContent = ev.text; cell.appendChild(el);
        }
      }
    });
  }

  // click handlers open modal
  document.querySelectorAll('.hour-cell').forEach(cell=>{
    cell.addEventListener('click', ()=> {
      const hour = cell.dataset.hour ? parseInt(cell.dataset.hour,10) : undefined;
      openModal(cell.dataset.date, hour);
    });
  });
}

/* DAY */
function renderDay(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth(), d = currentDate.getDate();
  const ds = `${y}-${m+1}-${d}`;
  const yHols = germanHolidays(y);
  const dayHoliday = yHols.find(h=>h.date===ds);

  let html = `<div style="display:grid;grid-template-columns:60px 1fr">`;
  html += `<div class="hour-label">All Day</div><div class="all-day-cell" data-date="${ds}"></div>`;
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;

  // all-day container: holiday badge + birthdays + all-day events (with text)
  const allDayContainer = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
  if(dayHoliday){
    const el = document.createElement('div'); el.className='all-day-badge holiday'; el.textContent = dayHoliday.label; allDayContainer.appendChild(el);
  }
  const bdays = getBirthdaysForDate(ds);
  bdays.forEach(b=>{
    const el = document.createElement('div'); el.className='all-day-badge birthday'; el.textContent = b.text; allDayContainer.appendChild(el);
  });
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour===undefined || ev.hour===null){
      if(!ev.birthday){
        const el = document.createElement('div'); el.className='all-day-badge'; el.textContent = ev.text; allDayContainer.appendChild(el);
      }
    }
  });

  // hourly events (timed)
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour!==undefined && ev.hour!==null && !ev.birthday){
      const cell = document.querySelector(`.day-hour[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if(cell){
        const el = document.createElement('div'); el.className='event'; el.textContent = ev.text; cell.appendChild(el);
      }
    }
  });

  // click handlers
  document.querySelectorAll('.day-hour, .all-day-cell').forEach(c=> c.addEventListener('click', ()=> {
    const hr = c.dataset.hour ? parseInt(c.dataset.hour,10) : undefined;
    openModal(c.dataset.date, hr);
  }));
}

/* YEAR */
function renderYear(){
  const y = currentDate.getFullYear();
  const holidays = germanHolidays(y);
  let html = `<div class="year-grid">`;
  for(let m=0; m<12; m++){
    const monthName = new Date(y,m,1).toLocaleString(undefined,{ month:'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}"><strong>${monthName}</strong><div style="display:grid;grid-template-columns:repeat(7,1fr);">`;
    const last = new Date(y,m+1,0).getDate();
    for(let d=1; d<=last; d++){
      const ds = `${y}-${m+1}-${d}`;
      const normals = getNormalEventsForDate(ds);
      const bdays = getBirthdaysForDate(ds);
      const holiday = holidays.find(h=>h.date===ds);
      const isToday = ds === ymd(new Date());
      // day cell: number + mini dots centered
      let dots = '';
      if(normals.length) dots += `<span class="dot event"></span>`;
      if(bdays.length) dots += `<span class="dot birthday"></span>`;
      if(holiday) dots += `<span class="dot holiday"></span>`;
      html += `<div class="day ${isToday? 'today':''}" ${holiday?`style="color:var(--holiday);font-weight:bold"`:''} >
                <div style="font-size:11px;">${d}</div>
                <div class="dots">${dots}</div>
               </div>`;
    }
    html += `</div></div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;
  // make sure each month click opens month
  document.querySelectorAll('.year-month').forEach(el=>{
    el.addEventListener('click', ()=>{
      const yy = parseInt(el.dataset.year,10);
      const mm = parseInt(el.dataset.month,10);
      currentDate = new Date(yy, mm, 1);
      setView('month');
    });
  });
}

/* MODAL */
let modalOpenFor = null;
function openModal(dateStr, hour){
  modalOpenFor = { date: dateStr, hour: hour };
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  modalDate.textContent = new Date(dateStr).toDateString() + (hour!==undefined ? ` ${pad(hour)}:00` : '');
  eventInput.value = '';
  // prepare hour select
  eventHourSelect.innerHTML = ''; for(let h=0; h<24; h++){ const opt=document.createElement('option'); opt.value=h; opt.text=`${pad(h)}:00`; eventHourSelect.appendChild(opt); }
  if(hour!==undefined && hour!==null){ eventHourCheckbox.checked = true; eventHourSelect.disabled = false; eventHourSelect.value = hour; }
  else { eventHourCheckbox.checked = false; eventHourSelect.disabled = true; }
  // birthday checkbox resets
  if(eventBirthdayCheckbox){ eventBirthdayCheckbox.checked = false; eventHourCheckbox.disabled = false; }
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
  const bdays = getBirthdaysForDate(dateStr);
  bdays.forEach((b, idx)=>{
    const li = document.createElement('li'); li.textContent = `🎂 ${b.text}`;
    const del = document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', ()=>{
      // remove first matching birthday occurrence in store
      const lower = b.text.trim().toLowerCase();
      outer: for(const key in events){
        const arr = events[key];
        for(let i=arr.length-1;i>=0;i--){
          if(arr[i] && arr[i].birthday && arr[i].text.trim().toLowerCase()===lower){
            arr.splice(i,1);
            if(arr.length===0) delete events[key];
            break outer;
          }
        }
      }
      localStorage.setItem('events', JSON.stringify(events));
      renderEventList(dateStr); render();
    });
    li.appendChild(del); eventList.appendChild(li);
  });

  // normal events (stored at this exact date)
  (events[dateStr]||[]).forEach((e, idx)=>{
    if(!e.birthday){
      const li = document.createElement('li'); li.textContent = (e.hour!==undefined?`${pad(e.hour)}:00 — `:'') + e.text;
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

// Add event
addEventBtn.addEventListener('click', ()=>{
  const txt = eventInput.value.trim(); if(!txt) return alert('Enter event text');
  const dateStr = modalOpenFor.date;
  if(!events[dateStr]) events[dateStr] = [];
  const ev = { text: txt };
  // birthday overrides hour and is stored only once (orig key)
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
if(eventHourCheckbox) eventHourCheckbox.addEventListener('change', ()=> eventHourSelect.disabled = !eventHourCheckbox.checked );
if(eventBirthdayCheckbox) eventBirthdayCheckbox.addEventListener('change', ()=> {
  if(eventBirthdayCheckbox.checked){ eventHourCheckbox.checked = false; eventHourCheckbox.disabled = true; eventHourSelect.disabled = true; }
  else { eventHourCheckbox.disabled = false; }
});

// Navigation handlers
navBtns.forEach(b=> b.addEventListener('click', ()=> setView(b.dataset.view) ));
todayBtn.addEventListener('click', ()=> {
  currentDate = new Date();
  // IMPORTANT: keep current view, only re-render & adjust
  render();
});
prevBtn.addEventListener('click', ()=> {
  if(currentView==='day') currentDate.setDate(currentDate.getDate()-1);
  else if(currentView==='week') currentDate.setDate(currentDate.getDate()-7);
  else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()-1);
  else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()-1);
  render();
});
nextBtn.addEventListener('click', ()=> {
  if(currentView==='day') currentDate.setDate(currentDate.getDate()+1);
  else if(currentView==='week') currentDate.setDate(currentDate.getDate()+7);
  else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()+1);
  else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()+1);
  render();
});

// swipe for prev/next
let touchStartX = 0, touchStartY = 0;
calendarArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; }, {passive:true});
calendarArea.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].screenX - touchStartX;
  const dy = e.changedTouches[0].screenY - touchStartY;
  if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)){
    if(dx > 0) prevBtn.click(); else nextBtn.click();
  }
}, {passive:true});

// adjust heights and month rows so no clipping
function adjustRowHeight(){
  const footer = document.querySelector('.footer');
  const footerH = footer ? footer.getBoundingClientRect().height : 0;
  const available = window.innerHeight - footerH;
  // set each view height explicitly
  document.querySelectorAll('.view').forEach(v => v.style.height = `${available}px`);
  // month grid rows
  const mg = document.querySelector('.month-grid');
  if(mg){
    const weekdayH = document.querySelector('.weekdays') ? document.querySelector('.weekdays').getBoundingClientRect().height : 34;
    // compute rows = children length / 7
    const rows = Math.ceil(mg.children.length / 7);
    const rowHeight = Math.max(56, Math.floor((available - weekdayH - 8) / rows));
    document.documentElement.style.setProperty('--row-height', `${rowHeight}px`);
  }
  // ensure year grid fits horizontally: CSS handles columns; vertical scroll allowed if needed
}

window.addEventListener('resize', adjustRowHeight);

// init
setView('month');
window.addEventListener('load', () => { adjustRowHeight(); render(); });
