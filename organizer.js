(() => {'use strict';
const notes=document.getElementById('notes-frame'),cal=document.getElementById('calendar-frame');
const tabs={notes:document.getElementById('tab-notes'),calendar:document.getElementById('tab-calendar')};
let active='calendar';
function show(which){if(!tabs[which])return;active=which;notes.classList.toggle('active',which==='notes');cal.classList.toggle('active',which==='calendar');for(const [key,el] of Object.entries(tabs)){el.classList.toggle('active',which===key);el.setAttribute('aria-pressed',String(which===key));}if(which==='calendar')cal.contentWindow?.postMessage({type:'ivy-notes-changed'},location.origin);}
tabs.notes.addEventListener('click',()=>show('notes'));tabs.calendar.addEventListener('click',()=>show('calendar'));
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;const d=event.data;if(d?.type==='ivy-open-note'&&typeof d.id==='string'){show('notes');notes.contentWindow?.postMessage(d,location.origin);}});
// Only compare published HTML with this loaded release; no popup on a mere service-worker restart.
const build = document.querySelector('meta[name="ivy-organizer-build"]')?.content || '';
const popup=document.getElementById('ivy-update-popup');
let availableBuild=null;
const pagePath=new URL('./index.html',location.href).pathname;
async function checkForUpdate(){
 if(!navigator.onLine || !location.protocol.startsWith('http') || document.hidden)return;
 try{
  const url=new URL(pagePath,location.origin);url.searchParams.set('_ivy_check',String(Date.now()));
  const response=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
  if(!response.ok)return;
  const html=await response.text();
  const match=html.match(/<meta\s+name=["']ivy-organizer-build["']\s+content=["']([^"']+)["']/i);
  if(!match||match[1]===build){availableBuild=null;popup.hidden=true;return;}
  const next=match[1];availableBuild=next;
  if(sessionStorage.getItem('ivy-organizer-deferred')===next || localStorage.getItem('ivy-organizer-confirmed')===next)return;
  popup.hidden=false;
 }catch(err){console.debug('Updateprüfung offline/nicht verfügbar:',err)}
}
document.getElementById('ivy-update-later').addEventListener('click',()=>{if(availableBuild)sessionStorage.setItem('ivy-organizer-deferred',availableBuild);popup.hidden=true;});
document.getElementById('ivy-update-now').addEventListener('click',()=>{
 if(!availableBuild)return;
 localStorage.setItem('ivy-organizer-confirmed',availableBuild);
 popup.hidden=true;
 const url=new URL('./index.html',location.href);url.searchParams.set('_ivy_version',availableBuild);
 location.replace(url.href);
});
window.addEventListener('focus',checkForUpdate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForUpdate()});
window.addEventListener('online',checkForUpdate);
setTimeout(checkForUpdate,6000);
setInterval(checkForUpdate,5*60*1000);
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(console.warn);
})();