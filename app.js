function $(id){return document.getElementById(id);}
let currentDate = new Date();
let currentView = "month";
let events = JSON.parse(localStorage.getItem("events") || "{}");

function updateTitle(){
  const opts={month:'long',year:'numeric'};
  $("title").textContent = currentDate.toLocaleDateString(undefined,opts);
}

function render(){
  document.querySelectorAll(".view").forEach(v=>v.innerHTML="");
  if(currentView==="month") renderMonth();
  if(currentView==="week") renderWeek();
  if(currentView==="day") $("dayView").innerHTML="<h2>"+currentDate.toDateString()+"</h2>";
  if(currentView==="year") $("yearView").innerHTML="<h2>"+currentDate.getFullYear()+"</h2>";
  updateTitle();
}

function renderMonth(){
  let y=currentDate.getFullYear(), m=currentDate.getMonth();
  let firstDay=(new Date(y,m,1).getDay()+6)%7; // Monday=0
  let lastDate=new Date(y,m+1,0).getDate();

  let weekdays=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  let html="<div class='weekdays'>";
  weekdays.forEach(d=>html+="<div>"+d+"</div>");
  html+="</div><div class='month-grid'>";

  for(let i=0;i<firstDay;i++) html+="<div></div>";
  for(let d=1; d<=lastDate; d++){
    let today=new Date();
    let isToday=(d===today.getDate() && m===today.getMonth() && y===today.getFullYear());
    let dateStr=`${y}-${m+1}-${d}`;
    let hasEvents = events[dateStr] && events[dateStr].length>0;
    html+=`<div class="day-cell" data-date="${dateStr}"><span class="${isToday?"today":""}">${d}</span>${hasEvents?'<div class="day-events"></div>':""}</div>`;
  }
  html+="</div>";
  $("monthView").innerHTML=html;

  document.querySelectorAll(".day-cell").forEach(cell=>{
    cell.onclick=()=>openModal(cell.dataset.date);
  });
}

function renderWeek(){
  let start=new Date(currentDate);
  let day=(start.getDay()+6)%7; // Monday=0
  start.setDate(start.getDate()-day);

  let html="<div class='week-grid'>";
  html+="<div></div>";
  for(let i=0;i<7;i++){
    let d=new Date(start);
    d.setDate(start.getDate()+i);
    html+=`<div style="text-align:center;border-bottom:1px solid #444;">${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}<br>${d.getDate()}</div>`;
  }

  for(let h=0;h<24;h++){
    html+=`<div class="hour-label">${h}:00</div>`;
    for(let i=0;i<7;i++){
      let d=new Date(start);
      d.setDate(start.getDate()+i);
      let dateStr=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      html+=`<div class="hour-cell" data-date="${dateStr}" data-hour="${h}"></div>`;
    }
  }
  html+="</div>";
  $("weekView").innerHTML=html;

  // render events
  for(let dateStr in events){
    events[dateStr].forEach(ev=>{
      if(ev.hour!==undefined){
        let cell=document.querySelector(`.hour-cell[data-date="${dateStr}"][data-hour="${ev.hour}"]`);
        if(cell){
          let div=document.createElement("div");
          div.className="event";
          div.textContent=ev.text;
          cell.appendChild(div);
        }
      }
    });
  }

  document.querySelectorAll(".hour-cell").forEach(cell=>{
    cell.onclick=()=>openModal(cell.dataset.date, cell.dataset.hour);
  });
}

/* Events Modal */
function openModal(dateStr, hour){
  $("eventModal").classList.remove("hidden");
  $("modalDate").textContent = new Date(dateStr).toDateString() + (hour!==undefined?` ${hour}:00`:"");
  $("eventInput").value="";
  $("eventList").innerHTML="";
  (events[dateStr]||[]).forEach(e=>{
    let li=document.createElement("li");
    li.textContent = e.text || e;
    $("eventList").appendChild(li);
  });
  $("addEventBtn").onclick=()=>{
    let txt=$("eventInput").value.trim();
    if(!txt) return;
    if(!events[dateStr]) events[dateStr]=[];
    if(hour!==undefined) events[dateStr].push({text:txt,hour:parseInt(hour)});
    else events[dateStr].push({text:txt});
    localStorage.setItem("events",JSON.stringify(events));
    $("eventModal").classList.add("hidden");
    render();
  };
}
$("closeModalBtn").onclick=()=> $("eventModal").classList.add("hidden");

/* Navigation */
document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    if(btn.id==="todayBtn"){currentDate=new Date(); currentView="month";}
    else currentView=btn.dataset.view;
    render();
  };
});
$("prevBtn").onclick=()=>{ if(currentView==="day")currentDate.setDate(currentDate.getDate()-1);
  else if(currentView==="week")currentDate.setDate(currentDate.getDate()-7);
  else if(currentView==="month")currentDate.setMonth(currentDate.getMonth()-1);
  else if(currentView==="year")currentDate.setFullYear(currentDate.getFullYear()-1);
  render();}
$("nextBtn").onclick=()=>{ if(currentView==="day")currentDate.setDate(currentDate.getDate()+1);
  else if(currentView==="week")currentDate.setDate(currentDate.getDate()+7);
  else if(currentView==="month")currentDate.setMonth(currentDate.getMonth()+1);
  else if(currentView==="year")currentDate.setFullYear(currentDate.getFullYear()+1);
  render();}

// auto refresh at midnight
setInterval(()=>{let now=new Date();if(now.getDate()!==currentDate.getDate()){currentDate=new Date();render();}},60000);

render();
