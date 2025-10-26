/* app.js - Final, vollständig
   - Mit: All-day stacking, birthdays recurring (29.02 fallback), modal hour handling,
     month/year dots centered, year 3x4 mini-months, render on view switch.
*/

/* ---------------- Helpers & State ---------------- */
const $ = id => document.getElementById(id);
const pad = n => (n < 10 ? '0' + n : '' + n);
const isLeap = y => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
const keyFromDate = d => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; // YYYY-M-D

let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text, hour?, birthday?}, ...] }

/* ---------------- Elements ---------------- */
const views = { day: $('dayView'), week: $('weekView'), month: $('monthView'), year: $('yearView') };
const calendarArea = $('calendarArea');
const titleEl = $('title'), subtitleEl = $('subtitle');
const prevBtn = $('prevBtn'), nextBtn = $('nextBtn'), todayBtn = $('todayBtn');
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));

const modal = $('eventModal'), modalDate = $('modalDate'), eventList = $('eventList');
const eventInput = $('eventInput'), addEventBtn = $('addEventBtn'), closeModalBtn = $('closeModalBtn');
const eventHourCheckbox = $('eventHourCheckbox'), eventHourSelect = $('eventHour');
const eventBirthdayCheckbox = $('eventBirthdayCheckbox');

/* ---------------- Holidays ---------------- */
function calcEaster(y){
  const f=Math.floor;
  const a=y%19,b=f(y/100),c=y%100,d=f(b/4),e=b%4,g=f((8*b+13)/25);
  const h=(19*a+b-d-g+15)%30,i=f(c/4),k=c%4;
  const l=(32+2*e+2*i-h-k)%7,m=f((a+11*h+22*l)/451);
  const month=f((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return new Date(y, month-1, day);
}
function germanHolidays(year){
  const fixed=[[1,1,"Neujahr"],[5,1,"Tag der Arbeit"],[10,3,"Tag der Deutschen Einheit"],[12,25,"1. Weihnachtstag"],[12,26,"2. Weihnachtstag"]];
  const eas=calcEaster(year);
  const add=(off,label)=>{ const d=new Date(eas); d.setDate(d.getDate()+off); fixed.push([d.getMonth()+1,d.getDate(),label]); };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return fixed.map(([m,d,label])=>({date:`${year}-${m}-${d}`,label}));
}

/* ---------------- Birthdays recurring ---------------- */
function getAllStoredBirthdays(){
  const out=[];
  for(const k in events){
    (events[k]||[]).forEach(ev=>{
      if(ev && ev.birthday && ev.text){
        const [oy,om,od] = k.split('-').map(Number);
        out.push({ text: ev.text, om, od, origKey: k });
      }
    });
  }
  return out;
}
function birthdaysForDateKey(ds){
  const [y,m,d] = ds.split('-').map(Number);
  const all = getAllStoredBirthdays();
  const seen = new Set();
  const res = [];
  all.forEach(b=>{
    let bd = b.od, bm = b.om;
    if(bm===2 && bd===29 && !isLeap(y)) bd = 28; // fallback
    if(bm===m && bd===d){
      const key = (b.text||'').trim().toLowerCase();
      if(key && !seen.has(key)){ seen.add(key); res.push({ text: b.text, origKey: b.origKey }); }
    }
  });
  return res;
}
function normalEventsForDate(ds){ return (events[ds]||[]).filter(e=>!e.birthday); }

/* ---------------- View control ---------------- */
function setView(v){
  currentView = v;
  Object.values(views).forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-hidden','true'); });
  views[v].classList.add('active'); views[v].setAttribute('aria-hidden','false');
  navBtns.forEach(b=>{ b.classList.toggle('active', b.dataset.view===v); b.setAttribute('aria-pressed', b.dataset.view===v ? 'true':'false'); });
  // call correct renderer explicitly to avoid stale state
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

/* ---------------- Month ---------------- */
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y,m,1);
  const firstIdx = (first.getDay()+6)%7;
  const lastDate = new Date(y,m+1,0).getDate();
  const holidays = germanHolidays(y);
  const todayKey = keyFromDate(new Date());

  let html = `<div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>`<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid">`;

  for(let i=0;i<firstIdx;i++) html += `<div class="day-cell empty"></div>`;

  for(let d=1; d<=lastDate; d++){
    const ds = `${y}-${m+1}-${d}`;
    const hol = holidays.find(h=>h.date===ds);
    const isToday = ds === todayKey;
    const normals = normalEventsForDate(ds);
    const bdays = birthdaysForDateKey(ds);

    const dots = [];
    if(normals.length) dots.push(`<div class="day-dot event" title="${normals.map(e=>e.text).join(', ')}"></div>`);
    if(bdays.length) dots.push(`<div class="day-dot birthday" title="${bdays.map(b=>b.text).join(', ')}"></div>`);

    const numCls = ((isToday)?'today':'') + (hol ? ' holiday' : '');
    html += `<div class="day-cell" data-date="${ds}" ${hol?`title="${hol.label}"`:''}>
      <div class="day-number ${numCls.trim()}">${d}</div>
      <div class="day-events">${dots.join('')}</div>
    </div>`;
  }

  const total = firstIdx + lastDate;
  const rem = (7 - (total % 7)) % 7;
  for(let i=0;i<rem;i++) html += `<div class="day-cell empty"></div>`;

  html += `</div>`;
  views.month.innerHTML = html;

  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>cell.addEventListener('click', ()=> openModal(cell.dataset.date)));
}

