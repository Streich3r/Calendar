const $ = id => document.getElementById(id);

let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}');

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
const eventBirthdayCheckbox = $('eventBirthdayCheckbox');
const eventHourSelect = $('eventHour');

const pad = n => (n < 10 ? '0' : '') + n;
function ymd(dt) { return `${dt.getFullYear()}-${dt.getMonth()+1}-${dt.getDate()}`; }
function formatTitle(d) { return d.toLocaleDateString(undefined, { month:'long', year:'numeric' }); }
function formatSubtitle(d){ return d.toLocaleDateString(undefined,{ weekday:'short', day:'numeric', month:'short'}); }

function setView(v) {
  currentView = v;
  Object.values(views).forEach(el => { el.classList.remove('active'); el.setAttribute('aria-hidden','true'); });
  views[v].classList.add('active');
  views[v].setAttribute('aria-hidden','false');
  navBtns.forEach(b=>{
    b.classList.toggle('active',b.dataset.view===v);
    b.setAttribute('aria-pressed', b.dataset.view===v ? 'true':'false');
  });
  render();
}

function render() {
  titleEl.textContent = currentView==='year' ? currentDate.getFullYear() : formatTitle(currentDate);
  subtitleEl.textContent = currentView==='month' ? '' : (currentView==='day'?formatSubtitle(currentDate):'');
  if (currentView==='month') renderMonth();
  else if (currentView==='week') renderWeek();
  else if (currentView==='day') renderDay();
  else renderYear();
  adjustRowHeight();
}

