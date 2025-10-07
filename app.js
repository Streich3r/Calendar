/* app.js - Calendar PWA
   - full Month/Week/Day/Year views
   - recurring birthdays handled (stored as birthday:true in events at original date)
   - 29.02 birthdays shown on 28.02 in non-leap years
   - All-day row in Day & Week, multiple badges
   - Month/Year: dots centered (blue=event, green=birthday)
   - Holidays: red number (no red dot), today: blue ring + red number if holiday
*/

const $ = id => document.getElementById(id);

// state
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text, hour?, birthday?}, ...] }

// elements
const views = { day: $('dayView'), week: $('weekView'), month: $('monthView'), year: $('yearView') };
const calendarArea = $('calendarArea');
const titleEl = $('title'), subtitleEl = $('subtitle');
const prevBtn = $('prevBtn'), nextBtn = $('nextBtn'), todayBtn = $('todayBtn');
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
const modal = $('eventModal'), modalDate = $('modalDate'), eventList = $('eventList');
const eventInput = $('eventInput'), addEventBtn = $('addEventBtn'), closeModalBtn = $('closeModalBtn');
const eventHourCheckbox = $('eventHourCheckbox'), eventHourSelect = $('eventHour');
const eventBirthdayCheckbox = $('eventBirthdayCheckbox');

const pad = n => (n < 10 ? '0' + n : '' + n);