/* ---------------- Week ---------------- */
function renderWeek(){
  const start = new Date(currentDate);
  const dayIndex = (start.getDay()+6)%7;
  start.setDate(start.getDate() - dayIndex);
  const days = [];
  for(let i=0;i<7;i++){ const d=new Date(start); d.setDate(start.getDate()+i); days.push(d); }

  let html = `<div class="week-grid">`;
  html += `<div></div>`;
  days.forEach(d => html += `<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(d.getDay()+6)%7]}<br>${d.getDate()}</div>`);

  // all-day row label + stacked containers
  html += `<div class="all-day-label">All Day</div>`;
  days.forEach(d => html += `<div class="all-day-row" data-date="${keyFromDate(d)}"></div>`);

  // hourly grid
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    days.forEach(d => html += `<div class="hour-cell" data-date="${keyFromDate(d)}" data-hour="${h}"></div>`);
  }
  html += `</div>`;
  views.week.innerHTML = html;

  // populate all-day (stacked)
  days.forEach(d=>{
    const ds = keyFromDate(d);
    const container = document.querySelector(`.all-day-row[data-date="${ds}"]`);
    if(!container) return;

    const hol = germanHolidays(d.getFullYear()).find(h=>h.date===ds);
    if(hol){
      const el = document.createElement('div'); el.className='event holiday'; el.textContent = hol.label; container.appendChild(el);
    }
    birthdaysForDateKey(ds).forEach(b=>{
      const el = document.createElement('div'); el.className='event birthday'; el.textContent = b.text; container.appendChild(el);
    });
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour===undefined || ev.hour===null){
        if(!ev.birthday){
          const el = document.createElement('div'); el.className='event'; el.textContent = ev.text; container.appendChild(el);
        }
      }
    });
  });

  // timed events
  for(const ds in events){
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour!==undefined && ev.hour!==null && !ev.birthday){
        const cell = document.querySelector(`.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`);
        if(cell){ const el=document.createElement('div'); el.className='event'; el.textContent = ev.text; cell.appendChild(el); }
      }
    });
  }

  // click handlers
  document.querySelectorAll('.hour-cell, .all-day-row').forEach(el=>{
    el.addEventListener('click', ()=> {
      const hr = el.dataset.hour ? parseInt(el.dataset.hour,10) : undefined;
      openModal(el.dataset.date, hr);
    });
  });
}

