/* IVY Calendar V2: stable high-density calendars, local dates, legacy event storage */
'use strict';
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const dateKey = d => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
const localDate = key => {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(key));
  if (!m) return null;
  const y = +m[1], mo = +m[2], day = +m[3];
  const d = new Date(y,mo-1,day,12);
  return d.getFullYear()===y && d.getMonth()===mo-1 && d.getDate()===day ? d : null;
};
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (d,options) => new Intl.DateTimeFormat('de-DE',options).format(d);
const today = () => new Date();
const leap = y => y%4===0&&(y%100!==0||y%400===0);
const safeHour = v => v===null||v===undefined||v===''?null:(Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=23?Number(v):null);
const cloneDate = d => new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);
const stepCalendar = (date,unit,dir) => {
  if(unit==='day') return new Date(date.getFullYear(),date.getMonth(),date.getDate()+dir,12);
  if(unit==='week') return new Date(date.getFullYear(),date.getMonth(),date.getDate()+7*dir,12);
  const y=date.getFullYear(),m=date.getMonth(),d=date.getDate();
  const target = unit==='year' ? new Date(y+dir,m,1,12) : new Date(y,m+dir,1,12);
  return new Date(target.getFullYear(),target.getMonth(),Math.min(d,new Date(target.getFullYear(),target.getMonth()+1,0).getDate()),12);
};
function loadEvents(){
  try {
    const value = JSON.parse(localStorage.getItem('events')||'{}');
    if(!value||typeof value!=='object'||Array.isArray(value)) return {};
    const out={};
    for(const [key,list] of Object.entries(value)){
      if(!localDate(key)||!Array.isArray(list)) continue;
      const safe=list.filter(e=>e&&typeof e.text==='string'&&e.text.trim())
       .map(e=>({text:e.text.trim().slice(0,250),...(e.birthday?{birthday:true}:{}),...(!e.birthday && safeHour(e.hour)!==null?{hour:safeHour(e.hour)}:{})}));
      if(safe.length) out[key]=safe;
    }
    return out;
  }catch(err){console.warn('Kalenderdaten konnten nicht geladen werden; Originaldaten bleiben erhalten.',err);return {}}
}
function linkedNotes(){
 try{
  const arr=JSON.parse(localStorage.getItem('notes')||'[]');
  return Array.isArray(arr)?arr.filter(n=>n&&typeof n.id==='string'&&typeof n.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(n.date)):[];
 }catch{return []}
}
function notesForDate(key){
 const canonical=localDate(key);if(!canonical)return [];
 const day=`${canonical.getFullYear()}-${pad(canonical.getMonth()+1)}-${pad(canonical.getDate())}`;
 return linkedNotes().filter(n=>n.date===day);
}
function labelNote(n){
 if(n.title?.trim())return n.title.trim();
 const box=document.createElement('div');box.innerHTML=String(n.content||'');
 return (box.textContent||'Notiz').trim().slice(0,85)||'Notiz';
}
function openLinkedNote(id){
 window.parent.postMessage({type:'ivy-open-note',id},location.origin);
}
let events=loadEvents();
let currentDate=cloneDate(today());
let currentView='month';
let modalOpenFor=null;
let birthdayCache=new Map();
let holidayCache=new Map();
const views={day:$('dayView'),week:$('weekView'),month:$('monthView'),year:$('yearView')};
const navBtns=[...document.querySelectorAll('.nav-btn[data-view]')];
const modal=$('eventModal'), modalDate=$('modalDate'), eventList=$('eventList');
const eventInput=$('eventInput'), hourBox=$('eventHourCheckbox'), hourSelect=$('eventHour'), birthdayBox=$('eventBirthdayCheckbox');
const summaryDate=key=>fmt(localDate(key),{weekday:'long',day:'numeric',month:'long',year:'numeric'});
function saveEvents(){
  try{localStorage.setItem('events',JSON.stringify(events)); birthdayCache.clear();return true}
  catch(err){console.error('Speichern fehlgeschlagen',err);alert('Speichern fehlgeschlagen. Bitte Browserspeicher prüfen.');return false}
}
// Computus / Gregorian Easter
function easter(year){
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
 h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
 month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
 return new Date(year,month-1,day,12);
}
function holidays(year){
 if(holidayCache.has(year))return holidayCache.get(year);
 const list=[[1,1,'Neujahr'],[5,1,'Tag der Arbeit'],[10,3,'Tag der Deutschen Einheit'],[12,25,'1. Weihnachtstag'],[12,26,'2. Weihnachtstag']];
 const base=easter(year);
 const movable=[[-2,'Karfreitag'],[1,'Ostermontag'],[39,'Christi Himmelfahrt'],[50,'Pfingstmontag']];
 for(const [offset,label] of movable){const d=new Date(year,base.getMonth(),base.getDate()+offset,12);list.push([d.getMonth()+1,d.getDate(),label]);}
 // Bundesland-spezifische Feiertage bewusst nicht bundesweit als Feiertag markieren.
 const map=new Map(list.map(([m,d,name])=>[`${year}-${m}-${d}`,name]));
 holidayCache.set(year,map);return map;
}
function birthdayMap(year){
 if(birthdayCache.has(year)) return birthdayCache.get(year);
 const map=new Map();
 for(const [key,items] of Object.entries(events)){
  const original=localDate(key);if(!original) continue;
  for(let i=0;i<items.length;i++){
   const ev=items[i];if(!ev.birthday)continue;
   const month=original.getMonth(),date=month===1&&original.getDate()===29&&!leap(year)?28:original.getDate();
   const k=`${year}-${month+1}-${date}`;
   if(!map.has(k))map.set(k,[]);
   map.get(k).push({text:ev.text,originalKey:key,index:i,birthday:true});
  }
 }
 birthdayCache.set(year,map);return map;
}
function forDate(key){
 const date=localDate(key);if(!date)return {normal:[],birthdays:[],holiday:''};
 return {normal:(events[key]||[]).filter(e=>!e.birthday),birthdays:birthdayMap(date.getFullYear()).get(key)||[],holiday:holidays(date.getFullYear()).get(key)||''};
}
function summary(key){
 const {normal,birthdays,holiday}=forDate(key);
 const parts=[...normal.map(e=>e.hour==null?e.text:`${pad(e.hour)}:00 ${e.text}`),...birthdays.map(e=>'🎂 '+e.text)];
 if(holiday)parts.unshift(holiday);
 const linked=notesForDate(key);parts.push(...linked.map(n=>'📝 '+labelNote(n)));
 return {normal,birthdays,holiday,linked,items:parts,label:`${summaryDate(key)}${parts.length?' · '+parts.length+' Einträge':''}`};
}
function setView(v){
 if(!views[v])return;
 currentView=v;
 for(const [key,el] of Object.entries(views)){const active=key===v;el.classList.toggle('active',active);el.setAttribute('aria-hidden',String(!active));}
 for(const b of navBtns){const on=b.dataset.view===v;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));}
 render();
}
function render(){
 const y=currentDate.getFullYear(), m=currentDate.getMonth();
 $('title').textContent=currentView==='year'?String(y):currentView==='day'?fmt(currentDate,{day:'numeric',month:'long',year:'numeric'}):fmt(currentDate,{month:'long',year:'numeric'});
 $('subtitle').textContent=currentView==='week'?`KW ${weekNumber(currentDate)} · ${y}`:currentView==='day'?fmt(currentDate,{weekday:'long'}):'';
 if(currentView==='month')renderMonth();else if(currentView==='week')renderWeek();else if(currentView==='day')renderDay();else renderYear();
}
function weekNumber(date){
 const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
 const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-yearStart)/86400000)+1)/7);
}
function markerMarkup(info,scope){
 const n=info.normal.length,b=info.birthdays.length,linked=info.linked?.length||0;
 return `<span class="${scope}-markers" aria-hidden="true">${n?`<i class="${scope}-marker event-marker"></i>`:''}${b?`<i class="${scope}-marker birthday-marker"></i>`:''}${linked?`<i class="${scope}-marker ivy-note-marker"></i>`:''}</span>`;
}
const weekdays=['Mo','Di','Mi','Do','Fr','Sa','So'];
function renderMonth(){
 const y=currentDate.getFullYear(),month=currentDate.getMonth(),offset=(new Date(y,month,1).getDay()+6)%7,last=new Date(y,month+1,0).getDate();
 let html=`<div class="weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div><div class="month-grid">`;
 for(let i=0;i<offset;i++)html+='<div class="day-cell empty"></div>';
 const current=dateKey(today());
 for(let day=1;day<=last;day++){
  const key=`${y}-${month+1}-${day}`,info=summary(key),count=info.normal.length+info.birthdays.length+(info.linked?.length||0);
  html+=`<button type="button" class="day-cell${key===current?' is-today':''}" data-date="${key}" aria-label="${esc(info.label)}" title="${esc(info.items.slice(0,8).join(' · ')||info.holiday||'')}"><span class="day-number${info.holiday?' holiday':''}">${day}</span>${markerMarkup(info,'day')}${count?`<span class="day-count">${count>99?'99+':count}</span>`:''}</button>`;
 }
 for(let i=0;i<(7-(offset+last)%7)%7;i++)html+='<div class="day-cell empty"></div>';
 views.month.innerHTML=html+'</div>';
 views.month.querySelectorAll('[data-date]').forEach(el=>el.addEventListener('click',()=>openModal(el.dataset.date)));
}
function renderYear(){
 const year=currentDate.getFullYear(),t=dateKey(today());let html='<div class="year-grid">';
 for(let month=0;month<12;month++){
  const label=fmt(new Date(year,month,1,12),{month:'long'}),offset=(new Date(year,month,1).getDay()+6)%7,last=new Date(year,month+1,0).getDate();
  html+=`<section class="year-month" aria-label="${esc(label)}"><button type="button" class="year-month-title" data-month="${month}">${esc(label)}</button><div class="mini-weekdays">${weekdays.map(w=>`<span>${w.slice(0,1)}</span>`).join('')}</div><div class="mini-month">`;
  for(let i=0;i<offset;i++)html+='<span class="mini-day empty"></span>';
  for(let day=1;day<=last;day++){
   const key=`${year}-${month+1}-${day}`,info=summary(key),count=info.normal.length+info.birthdays.length+(info.linked?.length||0);
   // Always at most TWO dots. Total count is exposed via title + aria-label.
   html+=`<button type="button" class="mini-day${key===t?' is-today':''}${info.holiday?' holiday':''}" data-date="${key}" title="${esc(info.items.slice(0,6).join(' · ')||info.holiday||summaryDate(key))}" aria-label="${esc(info.label)}"><span class="mini-number">${day}</span>${markerMarkup(info,'mini')}${count>2?`<span class="mini-extra">+</span>`:''}</button>`;
  }
  for(let i=0;i<(42-offset-last);i++)html+='<span class="mini-day empty"></span>';
  html+='</div></section>';
 }
 views.year.innerHTML=html+'</div>';
 views.year.querySelectorAll('.year-month-title').forEach(btn=>btn.addEventListener('click',()=>{currentDate=new Date(year,+btn.dataset.month,1,12);setView('month')}));
 views.year.querySelectorAll('.mini-day[data-date]').forEach(btn=>btn.addEventListener('click',()=>openModal(btn.dataset.date)));
}
function smallEvents(items,max,extraClass=''){
 const n=items.length,rows=items.slice(0,max).map(ev=>`<span class="event-pill ${extraClass}" title="${esc(ev.text)}">${esc(ev.text)}</span>`);
 if(n>max)rows.push(`<span class="event-more">+${n-max} weitere</span>`);
 return rows.join('');
}
function daySummaryHtml(key,cap=3){
 const data=forDate(key),all=[...(data.holiday?[{text:data.holiday,holiday:true}]:[]),...data.birthdays.map(b=>({text:'🎂 '+b.text,birthday:true})),...data.normal.filter(e=>e.hour==null),...notesForDate(key).map(n=>({text:'📝 '+labelNote(n),linked:true}))];
 return all.slice(0,cap).map(e=>`<span class="event-pill${e.holiday?' holiday':''}${e.birthday?' birthday':''}" title="${esc(e.text)}">${esc(e.text)}</span>`).join('')+(all.length>cap?`<span class="event-more">+${all.length-cap} weitere</span>`:'');
}
function renderWeek(){
 const first=cloneDate(currentDate);first.setDate(first.getDate()-(first.getDay()+6)%7);
 const dates=Array.from({length:7},(_,i)=>new Date(first.getFullYear(),first.getMonth(),first.getDate()+i,12));
 let html='<div class="week-grid"><div class="grid-corner"></div>';
 for(const d of dates)html+=`<div class="week-heading${dateKey(d)===dateKey(today())?' is-today':''}">${weekdays[(d.getDay()+6)%7]} <b>${d.getDate()}</b></div>`;
 html+='<div class="all-day-label">Ganztägig</div>';
 for(const d of dates)html+=`<button type="button" class="all-day-row" data-date="${dateKey(d)}">${daySummaryHtml(dateKey(d))}</button>`;
 for(let h=0;h<24;h++){
  html+=`<div class="hour-label">${pad(h)}:00</div>`;
  for(const d of dates){const key=dateKey(d),timed=forDate(key).normal.filter(e=>e.hour===h);
   html+=`<button type="button" class="hour-cell" data-date="${key}" data-hour="${h}">${smallEvents(timed,2)}</button>`;
  }
 }
 views.week.innerHTML=html+'</div>';
 views.week.querySelectorAll('.hour-cell,.all-day-row').forEach(el=>el.addEventListener('click',()=>openModal(el.dataset.date,el.dataset.hour!==undefined?Number(el.dataset.hour):undefined)));
}
function renderDay(){
 const key=dateKey(currentDate);let html='<div class="day-grid"><div class="all-day-label">Ganztägig</div>';
 html+=`<button type="button" class="all-day-row" data-date="${key}">${daySummaryHtml(key,5)}</button>`;
 for(let hour=0;hour<24;hour++){
  const timed=forDate(key).normal.filter(e=>e.hour===hour);
  html+=`<div class="hour-label">${pad(hour)}:00</div><button type="button" class="hour-cell" data-date="${key}" data-hour="${hour}">${smallEvents(timed,3)}</button>`;
 }
 views.day.innerHTML=html+'</div>';
 views.day.querySelectorAll('.hour-cell,.all-day-row').forEach(el=>el.addEventListener('click',()=>openModal(el.dataset.date,el.dataset.hour!==undefined?Number(el.dataset.hour):undefined)));
}
function closeModal(){modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');modalOpenFor=null;}
function openModal(key,hour){
 if(!localDate(key))return;
 modalOpenFor={date:key,hour};modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
 modalDate.textContent=summaryDate(key)+(hour!==undefined?` · ${pad(hour)}:00`:'');
 eventInput.value='';birthdayBox.checked=false;hourBox.disabled=false;hourBox.checked=hour!==undefined;
 hourSelect.innerHTML=Array.from({length:24},(_,h)=>`<option value="${h}">${pad(h)}:00</option>`).join('');
 hourSelect.disabled=hour===undefined;if(hour!==undefined)hourSelect.value=String(hour);
 updateEventList(key);eventInput.focus({preventScroll:true});
}
function updateEventList(key){
 eventList.replaceChildren();const data=forDate(key);
 const addRow=(label,type,sourceKey=null,index=null)=>{
  const li=document.createElement('li'),span=document.createElement('span');span.textContent=label;li.appendChild(span);
  if(type!=='holiday'){
   const del=document.createElement('button');del.type='button';del.className='delete-event';del.textContent='Entfernen';del.setAttribute('aria-label','Eintrag entfernen: '+label);
   del.addEventListener('click',()=>{
    if(!events[sourceKey]||!events[sourceKey][index])return;
    events[sourceKey].splice(index,1);if(!events[sourceKey].length)delete events[sourceKey];
    if(saveEvents()){updateEventList(key);render()}
   });li.appendChild(del);
  }else li.classList.add('holiday');
  eventList.appendChild(li);
 };
 if(data.holiday)addRow(data.holiday,'holiday');
 for(const note of notesForDate(key)){
  const li=document.createElement('li');li.className='ivy-calendar-linked-note';
  const btn=document.createElement('button');btn.type='button';btn.className='ivy-open-note';
  btn.textContent='📝 '+labelNote(note)+' · Notiz öffnen';btn.addEventListener('click',()=>openLinkedNote(note.id));
  li.appendChild(btn);eventList.appendChild(li);
 }
 for(const bd of data.birthdays)addRow('🎂 '+bd.text,'birthday',bd.originalKey,bd.index);
 (events[key]||[]).forEach((ev,i)=>{if(!ev.birthday)addRow((ev.hour!=null?`${pad(ev.hour)}:00 · `:'')+ev.text,'normal',key,i)});
 if(!eventList.children.length){const li=document.createElement('li');li.className='event-empty';li.textContent='Noch keine Einträge';eventList.appendChild(li)}
}
$('addEventBtn').addEventListener('click',()=>{
 if(!modalOpenFor)return;
 const txt=eventInput.value.trim();if(!txt){eventInput.focus();return}
 const key=modalOpenFor.date,ev={text:txt.slice(0,250)};
 if(birthdayBox.checked)ev.birthday=true;
 else if(hourBox.checked)ev.hour=safeHour(hourSelect.value)??0;
 if(!events[key])events[key]=[];events[key].push(ev);
 if(!saveEvents()){events[key].pop();if(!events[key].length)delete events[key];return}
 closeModal();render();
});
$('closeModalBtn').addEventListener('click',closeModal);
modal.addEventListener('pointerdown',e=>{if(e.target===modal)closeModal()});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!modal.classList.contains('hidden'))closeModal();
 if(e.key==='Enter'&&document.activeElement===eventInput&&!modal.classList.contains('hidden')){$('addEventBtn').click()}
});
hourBox.addEventListener('change',()=>{hourSelect.disabled=!hourBox.checked||birthdayBox.checked});
birthdayBox.addEventListener('change',()=>{
 hourBox.disabled=birthdayBox.checked;
 if(birthdayBox.checked)hourBox.checked=false;
 hourSelect.disabled=birthdayBox.checked||!hourBox.checked;
});
navBtns.forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('todayBtn').addEventListener('click',()=>{currentDate=cloneDate(today());setView('month')});
$('prevBtn').addEventListener('click',()=>{currentDate=stepCalendar(currentDate,currentView,-1);render()});
$('nextBtn').addEventListener('click',()=>{currentDate=stepCalendar(currentDate,currentView,1);render()});
let start=null;
$('calendarArea').addEventListener('touchstart',e=>{
 if(e.touches.length!==1)return;
 const t=e.touches[0];start={x:t.clientX,y:t.clientY,scrollY:e.target.closest('.year-grid,.week-grid,.day-grid')?.scrollTop||0};
},{passive:true});
$('calendarArea').addEventListener('touchend',e=>{
 if(!start||e.changedTouches.length!==1)return;
 const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;start=null;
 // Swipe navigation only in month view. Week and year must remain scrollable.
 if(currentView==='month'&&Math.abs(dx)>85&&Math.abs(dx)>2*Math.abs(dy)){$(dx>0?'prevBtn':'nextBtn').click()}
},{passive:true});
setView('month');

window.addEventListener('message',ev=>{if(ev.origin===location.origin&&ev.data?.type==='ivy-notes-changed'){render();if(modalOpenFor)updateEventList(modalOpenFor.date);}});
window.addEventListener('storage',ev=>{if(ev.key==='notes'){render();if(modalOpenFor)updateEventList(modalOpenFor.date);}});