// helpers
function ymdKeyFromDate(d){ return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function parseKey(key){ return key.split('-').map(Number); }
function isLeapYear(y){ return (y%4===0 && (y%100!==0 || y%400===0)); }

// Holidays
function calcEaster(y){
  const f = Math.floor, a = y%19, b = f(y/100), c = y%100;
  const d = f(b/4), e = b%4, g = f((8*b+13)/25);
  const h = (19*a + b - d - g + 15) % 30;
  const i = f(c/4), k = c%4;
  const l = (32 + 2*e + 2*i - h - k) % 7;
  const m = f((a + 11*h + 22*l)/451);
  const month = f((h + l - 7*m + 114)/31);
  const day = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(y, month-1, day);
}
function germanHolidays(year){
  const dates = [
    [1,1,"Neujahr"],
    [5,1,"Tag der Arbeit"],
    [10,3,"Tag der Deutschen Einheit"],
    [12,25,"1. Weihnachtstag"],
    [12,26,"2. Weihnachtstag"]
  ];
  const easter = calcEaster(year);
  const add = (offset,label)=>{ const d=new Date(easter); d.setDate(d.getDate()+offset); dates.push([d.getMonth()+1,d.getDate(),label]); };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return dates.map(([m,d,label])=>({ date: `${year}-${m}-${d}`, label }));
}

// RECURRING BIRTHDAYS: scan events and return list for given month/day in *any year*
function getRecurringBirthdaysForMonthDay(month, day, targetYear){
  const list = [];
  for(const key in events){
    const arr = events[key];
    if(!Array.isArray(arr)) continue;
    const [origY, origM, origD] = parseKey(key);
    arr.forEach(ev=>{
      if(ev && ev.birthday){
        // handle 29.02 fallback: if orig is 29-2 and targetYear not leap -> map to 28-2
        let showMonth = origM, showDay = origD;
        if(origM===2 && origD===29 && !isLeapYear(targetYear)){
          showDay = 28; // fallback
        }
        if(showMonth===month && showDay===day){
          // include text and optional stored hour/year (we keep e.hour if present but display as allday)
          list.push({ text: ev.text, hour: ev.hour, origYear: origY });
        }
      }
    });
  }
  return list;
}

// get normal (non-birthday) events for exact date key
function getEventsForDate(ds){
  return (events[ds] || []).filter(ev => !ev.birthday);
}

// get birthdays for exact date (including recurring)
function getBirthdaysForDate(ds){
  const [y,m,d] = parseKey(ds);
  // birthdays physically stored on that exact date (same key)...
  const direct = (events[ds] || []).filter(ev => ev.birthday).map(ev => ({ text: ev.text, hour: ev.hour }));
  // plus recurring birthdays stored under other years but matching month/day
  const recurring = getRecurringBirthdaysForMonthDay(m, d, y);
  // merge unique by text+origYear to avoid duplicates if stored both directly and as recurring - keep both anyway
  const merged = [...direct, ...recurring];
  return merged;
}

// set view
function setView(v){
  currentView = v;
  Object.values(views).forEach(el => { el.classList.remove('active'); el.setAttribute('aria-hidden','true'); });
  views[v].classList.add('active'); views[v].setAttribute('aria-hidden','false');
  navBtns.forEach(b => { b.classList.toggle('active', b.dataset.view===v); b.setAttribute('aria-pressed', b.dataset.view===v ? 'true' : 'false'); });
  render();
}

// render (master)
function render(){
  titleEl.textContent = (currentView==='year') ? currentDate.getFullYear() : currentDate.toLocaleDateString(undefined,{ month:'long', year:'numeric' });
  subtitleEl.textContent = (currentView==='month') ? '' : (currentView==='day' ? currentDate.toLocaleDateString(undefined,{ weekday:'short', day:'numeric', month:'short' }) : '');
  if(currentView==='month') renderMonth();
  else if(currentView==='week') renderWeek();
  else if(currentView==='day') renderDay();
  else renderYear();
  adjustRowHeight();
}

/* ---------- MONTH ---------- */
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y,m,1);
  const firstDayIndex = (first.getDay()+6)%7;
  const lastDate = new Date(y,m+1,0).getDate();
  const holidays = germanHolidays(y);
  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let html = `<div class="weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid">`;

  for(let i=0;i<firstDayIndex;i++) html += `<div class="day-cell empty"></div>`;

  for(let d=1; d<=lastDate; d++){
    const dt = new Date(y,m,d);
    const ds = `${y}-${m+1}-${d}`;
    const isToday = dt.toDateString() === new Date().toDateString();
    const holiday = holidays.find(h=>h.date===ds);
    const normalEvents = getEventsForDate(ds);
    const birthdays = getBirthdaysForDate(ds);

    // build dot HTML: only for events + birthdays (no holiday dot unless today)
    let dots = '';
    if(normalEvents.length) dots += `<div class="day-dot event" title="${normalEvents.map(e=>e.text).join(', ')}"></div>`;
    if(birthdays.length) dots += `<div class="day-dot birthday" title="${birthdays.map(b=>b.text).join(', ')}"></div>`;
    // if holiday AND today, show small holiday dot as additional indicator (but per your request main sign = red number)
    if(holiday && isToday) dots += `<div class="day-dot holiday" title="${holiday.label}"></div>`;

    // day number class: if holiday (and not today), show red number via CSS class on number
    const numberClass = (holiday ? 'holiday' : '') + (isToday ? ' today' : '');

    html += `<div class="day-cell" data-date="${ds}" ${holiday?`title="${holiday.label}"`:''}>
      <div class="day-number ${numberClass}">${d}</div>
      <div class="day-events">${dots}</div>
    </div>`;
  }

  // trailing blanks to fill
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
  const dayIndex = (start.getDay()+6)%7; // Monday=0
  start.setDate(start.getDate() - dayIndex);
  const days = [];
  const headerNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const holidays = germanHolidays(currentDate.getFullYear());

  // header row (weekday + date)
  let html = `<div class="week-grid">`;
  html += `<div class="all-day-label"></div>`; // top-left corner
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    days.push(d);
    html += `<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${headerNames[i]}<br>${d.getDate()}</div>`;
  }

  // all-day row label + cells
  html += `<div class="all-day-label">All Day</div>`;
  for(let i=0;i<7;i++){
    const d = days[i], ds = ymdKeyFromDate(d);
    const holiday = holidays.find(h => h.date === ds);
    // will populate badges later
    html += `<div class="all-day-cell" data-date="${ds}"></div>`;
  }

  // hourly rows
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    for(let i=0;i<7;i++){
      const d = days[i];
      const ds = ymdKeyFromDate(d);
      html += `<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
    }
  }

  html += `</div>`; // week-grid
  views.week.innerHTML = html;

  // populate all-day cells (holidays, birthdays, events without hour)
  days.forEach(d=>{
    const ds = ymdKeyFromDate(d);
    const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
    // holiday: display as badge text
    const holiday = holidays.find(h=>h.date===ds);
    if(holiday){
      const el = document.createElement('div');
      el.className = 'all-day-badge holiday';
      el.textContent = holiday.label;
      container.appendChild(el);
    }
    // recurring birthdays for this month/day
    const [yy,mm,dd] = parseKey(ds);
    const recB = getRecurringBirthdaysForMonthDay(mm, dd, yy);
    recB.forEach(b=>{
      const el = document.createElement('div');
      el.className = 'all-day-badge birthday';
      el.textContent = b.text;
      container.appendChild(el);
    });
    // birthdays stored exactly on this date
    (events[ds]||[]).forEach(ev=>{
      if(ev.birthday){
        const el = document.createElement('div');
        el.className = 'all-day-badge birthday';
        el.textContent = ev.text;
        container.appendChild(el);
      }
    });
    // events without hour (all-day normal events)
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour===undefined || ev.hour===null){
        if(!ev.birthday){
          const el = document.createElement('div');
          el.className = 'all-day-badge';
          el.textContent = ev.text;
          container.appendChild(el);
        }
      }
    });
  });

  // populate hourly events (non-birthday events with hour)
  for(const ds in events){
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour!==undefined && ev.hour!==null && !ev.birthday){
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

  // attach click handlers to open modal
  document.querySelectorAll('.hour-cell, .all-day-cell').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date, cell.dataset.hour ? parseInt(cell.dataset.hour,10) : undefined));
  });
}

/* ---------- DAY ---------- */
function renderDay(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth(), d = currentDate.getDate();
  const ds = `${y}-${m+1}-${d}`;
  const holidays = germanHolidays(y);
  const holiday = holidays.find(h=>h.date===ds);

  let html = `<div class="day-view">`;
  // left column is hour labels (handled via CSS grid so we build columns)
  html += `<div class="all-day-label">All Day</div><div class="all-day-cell" data-date="${ds}"></div>`;

  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;

  // populate all-day: holiday, recurring birthdays, stored birthdays, all-day events
  const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
  if(holiday){
    const el = document.createElement('div');
    el.className = 'all-day-badge holiday';
    el.textContent = holiday.label;
    container.appendChild(el);
  }
  // recurring birthdays (match month/day)
  const [yy,mm,dd] = parseKey(ds);
  const recB = getRecurringBirthdaysForMonthDay(mm, dd, yy);
  recB.forEach(b=>{
    const el = document.createElement('div');
    el.className = 'all-day-badge birthday';
    el.textContent = b.text;
    container.appendChild(el);
  });
  // birthdays stored exactly on this date
  (events[ds]||[]).forEach(ev=>{
    if(ev.birthday){
      const el = document.createElement('div');
      el.className = 'all-day-badge birthday';
      el.textContent = ev.text;
      container.appendChild(el);
    }
  });
  // events without hour
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour===undefined || ev.hour===null){
      if(!ev.birthday){
        const el = document.createElement('div');
        el.className = 'all-day-badge';
        el.textContent = ev.text;
        container.appendChild(el);
      }
    }
  });

  // populate hourly events (with hour, non-birthday)
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour!==undefined && ev.hour!==null && !ev.birthday){
      const cell = document.querySelector(`.day-hour[data-hour="${ev.hour}"]`);
      if(cell){
        const el = document.createElement('div');
        el.className = 'event';
        el.textContent = ev.text;
        cell.appendChild(el);
      }
    }
  });

  // attach handlers
  document.querySelectorAll('.day-hour, .all-day-cell').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date, cell.dataset.hour ? parseInt(cell.dataset.hour,10) : undefined));
  });
}

/* ---------- YEAR ---------- */
function renderYear(){
  const y = currentDate.getFullYear();
  const holidays = germanHolidays(y);
  let html = `<div class="year-grid">`;
  for(let m=0;m<12;m++){
    const monthStart = new Date(y,m,1);
    const monthName = monthStart.toLocaleString(undefined,{ month:'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}"><strong>${monthName}</strong><div class="year-mini">${renderMiniMonth(y,m,holidays)}</div></div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;

  document.querySelectorAll('.year-month').forEach(el=>{
    el.addEventListener('click', ()=> {
      currentDate = new Date(parseInt(el.dataset.year,10), parseInt(el.dataset.month,10), 1);
      setView('month');
    });
  });
}
function renderMiniMonth(y,m,holidays){
  const first = new Date(y,m,1);
  const firstIdx = (first.getDay()+6)%7;
  const lastDate = new Date(y,m+1,0).getDate();
  let mini = `<div style="display:grid;grid-template-columns:repeat(7,1fr);font-size:11px;position:relative">`;
  for(let i=0;i<firstIdx;i++) mini += `<div></div>`;
  for(let d=1; d<=lastDate; d++){
    const ds = `${y}-${m+1}-${d}`;
    const holiday = holidays.find(h=>h.date===ds);
    const normalEvents = getEventsForDate(ds);
    const birthdays = getBirthdaysForDate(ds);
    let dots = '';
    if(normalEvents.length) dots += `<span class="mini-dot" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--event') || '#8ab4f8'}"></span>`;
    if(birthdays.length) dots += `<span class="mini-dot" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--birthday') || '#34a853'}"></span>`;
    if(holiday){
      mini += `<div style="position:relative;padding:2px;color:var(--holiday);font-weight:bold">${d}${dots?`<div class="mini-dots">${dots}</div>`:''}</div>`;
    } else {
      mini += `<div style="position:relative;padding:2px">${d}${dots?`<div class="mini-dots">${dots}</div>`:''}</div>`;
    }
  }
  mini += `</div>`;
  return mini;
}

