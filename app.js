const $ = id => document.getElementById(id);
const views = {day:$("dayView"), week:$("weekView"), month:$("monthView"), year:$("yearView")};
let currentView = "month";
let currentDate = new Date();
let events = JSON.parse(localStorage.getItem("events")||"{}");

function saveEvents(){ localStorage.setItem("events", JSON.stringify(events)); }

/* German fixed-date holidays */
function germanHolidays(year){
  return {
    [`${year}-1-1`]: "Neujahr",
    [`${year}-5-1`]: "Tag der Arbeit",
    [`${year}-10-3`]: "Tag der Deutschen Einheit",
    [`${year}-12-25`]: "1. Weihnachtstag",
    [`${year}-12-26`]: "2. Weihnachtstag"
  };
}

/* ---------- RENDERING ---------- */

function render(){
  $("title").textContent = titleText();
  for(const v in views){ views[v].style.display = "none"; }
  views[currentView].style.display = "block";
  if(currentView==="month") renderMonth();
  if(currentView==="week") renderWeek();
  if(currentView==="day") renderDay();
  if(currentView==="year") renderYear();
}

function titleText(){
  if(currentView==="day") return currentDate.toDateString();
  if(currentView==="week"){
    const start = new Date(currentDate); start.setDate(currentDate.getDate()-currentDate.getDay()+1);
    const end = new Date(start); end.setDate(start.getDate()+6);
    return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  }
  if(currentView==="month") return currentDate.toLocaleString("default",{month:"long",year:"numeric"});
  if(currentView==="year") return currentDate.getFullYear();
}

/* --- MONTH VIEW --- */
function renderMonth(){
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  const holidays = germanHolidays(y);

  const first = new Date(y,m,1);
  const firstDayIndex = (first.getDay()+6)%7;
  const lastDate = new Date(y,m+1,0).getDate();

  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html = `<div class="weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div>`;
  html += `<div class="month-grid" id="monthGrid">`;

  for(let i=0;i<firstDayIndex;i++) html += `<div class="day-cell empty"></div>`;

  for(let d=1; d<=lastDate; d++){
    const dt = new Date(y,m,d);
    const dayOfWeek = dt.getDay();
    const isWeekend = (dayOfWeek===0 || dayOfWeek===6);
    const isToday = dt.toDateString() === (new Date()).toDateString();
    const ds = `${y}-${m+1}-${d}`;
    const isHoliday = holidays[ds] !== undefined;
    const hasEvents = events[ds] && events[ds].length>0;

    html += `<div class="day-cell${isWeekend?' weekend':''}" data-date="${ds}" title="${isHoliday?holidays[ds]:''}">
              <div class="day-number ${isToday? 'today' : ''} ${isHoliday? 'holiday' : ''}">${d}</div>
              <div class="day-events">${ hasEvents ? '<div class="day-dot"></div>' : '' }</div>
            </div>`;
  }

  const totalCells = firstDayIndex + lastDate;
  const rem = (7 - (totalCells % 7)) % 7;
  for(let i=0;i<rem;i++) html += `<div class="day-cell empty"></div>`;

  html += `</div>`;
  views.month.innerHTML = html;

  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{
    cell.addEventListener('click', ()=> openModal(cell.dataset.date));
  });
}

