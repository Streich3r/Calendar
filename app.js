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
function formatTitle(d){ return d.toLocaleDateString(undefined,{month:'long',year:'numeric'}); }
function formatSubtitle(d){ return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}); }

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
    const d = new Date(easter); d.setDate(d.getDate()+offset);
    dates.push([d.getMonth()+1,d.getDate(),label]);
  };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return dates.map(([m,d,label])=>({date:`${year}-${m}-${d}`,label}));
}

function calcEaster(y){
  const f = Math.floor, a=y%19, b=f(y/100), c=y%100, d=f(b/4), e=b%4;
  const g=f((8*b+13)/25), h=(19*a+b-d-g+15)%30;
  const i=f(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7, m=f((a+11*h+22*l)/451);
  const month=f((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return new Date(y,month-1,day);
}

// MONTH view
function renderMonth(){
  const y=currentDate.getFullYear(), m=currentDate.getMonth();
  const first=new Date(y,m,1);
  const firstDayIndex=(first.getDay()+6)%7;
  const lastDate=new Date(y,m+1,0).getDate();
  const holidays=germanHolidays(y);

  const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html=`<div class="weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div>`;
  html+=`<div class="month-grid" id="monthGrid">`;

  for(let i=0;i<firstDayIndex;i++) html+=`<div class="day-cell empty"></div>`;

  for(let d=1; d<=lastDate; d++){
    const dt=new Date(y,m,d);
    const isToday = dt.toDateString() === (new Date()).toDateString();
    const ds=`${y}-${m+1}-${d}`;
    const hasEvents=events[ds] && events[ds].length>0;
    const dayOfWeek = dt.getDay();
    const isWeekend = (dayOfWeek===0 || dayOfWeek===6);
    const holiday = holidays.find(h=>h.date===ds);

    let dots = '';
    if(hasEvents) dots += `<div class="day-dot" title="Has events"></div>`;
    if(events[ds]?.some(ev=>ev.birthday)) dots += `<div class="day-dot birthday" title="Birthday"></div>`;

    html+=`<div class="day-cell${isWeekend?' weekend':''}${holiday?' holiday':''}" data-date="${ds}" ${holiday?`title="${holiday.label}"`:''}>
            <div class="day-number ${isToday? 'today' : ''}">${d}</div>
            <div class="day-events">${dots}</div>
          </div>`;
  }

  const totalCells=firstDayIndex+lastDate;
  const rem=(7-(totalCells%7))%7;
  for(let i=0;i<rem;i++) html+=`<div class="day-cell empty"></div>`;
  html+=`</div>`;
  views.month.innerHTML = html;

  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date));
  });
}

// WEEK / DAY / YEAR rendering (analog zu deinem alten Code, nur Geburtstags-Punkte hinzugefügt)
function renderWeek(){
  const start=new Date(currentDate);
  const dayIndex=(start.getDay()+6)%7; start.setDate(start.getDate()-dayIndex);
  let html=`<div class="week-grid"><div></div>`;
  const days=[];
  for(let i=0;i<7;i++){
    const d=new Date(start); d.setDate(start.getDate()+i); days.push(d);
    html+=`<div style="text-align:center;border-bottom:1px solid #2b2b2b;padding:6px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}<br>${d.getDate()}</div>`;
  }
  for(let h=0;h<24;h++){
    html+=`<div class="hour-label">${pad(h)}:00</div>`;
    for(let i=0;i<7;i++){
      const d=days[i]; const ds=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      html+=`<div class="hour-cell" data-date="${ds}" data-hour="${h}"></div>`;
    }
  }
  html+=`</div>`;
  views.week.innerHTML=html;

  for(const ds in events){
    (events[ds]||[]).forEach(ev=>{
      if(ev.hour!==undefined){
        const sel=`.hour-cell[data-date="${ds}"][data-hour="${ev.hour}"]`;
        const cell=document.querySelector(sel);
        if(cell){
          const el=document.createElement('div');
          el.className='event';
          el.textContent=ev.text;
          cell.appendChild(el);
        }
      }
    });
  }
}

