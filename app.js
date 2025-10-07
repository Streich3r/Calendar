// app.js — komplett, kopierbar
const $ = id => document.getElementById(id);

// state
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{ text, hour?, birthday? }, ...] }

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
const parseKey = k => k.split('-').map(Number);
const isLeap = y => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
const ymd = d => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
const sameDay = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

// Easter + holidays
function calcEaster(y){const f=Math.floor,a=y%19,b=f(y/100),c=y%100,d=f(b/4),e=b%4,g=f((8*b+13)/25),h=(19*a+b-d-g+15)%30,i=f(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=f((a+11*h+22*l)/451),month=f((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(y,month-1,day);}
function germanHolidays(year){
  const fixed=[[1,1,"Neujahr"],[5,1,"Tag der Arbeit"],[10,3,"Tag der Deutschen Einheit"],[12,25,"1. Weihnachtstag"],[12,26,"2. Weihnachtstag"]];
  const eas = calcEaster(year);
  const add=(off,label)=>{const d=new Date(eas);d.setDate(d.getDate()+off);fixed.push([d.getMonth()+1,d.getDate(),label]);};
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return fixed.map(([m,d,label])=>({date:`${year}-${m}-${d}`,label}));
}

// get recurring birthdays that should appear on given month/day in targetYear
function getRecurringBirthdaysForMonthDay(month, day, targetYear){
  const out=[];
  for(const k in events){
    const arr = events[k];
    if(!Array.isArray(arr)) continue;
    const [origY, origM, origD] = parseKey(k);
    arr.forEach(ev=>{
      if(ev && ev.birthday){
        let showM = origM, showD = origD;
        if(origM===2 && origD===29 && !isLeap(targetYear)) showD = 28;
        if(showM===month && showD===day){
          out.push({ text: ev.text, origKey:k });
        }
      }
    });
  }
  return out;
}

// combine direct birthdays (on this exact key) with recurring ones, dedupe by normalized text
function getBirthdaysForDate(ds){
  const [y, m, d] = parseKey(ds);
  const direct = (events[ds]||[]).filter(e=>e.birthday).map(e=>({ text:e.text }));
  const recurring = getRecurringBirthdaysForMonthDay(m, d, y);
  // dedupe by lowercase text
  const seen = new Set();
  const res = [];
  direct.forEach(e=>{ const k=e.text.trim().toLowerCase(); if(!seen.has(k)){ seen.add(k); res.push(e); } });
  recurring.forEach(e=>{ const k=e.text.trim().toLowerCase(); if(!seen.has(k)){ seen.add(k); res.push(e); } });
  return res;
}

// normal events for date (non-birthday)
function getNormalEventsForDate(ds){
  return (events[ds]||[]).filter(e=>!e.birthday);
}

// view switch
function setView(v){
  currentView = v;
  Object.values(views).forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-hidden','true'); });
  views[v].classList.add('active'); views[v].setAttribute('aria-hidden','false');
  navBtns.forEach(b=>{ b.classList.toggle('active', b.dataset.view===v); b.setAttribute('aria-pressed', b.dataset.view===v ? 'true' : 'false'); });
  render();
}

// render master
function render(){
  titleEl.textContent = currentView==='year' ? currentDate.getFullYear() : currentDate.toLocaleDateString(undefined,{ month:'long', year:'numeric' });
  subtitleEl.textContent = currentView==='day' ? currentDate.toLocaleDateString(undefined,{ weekday:'short', day:'numeric', month:'short' }) : '';
  if(currentView==='month') renderMonth();
  else if(currentView==='week') renderWeek();
  else if(currentView==='day') renderDay();
  else renderYear();
  adjustRowHeight();
}

/* ---------- MONTH ---------- */
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const first = new Date(y,m,1), firstIdx=(first.getDay()+6)%7, lastDate=new Date(y,m+1,0).getDate();
  const holidays = germanHolidays(y);
  let html = `<div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>`<div>${w}</div>`).join('')}</div><div class="month-grid">`;
  for(let i=0;i<firstIdx;i++) html += `<div class="day-cell empty"></div>`;
  for(let d=1; d<=lastDate; d++){
    const dt=new Date(y,m,d); const ds=`${y}-${m+1}-${d}`; const isToday = sameDay(dt, new Date());
    const holiday = holidays.find(h=>h.date===ds);
    const normal = getNormalEventsForDate(ds);
    const bdays = getBirthdaysForDate(ds);
    let dots='';
    if(normal.length) dots += `<span class="day-dot event" title="${normal.map(e=>e.text).join(', ')}"></span>`;
    if(bdays.length) dots += `<span class="day-dot birthday" title="${bdays.map(b=>b.text).join(', ')}"></span>`;
    const numClass = holiday ? 'holiday' : (isToday ? 'today' : '');
    html += `<div class="day-cell" data-date="${ds}" ${holiday?`title="${holiday.label}"`:''}>
      <div class="day-number ${numClass}">${d}</div>
      <div class="day-events">${dots}</div>
    </div>`;
  }
  const total = firstIdx + lastDate; const rem=(7-(total%7))%7; for(let i=0;i<rem;i++) html += `<div class="day-cell empty"></div>`;
  html += `</div>`;
  views.month.innerHTML = html;
  document.querySelectorAll('.day-cell[data-date]').forEach(el=>el.addEventListener('click', ()=> openModal(el.dataset.date)));
}

/* ---------- WEEK ---------- */
function renderWeek(){
  const start = new Date(currentDate); const dayIdx=(start.getDay()+6)%7; start.setDate(start.getDate() - dayIdx);
  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const holidays = germanHolidays(currentDate.getFullYear());
  // Build grid: header row (empty + weekday headers), then all-day label+cells, then hours
  let html = `<div class="week-grid">`;
  // header row: top-left empty
  html += `<div></div>`;
  for(let i=0;i<7;i++){ const d=new Date(start); d.setDate(start.getDate()+i); html += `<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${weekdays[i]}<br>${d.getDate()}</div>`; }
  // all-day row: label + cells
  html += `<div class="all-day-label">All Day</div>`;
  const days = [];
  for(let i=0;i<7;i++){ const d=new Date(start); d.setDate(start.getDate()+i); days.push(d); const ds=ymd(d); html += `<div class="all-day-cell" data-date="${ds}"></div>`; }
  // hourly rows
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div>`;
    for(let i=0;i<7;i++){
      const d = days[i]; const ds=ymd(d);
      html += `<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
    }
  }
  html += `</div>`;
  views.week.innerHTML = html;

  // populate all-day cells
  days.forEach(d=>{
    const ds = ymd(d);
    const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
    const holiday = germanHolidays(d.getFullYear()).find(h=>h.date===ds);
    if(holiday){
      const el = document.createElement('div'); el.className='all-day-badge holiday'; el.textContent = holiday.label; container.appendChild(el);
    }
    const bdays = getBirthdaysForDate(ds);
    bdays.forEach(b=>{
      const el = document.createElement('div'); el.className='all-day-badge birthday'; el.textContent = b.text; container.appendChild(el);
    });
    // all-day normal events (no hour)
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour===undefined || ev.hour===null){
        if(!ev.birthday){
          const el = document.createElement('div'); el.className='all-day-badge'; el.textContent = ev.text; container.appendChild(el);
        }
      }
    });
  });

  // populate hourly events (normal events only)
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

  // click handlers
  document.querySelectorAll('.all-day-cell, .hour-cell').forEach(c=> c.addEventListener('click', ()=> openModal(c.dataset.date, c.dataset.hour ? parseInt(c.dataset.hour,10) : undefined)));
}

