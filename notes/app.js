/* IVY Notes V3 – offline, local-first, no external JS dependencies.
   Legacy notes/order storage preserved. Images are stored separately in IndexedDB. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'notes', ORDER_KEY = 'notes-order', DRAFT_KEY = 'ivy-notes-draft-v2', GROUPS_KEY = 'ivy-notes-groups-v4';
  const MAX_IMPORT_BYTES = 70 * 1024 * 1024, MAX_IMAGE_BYTES = 7 * 1024 * 1024;
  const editor = $('note-editor'), titleInput = $('note-title-input'), noteList = $('notes-list');
  const searchInput = $('search-input'), sortSelect = $('sort-select');
  let notes = [], order = [], groups = [], activeGroup = 'all', sort = 'unsorted', editingId = null, savedRange = null;
  let draftTimer = 0, toastTimer = 0, dragCard = null, corruptStorage = false, holdTimer = null;
  let imageDBPromise, imageURLs = new Map();
  let selectedDate = null; // calendar association; null = no date

  function notify(message) {
    const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3400);
  }
  function parseJSON(text, fallback) { try { return JSON.parse(text) ?? fallback; } catch { return fallback; } }
  function makeId() { return globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)); }
  function normalize(n) {
    if (!n || typeof n !== 'object') return null;
    const created = Number(n.createdAt), updated = Number(n.updatedAt);
    return { ...n, id:String(n.id || makeId()), title:String(n.title || '').slice(0, 180), content:String(n.content || '').slice(0, 750000),
      createdAt:Number.isFinite(created)&&created>0?created:Date.now(),
      updatedAt:Number.isFinite(updated)&&updated>0?updated:Date.now(),
      color:typeof n.color==='string'?n.color:'default',
      groupId:typeof n.groupId==='string'?n.groupId:null, pinned:!!n.pinned, date: /^\d{4}-\d{2}-\d{2}$/.test(String(n.date||''))?n.date:null,
      caretPath:Array.isArray(n.caretPath)?n.caretPath.filter(x=>Number.isInteger(x)&&x>=0&&x<10000).slice(0,30):null,
      caretOffset:Number.isInteger(n.caretOffset)&&n.caretOffset>=0?n.caretOffset:null,
      caretNodeOffset:Number.isInteger(n.caretNodeOffset)&&n.caretNodeOffset>=0?n.caretNodeOffset:null };
  }
  const permitted = new Set(['B','STRONG','I','EM','U','S','STRIKE','A','P','DIV','UL','OL','LI','FONT','SPAN','BLOCKQUOTE','BR','H1','H2','H3','H4','IMG','INPUT']);
  const blocked = new Set(['SCRIPT','STYLE','IFRAME','SVG','MATH','OBJECT','EMBED','FORM','TEMPLATE','NOSCRIPT','META','LINK','BASE']);
  function sanitize(html) {
    const doc = new DOMParser().parseFromString('<main id="ivy-raw">'+String(html??'')+'</main>','text/html');
    const source = doc.getElementById('ivy-raw'), result = document.createElement('div');
    function walk(node, parent, depth=0) {
      if(depth>45)return;
      if(node.nodeType===Node.TEXT_NODE){parent.appendChild(document.createTextNode(node.textContent));return;}
      if(node.nodeType!==Node.ELEMENT_NODE)return;
      const tag=node.tagName.toUpperCase(); if(blocked.has(tag))return;
      if(!permitted.has(tag)) {for(const child of [...node.childNodes])walk(child,parent,depth+1);return;}
      if(tag==='INPUT'){
        // Only a checklist checkbox may survive import/paste. Never keep arbitrary input controls.
        if(node.getAttribute('type')!=='checkbox'||node.getAttribute('data-ivy-check')!=='1'||parent.tagName!=='LI')return;
        if(parent.querySelector(':scope > input[data-ivy-check]'))return;
        const box=document.createElement('input');box.type='checkbox';box.setAttribute('data-ivy-check','1');box.setAttribute('contenteditable','false');
        if(node.hasAttribute('checked')||node.checked)box.setAttribute('checked','');
        parent.appendChild(box);return;
      }
      const el=document.createElement(tag.toLowerCase());
      if(tag==='UL'&&node.getAttribute('data-ivy-checklist')==='1')el.setAttribute('data-ivy-checklist','1');
      if(tag==='IMG') {
        const id=node.getAttribute('data-ivy-image-id');
        if(!id||!/^img-[a-zA-Z0-9_-]{8,100}$/.test(id))return;
        el.setAttribute('data-ivy-image-id',id);
        el.setAttribute('alt',(node.getAttribute('alt')||'Notizbild').slice(0,140));
        el.setAttribute('draggable','false');
      }
      if(tag==='A') {
        const href=(node.getAttribute('href')||'').trim();
        try{const url=new URL(href,location.href);
          if(['https:','http:','mailto:','tel:'].includes(url.protocol)){
            el.setAttribute('href',url.href); el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer');
          }
        }catch{}
      }
      if(tag==='FONT'){
        const size=node.getAttribute('size'), color=node.getAttribute('color');
        if(/^[1-7]$/.test(size||''))el.setAttribute('size',size);
        if(/^(#[\da-f]{3,8}|[a-z]{2,20})$/i.test(color||''))el.setAttribute('color',color);
      }
      if(tag==='OL'||tag==='UL'){
        const type=node.style?.listStyleType;
        if(['disc','circle','decimal','lower-alpha','upper-alpha'].includes(type))el.style.listStyleType=type;
      }
      if(['SPAN','DIV','P','H1','H2','H3','H4'].includes(tag)){
        const s=node.style;
        if(s){
          if(/^(#[\da-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]{2,20})$/i.test(s.color||''))el.style.color=s.color;
          if(/^(bold|bolder|normal|[1-9]00)$/i.test(s.fontWeight||''))el.style.fontWeight=s.fontWeight;
          if(/^(italic|oblique|normal)$/i.test(s.fontStyle||''))el.style.fontStyle=s.fontStyle;
          if(/^(\d+(\.\d+)?)(px|em|rem|%)$/.test(s.fontSize||'')&&Number.parseFloat(s.fontSize)<=80)el.style.fontSize=s.fontSize;
          if(s.textDecorationLine==='underline'||s.textDecoration==='underline')el.style.textDecoration='underline';
          if(['left','center','right'].includes(s.textAlign))el.style.textAlign=s.textAlign;
        }
      }
      if(tag!=='IMG')for(const child of [...node.childNodes])walk(child,el,depth+1);
      parent.appendChild(el);
    }
    for(const node of [...source.childNodes])walk(node,result);
    return result.innerHTML;
  }
  function textFromHTML(html){const node=document.createElement('div');node.innerHTML=sanitize(html);return node.textContent||'';}
  function hasContent(html){return textFromHTML(html).trim().length>0 || /data-ivy-image-id="img-/.test(html);}

  // Keep text-selection positions relative to the editor, never viewport pixels.
  function selectionInEditor(){const s=getSelection();return !!(s?.rangeCount&&editor.contains(s.getRangeAt(0).commonAncestorContainer));}
  function capture(){if(selectionInEditor())savedRange=getSelection().getRangeAt(0).cloneRange();}
  function restore(){
    editor.focus({preventScroll:true});
    try{if(savedRange?.commonAncestorContainer?.isConnected&&editor.contains(savedRange.commonAncestorContainer)){
      const selection=getSelection();selection.removeAllRanges();selection.addRange(savedRange);return true;
    }}catch{}
    return false;
  }
  function caretData(){
    let range=selectionInEditor()?getSelection().getRangeAt(0):savedRange;
    if(!range||!editor.contains(range.startContainer))return {caretPath:null,caretOffset:null};
    const node=range.startContainer, path=[];let cur=node;
    while(cur!==editor&&cur?.parentNode){path.unshift([...cur.parentNode.childNodes].indexOf(cur));cur=cur.parentNode;}
    if(cur!==editor)return {caretPath:null,caretOffset:null};
    const pre=document.createRange();pre.selectNodeContents(editor);pre.setEnd(node,range.startOffset);
    return {caretPath:path,caretOffset:pre.toString().length,caretNodeOffset:range.startOffset};
  }
  function restoreCaret(note){
    let node=editor;
    const path=Array.isArray(note?.caretPath)?note.caretPath:null;
    if(path){
      for(const n of path){node=node?.childNodes?.[n];if(!node)break;}
      if(node){
        const offset=Math.max(0,Math.min(note?.caretNodeOffset??note?.caretOffset??0,node.nodeType===Node.TEXT_NODE?node.length:node.childNodes.length));
        try{const r=document.createRange();r.setStart(node,offset);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);capture();return; }catch{}
      }
    }
    const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);
    let remain=Math.max(0,note?.caretOffset??Number.MAX_SAFE_INTEGER),last=null,nodeText;
    while((nodeText=walker.nextNode())) {last=nodeText;if(remain<=nodeText.length){const r=document.createRange();r.setStart(nodeText,remain);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);capture();return;}remain-=nodeText.length;}
    const r=document.createRange();r.selectNodeContents(editor);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);capture();
  }
  function updateFormatting(){
    if(!selectionInEditor())return;
    const node=getSelection()?.anchorNode, el=node?.nodeType===Node.TEXT_NODE?node.parentElement:node;
    $('checklist-btn').setAttribute('aria-pressed',String(!!el?.closest?.('ul[data-ivy-checklist="1"]')));
    for(const btn of document.querySelectorAll('[data-format]')){
      let pressed=false;try{pressed=document.queryCommandState(btn.dataset.format);}catch{}
      btn.setAttribute('aria-pressed',String(pressed));
    }
  }
  function execute(command,value=null){
    restore();
    try{const succeeded=document.execCommand(command,false,value);if(!succeeded)console.debug('Format command returned false:',command);}catch(error){console.warn(error);notify('Diese Formatierung wird im Browser nicht unterstützt.');}
    capture();updateFormatting();scheduleDraft();
  }
  function insertHTMLAtCaret(html){
    restore();
    // execCommand keeps one browser undo transaction for inserted material.
    document.execCommand('insertHTML',false,html);
    capture();scheduleDraft();
  }
  function applyList(style){
    if(!style)return;
    restore();
    const selection=getSelection(),node=selection?.anchorNode;
    let el=node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement;
    const existing=el?.closest?.('ul,ol');
    if(existing&&editor.contains(existing)){
      if((style==='decimal'&&existing.tagName==='OL') || (style!=='decimal'&&existing.tagName==='UL')){
        if(style==='decimal'){execute('insertOrderedList');return;}
        // Repeated selected style toggles the list off; other style switches without rebuilding.
        if((existing.style.listStyleType||'disc')===style){execute('insertUnorderedList');return;}
        existing.style.listStyleType=style;capture();scheduleDraft();return;
      }
    }
    execute(style==='decimal'?'insertOrderedList':'insertUnorderedList');
    const s=getSelection();el=s?.anchorNode?.nodeType===Node.TEXT_NODE?s.anchorNode.parentElement:s?.anchorNode;
    const created=el?.closest?.('ul,ol');if(created&&editor.contains(created)&&style!=='decimal')created.style.listStyleType=style;
    capture();scheduleDraft();
  }
  function ensureChecklist(ul){
    if(!ul||ul.tagName!=='UL'||ul.getAttribute('data-ivy-checklist')!=='1')return;
    for(const li of [...ul.children].filter(el=>el.tagName==='LI')){
      let box=li.querySelector(':scope > input[data-ivy-check]');
      if(!box){box=document.createElement('input');box.type='checkbox';box.setAttribute('data-ivy-check','1');box.setAttribute('contenteditable','false');li.prepend(box);}
      // Do not overwrite the live checked state while an input event is being processed.
    }
  }
  function ensureEditorChecklists(){for(const ul of editor.querySelectorAll('ul[data-ivy-checklist="1"]'))ensureChecklist(ul);}
  function checklistToggle(){
    restore();
    let sel=getSelection(), n=sel?.anchorNode, el=n?.nodeType===Node.TEXT_NODE?n.parentElement:n;
    let ul=el?.closest?.('ul');if(ul&&!editor.contains(ul))ul=null;
    if(ul?.getAttribute('data-ivy-checklist')==='1'){
      ul.removeAttribute('data-ivy-checklist');ul.querySelectorAll('input[data-ivy-check]').forEach(i=>i.remove());
      $('checklist-btn').setAttribute('aria-pressed','false');
    }else{
      if(!ul){execute('insertUnorderedList');sel=getSelection();n=sel?.anchorNode;el=n?.nodeType===Node.TEXT_NODE?n.parentElement:n;ul=el?.closest?.('ul');}
      if(!ul||!editor.contains(ul)){notify('Cursor zuerst in die Notiz setzen.');return;}
      ul.setAttribute('data-ivy-checklist','1');ensureChecklist(ul);
      $('checklist-btn').setAttribute('aria-pressed','true');
    }
    capture();scheduleDraft();
  }
  function updateChecklistCheckbox(input){
    input.toggleAttribute('checked',input.checked);
    input.closest('li')?.classList.toggle('ivy-checked',input.checked);
  }

  function validLink(input){try{const url=new URL(String(input).trim());return ['http:','https:','mailto:','tel:'].includes(url.protocol)?url.href:null;}catch{return null;}}

  // Image assets are never embedded into localStorage. This prevents quota exhaustion.
  function database(){
    if(imageDBPromise)return imageDBPromise;
    imageDBPromise=new Promise((resolve,reject)=>{
      try{
        const request=indexedDB.open('ivy-notes-assets-v3',1);
        request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('images'))db.createObjectStore('images',{keyPath:'id'});};
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error||new Error('IndexedDB konnte nicht geöffnet werden'));
      }catch(e){reject(e);}
    }).catch(error=>{imageDBPromise=null;throw error;});
    return imageDBPromise;
  }
  async function getImage(id){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const request=db.transaction('images','readonly').objectStore('images').get(id);
      request.onsuccess=()=>resolve(request.result?.blob||null);
      request.onerror=()=>reject(request.error);
    });
  }
  async function putImage(id,blob){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('images','readwrite');tx.objectStore('images').put({id,blob});
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });
  }
  function imageIDs(html){return [...new Set([...String(html||'').matchAll(/data-ivy-image-id="(img-[a-zA-Z0-9_-]{8,100})"/g)].map(m=>m[1]))];}
  async function fillImages(root){
    for(const img of [...root.querySelectorAll('img[data-ivy-image-id]')]){
      const id=img.dataset.ivyImageId;
      if(!imageURLs.has(id)){
        try{const blob=await getImage(id);if(blob)imageURLs.set(id,URL.createObjectURL(blob));}catch(e){console.warn('Bild konnte nicht geladen werden',e)}
      }
      if(img.isConnected){
        if(imageURLs.has(id)){img.src=imageURLs.get(id);img.classList.remove('ivy-image-missing');}
        else {img.alt='Bild nicht verfügbar';img.classList.add('ivy-image-missing');}
      }
    }
  }
  async function imageBlob(file){
    if(!file.type.startsWith('image/')||file.type==='image/svg+xml')throw new Error('Bitte PNG, JPG, WebP, GIF oder AVIF wählen.');
    if(file.size>MAX_IMAGE_BYTES)throw new Error('Bild ist zu groß (max. 7 MB).');
    // Downscale big static images. GIF is intentionally left intact for animation.
    if(file.type==='image/gif'||file.size<320000)return file;
    try{
      const bitmap=await createImageBitmap(file);const max=1600;
      if(bitmap.width<=max&&bitmap.height<=max&&file.size<900000){bitmap.close();return file;}
      const ratio=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.85));
      return blob&&blob.size<file.size?blob:file;
    }catch{return file;}
  }
  async function insertImage(file){
    if(!file)return;
    try{
      const blob=await imageBlob(file);const id='img-'+makeId().replace(/[^a-z0-9_-]/gi,'');
      await putImage(id,blob); // Save first; don't create broken references on quota error.
      imageURLs.set(id,URL.createObjectURL(blob));
      restore();
      // use a real image DOM element; preserve cursor *after* it.
      const image=document.createElement('img');image.setAttribute('data-ivy-image-id',id);image.alt=(file.name||'Notizbild').slice(0,140);image.draggable=false;image.src=imageURLs.get(id);
      const s=getSelection();let r=s?.rangeCount?s.getRangeAt(0):null;
      if(!r||!editor.contains(r.commonAncestorContainer)){r=document.createRange();r.selectNodeContents(editor);r.collapse(false);}
      r.deleteContents();r.insertNode(image);
      const tail=document.createTextNode('\u00a0');image.after(tail);r.setStart(tail,1);r.collapse(true);s.removeAllRanges();s.addRange(r);
      capture();scheduleDraft();notify('Bild eingefügt');
    }catch(e){notify('Bild konnte nicht eingefügt werden: '+(e?.message||'Speicherfehler'));}
  }
  async function fileToDataURL(blob){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
  function dataURLtoBlob(str){const match=/^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/i.exec(str||'');if(!match)return null;const binary=atob(match[2]);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type:match[1]});}

  function scheduleDraft(){
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>{
      try{
        const content=sanitize(editor.innerHTML);
        if(!titleInput.value.trim()&&!hasContent(content)){localStorage.removeItem(DRAFT_KEY);return;}
        const data={title:titleInput.value,content,editingId,date:selectedDate,groupId:$('note-group-select').value||null,...caretData()};
        localStorage.setItem(DRAFT_KEY,JSON.stringify(data));$('draft-indicator').textContent='Entwurf lokal gesichert';
      }catch{$('draft-indicator').textContent='Entwurf konnte nicht gesichert werden';}
    },550);
  }
  function clearDraft(){clearTimeout(draftTimer);draftTimer=0;localStorage.removeItem(DRAFT_KEY);}
  function setEditing(active){
    $('compose-heading').textContent=active?'Notiz bearbeiten':'Neue Notiz';
    $('save-note-label').textContent=active?'Änderungen speichern':'Notiz speichern';
    $('cancel-edit-btn').classList.toggle('hidden',!active);
  }
  function resetEditor(){
    editingId=null;selectedDate=null;titleInput.value='';editor.innerHTML='';savedRange=null;clearDraft();setEditing(false);updateDateBadge();
    $('note-group-select').value=groups.some(g=>g.id===activeGroup)?activeGroup:'';
    $('draft-indicator').textContent='Entwurf wird lokal gesichert';
    for(const b of document.querySelectorAll('[data-format]'))b.setAttribute('aria-pressed','false');$('checklist-btn').setAttribute('aria-pressed','false');
  }
  function load(){
    const raw=localStorage.getItem(KEY);let parsed=[];
    if(raw){try{parsed=JSON.parse(raw);}catch{corruptStorage=true;notify('Gespeicherte Notizen sind beschädigt. Die Originaldaten bleiben unangetastet.');return;}}
    if(!Array.isArray(parsed)){corruptStorage=true;notify('Notizen haben ein ungültiges Format. Nichts wird überschrieben.');return;}
    groups=normalizeGroups(parseJSON(localStorage.getItem(GROUPS_KEY),[]));
    notes=parsed.map(normalize).filter(Boolean);
    for(const note of notes){if(note.groupId&&!groups.some(g=>g.id===note.groupId))note.groupId=null;}
    updateGroupSelect();
    const storedOrder=parseJSON(localStorage.getItem(ORDER_KEY),[]);
    order=[...new Set([...(Array.isArray(storedOrder)?storedOrder.map(String):[]),...notes.map(n=>n.id)])].filter(id=>notes.some(n=>n.id===id));
    const draft=parseJSON(localStorage.getItem(DRAFT_KEY),null);
    if(draft&&(draft.title||hasContent(draft.content||''))){
      selectedDate=typeof draft.date==='string'?draft.date:null;updateDateBadge();
      titleInput.value=String(draft.title||'');editor.innerHTML=sanitize(draft.content||'');$('note-group-select').value=draft.groupId&&groups.some(g=>g.id===draft.groupId)?draft.groupId:'';
      fillImages(editor);
      if(draft.editingId&&notes.some(n=>n.id===draft.editingId)){editingId=draft.editingId;setEditing(true);}
      $('draft-indicator').textContent='Vorheriger Entwurf wiederhergestellt';
    }
    render();
  }
  function persist(){
    if(corruptStorage){notify('Speichern gesperrt: Originaldaten sind beschädigt.');return false;}
    try{localStorage.setItem(KEY,JSON.stringify(notes));localStorage.setItem(ORDER_KEY,JSON.stringify(order));localStorage.setItem(GROUPS_KEY,JSON.stringify(groups));$('storage-indicator').textContent='LOKAL · GESPEICHERT';return true;}
    catch(error){console.error(error);notify('Speichern fehlgeschlagen: Browserspeicher voll? Bitte Backup erstellen.');return false;}
  }
  function saveNote(){
    ensureEditorChecklists();const noteTitle=titleInput.value.trim(),content=sanitize(editor.innerHTML),groupId=$('note-group-select').value||null;
    if(!noteTitle&&!hasContent(content)){notify('Bitte einen Titel, Text oder ein Bild einfügen.');return;}
    const caret=caretData();const now=Date.now();const previous=notes.find(n=>n.id===editingId);
    const oldNotes=notes.slice(),oldOrder=order.slice();
    if(previous){notes=notes.map(n=>n.id===previous.id?{...n,title:noteTitle,content,date:selectedDate,groupId,updatedAt:now,...caret}:n);}
    else{const id=makeId();notes.unshift({id,title:noteTitle,content,date:selectedDate,createdAt:now,updatedAt:now,color:'default',groupId,pinned:false,...caret});order.unshift(id);}
    if(!persist()){notes=oldNotes;order=oldOrder;return;}
    resetEditor();render();notify(previous?'Notiz aktualisiert':'Notiz gespeichert');
  }
  function editNote(id){
    const note=notes.find(n=>n.id===id);if(!note)return;
    editingId=id;selectedDate=note.date||null;updateDateBadge();titleInput.value=note.title||'';editor.innerHTML=sanitize(note.content);$('note-group-select').value=note.groupId||'';setEditing(true);ensureEditorChecklists();
    fillImages(editor);
    document.querySelector('.composer').scrollIntoView({behavior:'smooth',block:'start'});
    editor.focus({preventScroll:true});restoreCaret(note);scheduleDraft();
  }
  async function dialog(message,{heading='Bestätigung',confirm='Bestätigen',cancelable=true}={}){
    const bg=$('dialog-backdrop');$('dialog-title').textContent=heading;$('dialog-message').textContent=message;
    $('dialog-confirm').textContent=confirm;$('dialog-cancel').hidden=!cancelable;bg.hidden=false;$('dialog-confirm').focus();
    return await new Promise(resolve=>{
      let finished=false;
      const close=result=>{if(finished)return;finished=true;bg.hidden=true;cleanup();resolve(result);};
      const yes=()=>close(true),no=()=>close(false),esc=e=>{if(e.key==='Escape')close(false);};
      const backdrop=e=>{if(e.target===bg)close(false);};
      const cleanup=()=>{$('dialog-confirm').removeEventListener('click',yes);$('dialog-cancel').removeEventListener('click',no);document.removeEventListener('keydown',esc);bg.removeEventListener('click',backdrop);};
      $('dialog-confirm').addEventListener('click',yes);$('dialog-cancel').addEventListener('click',no);document.addEventListener('keydown',esc);bg.addEventListener('click',backdrop);
    });
  }
  async function deleteNote(id){
    const note=notes.find(n=>n.id===id);if(!note)return;
    if(!await dialog(`„${note.title||'Diese Notiz'}“ wirklich löschen?`,{heading:'Notiz löschen',confirm:'Löschen'}))return;
    const oldNotes=notes.slice(),oldOrder=order.slice();notes=notes.filter(n=>n.id!==id);order=order.filter(k=>k!==id);
    if(!persist()){notes=oldNotes;order=oldOrder;return;}
    if(editingId===id)resetEditor();render();notify('Notiz gelöscht');
    // Image blobs remain available for backups of unsaved drafts; avoid accidental data loss.
  }
  function normalizeGroups(value){
    if(!Array.isArray(value))return [];
    const seen=new Set(),items=[];
    for(const raw of value){if(!raw||typeof raw!=='object')continue;
      const name=String(raw.name||'').trim().slice(0,64),id=String(raw.id||'').slice(0,100);
      if(!name||!id||seen.has(id))continue;seen.add(id);items.push({id,name});
    }
    return items;
  }
  function updateGroupSelect(){
    const select=$('note-group-select'),prev=select.value;
    select.replaceChildren(new Option('Ohne Gruppe',''));
    for(const g of groups)select.add(new Option(g.name,g.id));
    select.value=groups.some(g=>g.id===prev)?prev:'';
  }
  function renderGroups(){
    const bar=$('group-tabs');if(!bar)return;bar.replaceChildren();
    const chip=(key,name,count)=>{
      const wrap=document.createElement('div');wrap.className='group-chip-wrap';
      const b=document.createElement('button');b.type='button';b.className='group-chip';b.dataset.group=key;
      b.textContent=name+' · '+count;b.setAttribute('aria-pressed',String(activeGroup===key));
      b.addEventListener('click',()=>{activeGroup=key;render();});wrap.append(b);
      if(key!=='all'&&key!=='ungrouped'){
        const edit=document.createElement('button');edit.type='button';edit.className='group-edit';edit.setAttribute('aria-label','Gruppe '+name+' bearbeiten');edit.title='Gruppe umbenennen oder löschen';edit.textContent='⋯';edit.addEventListener('click',()=>groupDialog(key));wrap.append(edit);
      }
      bar.append(wrap);
    };
    chip('all','Alle',notes.length);chip('ungrouped','Ohne Gruppe',notes.filter(n=>!n.groupId).length);
    for(const group of groups)chip(group.id,group.name,notes.filter(n=>n.groupId===group.id).length);
  }
  function groupDialog(id=null){
    const group=groups.find(g=>g.id===id);const bg=$('group-backdrop');
    $('group-title').textContent=group?'Gruppe bearbeiten':'Neue Gruppe';
    $('group-name-input').value=group?.name||'';
    $('group-delete-btn').hidden=!group;bg.hidden=false;
    $('group-name-input').focus();$('group-name-input').select();
    const close=()=>{bg.hidden=true;document.removeEventListener('keydown',key);$('group-confirm-btn').removeEventListener('click',save);$('group-cancel-btn').removeEventListener('click',close);$('group-delete-btn').removeEventListener('click',remove);};
    const key=e=>{if(e.key==='Escape')close();if(e.key==='Enter'&&document.activeElement===$('group-name-input')){e.preventDefault();save();}};
    const save=()=>{
      const name=$('group-name-input').value.trim();if(!name){notify('Bitte einen Gruppennamen eingeben.');return;}
      if(!group&&groups.some(g=>g.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'))){notify('Diese Gruppe existiert bereits.');return;}
      if(group){if(groups.some(g=>g.id!==group.id&&g.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'))){notify('Diese Gruppe existiert bereits.');return;}group.name=name;}else {const fresh={id:'grp-'+makeId(),name};groups.push(fresh);activeGroup=fresh.id;}
      if(!persist())return;updateGroupSelect();if(!group&&!editingId)$('note-group-select').value=activeGroup;close();render();
    };
    const remove=async()=>{
      if(!group)return;close();if(!await dialog('Gruppe „'+group.name+'“ löschen? Alle Notizen bleiben erhalten und werden „Ohne Gruppe“ zugeordnet.',{heading:'Gruppe löschen',confirm:'Gruppe löschen'}))return;
      groups=groups.filter(g=>g.id!==group.id);notes=notes.map(n=>n.groupId===group.id?{...n,groupId:null}:n);
      if(activeGroup===group.id)activeGroup='all';
      if($('note-group-select').value===group.id)$('note-group-select').value='';
      if(!persist())return;updateGroupSelect();render();notify('Gruppe entfernt; Notizen behalten.');
    };
    document.addEventListener('keydown',key);$('group-confirm-btn').addEventListener('click',save);$('group-cancel-btn').addEventListener('click',close);$('group-delete-btn').addEventListener('click',remove);
  }
  function togglePin(id){
    const note=notes.find(n=>n.id===id);if(!note)return;
    note.pinned=!note.pinned;note.updatedAt=Date.now();if(persist())render();
  }
  const icons={edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 5-.8L19 9l-4-4L5 15l-1 5ZM13 7l4 4"/></svg>',delete:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 4h4m-8 3 1 13h10l1-13M10 11v5m4-5v5"/></svg>'};
  function shownNotes(){
    const query=searchInput.value.trim().toLocaleLowerCase('de');
    const all=notes.filter(n=>(activeGroup==='all'||(activeGroup==='ungrouped'?!n.groupId:n.groupId===activeGroup))&&(n.title+' '+textFromHTML(n.content)).toLocaleLowerCase('de').includes(query));
    if(sort==='newest')all.sort((a,b)=>b.updatedAt-a.updatedAt);
    else if(sort==='oldest')all.sort((a,b)=>a.updatedAt-b.updatedAt);
    else if(sort==='title-asc')all.sort((a,b)=>a.title.localeCompare(b.title,'de'));
    else if(sort==='title-desc')all.sort((a,b)=>b.title.localeCompare(a.title,'de'));
    else{const pos=new Map(order.map((id,i)=>[id,i]));all.sort((a,b)=>(pos.get(a.id)??999999)-(pos.get(b.id)??999999));}
    all.sort((a,b)=>Number(b.pinned)-Number(a.pinned));
    return all;
  }
  function render(){
    noteList.replaceChildren();const visible=shownNotes();const sortable=sort==='unsorted'&&!searchInput.value.trim()&&activeGroup==='all';
    $('note-count').textContent=notes.length;renderGroups();
    $('no-notes-message').hidden=visible.length>0;
    $('no-notes-message').querySelector('strong').textContent=notes.length?'Keine Treffer':'Noch keine Notizen';
    $('no-notes-message').querySelector('span').textContent=notes.length?'Anderen Suchbegriff probieren.':'Deine Ideen finden hier ihren Platz.';
    $('sort-hint').textContent=sortable?'GRIFF HALTEN & ZIEHEN':'SORTIERT / GEFILTERT';
    for(const note of visible){
      const card=document.createElement('article');card.className='note-card';card.dataset.id=note.id;
      const header=document.createElement('div');header.className='note-card-header';
      const heading=document.createElement('div');heading.className='note-card-heading';
      if(note.title.trim()){
        const h=document.createElement('h3');h.textContent=note.title;heading.appendChild(h);
      } else card.classList.add('untitled');
      const date=document.createElement('div');date.className='note-date';
      date.textContent=(note.date?'📅 '+new Date(note.date+'T12:00:00').toLocaleDateString('de-DE')+' · ':'')+'BEARBEITET · '+new Date(note.updatedAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
      heading.appendChild(date);
      if(note.groupId){const group=groups.find(g=>g.id===note.groupId);if(group){const label=document.createElement('span');label.className='note-group-label';label.textContent=group.name;heading.append(label);}}
      header.appendChild(heading);
      const handle=document.createElement('button');handle.type='button';handle.className='drag-handle';handle.textContent='⠿';handle.title='Zum Sortieren halten und ziehen';handle.setAttribute('aria-label','Notiz verschieben');handle.hidden=!sortable;
      header.appendChild(handle);card.appendChild(header);
      const content=document.createElement('div');content.className='note-content rich-text';content.innerHTML=sanitize(note.content);card.appendChild(content);
      const actions=document.createElement('div');actions.className='card-actions';
      const edit=document.createElement('button');edit.type='button';edit.className='card-button edit';edit.title='Bearbeiten';edit.setAttribute('aria-label','Notiz bearbeiten');edit.innerHTML=icons.edit;edit.addEventListener('click',()=>editNote(note.id));
      const del=document.createElement('button');del.type='button';del.className='card-button delete';del.title='Löschen';del.setAttribute('aria-label','Notiz löschen');del.innerHTML=icons.delete;del.addEventListener('click',()=>deleteNote(note.id));
      const pin=document.createElement('button');pin.type='button';pin.className='card-button pin';pin.textContent=note.pinned?'★':'☆';pin.title=note.pinned?'Fixierung aufheben':'Notiz anheften';pin.setAttribute('aria-label',pin.title);pin.setAttribute('aria-pressed',String(note.pinned));pin.addEventListener('click',()=>togglePin(note.id));
      actions.append(pin,edit,del);card.appendChild(actions);noteList.append(card);
      if(note.pinned)card.classList.add('is-pinned');
      content.addEventListener('change',e=>{
        const input=e.target.closest?.('input[data-ivy-check="1"]');if(!input||!content.contains(input))return;
        updateChecklistCheckbox(input);note.content=sanitize(content.innerHTML);note.updatedAt=Date.now();persist();
      });
      fillImages(content);if(sortable)bindDrag(card,handle);
    }
  }
  function persistDOMOrder(){
    const ids=[...noteList.querySelectorAll(':scope > .note-card')].map(c=>c.dataset.id);
    if(ids.length!==notes.length||sort!=='unsorted'||searchInput.value.trim()||activeGroup!=='all')return;
    order=ids;if(persist())notify('Reihenfolge gespeichert');
  }
  function reposition(dragged, target, x, y){
    if(!dragged||!target||dragged===target||!noteList.contains(target))return;
    const r=target.getBoundingClientRect(),dr=dragged.getBoundingClientRect();
    const sameRow=Math.abs(r.top-dr.top)<Math.min(r.height,dr.height)*.45;
    const before=sameRow?x<r.left+r.width/2:y<r.top+r.height/2;
    noteList.insertBefore(dragged,before?target:target.nextSibling);
  }
  function bindDrag(card,handle){
    handle.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')card.draggable=true;});
    handle.addEventListener('pointerup',()=>{if(!dragCard)card.draggable=false;});
    card.addEventListener('dragstart',e=>{if(!card.draggable){e.preventDefault();return;}dragCard=card;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',card.dataset.id);});
    card.addEventListener('dragover',e=>{if(!dragCard)return;e.preventDefault();reposition(dragCard,card,e.clientX,e.clientY);});
    card.addEventListener('drop',e=>{if(!dragCard)return;e.preventDefault();reposition(dragCard,card,e.clientX,e.clientY);});
    card.addEventListener('dragend',()=>{if(dragCard){dragCard.classList.remove('dragging');dragCard=null;persistDOMOrder();}card.draggable=false;});
    let sx=0,sy=0,active=false;
    handle.addEventListener('touchstart',e=>{
      if(e.touches.length!==1)return;const t=e.touches[0];sx=t.clientX;sy=t.clientY;active=false;
      clearTimeout(holdTimer);holdTimer=setTimeout(()=>{active=true;dragCard=card;card.classList.add('dragging');navigator.vibrate?.(20);},220);
    },{passive:true});
    handle.addEventListener('touchmove',e=>{
      if(e.touches.length!==1)return;const t=e.touches[0];
      if(!active){if(Math.hypot(t.clientX-sx,t.clientY-sy)>8)clearTimeout(holdTimer);return;}
      e.preventDefault();const target=document.elementFromPoint(t.clientX,t.clientY)?.closest('.note-card');if(target)reposition(card,target,t.clientX,t.clientY);
    },{passive:false});
    const stop=()=>{clearTimeout(holdTimer);if(active){card.classList.remove('dragging');dragCard=null;persistDOMOrder();}active=false;};
    handle.addEventListener('touchend',stop,{passive:true});handle.addEventListener('touchcancel',stop,{passive:true});
  }

  async function insertLink(){
    capture();const bg=$('link-backdrop');bg.hidden=false;$('link-url-input').value='';$('link-url-input').focus();
    const raw=await new Promise(resolve=>{
      let done=false;
      const finish=value=>{if(done)return;done=true;bg.hidden=true;cleanup();resolve(value);};
      const yes=()=>finish($('link-url-input').value),no=()=>finish(null);
      const key=e=>{if(e.key==='Escape')finish(null);if(e.key==='Enter'){e.preventDefault();yes();}};
      const cleanup=()=>{$('link-confirm').removeEventListener('click',yes);$('link-cancel').removeEventListener('click',no);document.removeEventListener('keydown',key);};
      $('link-confirm').addEventListener('click',yes);$('link-cancel').addEventListener('click',no);document.addEventListener('keydown',key);
    });
    if(raw===null)return;const href=validLink(raw);if(!href){notify('Bitte eine gültige Webadresse eingeben.');return;}
    restore();document.execCommand('createLink',false,href);capture();scheduleDraft();
  }
  function updateDateBadge(){
    const badge=$('ivy-linked-date');if(!badge)return;
    badge.hidden=!selectedDate;
    if(selectedDate){badge.textContent='📅 Kalender: '+new Date(selectedDate+'T12:00:00').toLocaleDateString('de-DE');}
  }
  function initDatePicker(){
    const menu=$('date-menu'),input=$('date-picker');
    function open(){capture();menu.hidden=false;const today=new Date();input.value=selectedDate||[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');input.focus();}
    function close(){menu.hidden=true;}
    $('date-btn').addEventListener('pointerdown',capture);
    $('date-btn').addEventListener('click',()=>menu.hidden?open():close());
    $('date-insert-btn').addEventListener('click',()=>{
      const date=/^\d{4}-\d{2}-\d{2}$/.test(input.value)?new Date(input.value+'T12:00:00'):null;
      if(!date||Number.isNaN(date.valueOf())){notify('Bitte ein gültiges Datum wählen.');return;}
      close();selectedDate=input.value;updateDateBadge();scheduleDraft();
      const label=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);
      insertHTMLAtCaret('📅 '+label.replace(/&/g,'&amp;').replace(/</g,'&lt;')+' —&nbsp;');
      editor.focus({preventScroll:true});
    });
    $('date-cancel-btn').addEventListener('click',close);
    $('ivy-date-clear')?.addEventListener('click',()=>{selectedDate=null;updateDateBadge();scheduleDraft();close();notify('Kalender-Verknüpfung entfernt')});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden)close();});
  }
  async function exportBackup(){
    try{
      const imgs={};for(const id of new Set(notes.flatMap(n=>imageIDs(n.content)))){
        const blob=await getImage(id);if(blob)imgs[id]=await fileToDataURL(blob);
      }
      const backup={format:'ivy-notes-backup',version:4,exportedAt:new Date().toISOString(),notes,order,groups,images:imgs};
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='IVY_Notes_Backup_'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);notify('Backup inklusive Bildern erstellt');
    }catch(error){console.error(error);notify('Backup fehlgeschlagen – Bildspeicher prüfen.');}
  }
  async function importBackup(file){
    if(!file)return;if(file.size>MAX_IMPORT_BYTES){notify('Backup zu groß (max. 70 MB).');return;}
    let json;try{json=JSON.parse(await file.text());}catch{notify('Ungültige JSON-Datei.');return;}
    const source=Array.isArray(json)?json:json?.notes;
    if(!Array.isArray(source)){notify('Keine gültige Notizliste gefunden.');return;}
    const incoming=source.map(normalize).filter(Boolean);
    if(!incoming.length){notify('Keine Notizen gefunden.');return;}
    if(!await dialog(`${incoming.length} Notizen importieren? Bereits vorhandene bleiben erhalten.`,{heading:'Backup importieren',confirm:'Importieren'}))return;
    const oldNotes=notes.slice(),oldOrder=order.slice(),oldGroups=groups.slice(),existing=new Set(notes.map(n=>n.id));
    const groupMap=new Map();
    for(const g of normalizeGroups(json?.groups)){
      const match=groups.find(x=>x.name.toLocaleLowerCase('de')===g.name.toLocaleLowerCase('de'));
      if(match)groupMap.set(g.id,match.id);
      else{const fresh={id:'grp-'+makeId(),name:g.name};groups.push(fresh);groupMap.set(g.id,fresh.id);}
    }
    for(const g of groups)groupMap.set(g.id,g.id);
    const appended=[];const incomingImages=json?.images&&typeof json.images==='object'?json.images:{};
    for(const note of incoming){
      if(existing.has(note.id))continue; existing.add(note.id);
      let html=sanitize(note.content);
      for(const id of imageIDs(html)){
        const data=incomingImages[id];
        if(!data)continue;
        let blob;
        try{blob=dataURLtoBlob(data);}catch{}
        if(!blob||blob.size>MAX_IMAGE_BYTES)continue;
        const newImageId='img-'+makeId().replace(/[^a-z0-9_-]/gi,'');
        try{await putImage(newImageId,blob);html=html.split('data-ivy-image-id="'+id+'"').join('data-ivy-image-id="'+newImageId+'"');}catch(e){console.warn('Could not import image',e);}
      }
      note.content=html;note.groupId=groupMap.get(note.groupId)||null;appended.push(note);
    }
    notes=[...notes,...appended];
    const prefer=Array.isArray(json?.order)?json.order.map(String):appended.map(n=>n.id),valid=new Set(appended.map(n=>n.id));
    order=[...new Set([...order,...prefer.filter(id=>valid.has(id)),...appended.map(n=>n.id)])];
    if(!persist()){notes=oldNotes;order=oldOrder;groups=oldGroups;return;}
    updateGroupSelect();sort='unsorted';sortSelect.value=sort;render();notify(appended.length+' neue Notizen importiert');
  }
  function boot(){
    load();initDatePicker();
    $('new-group-btn').addEventListener('click',()=>groupDialog());$('note-group-select').addEventListener('change',scheduleDraft);
    $('save-note-btn').addEventListener('click',saveNote);
    $('cancel-edit-btn').addEventListener('click',()=>{resetEditor();notify('Bearbeitung abgebrochen');});
    titleInput.addEventListener('input',scheduleDraft);editor.addEventListener('input',()=>{ensureEditorChecklists();capture();scheduleDraft();updateFormatting();});
    editor.addEventListener('change',e=>{const input=e.target.closest?.('input[data-ivy-check="1"]');if(input){updateChecklistCheckbox(input);scheduleDraft();}},true);
    $('checklist-btn').addEventListener('pointerdown',e=>{capture();e.preventDefault();});
    $('checklist-btn').addEventListener('click',checklistToggle);
    editor.addEventListener('paste',async e=>{
      const image=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'));
      if(image){e.preventDefault();capture();await insertImage(image);return;}
      const html=e.clipboardData?.getData('text/html');
      if(html){e.preventDefault();insertHTMLAtCaret(sanitize(html));}
    });
    ['keyup','mouseup','focus','click'].forEach(type=>editor.addEventListener(type,()=>{capture();updateFormatting();}));
    document.addEventListener('selectionchange',()=>{if(document.activeElement===editor)capture();});
    document.querySelectorAll('[data-format]').forEach(btn=>{
      btn.addEventListener('pointerdown',e=>{capture();e.preventDefault();});
      btn.addEventListener('click',()=>execute(btn.dataset.format));
    });
    for(const id of ['font-size','font-color','list-style'])$(id).addEventListener('pointerdown',capture);
    $('font-size').addEventListener('change',e=>{if(e.target.value)execute('fontSize',e.target.value);e.target.value='';});
    $('font-color').addEventListener('change',e=>{if(e.target.value)execute('foreColor',e.target.value);e.target.value='';});
    $('list-style').addEventListener('change',e=>{applyList(e.target.value);e.target.value='';});
    for(const id of ['indent-btn','outdent-btn']) $(id).addEventListener('pointerdown',e=>{capture();e.preventDefault();});
    $('indent-btn').addEventListener('click',()=>execute('indent'));
    $('outdent-btn').addEventListener('click',()=>execute('outdent'));
    $('link-btn').addEventListener('pointerdown',capture);$('link-btn').addEventListener('click',insertLink);
    $('image-btn').addEventListener('pointerdown',capture);
    $('image-btn').addEventListener('click',()=>$('image-file-input').click());
    $('image-file-input').addEventListener('change',async e=>{const file=e.target.files?.[0];try{await insertImage(file);}finally{e.target.value='';}});
    sortSelect.addEventListener('change',e=>{sort=e.target.value;render();});
    searchInput.addEventListener('input',render);
    $('export-btn').addEventListener('click',exportBackup);
    $('import-btn').addEventListener('click',()=>$('import-file-input').click());
    $('import-file-input').addEventListener('change',async e=>{try{await importBackup(e.target.files?.[0]);}finally{e.target.value='';}});
    window.addEventListener('beforeunload',()=>{
      clearTimeout(draftTimer);
      try{const content=sanitize(editor.innerHTML);if(titleInput.value.trim()||hasContent(content))localStorage.setItem(DRAFT_KEY,JSON.stringify({title:titleInput.value,content,editingId,date:selectedDate,groupId:$('note-group-select').value||null,...caretData()}));}catch{}
      for(const url of imageURLs.values())URL.revokeObjectURL(url);
    });
    window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.data?.type!=='ivy-open-note')return;
      load();editNote(String(event.data.id));
    });
    if(false && 'serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
      window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(e=>console.info('Offline-Modus nicht verfügbar',e)),{once:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
