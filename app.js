const $ = id => document.getElementById(id);

let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}');

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
const eventRepeatYearly = $('eventRepeatYearly');

const pad = n => (n<10?'0':'')+n;
function ymd(dt){ return `${dt.getFullYear()}-${dt.getMonth()+1}-${dt.getDate()}`; }
function formatTitle(d){ return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
function formatSubtitle(d){ return d.toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' }); }

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

function render(){
  titleEl.textContent = (currentView==='year') ? currentDate.getFullYear() : formatTitle(currentDate);
  subtitleEl.textContent = (currentView==='month') ? '' : (currentView==='day'? formatSubtitle(currentDate) : '');
  if(currentView==='month') renderMonth();
  else if(currentView==='week') renderWeek();
  else if(currentView==='day') renderDay();
  else if(currentView==='year') renderYear();
  adjustRowHeight();
}

// Feiertage & Geburtstage & Events
function germanHolidays(year) {
  const dates = [
    [1,1,"Neujahr"], [5,1,"Tag der Arbeit"], [10,3,"Tag der Deutschen Einheit"],
    [12,25,"1. Weihnachtstag"], [12,26,"2. Weihnachtstag"]
  ];
  const easter = calcEaster(year);
  const add = (offset,label)=>{
    const d = new Date(easter); d.setDate(d.getDate()+offset); dates.push([d.getMonth()+1, d.getDate(), label]);
  };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return dates.map(([m,d,label])=>({date:`${year}-${m}-${d}`,label}));
}
function calcEaster(y) {
  const f=Math.floor,a=y%19,b=f(y/100),c=y%100,d=f(b/4),e=b%4,g=f((8*b+13)/25),h=(19*a+b-d-g+15)%30,i=f(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=f((a+11*h+22*l)/451),month=f((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(y,month-1,day);
}

// Punkte generieren
function getEventsForDate(date){
  const ds = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
  const normalEvents = events[ds]||[];
  const yearlyEvents = Object.values(events).flat().filter(ev=>ev.repeat==='yearly' &&
      new Date(ev.date).getDate()===date.getDate() && new Date(ev.date).getMonth()===date.getMonth());
  const holidays = germanHolidays(date.getFullYear()).map(h=>{
    const parts = h.date.split('-').map(Number);
    if(parts[0]===date.getFullYear() && parts[1]===date.getMonth()+1 && parts[2]===date.getDate())
      return {text:h.label,holiday:true};
  }).filter(Boolean);
  return [...normalEvents,...yearlyEvents,...holidays];
}
function renderDayDots(el,date){
  const allEvents = getEventsForDate(date);
  const container = el.querySelector('.day-events') || document.createElement('div');
  container.className='day-events';
  container.innerHTML='';
  allEvents.forEach(ev=>{
    const dot = document.createElement('div');
    dot.className='day-dot';
    if(ev.holiday) dot.classList.add('holiday');
    else if(ev.repeat==='yearly') dot.classList.add('birthday');
    container.appendChild(dot);
  });
  if(!el.querySelector('.day-events')) el.appendChild(container);
}

// Modal Logic
let modalOpenFor=null;
function openModal(dateStr,hour){
  modalOpenFor={date:dateStr,hour:hour};
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  modalDate.textContent=new Date(dateStr).toDateString()+(hour!==undefined?` ${pad(hour)}:00`:'');
  eventInput.value='';
  renderEventList(dateStr);

  eventHourSelect.innerHTML='';
  for(let h=0;h<24;h++){ const opt=document.createElement('option'); opt.value=h; opt.text=`${pad(h)}:00`; eventHourSelect.appendChild(opt); }

  if(hour!==undefined){ eventHourCheckbox.checked=true; eventHourSelect.disabled=false; eventHourSelect.value=hour; }
  else { eventHourCheckbox.checked=false; eventHourSelect.disabled=true; }

  eventRepeatYearly.checked=false;
}

function renderEventList(dateStr){
  eventList.innerHTML='';
  const [y,m,d]=dateStr.split('-').map(Number);
  const holiday = germanHolidays(y).find(h=>h.date===dateStr);
  if(holiday){ const li=document.createElement("li"); li.textContent="📅 "+holiday.label; li.style.color="#e84545"; li.style.fontWeight="bold"; eventList.appendChild(li);}
  (events[dateStr]||[]).forEach((e,idx)=>{
    const li=document.createElement('li');
    li.textContent=e.hour!==undefined?`${pad(e.hour)}:00 — ${e.text}`:e.text;
    const del=document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click',()=>{
      events[dateStr].splice(idx,1); if(events[dateStr].length===0) delete events[dateStr]; localStorage.setItem('events',JSON.stringify(events)); renderEventList(dateStr); render();
    });
    li.appendChild(del); eventList.appendChild(li);
  });
}

addEventBtn.addEventListener('click',()=>{
  const txt=eventInput.value.trim(); if(!txt) return alert('Enter event text');
  const dateStr=modalOpenFor.date;
  const useHour=eventHourCheckbox.checked?parseInt(eventHourSelect.value,10):modalOpenFor.hour;
  if(!events[dateStr]) events[dateStr]=[];
  const ev=useHour!==undefined?{text:txt,hour:useHour}:{text:txt};
  if(eventRepeatYearly.checked){ev.repeat='yearly'; ev.date=dateStr;}
  events[dateStr].push(ev);
  localStorage.setItem('events',JSON.stringify(events));
  modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); render();
});
closeModalBtn.addEventListener('click',()=>{modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');});
eventHourCheckbox.addEventListener('change',()=>{eventHourSelect.disabled=!eventHourCheckbox.checked;});

navBtns.forEach(b=>b.addEventListener('click',()=>{setView(b.dataset.view);}));
todayBtn.addEventListener('click',()=>{currentDate=new Date(); setView('month');});

function prev(){ if(currentView==='day') currentDate.setDate(currentDate.getDate()-1); else if(currentView==='week') currentDate.setDate(currentDate.getDate()-7); else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()-1); else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()-1); render(); }
function next(){ if(currentView==='day') currentDate.setDate(currentDate.getDate()+1); else if(currentView==='week') currentDate.setDate(currentDate.getDate()+7); else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()+1); else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()+1); render(); }
prevBtn.addEventListener('click',prev); nextBtn.addEventListener('click',next);