/* ---------- Modal ---------- */
let modalOpenFor = null;
function openModal(dateStr, hour){
  modalOpenFor = { date: dateStr, hour: hour };
  modal.classList.remove('hidden');
  modalDate.textContent = new Date(dateStr).toDateString() + (hour!==undefined?` ${pad(hour)}:00`:'');
  eventInput.value = '';
  eventHourSelect.innerHTML = '';
  for(let h=0;h<24;h++){ const opt=document.createElement('option'); opt.value=h; opt.text=`${pad(h)}:00`; eventHourSelect.appendChild(opt); }
  eventHourCheckbox.checked = false; eventHourSelect.disabled = true;
  eventBirthdayCheckbox.checked = false;
  renderEventList(dateStr);
}
function renderEventList(dateStr){
  eventList.innerHTML = '';
  const y = parseInt(dateStr.split('-')[0],10);
  const holiday = germanHolidays(y).find(h=>h.date===dateStr);
  if(holiday){
    const li=document.createElement('li'); li.textContent = `📅 ${holiday.label}`; li.style.color = '#e84545'; li.style.fontWeight='bold'; eventList.appendChild(li);
  }
  // show recurring birthdays and direct birthdays for this date
  const [yy,mm,dd] = parseKey(dateStr);
  const recB = getRecurringBirthdaysForMonthDay(mm, dd, yy);
  recB.forEach((b, idx)=>{
    const li = document.createElement('li'); li.textContent = `🎂 ${b.text}`; 
    const del = document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    // deletion for recurring birthdays: find and remove matching entry in events (search all keys)
    del.addEventListener('click', ()=>{
      // search and remove first matching birthday text on any key
      for(const key in events){
        const arr = events[key];
        for(let i=arr.length-1;i>=0;i--){
          if(arr[i] && arr[i].birthday && arr[i].text===b.text){
            arr.splice(i,1);
            if(arr.length===0) delete events[key];
            localStorage.setItem('events', JSON.stringify(events));
            renderEventList(dateStr); render();
            return;
          }
        }
      }
    });
    li.appendChild(del);
    eventList.appendChild(li);
  });

  // direct events on this exact date
  (events[dateStr]||[]).forEach((e, idx)=>{
    const li = document.createElement('li');
    li.textContent = (e.hour!==undefined?`${pad(e.hour)}:00 — `:'') + e.text + (e.birthday?' 🎂':'');
    const del = document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', ()=>{
      events[dateStr].splice(idx,1);
      if(events[dateStr].length===0) delete events[dateStr];
      localStorage.setItem('events', JSON.stringify(events));
      renderEventList(dateStr); render();
    });
    li.appendChild(del);
    eventList.appendChild(li);
  });
}