/* ---------- DAY ---------- */
function renderDay(){
  const ds = ymd(currentDate);
  // build: left column + right column (all-day, then hours)
  let html = `<div class="day-view">`;
  html += `<div class="hour-label all-day-label">All Day</div><div class="all-day-cell" data-date="${ds}"></div>`;
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;

  // fill all-day: holiday, birthdays, events without hour
  const container = document.querySelector(`.all-day-cell[data-date="${ds}"]`);
  const holiday = germanHolidays(currentDate.getFullYear()).find(h=>h.date===ds);
  if(holiday){
    const el = document.createElement('div'); el.className='all-day-badge holiday'; el.textContent = holiday.label; container.appendChild(el);
  }
  const bdays = getBirthdaysForDate(ds);
  bdays.forEach(b=>{
    const el = document.createElement('div'); el.className='all-day-badge birthday'; el.textContent = b.text; container.appendChild(el);
  });
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour===undefined || ev.hour===null){
      if(!ev.birthday){
        const el = document.createElement('div'); el.className='all-day-badge'; el.textContent = ev.text; container.appendChild(el);
      }
    }
  });

  // fill hourly
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour!==undefined && ev.hour!==null && !ev.birthday){
      const cell = document.querySelector(`.day-hour[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if(cell){
        const el = document.createElement('div'); el.className='event'; el.textContent = ev.text; cell.appendChild(el);
      }
    }
  });

  // click handlers
  document.querySelectorAll('.all-day-cell, .day-hour').forEach(c=> c.addEventListener('click', ()=> openModal(c.dataset.date, c.dataset.hour ? parseInt(c.dataset.hour,10) : undefined)));
}

/* ---------- YEAR ---------- */
function renderYear(){
  const y = currentDate.getFullYear();
  const holidays = germanHolidays(y);
  let html = `<div class="year-grid">`;
  for(let m=0;m<12;m++){
    const name = new Date(y,m,1).toLocaleString(undefined,{ month:'long' });
    html += `<div class="year-month" data-month="${m}" data-year="${y}"><strong>${name}</strong>${renderMiniMonth(y,m,holidays)}</div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;
  // click month -> month view
  document.querySelectorAll('.year-month').forEach(el=> el.addEventListener('click', ()=> { currentDate = new Date(parseInt(el.dataset.year,10), parseInt(el.dataset.month,10), 1); setView('month'); }));
}
function renderMiniMonth(y,m,holidays){
  const first = new Date(y,m,1), firstIdx=(first.getDay()+6)%7, lastDate=new Date(y,m+1,0).getDate();
  let mini = `<div class="year-mini" style="display:grid;grid-template-columns:repeat(7,1fr);">`;
  for(let i=0;i<firstIdx;i++) mini += `<div></div>`;
  for(let d=1; d<=lastDate; d++){
    const ds = `${y}-${m+1}-${d}`;
    const normal = getNormalEventsForDate(ds);
    const bdays = getBirthdaysForDate(ds);
    const holiday = holidays.find(h=>h.date===ds);
    // prepare dots markup (small, centered under number)
    let dotHtml = `<div class="mini-dots">`;
    if(normal.length) dotHtml += `<span class="mini-dot" style="background:var(--event)"></span>`;
    if(bdays.length) dotHtml += `<span class="mini-dot" style="background:var(--birthday)"></span>`;
    dotHtml += `</div>`;
    const numColor = holiday ? 'var(--holiday)' : 'inherit';
    mini += `<div style="position:relative; padding:4px; min-height:28px;">
                <div style="line-height:1;font-size:11px;color:${numColor};">${d}</div>
                ${ (normal.length || bdays.length) ? dotHtml : '' }
              </div>`;
  }
  mini += `</div>`;
  return mini;
}

/* ---------- Modal ---------- */
let modalOpenFor = null;
function openModal(ds, hour){
  modalOpenFor = { date: ds, hour: hour };
  modal.classList.remove('hidden');
  modalDate.textContent = new Date(ds).toDateString() + (hour!==undefined ? ` ${pad(hour)}:00` : '');
  eventInput.value = '';
  // reset controls
  eventHourCheckbox.checked = false; eventHourSelect.disabled = true;
  eventBirthdayCheckbox.checked = false;
  // eventBirthdayCheckbox disables hour selection
  eventBirthdayCheckbox.onchange = () => {
    if(eventBirthdayCheckbox.checked){ eventHourCheckbox.checked = false; eventHourSelect.disabled = true; eventHourCheckbox.disabled = true; }
    else eventHourCheckbox.disabled = false;
  };
  // populate hour select
  eventHourSelect.innerHTML = ''; for(let h=0; h<24; h++){ const opt=document.createElement('option'); opt.value=h; opt.text=`${pad(h)}:00`; eventHourSelect.appendChild(opt); }
  renderEventList(ds);
}
function renderEventList(ds){
  eventList.innerHTML = '';
  const [y] = parseKey(ds);
  const holiday = germanHolidays(y).find(h=>h.date===ds);
  if(holiday){
    const li = document.createElement('li'); li.textContent = `📅 ${holiday.label}`; li.style.color = 'var(--holiday)'; li.style.fontWeight='bold'; eventList.appendChild(li);
  }
  // recurring + direct birthdays (deduped by getBirthdaysForDate)
  const bdays = getBirthdaysForDate(ds);
  bdays.forEach((b, idx)=>{
    const li = document.createElement('li'); li.textContent = `🎂 ${b.text}`;
    const del = document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click', ()=>{
      // remove first matching birthday text anywhere
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
      renderEventList(ds); render();
    });
    li.appendChild(del); eventList.appendChild(li);
  });

  // direct events on this exact date
  (events[ds]||[]).forEach((e, idx)=>{
    if(!e.birthday){
      const li=document.createElement('li'); li.textContent = (e.hour!==undefined?`${pad(e.hour)}:00 — `:'') + e.text;
      const del=document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
      del.addEventListener('click', ()=>{
        events[ds].splice(idx,1); if(events[ds].length===0) delete events[ds];
        localStorage.setItem('events', JSON.stringify(events));
        renderEventList(ds); render();
      });
      li.appendChild(del); eventList.appendChild(li);
    }
  });
}

