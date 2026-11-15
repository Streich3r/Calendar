(() => {'use strict';
const notes=document.getElementById('notes-frame'),cal=document.getElementById('calendar-frame');
const tabs={notes:document.getElementById('tab-notes'),calendar:document.getElementById('tab-calendar')};
let active='notes';
function show(which){if(!tabs[which])return;active=which;notes.classList.toggle('active',which==='notes');cal.classList.toggle('active',which==='calendar');for(const [key,el] of Object.entries(tabs)){el.classList.toggle('active',which===key);el.setAttribute('aria-pressed',String(which===key));}if(which==='calendar')cal.contentWindow?.postMessage({type:'ivy-notes-changed'},location.origin);}
tabs.notes.addEventListener('click',()=>show('notes'));tabs.calendar.addEventListener('click',()=>show('calendar'));
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;const d=event.data;if(d?.type==='ivy-open-note'&&typeof d.id==='string'){show('notes');notes.contentWindow?.postMessage(d,location.origin);}});
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(console.warn);
})();