// add event
addEventBtn.addEventListener('click', ()=>{
  const txt = eventInput.value.trim(); if(!txt) return alert('Enter event text');
  const ds = modalOpenFor.date;
  // if birthday checkbox checked -> store birthday:true on that date (it becomes recurring at render)
  if(!events[ds]) events[ds]=[];
  const ev = { text: txt };
  if(eventBirthdayCheckbox.checked){
    ev.birthday = true;
    // storing month/day implicitly from ds (we rely on key)
  } else if(eventHourCheckbox.checked){
    ev.hour = parseInt(eventHourSelect.value,10);
  }
  events[ds].push(ev);
  localStorage.setItem('events', JSON.stringify(events));
  modal.classList.add('hidden');
  render();
});

// close modal
closeModalBtn.addEventListener('click', ()=> { modal.classList.add('hidden'); });

// hour toggle
eventHourCheckbox.addEventListener('change', ()=> { eventHourSelect.disabled = !eventHourCheckbox.checked; });

// navigation
navBtns.forEach(b=> b.addEventListener('click', ()=> setView(b.dataset.view)));
todayBtn.addEventListener('click', ()=> { currentDate = new Date(); setView('month'); });

function change(delta, unit){
  if(currentView==='day') currentDate.setDate(currentDate.getDate() + delta);
  else if(currentView==='week') currentDate.setDate(currentDate.getDate() + delta*7);
  else if(currentView==='month') currentDate.setMonth(currentDate.getMonth() + delta);
  else currentDate.setFullYear(currentDate.getFullYear() + delta);
  render();
}
prevBtn.addEventListener('click', ()=> change(-1));
nextBtn.addEventListener('click', ()=> change(1));

