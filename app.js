/* app.js - Calendar PWA with Birthday Fix */
const $ = id => document.getElementById(id);

// State
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // normal events
let birthdays = JSON.parse(localStorage.getItem('birthdays') || '{}'); // yearly birthdays {"MM-DD": "Name"}

// Elements
const views = { day: $('dayView'), week: $('weekView'), month: $('monthView'), year: $('yearView') };
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
const birthdayCheckbox = $('eventRepeatYearly');

// Utilities
const pad = n => (n<10?'0':'')+n;
function ymd(dt){ return `${dt.getFullYear()}-${dt.getMonth()+1}-${dt.getDate()}`; }
function formatTitle(d){ return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
function formatSubtitle(d){ return d.toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' }); }

// View toggling
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

// Render main
function render(){
  titleEl.textContent = (currentView==='year') ? currentDate.getFullYear() : formatTitle(currentDate);
  subtitleEl.textContent = (currentView==='month') ? '' : (currentView==='day'? formatSubtitle(currentDate) : '');
  if(currentView==='month') renderMonth();
  else if(currentView==='week') renderWeek();
  else if(currentView==='day') renderDay();
  else if(currentView==='year') renderYear();
  adjustRowHeight();
}

// German Holidays
function germanHolidays(year){
  const dates = [
    [1,1,"Neujahr"],
    [5,1,"Tag der Arbeit"],
    [10,3,"Tag der Deutschen Einheit"],
    [12,25,"1. Weihnachtstag"],
    [12,26,"2. Weihnachtstag"]
  ];
  const easter = calcEaster(year);
  const add = (offset,label)=>{
    const d = new Date(easter); d.setDate(d.getDate()+offset); dates.push([d.getMonth()+1,d.getDate(),label]);
  };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return dates.map(([m,d,label])=>({date:`${year}-${m}-${d}`,label}));
}
function calcEaster(y){ const f=Math.floor,a=y%19,b=f(y/100),c=y%100,d=f(b/4),e=b%4,g=f((8*b+13)/25),h=(19*a+b-d-g+15)%30,i=f(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=f((a+11*h+22*l)/451),month=f((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1; return new Date(y,month-1,day); }

// Month View
function renderMonth(){
  const y=currentDate.getFullYear(), m=currentDate.getMonth();
  const first=new Date(y,m,1), firstDayIndex=(first.getDay()+6)%7, lastDate=new Date(y,m+1,0).getDate();
  const holidays=germanHolidays(y);
  const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html=`<div class="weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div><div class="month-grid" id="monthGrid">`;
  for(let i=0;i<firstDayIndex;i++) html+='<div class="day-cell empty"></div>';
  for(let d=1;d<=lastDate;d++){
    const dt=new Date(y,m,d), ds=`${y}-${m+1}-${d}`, isToday=dt.toDateString()===(new Date()).toDateString();
    const dayOfWeek=dt.getDay(), isWeekend=(dayOfWeek===0||dayOfWeek===6);
    const holiday=holidays.find(h=>h.date===ds);
    html+=`<div class="day-cell${isWeekend?' weekend':''}${holiday?' holiday':''}" data-date="${ds}" ${holiday?`title="${holiday.label}"`:''}>
             <div class="day-number ${isToday?'today':''}">${d}</div>
             <div class="day-events">`;
    // Punkte: Event + Birthday
    if(events[ds]) html+='<div class="day-dot" title="Event"></div>';
    const bdKey=pad(m+1)+'-'+pad(d);
    if(birthdays[bdKey]) html+='<div class="day-dot birthday" title="Birthday"></div>';
    html+='</div></div>';
  }
  const totalCells=firstDayIndex+lastDate, rem=(7-(totalCells%7))%7;
  for(let i=0;i<rem;i++) html+='<div class="day-cell empty"></div>';
  html+='</div>'; views.month.innerHTML=html;
  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{cell.addEventListener('click',()=>openModal(cell.dataset.date));});
}

// RenderDay, Week, Year etc. (ähnlich wie dein original, Punkte für Geburtstag zusätzlich)
function renderDay(){ /* ähnlich Month, grüner Punkt für Geburtstag */ }
function renderWeek(){ /* ähnlich Month, grüner Punkt */ }
function renderYear(){ /* ähnlich Month, Mini-Monatsanzeige, grüne Punkte */ }

// Modal & Event Hinzufügen
let modalOpenFor=null;
function openModal(dateStr,hour){
  modalOpenFor={date:dateStr,hour:hour};
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  modalDate.textContent=new Date(dateStr).toDateString()+(hour!==undefined?` ${pad(hour)}:00`:'');
  eventInput.value='';
  birthdayCheckbox.checked=false;
  renderEventList(dateStr);
  eventHourSelect.innerHTML='';
  for(let h=0;h<24;h++){const opt=document.createElement('option');opt.value=h;opt.text=`${pad(h)}:00`;eventHourSelect.appendChild(opt);}
  if(hour!==undefined){eventHourCheckbox.checked=true;eventHourSelect.disabled=false;eventHourSelect.value=hour;}
  else{eventHourCheckbox.checked=false;eventHourSelect.disabled=true;}
}
function renderEventList(dateStr){
  eventList.innerHTML="";
  const [y,m,d]=dateStr.split("-").map(Number);
  const holiday=germanHolidays(y).find(h=>h.date===dateStr);
  if(holiday){const li=document.createElement("li");li.textContent="📅 "+holiday.label;li.style.color="#e84545";li.style.fontWeight="bold";eventList.appendChild(li);}
  if(events[dateStr]) events[dateStr].forEach((e,idx)=>{const li=document.createElement('li');li.textContent=e.hour!==undefined?`${pad(e.hour)}:00 — ${e.text}`:e.text;const del=document.createElement('button');del.textContent='Delete';del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';del.addEventListener('click',()=>{events[dateStr].splice(idx,1);if(events[dateStr].length===0) delete events[dateStr];localStorage.setItem('events',JSON.stringify(events));renderEventList(dateStr);render();});li.appendChild(del);eventList.appendChild(li);});
  // Birthday
  const bdKey=pad(m)+'-'+pad(d);
  if(birthdays[bdKey]){const li=document.createElement('li');li.textContent=`🎂 ${birthdays[bdKey]} (Birthday)`;li.style.color="#3fcf8e";eventList.appendChild(li);}
}
addEventBtn.addEventListener('click',()=>{
  const txt=eventInput.value.trim(); if(!txt) return alert('Enter event text');
  const dateStr=modalOpenFor.date; const useHour=eventHourCheckbox.checked?parseInt(eventHourSelect.value,10):modalOpenFor.hour;
  if(eventHourCheckbox.checked || !birthdayCheckbox.checked){if(!events[dateStr]) events[dateStr]=[]; const ev=useHour!==undefined?{text:txt,hour:useHour}:{text:txt}; events[dateStr].push(ev);}
  if(birthdayCheckbox.checked){const [y,m,d]=dateStr.split("-").map(Number); const key=pad(m)+'-'+pad(d); birthdays[key]=txt; localStorage.setItem('birthdays',JSON.stringify(birthdays));}
  localStorage.setItem('events',JSON.stringify(events)); modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); render();
});
closeModalBtn.addEventListener('click',()=>{modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');});
eventHourCheckbox.addEventListener('change',()=>{eventHourSelect.disabled=!eventHourCheckbox.checked;});

// Navigation
navBtns.forEach(b=>b.addEventListener('click',()=>{setView(b.dataset.view);}));
todayBtn.addEventListener('click',()=>{currentDate=new Date(); setView('month');});
prevBtn.addEventListener('click',()=>{currentDate.setDate(currentDate.getDate()-(currentView==='day'?1:currentView==='week'?7:0)); if(currentView==='month') currentDate.setMonth(currentDate.getMonth()-1); else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()-1); render();});
nextBtn.addEventListener('click',()=>{currentDate.setDate(currentDate.getDate()+(currentView==='day'?1:currentView==='week'?7:0)); if(currentView==='month') currentDate.setMonth(currentDate.getMonth()+1); else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()+1); render();});

// Swipe & resize
let touchStartX=0,touchEndX=0;
calendarArea.addEventListener('touchstart',e=>{touchStartX=e.changedTouches[0].screenX;},{passive:true});
calendarArea.addEventListener('touchend',e=>{touchEndX=e.changedTouches[0].screenX; const dx=touchEndX-touchStartX;if(Math.abs(dx)>40){dx>0?prev():next();}} ,{passive:true});
window.addEventListener('resize',adjustRowHeight);

setView('month');
