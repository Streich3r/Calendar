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
  if(currentView==="day") $("dayView").innerHTML="<h2>"+currentDate.toDateString()+"</h2>";
  if(currentView==="week") renderWeek();
  if(currentView==="year") renderYear();
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
    let cls="day-cell";
    html+=`<div class="${cls}" data-date="${y}-${m+1}-${d}">${isToday?`<span>${d}</span>`:d}</div>`;
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
  let html="<div>";
  for(let i=0;i<7;i++){let d=new Date(start);d.setDate(start.getDate()+i);html+="<div>"+d.toDateString()+"</div>";}
  html+="</div>";
  $("weekView").innerHTML=html;
}

function renderYear(){
  let y=currentDate.getFullYear();
  let html="<div>";
  for(let m=0;m<12;m++){html+="<div>"+new Date(y,m,1).toLocaleString('default',{month:'long'})+"</div>";}
  html+="</div>";
  $("yearView").innerHTML=html;
}

/* Events Modal */
function openModal(dateStr){
  $("eventModal").classList.remove("hidden");
  $("modalDate").textContent = new Date(dateStr).toDateString();
  $("eventInput").value="";
  $("eventList").innerHTML="";
  (events[dateStr]||[]).forEach(e=>{
    let li=document.createElement("li");
    li.textContent=e;
    $("eventList").appendChild(li);
  });
  $("addEventBtn").onclick=()=>{
    let txt=$("eventInput").value.trim();
    if(!txt) return;
    if(!events[dateStr]) events[dateStr]=[];
    events[dateStr].push(txt);
    localStorage.setItem("events",JSON.stringify(events));
    openModal(dateStr);
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