// swipe
let touchStartX=0;
calendarArea.addEventListener('touchstart', e=> touchStartX = e.changedTouches[0].screenX, {passive:true});
calendarArea.addEventListener('touchend', e=>{
  const dx = e.changedTouches[0].screenX - touchStartX;
  if(Math.abs(dx)>50) dx>0 ? change(-1) : change(1);
}, {passive:true});

// adjust heights & month row height setting
function adjustRowHeight(){
  const footer = document.querySelector('.footer');
  const footerH = footer ? footer.getBoundingClientRect().height : 0;
  const available = window.innerHeight - footerH;
  // set view heights
  document.querySelectorAll('.view').forEach(v => v.style.height = `${available}px`);
  // month grid row height: compute number of rows in current month grid
  const monthGrid = document.querySelector('.month-grid');
  if(monthGrid){
    // count children (including empties)
    const rows = Math.ceil(monthGrid.children.length / 7);
    const headerHeight = document.querySelector('.weekdays') ? document.querySelector('.weekdays').getBoundingClientRect().height : 34;
    const rh = Math.max(60, Math.floor((available - headerHeight - 8) / rows));
    document.documentElement.style.setProperty('--row-height', `${rh}px`);
  }
}

window.addEventListener('resize', adjustRowHeight);

// init
setView('month');
