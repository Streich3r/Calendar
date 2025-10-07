/* app.js - refined final version
   Fixes:
   - Time selection in modal restored
   - Day view scrollable & layout restored
   - Today button renders immediately
*/

const $ = id => document.getElementById(id);
const pad = n => (n < 10 ? '0' + n : '' + n);
const isLeap = y => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));

let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}');

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
const eventBirthdayCheckbox = $('eventBirthdayCheckbox');

function parseKey(k){ return k.split('-').map(x=>parseInt(x,10)); }
function keyFromDate(d){ return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }

/* Holidays */
function calcEaster(y){
  const f=Math.floor;
  const a=y%19,b=f(y/100),c=y%100,d=f(b/4),e=b%4,g=f((8*b+13)/25),h=(19*a+b-d-g+15)%30;
  const i=f(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=f((a+11*h+22*l)/451);
  const month=f((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(y,month-1,day);
}
function germanHolidays(y){
  const arr=[[1,1,"Neujahr"],[5,1,"Tag der Arbeit"],[10,3,"Tag der Deutschen Einheit"],[12,25,"1. Weihnachtstag"],[12,26,"2. Weihnachtstag"]];
  const eas=calcEaster(y), add=(off,txt)=>{const d=new Date(eas);d.setDate(d.getDate()+off);arr.push([d.getMonth()+1,d.getDate(),txt]);};
  add(1,"Ostermontag");add(39,"Christi Himmelfahrt");add(50,"Pfingstmontag");add(60,"Fronleichnam");
  return arr.map(([m,d,l])=>({date:`${y}-${m}-${d}`,label:l}));
}

/* Birthdays recurring */
function getAllBirthdays(){
  const b=[];
  for(const k in events){
    for(const e of events[k]||[]){
      if(e.birthday){
        const [y,m,d]=parseKey(k);
        b.push({text:e.text,month:m,day:d});
      }
    }
  }
  return b;
}
function birthdaysForDateKey(ds){
  const [y,m,d]=parseKey(ds);
  const bdays=getAllBirthdays();
  const out=[];
  for(const b of bdays){
    let bd=b.day, bm=b.month;
    if(bm===2 && bd===29 && !isLeap(y)) bd=28;
    if(bm===m && bd===d) out.push(b);
  }
  return out;
}
function normalEventsForDate(ds){ return (events[ds]||[]).filter(e=>!e.birthday); }

/* RENDER */
function setView(v){
  currentView=v;
  Object.values(views).forEach(e=>{e.classList.remove('active');e.setAttribute('aria-hidden','true');});
  views[v].classList.add('active');views[v].setAttribute('aria-hidden','false');
  navBtns.forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  render();
}
function render(){
  titleEl.textContent=(currentView==='year')?currentDate.getFullYear():currentDate.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  subtitleEl.textContent=(currentView==='day')?currentDate.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}):'';
  if(currentView==='month') renderMonth();
  else if(currentView==='week') renderWeek();
  else if(currentView==='day') renderDay();
  else renderYear();
  adjustRowHeight();
}

/* MONTH */
function renderMonth(){
  const y=currentDate.getFullYear(),m=currentDate.getMonth();
  const first=new Date(y,m,1),firstIdx=(first.getDay()+6)%7,last=new Date(y,m+1,0).getDate();
  const hols=germanHolidays(y),todayKey=keyFromDate(new Date());
  let html=`<div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>`<div>${w}</div>`).join('')}</div><div class="month-grid">`;
  for(let i=0;i<firstIdx;i++)html+=`<div class="day-cell empty"></div>`;
  for(let d=1;d<=last;d++){
    const ds=`${y}-${m+1}-${d}`,hol=hols.find(h=>h.date===ds),today=(ds===todayKey);
    const evs=normalEventsForDate(ds),bds=birthdaysForDateKey(ds);
    const dots=[];
    if(evs.length)dots.push('<div class="day-dot event"></div>');
    if(bds.length)dots.push('<div class="day-dot birthday"></div>');
    const numCls=hol?'holiday':(today?'today':'');
    html+=`<div class="day-cell" data-date="${ds}"><div class="day-number ${numCls}">${d}</div><div class="day-events">${dots.join('')}</div></div>`;
  }
  html+=`</div>`;
  views.month.innerHTML=html;
  document.querySelectorAll('.day-cell[data-date]').forEach(c=>c.onclick=()=>openModal(c.dataset.date));
}

/* WEEK */
function renderWeek(){
  const start=new Date(currentDate);const idx=(start.getDay()+6)%7;start.setDate(start.getDate()-idx);
  const days=[];for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d);}
  let html='<div class="week-grid"><div></div>';
  for(let i=0;i<7;i++){const d=days[i];html+=`<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}<br>${d.getDate()}</div>`;}
  html+='<div class="hour-label">All Day</div>';
  for(const d of days) html+=`<div class="all-day-cell" data-date="${keyFromDate(d)}"></div>`;
  for(let h=0;h<24;h++){html+=`<div class="hour-label">${pad(h)}:00</div>`;for(const d of days){html+=`<div class="hour-cell" data-date="${keyFromDate(d)}" data-hour="${h}"></div>`;}}
  html+='</div>';views.week.innerHTML=html;

  days.forEach(d=>{
    const ds=keyFromDate(d);
    const cont=document.querySelector(`.all-day-cell[data-date="${ds}"]`);
    const hol=germanHolidays(d.getFullYear()).find(h=>h.date===ds);
    if(hol)cont.innerHTML+=`<div class="event holiday">${hol.label.slice(0,3)}...</div>`;
    birthdaysForDateKey(ds).forEach(b=>cont.innerHTML+=`<div class="event birthday">${b.text.slice(0,3)}...</div>`);
    normalEventsForDate(ds).forEach(e=>{if(e.hour==null)cont.innerHTML+=`<div class="event">${e.text.slice(0,3)}...</div>`;});
  });
  for(const ds in events){
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour!=null&&!ev.birthday){
        const c=document.querySelector(`.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`);
        if(c)c.innerHTML+=`<div class="event">${ev.text}</div>`;
      }
    });
  }
  document.querySelectorAll('.hour-cell,.all-day-cell').forEach(c=>c.onclick=()=>openModal(c.dataset.date,c.dataset.hour?parseInt(c.dataset.hour):undefined));
}