function renderDay(){
  const y=currentDate.getFullYear(), m=currentDate.getMonth(), d=currentDate.getDate();
  const ds=`${y}-${m+1}-${d}`;
  let html=`<div style="display:grid;grid-template-columns:60px 1fr">`;
  for(let h=0;h<24;h++){
    html+=`<div class="hour-label">${pad(h)}:00</div>`;
    html+=`<div class="day-hour" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html+=`</div>`;
  views.day.innerHTML=html;

  (events[ds]||[]).forEach(ev=>{
    const cell = document.querySelector(`.day-hour[data-date="${ds}"][data-hour="${ev.hour??0}"]`);
    if(cell){
      const el=document.createElement('div');
      el.className='event';
      el.textContent=ev.text + (ev.birthday?' 🎂':'');
      cell.appendChild(el);
    }
  });
}

function renderYear(){
  const y=currentDate.getFullYear();
  let html=`<div class="year-grid">`;
  for(let m=0;m<12;m++){
    const monthStart=new Date(y,m,1);
    const monthName=monthStart.toLocaleString(undefined,{month:'long'});
    html+=`<div class="year-month" data-month="${m}" data-year="${y}">
             <strong>${monthName}</strong>
             <div style="font-size:12px;margin-top:6px">${renderMiniMonth(y,m)}</div>
           </div>`;
  }
  html+=`</div>`;
  views.year.innerHTML=html;

  document.querySelectorAll('.year-month').forEach(el=>{
    el.addEventListener('click',()=>{
      const yy=parseInt(el.dataset.year,10), mm=parseInt(el.dataset.month,10);
      currentDate=new Date(yy,mm,1);
      setView('month');
    });
  });
}

function renderMiniMonth(y,m){
  const first=new Date(y,m,1);
  const firstIdx=(first.getDay()+6)%7;
  const lastDate=new Date(y,m+1,0).getDate();
  const holidays=germanHolidays(y);
  let mini='<div style="display:grid;grid-template-columns:repeat(7,1fr);font-size:11px">';
  for(let i=0;i<firstIdx;i++) mini+='<div></div>';
  for(let d=1;d<=lastDate;d++){
    const dt=new Date(y,m,d);
    const ds=`${y}-${m+1}-${d}`;
    const holiday=holidays.find(h=>h.date===ds);
    const birthday=events[ds]?.some(ev=>ev.birthday);
    let style='';
    if(holiday) style+='color:#e84545;font-weight:bold;';
    mini+=`<div style="padding:1px;${holiday?'background:#e84545;':''}" title="${holiday?holiday.label:''}">
              ${d}${birthday?' 🎂':''}
           </div>`;
  }
  mini+='</div>';
  return mini;
}

// MODAL
let modalOpenFor = null;
function openModal(dateStr,hour){
  modalOpenFor={date:dateStr,hour:hour};
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  modalDate.textContent=new Date(dateStr).toDateString() + (hour!==undefined?` ${pad(hour)}:00`:'');
  eventInput.value='';
  renderEventList(dateStr);
  eventHourSelect.innerHTML=''; for(let h=0;h<24;h++){ const opt=document.createElement('option'); opt.value=h; opt.text=`${pad(h)}:00`; eventHourSelect.appendChild(opt);}
  if(hour!==undefined){ eventHourCheckbox.checked=true; eventHourSelect.disabled=false; eventHourSelect.value=hour; } else { eventHourCheckbox.checked=false; eventHourSelect.disabled=true; }
  eventRepeatYearly.checked=false;
}

function renderEventList(dateStr){
  eventList.innerHTML='';
  const [y,m,d]=dateStr.split("-").map(Number);
  const holiday=germanHolidays(y).find(h=>h.date===dateStr);
  if(holiday){ const li=document.createElement('li'); li.textContent="📅 "+holiday.label; li.style.color="#e84545"; li.style.fontWeight="bold"; eventList.appendChild(li);}
  (events[dateStr]||[]).forEach((e,idx)=>{
    const li=document.createElement('li');
    li.textContent=(e.hour!==undefined?`${pad(e.hour)}:00 — ${e.text}`:e.text)+(e.birthday?' 🎂':'');
    const del=document.createElement('button');
    del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click',()=>{
      events[dateStr].splice(idx,1);
      if(events[dateStr].length===0) delete events[dateStr];
      localStorage.setItem('events',JSON.stringify(events));
      renderEventList(dateStr);
      render();
    });
    li.appendChild(del);
    eventList.appendChild(li);
  });
}

addEventBtn.addEventListener('click',()=>{
  const txt=eventInput.value.trim();
  if(!txt) return alert('Enter event text');
  const dateStr=modalOpenFor.date;
  const useHour=eventHourCheckbox.checked ? parseInt(eventHourSelect.value,10) : modalOpenFor.hour;
  if(!events[dateStr]) events[dateStr]=[];
  const ev={ text:txt, hour: useHour };
  if(eventRepeatYearly.checked) ev.birthday=true;
  events[dateStr].push(ev);
  localStorage.setItem('events',JSON.stringify(events));
  modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
  render();
});

closeModalBtn.addEventListener('click',()=>{modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');});
eventHourCheckbox.addEventListener('change',()=>{eventHourSelect.disabled=!eventHourCheckbox.checked;});

// NAV
navBtns.forEach(b=>b.addEventListener('click',()=>{setView(b.dataset.view);}));
todayBtn.addEventListener('click',()=>{currentDate=new Date(); setView('month');});

function prev(){ if(currentView==='day') currentDate.setDate(currentDate.getDate()-1); else if(currentView==='week') currentDate.setDate(currentDate.getDate()-7); else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()-1); else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()-1); render();}
function next(){ if(currentView==='day') currentDate.setDate(currentDate.getDate()+1); else if(currentView==='week') currentDate.setDate(currentDate.getDate()+7); else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()+1); else if(currentView==='year') currentDate.setFullYear(currentDate.getFullYear()+1); render();}
prevBtn.addEventListener('click',prev);
nextBtn.addEventListener('click',next);

// Swipe
let touchStartX=0,touchStartY=0,touchEndX=0,touchEndY=0,isDown=false,startX=0;
calendarArea.addEventListener('touchstart',e=>{touchStartX=e.changedTouches[0].screenX; touchStartY=e.changedTouches[0].screenY;},{passive:true});
calendarArea.addEventListener('touchend',e=>{touchEndX=e.changedTouches[0].screenX; touchEndY=e.changedTouches[0].screenY; handleSwipe();},{passive:true});
calendarArea.addEventListener('mousedown',e=>{isDown=true;startX=e.screenX;},{passive:true});
calendarArea.addEventListener('mouseup',e=>{if(!isDown) return; isDown=false; const diff=e.screenX-startX; if(Math.abs(diff)>60){if(diff>0) prev(); else next();}});

function handleSwipe(){
  const dx=touchEndX-touchStartX,dy=touchEndY-touchStartY;
  if(Math.abs(dx)<40||Math.abs(dx)<Math.abs(dy)) return;
  dx>0?prev():next();
}

// Adjust row height
function adjustRowHeight(){
  const footer=document.querySelector('.footer');
  const footerRect=footer?footer.getBoundingClientRect():{height:0};
  const available=window.innerHeight-footerRect.height;
  const weekdays=document.querySelector('.weekdays');
  const weekdaysH=weekdays?weekdays.getBoundingClientRect().height:0;
  const rows=6;
  const rowHeight=Math.max(60,Math.floor((available-weekdaysH-8)/rows));
  document.documentElement.style.setProperty('--row-height',rowHeight+'px');
}

window.addEventListener('resize',adjustRowHeight);
setView('month');