/* ---------------- Day ---------------- */
function renderDay(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth(), d = currentDate.getDate();
  const ds = `${y}-${m+1}-${d}`;
  let html = `<div class="day-grid">`;
  html += `<div class="all-day-label">All Day</div><div class="all-day-row" data-date="${ds}"></div>`;
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div><div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;
  views.day.style.overflowY = 'auto';

  // fill all-day
  const container = document.querySelector(`.all-day-row[data-date="${ds}"]`);
  if(container){
    const hol = germanHolidays(y).find(h=>h.date===ds);
    if(hol){ const el=document.createElement('div'); el.className='event holiday'; el.textContent=hol.label; container.appendChild(el); }
    birthdaysForDateKey(ds).forEach(b=>{ const el=document.createElement('div'); el.className='event birthday'; el.textContent=b.text; container.appendChild(el); });
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour===undefined || ev.hour===null){
        if(!ev.birthday){ const el=document.createElement('div'); el.className='event'; el.textContent=ev.text; container.appendChild(el); }
      }
    });
  }

  // timed events
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour!==undefined && ev.hour!==null && !ev.birthday){
      const c = document.querySelector(`.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if(c){ const el=document.createElement('div'); el.className='event'; el.textContent = ev.text; c.appendChild(el); }
    }
  });

  // clicks
  document.querySelectorAll('.hour-cell, .all-day-row').forEach(el=>{
    el.addEventListener('click', ()=> {
      const hr = el.dataset.hour ? parseInt(el.dataset.hour,10) : undefined;
      openModal(el.dataset.date, hr);
    });
  });
}

/* ---------------- Year ---------------- */
function renderYear() {
  const y = currentDate.getFullYear();
  const holidays = germanHolidays(y);
  let html = `<div class="year-grid">`;

  for (let m = 0; m < 12; m++) {
    const monthName = new Date(y, m, 1).toLocaleString(undefined, { month: 'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}">
               <strong>${monthName}</strong>
               <div class="mini-month">`;

    const first = new Date(y, m, 1);
    const firstIdx = (first.getDay() + 6) % 7;
    const lastDate = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < firstIdx; i++) html += `<div class="mini-day"></div>`;

    for (let d = 1; d <= lastDate; d++) {
      const ds = `${y}-${m + 1}-${d}`;
      const hol = holidays.find(h => h.date === ds);
      const evs = normalEventsForDate(ds);
      const bds = birthdaysForDateKey(ds);

      let dots = '';
      if (evs.length) dots += `<span class="year-dot event"></span>`;
      if (bds.length) dots += `<span class="year-dot birthday"></span>`;

      html += `<div class="mini-day">
                 <span class="mini-number ${hol ? 'holiday' : ''}">${d}</span>
                 ${dots ? `<div class="mini-dots">${dots}</div>` : ''}
               </div>`;
    }

    html += `</div></div>`;
  }

  html += `</div>`;
  views.year.innerHTML = html;

  // Click to open selected month
  document.querySelectorAll('.year-month').forEach(el => {
    el.addEventListener('click', () => {
      const yy = parseInt(el.dataset.year, 10);
      const mm = parseInt(el.dataset.month, 10);
      currentDate = new Date(yy, mm, 1);
      setView('month');
    });
  });
}


/* ---------------- Modal & CRUD ---------------- */
let modalOpenFor = null;
function openModal(dateStr, hour){
  modalOpenFor = { date: dateStr, hour: hour };
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  modalDate.textContent = new Date(dateStr).toDateString() + (hour!==undefined ? ` ${pad(hour)}:00` : '');
  eventInput.value = '';

  // fill hour select
  eventHourSelect.innerHTML = '';
  for(let h=0; h<24; h++){ const opt=document.createElement('option'); opt.value=h; opt.text=`${pad(h)}:00`; eventHourSelect.appendChild(opt); }
  if(hour!==undefined){ eventHourCheckbox.checked = true; eventHourSelect.disabled = false; eventHourSelect.value = hour; }
  else { eventHourCheckbox.checked = false; eventHourSelect.disabled = true; }

  if(eventBirthdayCheckbox) eventBirthdayCheckbox.checked = false;

  renderEventList(dateStr);
}