/* DAY */
function renderDay(){
  const y=currentDate.getFullYear(),m=currentDate.getMonth(),d=currentDate.getDate();
  const ds=`${y}-${m+1}-${d}`,hol=germanHolidays(y).find(h=>h.date===ds);
  let html=`<div class="day-scroll"><div class="hour-label">All Day</div><div class="all-day-cell" data-date="${ds}"></div>`;
  for(let h=0;h<24;h++) html+=`<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  html+='</div>';views.day.innerHTML=html;views.day.style.overflowY='auto';

  const cont=document.querySelector(`.all-day-cell[data-date="${ds}"]`);
  if(hol)cont.innerHTML+=`<div class="event holiday">${hol.label.slice(0,3)}...</div>`;
  birthdaysForDateKey(ds).forEach(b=>cont.innerHTML+=`<div class="event birthday">${b.text.slice(0,3)}...</div>`);
  normalEventsForDate(ds).forEach(e=>{if(e.hour==null)cont.innerHTML+=`<div class="event">${e.text.slice(0,3)}...</div>`;});
  (events[ds]||[]).forEach(ev=>{
    if(ev.hour!=null&&!ev.birthday){
      const c=document.querySelector(`.day-hour[data-date="${ds}"][data-hour="${ev.hour}"]`);
      if(c)c.innerHTML+=`<div class="event">${ev.text}</div>`;
    }
  });
  document.querySelectorAll('.day-hour,.all-day-cell').forEach(c=>c.onclick=()=>openModal(c.dataset.date,c.dataset.hour?parseInt(c.dataset.hour):undefined));
}

/* YEAR */
function renderYear(){
  const y=currentDate.getFullYear(),hols=germanHolidays(y);
  let html='<div class="year-grid">';
  for(let m=0;m<12;m++){
    const name=new Date(y,m,1).toLocaleString(undefined,{month:'long'});
    html+=`<div class="year-month" data-month="${m}" data-year="${y}"><strong>${name}</strong><div class="year-mini">`;
    const first=new Date(y,m,1),idx=(first.getDay()+6)%7,last=new Date(y,m+1,0).getDate();
    for(let i=0;i<idx;i++)html+='<div></div>';
    for(let d=1;d<=last;d++){
      const ds=`${y}-${m+1}-${d}`,hol=hols.find(h=>h.date===ds),bds=birthdaysForDateKey(ds),evs=normalEventsForDate(ds);
      const numCls=hol?'holiday':'';
      const dots=[];
      if(evs.length)dots.push('<span class="year-dot event"></span>');
      if(bds.length)dots.push('<span class="year-dot birthday"></span>');
      html+=`<div class="${numCls}">${d}${dots.length?`<div class="year-dot-wrap">${dots.join('')}</div>`:''}</div>`;
    }
    html+='</div></div>';
  }
  html+='</div>';views.year.innerHTML=html;
  document.querySelectorAll('.year-month').forEach(e=>e.onclick=()=>{currentDate=new Date(parseInt(e.dataset.year),parseInt(e.dataset.month),1);setView('month');});
}

/* MODAL */
let modalOpenFor=null;
function openModal(ds,hour){
  modalOpenFor={date:ds,hour};
  modal.classList.remove('hidden');
  modalDate.textContent=new Date(ds).toDateString()+(hour!=null?` ${pad(hour)}:00`:'');
  eventInput.value='';
  eventHourSelect.innerHTML='';for(let h=0;h<24;h++){const o=document.createElement('option');o.value=h;o.text=`${pad(h)}:00`;eventHourSelect.appendChild(o);}
  eventHourCheckbox.checked=false;eventHourCheckbox.disabled=false;
  eventHourSelect.disabled=true;
  eventBirthdayCheckbox.checked=false;
  renderEventList(ds);
}
eventHourCheckbox.onchange=()=>eventHourSelect.disabled=!eventHourCheckbox.checked;
eventBirthdayCheckbox.onchange=()=>{if(eventBirthdayCheckbox.checked){eventHourCheckbox.checked=false;eventHourCheckbox.disabled=true;eventHourSelect.disabled=true;}else{eventHourCheckbox.disabled=false;}};

function renderEventList(ds){
  eventList.innerHTML='';
  const [y]=parseKey(ds);const hol=germanHolidays(y).find(h=>h.date===ds);
  if(hol){const li=document.createElement('li');li.textContent=hol.label;li.style.color='var(--holiday)';li.style.fontWeight='bold';eventList.appendChild(li);}
  (events[ds]||[]).forEach((e,i)=>{
    const li=document.createElement('li');
    li.textContent=e.hour!=null?`${pad(e.hour)}:00 — ${e.text}`:e.text;
    const del=document.createElement('button');del.textContent='Delete';
    del.onclick=()=>{events[ds].splice(i,1);if(!events[ds].length)delete events[ds];localStorage.setItem('events',JSON.stringify(events));renderEventList(ds);render();};
    li.appendChild(del);eventList.appendChild(li);
  });
}
addEventBtn.onclick=()=>{
  const txt=eventInput.value.trim();if(!txt)return alert('Enter text');
  const ds=modalOpenFor.date;if(!events[ds])events[ds]=[];
  const ev={text:txt};
  if(eventBirthdayCheckbox.checked)ev.birthday=true;
  else if(eventHourCheckbox.checked)ev.hour=parseInt(eventHourSelect.value);
  events[ds].push(ev);localStorage.setItem('events',JSON.stringify(events));
  modal.classList.add('hidden');render();
};
closeModalBtn.onclick=()=>modal.classList.add('hidden');

/* NAVIGATION */
todayBtn.onclick=()=>{currentDate=new Date();setView(currentView);};
prevBtn.onclick=()=>{if(currentView==='day')currentDate.setDate(currentDate.getDate()-1);else if(currentView==='week')currentDate.setDate(currentDate.getDate()-7);else if(currentView==='month')currentDate.setMonth(currentDate.getMonth()-1);else currentDate.setFullYear(currentDate.getFullYear()-1);render();};
nextBtn.onclick=()=>{if(currentView==='day')currentDate.setDate(currentDate.getDate()+1);else if(currentView==='week')currentDate.setDate(currentDate.getDate()+7);else if(currentView==='month')currentDate.setMonth(currentDate.getMonth()+1);else currentDate.setFullYear(currentDate.getFullYear()+1);render();};
navBtns.forEach(b=>b.onclick=()=>setView(b.dataset.view));

/* SWIPE */
let sx=0,sy=0;
calendarArea.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
calendarArea.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){if(dx>0)prevBtn.click();else nextBtn.click();}},{passive:true});

/* LAYOUT */
function adjustRowHeight(){
  const footer=document.querySelector('.footer');
  const h=footer?footer.getBoundingClientRect().height:0;
  const avail=window.innerHeight-h;
  document.querySelectorAll('.view').forEach(v=>v.style.height=`${avail}px`);
}
window.onresize=adjustRowHeight;
setView('month');
window.onload=adjustRowHeight;