// add event
addEventBtn.addEventListener('click', ()=>{
  const txt = eventInput.value.trim(); if(!txt) return alert('Enter event text');
  const ds = modalOpenFor.date;
  if(!events[ds]) events[ds]=[];
  const ev = { text: txt };
  if(eventBirthdayCheckbox.checked){
    ev.birthday = true;
    // birthday is stored on the chosen key (orig year kept)
  } else if(eventHourCheckbox.checked){
    ev.hour = parseInt(eventHourSelect.value,10);
  }
  events[ds].push(ev);
  localStorage.setItem('events', JSON.stringify(events));
  modal.classList.add('hidden');
  render();
});
closeModalBtn.addEventListener('click', ()=> modal.classList.add('hidden'));
eventHourCheckbox.addEventListener('change', ()=> eventHourSelect.disabled = !eventHourCheckbox.checked);

// navigation
navBtns.forEach(b=> b.addEventListener('click', ()=> setView(b.dataset.view)));
todayBtn.addEventListener('click', ()=> { currentDate = new Date(); setView(currentView); });

// prev/next
prevBtn.addEventListener('click', ()=> { if(currentView==='day') currentDate.setDate(currentDate.getDate()-1); else if(currentView==='week') currentDate.setDate(currentDate.getDate()-7); else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()-1); else currentDate.setFullYear(currentDate.getFullYear()-1); render(); });
nextBtn.addEventListener('click', ()=> { if(currentView==='day') currentDate.setDate(currentDate.getDate()+1); else if(currentView==='week') currentDate.setDate(currentDate.getDate()+7); else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()+1); else currentDate.setFullYear(currentDate.getFullYear()+1); render(); });

// swipe left/right
let touchStartX=0;
calendarArea.addEventListener('touchstart', e=> touchStartX = e.changedTouches[0].screenX, {passive:true});
calendarArea.addEventListener('touchend', e=> { const dx = e.changedTouches[0].screenX - touchStartX; if(Math.abs(dx) > 50) { if(dx > 0) prevBtn.click(); else nextBtn.click(); } }, {passive:true});

// adjust heights + month row heights
function adjustRowHeight(){
  const footer = document.querySelector('.footer');
  const footerH = footer ? footer.getBoundingClientRect().height : 0;
  const available = window.innerHeight - footerH;
  document.querySelectorAll('.view').forEach(v => v.style.height = `${available}px`);
  // month grid row height
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