function renderEventList(dateStr){
  eventList.innerHTML = '';
  const [y] = dateStr.split('-').map(Number);
  const holiday = germanHolidays(y).find(h=>h.date===dateStr);
  if(holiday){
    const li=document.createElement('li'); li.textContent=holiday.label; li.style.color='var(--holiday)'; li.style.fontWeight='bold'; eventList.appendChild(li);
  }

  // birthdays deduped
  const bdays = birthdaysForDateKey(dateStr);
  bdays.forEach((b, idx)=>{
    const li=document.createElement('li'); li.textContent=`🎂 ${b.text}`;
    const del=document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', ()=>{
      const lower = b.text.trim().toLowerCase();
      outer: for(const k in events){
        const arr = events[k];
        for(let i=arr.length-1;i>=0;i--){
          if(arr[i] && arr[i].birthday && arr[i].text.trim().toLowerCase()===lower){
            arr.splice(i,1);
            if(arr.length===0) delete events[k];
            break outer;
          }
        }
      }
      localStorage.setItem('events', JSON.stringify(events));
      renderEventList(dateStr); render();
    });
    li.appendChild(del); eventList.appendChild(li);
  });

  (events[dateStr]||[]).forEach((e, idx)=>{
    if(!e.birthday){
      const li=document.createElement('li'); li.textContent = e.hour!==undefined ? `${pad(e.hour)}:00 — ${e.text}` : e.text;
      const del=document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
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

addEventBtn.addEventListener('click', ()=>{
  const txt = eventInput.value.trim();
  if(!txt) return alert('Enter event text');
  const ds = modalOpenFor.date;
  if(!events[ds]) events[ds]=[];
  const ev = { text: txt };
  if(eventBirthdayCheckbox && eventBirthdayCheckbox.checked){
    ev.birthday = true;
  } else if(eventHourCheckbox && eventHourCheckbox.checked){
    ev.hour = parseInt(eventHourSelect.value,10);
  }
  events[ds].push(ev);
  localStorage.setItem('events', JSON.stringify(events));
  modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
  render();
});

closeModalBtn.addEventListener('click', ()=>{ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); });

if(eventHourCheckbox) eventHourCheckbox.addEventListener('change', ()=> { eventHourSelect.disabled = !eventHourCheckbox.checked; });
if(eventBirthdayCheckbox) eventBirthdayCheckbox.addEventListener('change', ()=>{
  if(eventBirthdayCheckbox.checked){
    if(eventHourCheckbox){ eventHourCheckbox.checked=false; eventHourCheckbox.disabled=true; }
    eventHourSelect.disabled = true;
  } else {
    if(eventHourCheckbox) eventHourCheckbox.disabled = false;
  }
});

/* ---------------- Navigation ---------------- */
navBtns.forEach(b=> b.addEventListener('click', ()=> setView(b.dataset.view)));

todayBtn.addEventListener('click', ()=> {
  currentDate = new Date();
  // requirement: Today always shows Month view and highlight today
  setView('month');
});

/* Prev / Next (keep current view) */
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

/* ---------------- Swipe ---------------- */
let startX=0, startY=0;
calendarArea.addEventListener('touchstart', e=> { startX = e.changedTouches[0].screenX; startY = e.changedTouches[0].screenY; }, { passive:true });
calendarArea.addEventListener('touchend', e=> {
  const dx = e.changedTouches[0].screenX - startX, dy = e.changedTouches[0].screenY - startY;
  if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)){ if(dx>0) prevBtn.click(); else nextBtn.click(); }
}, { passive:true });

/* ---------------- Layout adjustments ---------------- */
function adjustRowHeight(){
  const footer = document.querySelector('.footer');
  const footerRect = footer ? footer.getBoundingClientRect() : { height: 0 };
  const available = window.innerHeight - footerRect.height;
  document.querySelectorAll('.view').forEach(v=> v.style.height = `${available}px`);

  const mg = document.querySelector('.month-grid');
  if(mg){
    const weekdays = document.querySelector('.weekdays');
    const weekdaysH = weekdays ? weekdays.getBoundingClientRect().height : 34;
    const rows = Math.ceil(mg.children.length / 7);
    const rowHeight = Math.max(56, Math.floor((available - weekdaysH - 8) / rows));
    document.documentElement.style.setProperty('--row-height', `${rowHeight}px`);
  }
}
window.addEventListener('resize', adjustRowHeight);

/* ---------------- Init ---------------- */
setView('month');
window.addEventListener('load', ()=> { adjustRowHeight(); render(); });

