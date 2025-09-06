function $(id){return document.getElementById(id);}
let currentDate = new Date();
let currentView = "day";

function updateTitle(){
  const opts={month:'long',year:'numeric'};
  $("title").textContent = currentDate.toLocaleDateString(undefined,opts);
  $("localDate").textContent = currentDate.toDateString();
}

function render(){
  document.querySelectorAll(".view").forEach(v=>v.innerHTML="");
  if(currentView==="day"){
    $("dayView").innerHTML = "<h2>"+currentDate.toDateString()+"</h2>";
  }else if(currentView==="week"){
    let start=new Date(currentDate);
    start.setDate(start.getDate()-start.getDay());
    let html="<div>";
    for(let i=0;i<7;i++){let d=new Date(start);d.setDate(start.getDate()+i);html+="<div>"+d.toDateString()+"</div>";}
    html+="</div>";
    $("weekView").innerHTML=html;
  }else if(currentView==="month"){
    let y=currentDate.getFullYear(),m=currentDate.getMonth();
    let last=new Date(y,m+1,0);
    let html="<div style='display:grid;grid-template-columns:repeat(7,1fr);gap:4px'>";
    for(let i=1;i<=last.getDate();i++){html+="<div style='padding:8px;text-align:center;background:#1a1a1a;border-radius:4px'>"+i+"</div>";}
    html+="</div>";
    $("monthView").innerHTML=html;
  }else if(currentView==="year"){
    let y=currentDate.getFullYear();
    let html="";
    for(let m=0;m<12;m++){html+="<div>"+new Date(y,m,1).toLocaleString('default',{month:'short'})+"</div>";}
    $("yearView").innerHTML=html;
  }
  updateTitle();
}

document.querySelectorAll(".view-btn").forEach(btn=>{
  btn.onclick=()=>{document.querySelectorAll(".view-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");currentView=btn.dataset.view;render();}
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