/* --- WEEK VIEW --- */
function renderWeek(){
  const y = currentDate.getFullYear();
  const start = new Date(currentDate); start.setDate(currentDate.getDate()-((currentDate.getDay()+6)%7));
  let html = `<div class="week-grid">`;
  html += `<div></div>`;
  for(let i=0;i<7;i++){ const d = new Date(start); d.setDate(start.getDate()+i); html+=`<div>${d.toLocaleDateString("de-DE",{weekday:"short",day:"numeric"})}</div>`; }
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${h}:00</div>`;
    for(let i=0;i<7;i++){
      const d = new Date(start); d.setDate(start.getDate()+i);
      const ds = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      const isWeekend = (d.getDay()===0 || d.getDay()===6);
      html += `<div class="hour-cell${isWeekend?' weekend':''}" data-date="${ds}" data-hour="${h}"></div>`;
    }
  }
  html += `</div>`;
  views.week.innerHTML = html;
}

/* --- DAY VIEW --- */
function renderDay(){
  const d = currentDate;
  const ds = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const isWeekend = (d.getDay()===0 || d.getDay()===6);
  let html = `<div class="day-grid">`;
  for(let h=0; h<24; h++){
    html += `<div class="hour-label">${h}:00</div>`;
    html += `<div class="day-hour${isWeekend?' weekend':''}" data-date="${ds}" data-hour="${h}"></div>`;
  }
  html += `</div>`;
  views.day.innerHTML = html;
}

/* --- YEAR VIEW --- */
function renderYear(){
  const y = currentDate.getFullYear();
  let html = `<div class="year-grid">`;
  for(let m=0;m<12;m++){
    html += `<div class="year-month"><strong>${new Date(y,m,1).toLocaleString("default",{month:"long"})}</strong>`;
    html += renderMiniMonth(y,m);
    html += `</div>`;
  }
  html += `</div>`;
  views.year.innerHTML = html;
}

function renderMiniMonth(y,m){
  const holidays = germanHolidays(y);
  const first = new Date(y,m,1);
  const firstIdx = (first.getDay()+6)%7;
  const lastDate = new Date(y,m+1,0).getDate();
  let mini = '<div style="display:grid;grid-template-columns:repeat(7,1fr);font-size:11px">';
  for(let i=0;i<firstIdx;i++) mini += `<div></div>`;
  for(let d=1; d<=lastDate; d++){
    const dt = new Date(y,m,d);
    const dayOfWeek = dt.getDay();
    const isWeekend = (dayOfWeek===0 || dayOfWeek===6);
    const ds = `${y}-${m+1}-${d}`;
    const isHoliday = holidays[ds] !== undefined;
    const dot = (events[ds] && events[ds].length>0) ? '<span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--event);"></span>' : '';
    mini += `<div style="padding:1px;${isWeekend?'background:#252627;':''}">
               <span style="${isHoliday?'color:#d93025;font-weight:bold;':''}">${d}</span> ${dot}
             </div>`;
  }
  mini += '</div>';
  return mini;
}

/* ---------- EVENTS MODAL ---------- */
function openModal(dateStr){
  $("modalDate").textContent = dateStr;
  $("eventInput").value = "";
  renderEventList(dateStr);
  $("eventModal").classList.remove("hidden");
  $("addEventBtn").onclick = ()=>{
    const val = $("eventInput").value.trim();
    if(val){
      if(!events[dateStr]) events[dateStr] = [];
      events[dateStr].push(val);
      saveEvents();
      renderEventList(dateStr);
      render();
    }
    $("eventInput").value="";
  };
  $("closeModalBtn").onclick = ()=> $("eventModal").classList.add("hidden");
}

function renderEventList(dateStr){
  const list = $("eventList"); list.innerHTML="";
  (events[dateStr]||[]).forEach(ev=>{
    const li=document.createElement("li");
    li.textContent=ev;
    list.appendChild(li);
  });
}

/* ----------- NAVIGATION ----------- */
$("todayBtn").onclick = ()=>{ currentDate=new Date(); render(); };
document.querySelectorAll(".nav-btn[data-view]").forEach(btn=>{
  btn.onclick = ()=>{
    currentView=btn.dataset.view;
    document.querySelectorAll(".nav-btn[data-view]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    render();
  };
});

function prev(){ if(currentView==="day") currentDate.setDate(currentDate.getDate()-1);
else if(currentView==="week") currentDate.setDate(currentDate.getDate()-7);
else if(currentView==="month") currentDate.setMonth(currentDate.getMonth()-1);
else if(currentView==="year") currentDate.setFullYear(currentDate.getFullYear()-1); render(); }

function next(){ if(currentView==="day") currentDate.setDate(currentDate.getDate()+1);
else if(currentView==="week") currentDate.setDate(currentDate.getDate()+7);
else if(currentView==="month") currentDate.setMonth(currentDate.getMonth()+1);
else if(currentView==="year") currentDate.setFullYear(currentDate.getFullYear()+1); render(); }

$("prevBtn").onclick=prev; $("nextBtn").onclick=next;

/* Swipe support */
let touchStartX=0;
document.addEventListener("touchstart", e=>{touchStartX=e.touches[0].clientX;});
document.addEventListener("touchend", e=>{
  let dx=e.changedTouches[0].clientX-touchStartX;
  if(Math.abs(dx)>50){ if(dx<0) next(); else prev(); }
});

render();