window.addEventListener('resize',adjustRowHeight);
setView('month');

/* ===== Month View ===== */
function renderMonth(){
  const y=currentDate.getFullYear(),m=currentDate.getMonth();
  const first=new Date(y,m,1); const firstDayIndex=(first.getDay()+6)%7;
  const lastDate=new Date(y,m+1,0).getDate();
  let html=`<div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>`<div>${w}</div>`).join('')}</div>`;
  html+=`<div class="month-grid">`;
  for(let i=0;i<firstDayIndex;i++) html+=`<div class="day-cell empty"></div>`;
  for(let d=1;d<=lastDate;d++){
    const dt=new Date(y,m,d); const ds=`${y}-${m+1}-${d}`;
    html+=`<div class="day-cell" data-date="${ds}"><div class="day-number ${dt.toDateString()===new Date().toDateString()?'today':''}">${d}</div></div>`;
  }
  const totalCells=firstDayIndex+lastDate; const rem=(7-(totalCells%7))%7;
  for(let i=0;i<rem;i++) html+=`<div class="day-cell empty"></div>`; html+='</div>';
  views.month.innerHTML=html;
  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{ renderDayDots(cell,new Date(cell.dataset.date)); cell.addEventListener('click',()=>openModal(cell.dataset.date)); });
}

/* ===== Week View ===== */
function renderWeek(){
  const start=new Date(currentDate); start.setDate(start.getDate()-(start.getDay()+6)%7);
  let html=`<div class="week-grid"><div></div>`;
  const days=[]; for(let i=0;i<7;i++){ const d=new Date(start); d.setDate(start.getDate()+i); days.push(d); html+=`<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}<br>${d.getDate()}</div>`;}
  for(let h=0;h<24;h++){ html+=`<div class="hour-label">${pad(h)}:00</div>`; for(let i=0;i<7;i++){ const d=days[i]; html+=`<div class="hour-cell" data-date="${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}" data-hour="${h}"></div>`; } }
  html+=`</div>`; views.week.innerHTML=html;
  days.forEach(d=>{ const ds=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; document.querySelectorAll(`.hour-cell[data-date="${ds}"]`).forEach(cell=>renderDayDots(cell,d)); });
  document.querySelectorAll('.hour-cell').forEach(cell=>cell.addEventListener('click',()=>openModal(cell.dataset.date,parseInt(cell.dataset.hour,10))));
}

/* ===== Day View ===== */
function renderDay(){
  const y=currentDate.getFullYear(),m=currentDate.getMonth(),d=currentDate.getDate();
  const ds=`${y}-${m+1}-${d}`;
  let html=`<div style="display:grid;grid-template-columns:60px 1fr">`;
  for(let h=0;h<24;h++){ html+=`<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;}
  html+='</div>'; views.day.innerHTML=html;
  document.querySelectorAll(`.day-hour`).forEach(cell=>renderDayDots(cell,currentDate));
  document.querySelectorAll('.day-hour').forEach(cell=>cell.addEventListener('click',()=>openModal(cell.dataset.date,parseInt(cell.dataset.hour,10))));
}

/* ===== Year View ===== */
function renderYear(){
  const y=currentDate.getFullYear();
  let html=`<div class="year-grid">`;
  for(let m=0;m<12;m++){
    const monthStart=new Date(y,m,1);
    const monthName=monthStart.toLocaleString(undefined,{month:'long'});
    html+=`<div class="year-month" data-month="${m}" data-year="${y}"><strong>${monthName}</strong><div style="font-size:12px;margin-top:6px">`;
    const first=new Date(y,m,1); const firstIdx=(first.getDay()+6)%7; const lastDate=new Date(y,m+1,0).getDate();
    for(let i=0;i<firstIdx;i++) html+=`<div></div>`;
    for(let d=1;d<=lastDate;d++){ const dt=new Date(y,m,d); html+=`<div class="day-cell" data-date="${y}-${m+1}-${d}"><div class="day-number">${d}</div></div>`;}
    html+='</div></div>';
  }
  html+='</div>'; views.year.innerHTML=html;
  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{ renderDayDots(cell,new Date(cell.dataset.date)); cell.addEventListener('click',()=>openModal(cell.dataset.date)); });
}