/* Feiertage */
function germanHolidays(year) {
  const dates=[[1,1,"Neujahr"],[5,1,"Tag der Arbeit"],[10,3,"Tag der Deutschen Einheit"],[12,25,"1. Weihnachtstag"],[12,26,"2. Weihnachtstag"]];
  const easter=calcEaster(year);
  const add=(offset,label)=>{const d=new Date(easter);d.setDate(d.getDate()+offset);dates.push([d.getMonth()+1,d.getDate(),label]);};
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return dates.map(([m,d,l])=>({date:`${year}-${m}-${d}`,label:l}));
}
function calcEaster(y){
  const f=Math.floor,a=y%19,b=f(y/100),c=y%100,d=f(b/4),e=b%4;
  const g=f((8*b+13)/25),h=(19*a+b-d-g+15)%30,i=f(c/4),k=c%4;
  const l=(32+2*e+2*i-h-k)%7,m=f((a+11*h+22*l)/451);
  const month=f((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(y,month-1,day);
}

/* MONTH */
function renderMonth(){
  const y=currentDate.getFullYear(), m=currentDate.getMonth();
  const first=new Date(y,m,1);
  const firstDayIndex=(first.getDay()+6)%7;
  const lastDate=new Date(y,m+1,0).getDate();
  const holidays=germanHolidays(y);

  const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html=`<div class="weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div><div class="month-grid">`;

  for(let i=0;i<firstDayIndex;i++) html+=`<div class="day-cell empty"></div>`;
  for(let d=1;d<=lastDate;d++){
    const dt=new Date(y,m,d);
    const ds=`${y}-${m+1}-${d}`;
    const isToday = dt.toDateString()===new Date().toDateString();
    const holiday=holidays.find(h=>h.date===ds);
    const dayEvents=events[ds]||[];
    const hasNormal=dayEvents.some(ev=>!ev.birthday);
    const hasBirthday=dayEvents.some(ev=>ev.birthday);

    let dots='';
    if(holiday && !isToday) dots+=`<div class="day-dot holiday"></div>`;
    if(hasNormal) dots+=`<div class="day-dot event"></div>`;
    if(hasBirthday) dots+=`<div class="day-dot birthday"></div>`;
    if(holiday && isToday) dots+=`<div class="day-dot holiday"></div>`;

    const holidayClass=holiday && !isToday?'holiday':'';
    html+=`<div class="day-cell${holidayClass?' holiday':''}" data-date="${ds}" ${holiday?`title="${holiday.label}"`:''}>
      <div class="day-number ${isToday?'today':''}">${d}</div>
      <div class="day-events">${dots}</div>
    </div>`;
  }
  const total=firstDayIndex+lastDate, rem=(7-(total%7))%7;
  for(let i=0;i<rem;i++) html+=`<div class="day-cell empty"></div>`;
  html+='</div>';
  views.month.innerHTML=html;
  document.querySelectorAll('.day-cell[data-date]').forEach(c=>c.addEventListener('click',()=>openModal(c.dataset.date)));
}

/* WEEK */
function renderWeek(){
  const start=new Date(currentDate);
  const dayIndex=(start.getDay()+6)%7;
  start.setDate(start.getDate()-dayIndex);
  let html=`<div class="week-grid"><div></div>`;
  const days=[];
  for(let i=0;i<7;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    days.push(d);
    html+=`<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}<br>${d.getDate()}</div>`;
  }
  for(let h=0;h<24;h++){
    html+=`<div class="hour-label">${pad(h)}:00</div>`;
    for(let i=0;i<7;i++){
      const d=days[i], ds=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      html+=`<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
    }
  }
  html+=`</div>`;
  views.week.innerHTML=html;

  const y=currentDate.getFullYear();
  const holidays=germanHolidays(y);
  document.querySelectorAll('.hour-cell').forEach(cell=>{
    const ds=cell.dataset.date;
    const holiday=holidays.find(h=>h.date===ds);
    const evts=events[ds]||[];
    evts.forEach(ev=>{
      const el=document.createElement('div');
      el.className='event'+(ev.birthday?' birthday':'');
      el.textContent=ev.text;
      cell.appendChild(el);
    });
    if(holiday){
      const el=document.createElement('div');
      el.className='event holiday';
      el.textContent=holiday.label;
      cell.appendChild(el);
    }
    cell.addEventListener('click',()=>openModal(ds,parseInt(cell.dataset.hour,10)));
  });
}

/* DAY */
function renderDay(){
  const y=currentDate.getFullYear(), m=currentDate.getMonth(), d=currentDate.getDate();
  const ds=`${y}-${m+1}-${d}`;
  const yHols=germanHolidays(y);
  let html=`<div style="display:grid;grid-template-columns:60px 1fr">`;
  for(let h=0;h<24;h++){
    html+=`<div class="hour-label">${pad(h)}:00</div><div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html+=`</div>`;
  views.day.innerHTML=html;

  const holiday=yHols.find(h=>h.date===ds);
  if(holiday){
    const el=document.createElement('div');
    el.className='event holiday';
    el.textContent=holiday.label;
    document.querySelector(`.day-hour[data-hour="0"]`).appendChild(el);
  }
  (events[ds]||[]).forEach(ev=>{
    const cell=document.querySelector(`.day-hour[data-hour="${ev.hour||0}"]`);
    if(cell){
      const el=document.createElement('div');
      el.className='event'+(ev.birthday?' birthday':'');
      el.textContent=ev.text;
      cell.appendChild(el);
    }
  });
  document.querySelectorAll('.day-hour').forEach(c=>c.addEventListener('click',()=>openModal(ds,parseInt(c.dataset.hour,10))));
}

/* YEAR */
function renderYear(){
  const y=currentDate.getFullYear();
  let html=`<div class="year-grid">`;
  for(let m=0;m<12;m++){
    const mn=new Date(y,m,1).toLocaleString(undefined,{month:'long'});
    html+=`<div class="year-month" data-month="${m}" data-year="${y}">
      <strong>${mn}</strong>
      <div style="font-size:12px;margin-top:6px">${renderMiniMonth(y,m)}</div>
    </div>`;
  }
  html+='</div>';
  views.year.innerHTML=html;
  document.querySelectorAll('.year-month').forEach(el=>{
    el.addEventListener('click',()=>{
      currentDate=new Date(parseInt(el.dataset.year,10),parseInt(el.dataset.month,10),1);
      setView('month');
    });
  });
}
function renderMiniMonth(y,m){
  const first=new Date(y,m,1), firstIdx=(first.getDay()+6)%7, last=new Date(y,m+1,0).getDate();
  const holidays=germanHolidays(y);
  let mini='<div style="display:grid;grid-template-columns:repeat(7,1fr);font-size:11px">';
  for(let i=0;i<firstIdx;i++) mini+='<div></div>';
  for(let d=1;d<=last;d++){
    const ds=`${y}-${m+1}-${d}`, hol=holidays.find(h=>h.date===ds);
    const dayEv=events[ds]||[];
    const hasE=dayEv.some(e=>!e.birthday), hasB=dayEv.some(e=>e.birthday);
    let dots='';
    if(hasE) dots+=`<div class="day-dot event" style="width:4px;height:4px;position:absolute;bottom:1px;"></div>`;
    if(hasB) dots+=`<div class="day-dot birthday" style="width:4px;height:4px;position:absolute;bottom:1px;left:8px;"></div>`;
    mini+=`<div style="position:relative;${hol?'color:#e84545;font-weight:bold;':''}" title="${hol?hol.label:''}">${d}${dots}</div>`;
  }
  mini+='</div>'; return mini;
}

/* Modal */
let modalOpenFor=null;
function openModal(dateStr,hour){
  modalOpenFor={date:dateStr,hour:hour};
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  modalDate.textContent=new Date(dateStr).toDateString()+(hour!==undefined?` ${pad(hour)}:00`:'');
  eventInput.value=''; renderEventList(dateStr);
  eventHourSelect.innerHTML=''; for(let h=0;h<24;h++){const o=document.createElement('option');o.value=h;o.text=`${pad(h)}:00`;eventHourSelect.appendChild(o);}
  eventHourCheckbox.checked=hour!==undefined; eventHourSelect.disabled=!eventHourCheckbox.checked;
  eventBirthdayCheckbox.checked=false;
}

function renderEventList(dateStr){
  eventList.innerHTML='';
  const [y]=dateStr.split('-').map(Number);
  const holiday=germanHolidays(y).find(h=>h.date===dateStr);
  if(holiday){
    const li=document.createElement('li'); li.textContent=holiday.label; li.style.color='#e84545'; li.style.fontWeight='bold';
    eventList.appendChild(li);
  }
  (events[dateStr]||[]).forEach((e,i)=>{
    const li=document.createElement('li');
    li.textContent=(e.hour!==undefined?`${pad(e.hour)}:00 — `:'')+e.text+(e.birthday?' 🎂':'');
    const del=document.createElement('button');
    del.textContent='Delete';
    del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.onclick=()=>{events[dateStr].splice(i,1);if(!events[dateStr].length)delete events[dateStr];
      localStorage.setItem('events',JSON.stringify(events));renderEventList(dateStr);render();};
    li.appendChild(del);eventList.appendChild(li);
  });
}

addEventBtn.onclick=()=>{
  const txt=eventInput.value.trim(); if(!txt)return alert('Enter event text');
  const dateStr=modalOpenFor.date;
  if(!events[dateStr]) events[dateStr]=[];
  const ev={text:txt};
  if(eventBirthdayCheckbox.checked){
    ev.birthday=true;
    const [y,m,d]=dateStr.split('-').map(Number);
    for(let i=y+1;i<=y+50;i++){
      let ny=i,nm=m,nd=d;
      if(nm===2&&nd===29&&!isLeap(i)) nd=28;
      const ds=`${ny}-${nm}-${nd}`;
      if(!events[ds]) events[ds]=[];
      events[ds].push({...ev});
    }
  } else if(eventHourCheckbox.checked) {
    ev.hour=parseInt(eventHourSelect.value,10);
  }
  events[dateStr].push(ev);
  localStorage.setItem('events',JSON.stringify(events));
  modal.classList.add('hidden'); render();
};
function isLeap(y){return(y%4===0&&y%100!==0)||y%400===0;}
closeModalBtn.onclick=()=>{modal.classList.add('hidden');};

/* Navigation */
navBtns.forEach(b=>b.onclick=()=>setView(b.dataset.view));
todayBtn.onclick=()=>{currentDate=new Date();setView('month');};
prevBtn.onclick=()=>change(-1); nextBtn.onclick=()=>change(1);
function change(dir){
  if(currentView==='day') currentDate.setDate(currentDate.getDate()+dir);
  else if(currentView==='week') currentDate.setDate(currentDate.getDate()+7*dir);
  else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()+dir);
  else currentDate.setFullYear(currentDate.getFullYear()+dir);
  render();
}

/* Swipe */
let startX=0;
calendarArea.addEventListener('touchstart',e=>startX=e.changedTouches[0].screenX,{passive:true});
calendarArea.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].screenX-startX;
  if(Math.abs(dx)>60){dx>0?change(-1):change(1);}
},{passive:true});

/* Row height */
function adjustRowHeight(){
  const footer=document.querySelector('.footer');
  const avail=window.innerHeight-(footer?footer.getBoundingClientRect().height:0);
  const weekdays=document.querySelector('.weekdays');
  const h=weekdays?weekdays.getBoundingClientRect().height:0;
  const rows=6;
  const rh=Math.max(60,Math.floor((avail-h-8)/rows));
  document.documentElement.style.setProperty('--row-height',rh+'px');
}
window.addEventListener('resize',adjustRowHeight);
setView('month');
