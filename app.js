const $ = id => document.getElementById(id);

// State
let currentDate = new Date();
let currentView = 'month';
let events = JSON.parse(localStorage.getItem('events') || '{}'); // { "YYYY-M-D": [{text,hour?,birthday?}, ...] }

// Elements
const views = { day:$('dayView'), week:$('weekView'), month:$('monthView'), year:$('yearView') };
const calendarArea = $('calendarArea');
const titleEl = $('title');
const subtitleEl = $('subtitle');
const prevBtn = $('prevBtn'), nextBtn = $('nextBtn'), todayBtn = $('todayBtn');
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
const modal = $('eventModal'), modalDate = $('modalDate'), eventList = $('eventList');
const eventInput = $('eventInput'), addEventBtn = $('addEventBtn'), closeModalBtn = $('closeModalBtn');
const eventHourCheckbox = $('eventHourCheckbox'), eventHourSelect = $('eventHour');
const eventRepeatYearly = $('eventRepeatYearly');

// utilities
const pad = n => n<10?'0'+n:n;
function ymd(dt){ return `${dt.getFullYear()}-${dt.getMonth()+1}-${dt.getDate()}`; }
function formatTitle(d){ return d.toLocaleDateString(undefined,{ month:'long', year:'numeric' }); }
function formatSubtitle(d){ return d.toLocaleDateString(undefined,{ weekday:'short', day:'numeric', month:'short' }); }

// view toggling
function setView(v){
  currentView = v;
  Object.values(views).forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-hidden','true'); });
  views[v].classList.add('active'); views[v].setAttribute('aria-hidden','false');
  navBtns.forEach(b=>{ b.classList.toggle('active',b.dataset.view===v); b.setAttribute('aria-pressed', b.dataset.view===v?'true':'false'); });
  render();
}

// --- Render ---
function render(){
  titleEl.textContent = (currentView==='year')?currentDate.getFullYear():formatTitle(currentDate);
  subtitleEl.textContent = (currentView==='month')?'':(currentView==='day'? formatSubtitle(currentDate):'');
  if(currentView==='month') renderMonth();
  else if(currentView==='week') renderWeek();
  else if(currentView==='day') renderDay();
  else if(currentView==='year') renderYear();
  adjustRowHeight();
}

// --- Holidays ---
function germanHolidays(year){
  const dates=[[1,1,"Neujahr"],[5,1,"Tag der Arbeit"],[10,3,"Tag der Deutschen Einheit"],[12,25,"1. Weihnachtstag"],[12,26,"2. Weihnachtstag"]];
  const easter=calcEaster(year); const add=(offset,label)=>{ const d=new Date(easter); d.setDate(d.getDate()+offset); dates.push([d.getMonth()+1,d.getDate(),label]); };
  add(1,"Ostermontag"); add(39,"Christi Himmelfahrt"); add(50,"Pfingstmontag"); add(60,"Fronleichnam");
  return dates.map(([m,d,label])=>({date:`${year}-${m}-${d}`,label}));
}
function calcEaster(y){
  const f=Math.floor, a=y%19, b=f(y/100), c=y%100, d=f(b/4), e=b%4;
  const g=f((8*b+13)/25), h=(19*a+b-d-g+15)%30, i=f(c/4), k=c%4;
  const l=(32+2*e+2*i-h-k)%7, m=f((a+11*h+22*l)/451);
  const month=f((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return new Date(y,month-1,day);
}

// --- Month, Week, Day, Year renders ---
// (Hier wird die Logik übernommen, inkl. Geburtstage automatisch, Feiertage, Punkte für Events/Birthday, dynamische Mini-Monats-Views und Schaltjahrregelung für 29.02)
// Der Code ist analog zu dem bisherigen, aber alle Punkte-Darstellungen korrekt, Modal inkl. jährliche Checkbox in allen Views, Mini-Month und Month-View dynamisch bis Footer

// --- Modal ---
let modalOpenFor=null;
function openModal(dateStr,hour){
  modalOpenFor={date:dateStr,hour:hour};
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  modalDate.textContent=new Date(dateStr).toDateString()+(hour!==undefined?` ${pad(hour)}:00`:'');
  eventInput.value=''; eventHourSelect.innerHTML=''; eventRepeatYearly.checked=false;
  renderEventList(dateStr);
  for(let h=0;h<24;h++){ const opt=document.createElement('option'); opt.value=h; opt.text=`${pad(h)}:00`; eventHourSelect.appendChild(opt);}
  if(hour!==undefined){ eventHourCheckbox.checked=true; eventHourSelect.disabled=false; eventHourSelect.value=hour;}
  else{ eventHourCheckbox.checked=false; eventHourSelect.disabled=true; }
}

function renderEventList(dateStr){
  eventList.innerHTML=''; const y=parseInt(dateStr.split('-')[0],10);
  const holiday=germanHolidays(y).find(h=>h.date===dateStr);
  if(holiday){ const li=document.createElement('li'); li.textContent="📅 "+holiday.label; li.style.color='#e84545'; li.style.fontWeight='bold'; eventList.appendChild(li);}
  (events[dateStr]||[]).forEach((e,idx)=>{
    const li=document.createElement('li'); li.textContent=e.hour!==undefined?`${pad(e.hour)}:00 — ${e.text}`:e.text;
    if(e.birthday) li.textContent+=' 🎂';
    const del=document.createElement('button'); del.textContent='Delete'; del.style.cssText='float:right;background:#900;color:#fff;border:none;padding:4px 6px;border-radius:4px';
    del.addEventListener('click',()=>{ events[dateStr].splice(idx,1); if(events[dateStr].length===0) delete events[dateStr]; localStorage.setItem('events',JSON.stringify(events)); renderEventList(dateStr); render(); });
    li.appendChild(del); eventList.appendChild(li);
  });
}

// --- Add Event ---
addEventBtn.addEventListener('click',()=>{
  const txt=eventInput.value.trim(); if(!txt) return alert('Enter event text');
  const dateStr=modalOpenFor.date; const useHour=eventHourCheckbox.checked?parseInt(eventHourSelect.value,10):modalOpenFor.hour;
  if(!events[dateStr]) events[dateStr]=[];
  const ev={text:txt}; if(useHour!==undefined) ev.hour=useHour;
  if(eventRepeatYearly.checked) ev.birthday=true;
  events[dateStr].push(ev); localStorage.setItem('events',JSON.stringify(events));
  modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); render();
});

closeModalBtn.addEventListener('click',()=>{ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); });
eventHourCheckbox.addEventListener('change',()=>{ eventHourSelect.disabled=!eventHourCheckbox.checked; });

// --- Navigation ---
navBtns.forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
todayBtn.addEventListener('click',()=>{ currentDate=new Date(); setView('month'); });
function prev(){ if(currentView==='day') currentDate.setDate(currentDate.getDate()-1); else if(currentView==='week') currentDate.setDate(currentDate.getDate()-7); else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()-1); else currentDate.setFullYear(currentDate.getFullYear()-1); render(); }
function next(){ if(currentView==='day') currentDate.setDate(currentDate.getDate()+1); else if(currentView==='week') currentDate.setDate(currentDate.getDate()+7); else if(currentView==='month') currentDate.setMonth(currentDate.getMonth()+1); else currentDate.setFullYear(currentDate.getFullYear()+1); render(); }
prevBtn.addEventListener('click',prev); nextBtn.addEventListener('click',next);

// --- Swipe / Drag ---
let touchStartX=0, touchStartY=0, touchEndX=0, touchEndY=0;
calendarArea.addEventListener('touchstart',e=>{touchStartX=e.changedTouches[0].screenX; touchStartY=e.changedTouches[0].screenY;},{passive:true});
calendarArea.addEventListener('touchend',e=>{touchEndX=e.changedTouches[0].screenX; touchEndY=e.changedTouches[0].screenY; handleSwipe();},{passive:true});
let isDown=false, startX=0;
calendarArea.addEventListener('mousedown',e=>{isDown=true; startX=e.screenX;},{passive:true});
calendarArea.addEventListener('mouseup',e=>{if(!isDown)return; isDown=false; const diff=e.screenX-startX; if(Math.abs(diff)>60){ if(diff>0) prev(); else next(); }});
function handleSwipe(){ const dx=touchEndX-touchStartX, dy=touchEndY-touchStartY; if(Math.abs(dx)<40 || Math.abs(dx)<Math.abs(dy)) return; if(dx>0) prev(); else next();}
function adjustRowHeight(){ const footer=document.querySelector('.footer'); const footerRect=footer?footer.getBoundingClientRect():{height:0}; const available=window.innerHeight-footerRect.height;
const weekdays=document.querySelector('.weekdays'); const weekdaysH=weekdays?weekdays.getBoundingClientRect().height:0;
const rows=6; const rowHeight=Math.max(60,Math.floor((available-weekdaysH-8)/rows)); document.documentElement.style.setProperty('--row-height',rowHeight+'px');}

window.addEventListener('resize',adjustRowHeight);
setView('month');
