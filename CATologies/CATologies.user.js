// ==UserScript==
// @name         Digiseller: CATologies
// @namespace    https://ggsel.com/
// @version      5.6
// @description  Аккордеон категорий/разделов с фаззи-поиском, историей, кэшем и дифф-синхронизацией. SVG-иконки. Подсказки без лагов (только по кэшу); закреплённые появляются ТОЛЬКО если есть базовые совпадения. Alt+клик по названию копирует название. Наведение показывает полный заголовок. Мягкий звуковой сигнал и золотисто-красная подсветка при отсутствии совпадений. Пакетная отрисовка, стабильный скролл, FAB, история/пины, опции (Ctrl+F-хук, размер пакета, тихая синхронизация).
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/razdels.asp*
// @grant        GM_addStyle
// @updateURL    https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologies.user.js
// @downloadURL  https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologies.user.js
// ==/UserScript==

(function(){
'use strict';

/* ======================= К О Н С Т А Н Т Ы ======================= */
const INPUT_DEBOUNCE_MS    = 250;    // задержка автокомплита
const AC_MIN_CHARS         = 2;      // минимум символов (кроме чистого ID)
const RENDER_CHUNK         = 30000;  // отрисовка пачками
const UPDATE_CHUNK         = 4000;   // пакет апдейтов текста
const MOVE_CHUNK           = 4000;   // пакет перемещений/вставок
const FIND_SCAN_CHUNK      = 4000;   // сканирование совпадений по панели
const SUGGEST_LIMIT        = 20;     // максимум подсказок
const SILENT_SYNC          = true;   // тихий дифф без прогресс-бара

const LS_HISTORY_KEY    = 'vibe_digi_history_v2';
const LS_PINS_KEY       = 'vibe_digi_pins_v1';
const LS_SETTINGS_KEY   = 'vibe_digi_settings_v6';
const LS_UI_STATE_KEY   = 'vibe_digi_ui_state_v1';

/* ======================= С Т И Л И ======================= */
GM_addStyle(`
.vibe-acc-panel{ position:fixed; top:0; right:0; width:750px; max-width:99vw; height:100vh; z-index:999999;
  background:#181920; box-shadow:-3px 0 40px #000d, 0 0 0 4px #ffde5c55; border-left:5px solid #ffe37a;
  display:flex; flex-direction:column; font-family:'JetBrains Mono','Fira Mono','Consolas',monospace,sans-serif; }
.vibe-acc-header{ padding:22px 40px 12px 38px; background:linear-gradient(90deg,#222228 85%,#ffde5c 300%);
  color:#ffe37a; font-size:22px; font-weight:700; letter-spacing:1.2px; border-bottom:3px solid #ffe37a; box-shadow:0 4px 0 0 #241f10;
  display:flex; align-items:center; gap:12px; min-height:60px; }
.vibe-acc-header-title{ flex:1; }
.vibe-acc-btn{ border:none; background:none; color:#ffe37a; cursor:pointer; font-size:20px; padding:6px 10px; border-radius:8px; transition:background .15s,color .15s; }
.vibe-acc-btn:hover{ background:#ffe37a22; color:#fffbe3; }
.vibe-acc-close{ font-size:26px; margin-left:15px; margin-bottom:4px; }

/* Поиск */
.vibe-acc-search-wrap{ background:#222328; border-bottom:3px solid #ffe37а; padding:10px 36px;
  display:grid; grid-template-columns:1fr auto auto auto; grid-gap:10px; align-items:center; position:relative; }
.vibe-acc-search{ border:none; background:#18191f; border-radius:8px; font-size:18px; color:#ffe37a; padding:10px 14px; outline:none;
  box-shadow:0 0 0 1px #ffde5c33; transition:box-shadow .14s, background .2s; }
.vibe-acc-search:focus{ box-shadow:0 0 0 2px #ffe37a, 0 0 0 4px #ffde5c25; }
.vibe-acc-find-ctrl{ min-width:90px; background:none; border:none; color:#ffe37a; font-size:16px; font-weight:700; cursor:pointer; opacity:.85; }
.vibe-acc-find-ctrl[disabled]{ opacity:.25; pointer-events:none; }
.vibe-acc-find-info{ color:#ffe37a; font-size:15px; min-width:44px; text-align:center; }

/* Ошибка подсказок */
.vibe-search-error{
  background:linear-gradient(90deg,#3a1a1a,#3a2818)!important;
  box-shadow:0 0 0 2px #ff6a3a, 0 0 0 6px #ffe37a55!important;
}

/* Список */
.vibe-acc-list{ position:relative; flex:1 1 auto; overflow-y:auto; padding:24px 32px 20px 32px; display:flex; flex-direction:column; gap:13px; }
.vibe-acc-row{ display:flex; align-items:center; gap:13px; user-select:none; border-radius:11px; background:linear-gradient(90deg,#24232a 75%,#3d3222 110%);
  color:#ffe37a; font-size:19px; padding:9px 12px 9px 16px; border:2.2px solid #ffe37a28; box-shadow:0 1px 0 0 #ffe37a13; font-weight:500; cursor:pointer;
  transition:background .12s, color .12s, border .14s; position:relative; }
.vibe-acc-row:hover{ background:linear-gradient(90deg,#2a2522 88%,#ffe37a18 115%); color:#fffbe3; }
.vibe-acc-row[data-opened="true"]{ border-color:#ffde5c; background:linear-gradient(90deg,#292618 82%,#ffde5c33 140%); }
.vibe-acc-row.vibe-acc-selected{ border-color:#ffe37a; background:linear-gradient(90deg,#fffbe366 80%,#ffde5c44 120%); color:#181920; box-shadow:0 0 0 2px #ffe37a90; }
.vibe-acc-id{ min-width:78px; font-size:16.5px; color:#d3be79; text-align:left; user-select:text; font-weight:600; cursor:pointer; }
.vibe-acc-id.vibe-id-copied{ color:#181920!important; background:#ffe37a; border-radius:5px; padding:2px 8px; font-weight:700; position:relative; }
.vibe-acc-title{ flex:0 1 520px; font-weight:600; font-size:20px; color:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vibe-acc-desc{ min-width:44px; font-size:17px; color:#ffda4f; font-weight:500; margin-left:2px; margin-right:10px; letter-spacing:.4px; }
.vibe-acc-btns{ margin-left:auto; display:flex; gap:10px; align-items:center; }
.vibe-acc-expand{ background:none; border:none; color:#ffe37a; font-size:21px; cursor:pointer; padding:0 7px; }
.vibe-acc-expand:hover{ color:#ffcc43; }
.vibe-acc-sublist{ margin:-8px 0 6px 34px; padding-left:13px; padding-top:10px; border-left:2.5px solid #ffe37a55; display:flex; flex-direction:column; gap:8px;
  background:linear-gradient(90deg,#232224 70%,#ffe37a08 140%); border-radius:0 0 7px 7px; contain: content; }
.vibe-acc-empty{ margin:12px 0 6px 6px; color:#ffcc43; font-size:16px; }
.vibe-acc-find-match{ background:#ffe37a55; color:#000; border-radius:6px; box-shadow:0 2px 4px #ffe37a60; z-index:10; outline:2px solid #ffe37a; }

/* Автокомплит */
.vibe-ac-suggest{ position:absolute; left:36px; right:36px; top:58px; z-index:1000001; background:#13141a; border:2px solid #ffe37a; border-radius:10px; box-shadow:0 10px 30px #000a; overflow:hidden;
  max-height:320px; overflow-y:auto; display:none; }
.vibe-ac-item{ display:grid; grid-template-columns:80px 1fr; gap:8px; align-items:center; padding:8px 12px; color:#ffe37a; cursor:pointer; font-size:15px; border-bottom:1px dashed #ffe37a22; }
.vibe-ac-item:last-child{ border-bottom:none; }
.vibe-ac-item:hover, .vibe-ac-item.active{ background:#ffe37a22; color:#fffbe3; }
.vibe-ac-id{ font-weight:700; color:#d3be79; }
.vibe-ac-title{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vibe-ac-path{ font-size:12px; color:#cdbb78; opacity:.9; margin-left:8px; }

/* История / настройки / FAB */
.vibe-history-panel{ position:absolute; right:14px; top:60px; z-index:1000002; width:640px; max-width:calc(100vw - 100px); background:#14151b; border:2px solid #ffe37a; border-radius:12px; box-shadow:0 12px 36px #000c;
  display:none; flex-direction:column; max-height:70vh; overflow:hidden; }
.vibe-history-head{ display:flex; align-items:center; gap:10px; padding:10px 12px; background:#1d1f27; border-bottom:2px solid #ffe37a; color:#ffe37a; font-weight:700; }
.vibe-history-actions{ margin-left:auto; display:flex; gap:8px; }
.vibe-history-btn{ background:#ffe37a; color:#232218; border:none; font-size:13px; font-weight:700; border-radius:7px; padding:6px 10px; cursor:pointer; }
.vibe-history-body{ overflow-y:auto; max-height:calc(70vh - 48px); padding:10px 10px 14px; display:grid; grid-template-columns:1fr; gap:10px; }
.vibe-history-section-title{ color:#ffe37a; font-size:14px; opacity:.9; margin:6px 4px 2px; }
.vibe-history-item{ display:grid; grid-template-columns:80px 1fr auto; align-items:center; gap:8px; padding:8px 10px; background:#1b1d25; border:1px solid #ffe37a33; border-radius:8px; cursor:pointer; }
.vibe-history-item:hover{ background:#22232b; }
.vibe-history-id{ color:#d3be79; font-weight:700; }
.vibe-history-title{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#ffe37a; }
.vibe-history-path{ font-size:12px; color:#cdbb78; opacity:.9; margin-left:8px; }
.vibe-history-pin{ cursor:pointer; font-size:18px; line-height:1; padding:2px 6px; color:#ffe37a; }
.vibe-history-pin.pinned{ color:#fff2a0; text-shadow:0 0 8px #ffea99; }

.vibe-scroll-overlay{ position:absolute; left:0; right:0; pointer-events:none; z-index:1000003; }
.vibe-scroll-fab{ position:absolute; left:8px; width:40px; height:32px; box-sizing:border-box; border-radius:10%; border:none; background:#ffe37a; color:#232218; font-size:16px; font-weight:900;
  display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:.35; box-shadow:0 2px 10px #000a; transition:opacity .15s, transform .15s, background .15s; pointer-events:auto; }
.vibe-scroll-fab:hover{ opacity:.98; background:#fffbe3; transform:scale(1.02); }
.vibe-scroll-fab-top{ top:5px; transform:translateY(2px); }
.vibe-scroll-fab-bot{ bottom:5px; transform:translateY(-2px); }

.vibe-settings-panel{ position:absolute; right:14px; top:60px; z-index:1000002; width:420px; max-width:calc(100vw - 100px); background:#14151b; border:2px solid #ffe37a; border-radius:12px; box-shadow:0 12px 36px #000c;
  display:none; flex-direction:column; max-height:60vh; overflow:hidden; color:#ffe37a; font-size:18px; }
.vibe-settings-head{ display:flex; align-items:center; gap:10px; padding:10px 12px; background:#1d1f27; border-bottom:2px solid #ffe37a; font-weight:700; }
.vibe-settings-body{ padding:12px 14px; display:grid; gap:12px; }
.vibe-settings-row{ display:flex; align-items:center; gap:10px; }
.vibe-settings-row label{ cursor:pointer; user-select:none; }
.vibe-settings-btn{ background:#ffe37a; color:#232218; border:none; font-size:13px; font-weight:700; border-radius:7px; padding:6px 10px; cursor:pointer; }

@media (max-width:1200px){ .vibe-acc-toolbar-outer{ left:8px!important; top:16px!important; } }
@media (max-width:900px){
  .vibe-acc-panel{ width:98vw!important; min-width:0; }
  .vibe-acc-title{ max-width:32vw; }
  .vibe-acc-toolbar-outer{ left:8px!important; top:14px!important; }
  .vibe-history-panel{ right:6px; width:calc(100vw - 20px); }
  .vibe-settings-panel{ right:6px; width:calc(100vw - 20px); }
}
`);

/* ======================= С О С Т О Я Н И Е ======================= */
let nodeMap       = new Map();   // id -> {id,title,desc,type,parentId}
let childrenCache = new Map();   // catId -> { map: Map(id->item), order: string[], ts }
let panelInstance = null;
let selectedIds   = new Set();
let lastSelectedId= null;
let toolbarOuter  = null;

// Поиск/подсказки
let searchTimeout = null;
let searchInput   = null;
let acBox         = null;
let acActiveIdx   = -1;

// История/настройки
let historyPanelEl = null;
let settingsPanel  = null;

// FAB
let scrollOverlay  = null;
let overlayResizeObserver = null;

/* Кэш поиска по панели */
let findCache = { q:'', list:[], idx:-1, building:false };

/* ======================= Н А С Т Р О Й К И ======================= */
function settingsDefault(){ return { replaceCtrlF:true, renderChunk:RENDER_CHUNK, silentSync:SILENT_SYNC }; }
function loadSettings(){
  try{
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    const inS = raw ? JSON.parse(raw) : {};
    const base = settingsDefault();
    if(typeof inS.replaceCtrlF === 'boolean') base.replaceCtrlF = inS.replaceCtrlF;
    if(typeof inS.renderChunk  === 'number' && inS.renderChunk>0) base.renderChunk = inS.renderChunk;
    if(typeof inS.silentSync   === 'boolean') base.silentSync   = inS.silentSync;
    return base;
  }catch{ return settingsDefault(); }
}
function saveSettings(s){ try{ localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(s)); }catch{} }

/* UI-state */
function loadUIState(){ try{ return JSON.parse(localStorage.getItem(LS_UI_STATE_KEY) || '{"openIds":[],"search":""}'); }catch{ return {openIds:[], search:""}; } }
function saveUIState(st){ try{ localStorage.setItem(LS_UI_STATE_KEY, JSON.stringify(st)); }catch{} }

/* ======================= У Т И Л И Т Ы ======================= */
function copyToClipboard(str){
  if(navigator.clipboard?.writeText) return navigator.clipboard.writeText(str);
  const t=document.createElement('textarea'); t.value=str; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
}
function showToast(msg){
  let el = document.createElement('div');
  el.textContent = msg;
  el.style = `position:fixed; top:19px; left:19px; z-index:9999999; background:#ffe37a; color:#181920; font-size:17px; padding:10px 25px; border-radius:12px; font-weight:700; box-shadow:0 6px 28px #000c; opacity:0.97; transition:opacity .4s;`;
  document.body.appendChild(el);
  setTimeout(()=> el.style.opacity='0', 1100);
  setTimeout(()=> el.remove(), 1500);
}
const normBase=s=>(s||'').toString().trim().replace(/\s+/g,' ');
const norm    =s=>normBase(s).toLowerCase().replace(/ё/g,'е');
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
const raf = () => new Promise(r=>requestAnimationFrame(()=>r()));
const idle = () => new Promise(r=>{
  if('requestIdleCallback' in window) requestIdleCallback(()=>r(), {timeout:17});
  else requestAnimationFrame(()=>r());
});
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* Мягкий бип */
function gentleBeep(duration=120, freq=520, volume=0.02){
  try{
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type='sine';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain); gain.connect(ac.destination);
    osc.start();
    setTimeout(()=>{ try{ osc.stop(); ac.close(); }catch{} }, duration);
  }catch(_){}
}

/* Пути */
function getPathArrayFromMap(id){ let arr=[], cur=nodeMap.get(id); while(cur){ arr.unshift(cur.title); cur=cur.parentId?nodeMap.get(cur.parentId):null; } return arr; }
function getPathIdArray(id){ let arr=[], cur=nodeMap.get(id); while(cur){ arr.unshift(cur.id); cur=cur.parentId?nodeMap.get(cur.parentId):null; } return arr; }
function getPathStringFromMap(id){ return getPathArrayFromMap(id).join(' > '); }

function getPathArrayFromRow(row){
  const arr=[]; let cur=row;
  while(cur && cur.classList && cur.classList.contains('vibe-acc-row')){
    const titleEl = cur.querySelector('.vibe-acc-title');
    const title = (titleEl?.textContent || cur.dataset.title || '').trim();
    arr.unshift(title);
    const container = cur.parentElement;
    if(!container) break;
    if(container.classList.contains('vibe-acc-sublist')) cur = container.previousElementSibling; else break;
  }
  return arr;
}
function getPathIdArrayFromRow(row){
  const arr=[]; let cur=row;
  while(cur && cur.classList && cur.classList.contains('vibe-acc-row')){
    arr.unshift(cur.dataset.id);
    const container = cur.parentElement;
    if(!container) break;
    if(container.classList.contains('vibe-acc-sublist')) cur = container.previousElementSibling; else break;
  }
  return arr;
}
function getPathStringFromRow(row){ return getPathArrayFromRow(row).join(' > '); }
function getPathString(id){ const row=findRowInPanel(id); return row?getPathStringFromRow(row):getPathStringFromMap(id); }

/* История/пины */
function loadHistory(){ try{ let raw=localStorage.getItem(LS_HISTORY_KEY); return raw?JSON.parse(raw):[]; }catch{ return []; } }
function saveHistory(arr){ try{ localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(arr)); }catch{} }
function addToHistory(id){
  const node=nodeMap.get(id); if(!node) return;
  let items=loadHistory(); let idx=items.findIndex(x=>x.id===id);
  const entry={ id:node.id, title:node.title, type:node.type, path:getPathArrayFromMap(id), pathIds:getPathIdArray(id), ts:Date.now(), freq:1 };
  if(idx>=0){ entry.freq=(items[idx].freq||1)+1; items.splice(idx,1); }
  items.unshift(entry); if(items.length>400) items.length=400; saveHistory(items);
}
function clearHistory(){ saveHistory([]); }

function loadPins(){ try{ let raw=localStorage.getItem(LS_PINS_KEY); return raw?JSON.parse(raw):[]; }catch{ return []; } }
function savePins(arr){ try{ localStorage.setItem(LS_PINS_KEY, JSON.stringify(arr)); }catch{} }
function togglePin(entry){
  let pins=loadPins();
  const i=pins.findIndex(p=>p.id===entry.id);
  if(i>=0){ pins.splice(i,1); } else {
    pins.unshift({ id:entry.id, title:entry.title, type:entry.type, path:entry.path||getPathArrayFromMap(entry.id), pathIds:entry.pathIds||getPathIdArray(entry.id), ts:Date.now() });
    if(pins.length>200) pins.length=200;
  }
  savePins(pins);
}
function isPinned(id){ return loadPins().some(p=>p.id===id); }

/* ======================= П А Р С И Н Г / F E T C H ======================= */
function parseCategoryTable(tbl, parentId){
  let res=[];
  for(let tr of tbl.querySelectorAll(':scope > tbody > tr')){
    let a=tr.querySelector('a[id^="r"]');
    if(a){
      let id=a.id.replace('r','').trim();
      let title=a.textContent.trim();
      let obj={ id, title, desc:"", type:"category", parentId };
      res.push(obj); nodeMap.set(id,obj);
    }else{
      let small=tr.querySelector('small');
      if(small){
        let id=small.textContent.trim();
        let td=small.parentElement;
        let allText=td.textContent.replace(/\s+/g,' ').trim();
        allText=allText.replace(id,'').replace(/^\s+|\s+$/g,'');
        allText=allText.replace(/(изменить|переместить|удалить)[^%]*$/i,'');
        let match=allText.match(/(.+?)\s*([0-9]+[.,]?\d*)\s*%/);
        let title='',desc='';
        if(match){ title=match[1].trim(); desc=match[2]+'%'; }
        else { let noBtns=allText.replace(/(изменить|переместить|удалить)/gi,'').trim(); title=noBtns||allText; desc=''; }
        let obj={ id, title, desc, type:"section", parentId };
        res.push(obj); nodeMap.set(id,obj);
      }
    }
  }
  return res;
}
async function fetchChildren(catId){
  let url=location.pathname + '?idprview=' + catId + '#r' + catId;
  let resp=await fetch(url, {credentials:'same-origin'});
  let html=await resp.text();
  let doc=document.implementation.createHTMLDocument(''); doc.documentElement.innerHTML=html;
  let anchor=doc.querySelector('a[id="r'+catId+'"]'); if(!anchor) return [];
  let tr=anchor.closest('tr'); if(!tr) return [];
  let nextTable=null, walker=tr.nextElementSibling;
  while(walker && !nextTable){ if(walker.querySelector && walker.querySelector('table')) nextTable=walker.querySelector('table'); walker=walker.nextElementSibling; }
  if(!nextTable) return [];
  return parseCategoryTable(nextTable, catId);
}
async function findNodeById(id){
  if(nodeMap.has(id)) return nodeMap.get(id);
  let url=location.pathname + '?idprview=' + id + '#r' + id;
  let resp=await fetch(url, {credentials:'same-origin'});
  let html=await resp.text();
  let doc=document.implementation.createHTMLDocument(''); doc.documentElement.innerHTML=html;

  let anchor=doc.querySelector('a[id="r'+id+'"]');
  if(anchor){
    let title=anchor.textContent.trim();
    let obj={ id, title, desc:"", type:"category", parentId:null };
    nodeMap.set(id,obj); return obj;
  }
  let small=Array.from(doc.querySelectorAll('small')).find(s=>s.textContent.trim()===id);
  if(small){
    let td=small.parentElement;
    let allText=td.textContent.replace(/\s+/g,' ').trim();
    allText=allText.replace(id,'').replace(/^\s+|\s+$/g,'');
    allText=allText.replace(/(изменить|переместить|удалить)[^%]*$/i,'');
    let match=allText.match(/(.+?)\s*([0-9]+[.,]?\d*)\s*%/);
    let title='',desc='';
    if(match){ title=match[1].trim(); desc=match[2]+'%'; }
    else { let noBtns=allText.replace(/(изменить|переместить|удалить)/gi,'').trim(); title=noBtns||allText; desc=''; }
    let obj={ id, title, desc, type:"section", parentId:null };
    nodeMap.set(id,obj); return obj;
  }
  return null;
}

/* ======================= R E N D E R ======================= */
function renderRow(item){
  let row=document.createElement('div');
  row.className='vibe-acc-row';
  row.dataset.title=item.title;
  row.dataset.id=item.id;

  // ID (клик — копия, Alt — путь)
  let idSpan=document.createElement('span');
  idSpan.className='vibe-acc-id';
  idSpan.textContent=item.id;
  idSpan.title='Клик — скопировать ID. Alt+клик — скопировать полный путь.';
  idSpan.onclick=function (e){
    e.stopPropagation();
    if(e.altKey){
      const rowEl = idSpan.closest('.vibe-acc-row');
      const path  = rowEl ? getPathStringFromRow(rowEl) : getPathString(item.id);
      copyToClipboard(path);
      idSpan.classList.add('vibe-id-copied'); idSpan.textContent='Путь скопирован!';
      setTimeout(()=>{ idSpan.textContent=item.id; idSpan.classList.remove('vibe-id-copied'); }, 900);
    }else{
      copyToClipboard(String(item.id));
      idSpan.classList.add('vibe-id-copied'); idSpan.textContent='Скопировано!';
      setTimeout(()=>{ idSpan.textContent=item.id; idSpan.classList.remove('vibe-id-copied'); }, 900);
    }
  };
  row.appendChild(idSpan);

  // Название (Alt+клик — копировать название; всегда показываем полный title в tooltip)
  let titleSpan=document.createElement('span');
  titleSpan.className='vibe-acc-title';
  titleSpan.textContent=item.title;
  titleSpan.title=item.title; // <-- полный заголовок при наведении
  titleSpan.addEventListener('click', (e)=>{
    // Alt+клик по названию — копировать само название (без пути)
    if(e.altKey){
      e.stopPropagation();
      copyToClipboard(item.title || '');
      // Лёгкая визуальная обратная связь: меняем opacity кратко
      const prev = titleSpan.style.opacity;
      titleSpan.style.opacity = '0.55';
      setTimeout(()=>{ titleSpan.style.opacity = prev || ''; }, 200);
      showToast('Название скопировано');
    }
  }, true);
  row.appendChild(titleSpan);

  // Комиссия
  if(item.desc){
    let descSpan=document.createElement('span');
    descSpan.className='vibe-acc-desc';
    descSpan.textContent=item.desc;
    row.appendChild(descSpan);
  }

  // Кнопки
  let btns=document.createElement('div');
  btns.className='vibe-acc-btns';
  if(item.type==='category'){
    let expand=document.createElement('button');
    expand.className='vibe-acc-expand';
    expand.innerHTML='<span style="display:inline-block;transform:translateY(-2px)">▼</span>';
    expand.title='Открыть подкатегории';
    expand.onclick = (e)=> onToggleCategory(e, row, item.id);
    btns.appendChild(expand);
  }
  row.appendChild(btns);

  // Выделение
  row.addEventListener('click', function(e){
    if(e.ctrlKey || e.shiftKey){
      e.preventDefault();
      if(e.shiftKey && lastSelectedId && lastSelectedId!==item.id){
        let allRows=Array.from(panelInstance.querySelectorAll('.vibe-acc-row'));
        let curIdx=allRows.findIndex(r=>r.dataset.id===item.id);
        let lastIdx=allRows.findIndex(r=>r.dataset.id===lastSelectedId);
        if(curIdx!==-1 && lastIdx!==-1){
          let [start,end]=[Math.min(curIdx,lastIdx), Math.max(curIdx,lastIdx)];
          for(let i=start;i<=end;i++){ let el=allRows[i]; el.classList.add('vibe-acc-selected'); selectedIds.add(el.dataset.id); }
          updateToolbar(); return;
        }
      }
      if(row.classList.toggle('vibe-acc-selected')) selectedIds.add(item.id);
      else selectedIds.delete(item.id);
      lastSelectedId=item.id; updateToolbar();
    }else{
      addToHistory(item.id);
      if(item.type==='category' && !e.target.closest('.vibe-acc-btns')) row.querySelector('.vibe-acc-expand')?.click();
    }
  });

  return row;
}

/* Пакетная отрисовка массива элементов */
async function renderItemsChunked(container, items, _label='Построение', chunkSize=null){
  const sz = (chunkSize || loadSettings().renderChunk || RENDER_CHUNK);
  container.innerHTML = '';
  const total = items.length;
  for(let i=0;i<total;i+=sz){
    const frag = document.createDocumentFragment();
    const end = Math.min(i+sz, total);
    for(let j=i;j<end;j++) frag.appendChild(renderRow(items[j]));
    container.appendChild(frag);
    await raf();
  }
}

/* ======================= D I F F / L I S ======================= */
function getScrollAnchor(container){
  const crect = container.getBoundingClientRect();
  const rows = container.querySelectorAll(':scope > .vibe-acc-row');
  let anchorEl=null, deltaTop=0;
  for(const r of rows){
    const rr=r.getBoundingClientRect();
    if(rr.bottom >= crect.top){ anchorEl=r; deltaTop=rr.top - crect.top; break; }
  }
  if(!anchorEl && rows.length){ const r = rows[rows.length-1]; anchorEl=r; deltaTop=r.getBoundingClientRect().top - crect.top; }
  return { el: anchorEl, deltaTop };
}
function restoreScrollAnchor(container, anchor){
  if(!anchor?.el || !container.isConnected) return;
  const crect = container.getBoundingClientRect();
  const rr = anchor.el.getBoundingClientRect();
  const diff = (rr.top - crect.top) - anchor.deltaTop;
  if(Math.abs(diff)>0.5){ container.scrollTop += diff; }
}
function lisIndices(seq){
  const n = seq.length, p=new Array(n), m=new Array(n+1); let L=0;
  for(let i=0;i<n;i++){
    let lo=1, hi=L;
    while(lo<=hi){ const mid=(lo+hi)>>1; if(seq[m[mid]]<seq[i]) lo=mid+1; else hi=mid-1; }
    const newL=lo; p[i]=m[newL-1]||-1; m[newL]=i; if(newL>L) L=newL;
  }
  const result=new Array(L); let k=m[L];
  for(let i=L-1;i>=0;i--){ result[i]=k; k=p[k]; }
  return result;
}

/** Дифф-синхронизация списка подкатегорий по LIS (минимум DOM-операций) */
async function reconcileSublistLIS(sub, catId, newItems, opts={silent:true}){
  const silent = (typeof opts.silent === 'boolean' ? opts.silent : loadSettings().silentSync);

  const newMap   = new Map(newItems.map(it=>[String(it.id), it]));
  const newOrder = newItems.map(it=> String(it.id));

  const rows = Array.from(sub.querySelectorAll(':scope > .vibe-acc-row'));
  const oldMap = new Map(rows.map(r=>[r.dataset.id, r]));
  const oldOrder = rows.map(r=> r.dataset.id);

  const anchor = getScrollAnchor(sub);

  // Удаления
  {
    const toRemove = [];
    for(const [id,row] of oldMap){ if(!newMap.has(id)) toRemove.push(row); }
    for(let i=0;i<toRemove.length;i+=MOVE_CHUNK){
      const end = Math.min(i+MOVE_CHUNK, toRemove.length);
      for(let j=i;j<end;j++) toRemove[j].remove();
      if(!silent) await raf(); else await idle();
    }
  }

  // Апдейты текста/desc
  {
    const commonIds = newOrder.filter(id => oldMap.has(id));
    for(let i=0;i<commonIds.length;i+=UPDATE_CHUNK){
      const end=Math.min(i+UPDATE_CHUNK, commonIds.length);
      for(let j=i;j<end;j++){
        const id=commonIds[j], data=newMap.get(id), row=oldMap.get(id);
        const ttl=row.querySelector('.vibe-acc-title'); if(ttl && ttl.textContent!==data.title){ ttl.textContent=data.title; row.dataset.title=data.title; ttl.title=data.title; }
        const descEl=row.querySelector('.vibe-acc-desc');
        if(data.desc){
          if(descEl){ if(descEl.textContent!==data.desc) descEl.textContent=data.desc; }
          else{ const s=document.createElement('span'); s.className='vibe-acc-desc'; s.textContent=data.desc; row.insertBefore(s, row.querySelector('.vibe-acc-btns')); }
        }else if(descEl) descEl.remove();
      }
      if(!silent) await raf(); else await idle();
    }
  }

  // Реупорядочивание + вставки
  const presentOldIndex = new Map();
  const presentOld = oldOrder.filter(id => newMap.has(id));
  presentOld.forEach((id, idx)=> presentOldIndex.set(id, idx));

  const seq=[], seqIds=[];
  for(const id of newOrder){ if(presentOldIndex.has(id)){ seq.push(presentOldIndex.get(id)); seqIds.push(id); } }
  const keepSet = new Set(lisIndices(seq).map(i => seqIds[i]));

  let nextSibling=null, moved=0;
  for(let i=newOrder.length-1;i>=0;i--){
    const id=newOrder[i], exists=oldMap.get(id);
    if(exists){
      if(!keepSet.has(id) && exists.nextSibling!==nextSibling){
        sub.insertBefore(exists, nextSibling);
        moved++;
      }
      nextSibling=exists;
    }else{
      const node=renderRow(newMap.get(id));
      sub.insertBefore(node, nextSibling);
      oldMap.set(id, node);
      nextSibling=node; moved++;
    }
    if(moved>=MOVE_CHUNK){ moved=0; if(!silent) await raf(); else await idle(); }
  }

  restoreScrollAnchor(sub, anchor);
  childrenCache.set(String(catId), { map:newMap, order:newOrder, ts:Date.now() });
}

/* ======================= П А Н Е Л Ь / U I ======================= */
function createPanel(){
  let old=document.getElementById('vibe-acc-panel'); if(old) old.remove();

  const panel=document.createElement('div');
  panel.id='vibe-acc-panel';
  panel.className='vibe-acc-panel';
  panel.innerHTML=`
    <div class="vibe-acc-header">
      <span class="vibe-acc-header-title">Каталоги Digiseller</span>
      
      <!-- SVG: Настройки -->
      <button class="vibe-acc-btn" id="vibe-settings-toggle" title="Настройки (Ctrl+F)">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" class="bi bi-gear-fill" viewBox="0 0 16 16">
          <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
      </svg>
      </button>

      <!-- SVG: История -->
      <button class="vibe-acc-btn" id="vibe-history-toggle" title="История (J)">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" class="bi bi-clock-history" viewBox="0 0 16 16">
            <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022zm2.004.45a7 7 0 0 0-.985-.299l.219-.976q.576.129 1.126.342zm1.37.71a7 7 0 0 0-.439-.27l.493-.87a8 8 0 0 1 .979.654l-.615.789a7 7 0 0 0-.418-.302zm1.834 1.79a7 7 0 0 0-.653-.796l.724-.69q.406.429.747.91zm.744 1.352a7 7 0 0 0-.214-.468l.893-.45a8 8 0 0 1 .45 1.088l-.95.313a7 7 0 0 0-.179-.483m.53 2.507a7 7 0 0 0-.1-1.025l.985-.17q.1.58.116 1.17zm-.131 1.538q.05-.254.081-.51l.993.123a8 8 0 0 1-.23 1.155l-.964-.267q.069-.247.12-.501m-.952 2.379q.276-.436.486-.908l.914.405q-.24.54-.555 1.038zm-.964 1.205q.183-.183.35-.378l.758.653a8 8 0 0 1-.401.432z"/>
            <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0z"/>
            <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5"/>
        </svg>
      </button>

      <button class="vibe-acc-btn vibe-acc-close" title="Закрыть">✕</button>
    </div>

    <div class="vibe-acc-search-wrap">
      <input class="vibe-acc-search" type="text" placeholder="Ctrl+F: По названию, ID или 'A > B > C'">
      <button class="vibe-acc-find-ctrl" id="vibe-acc-find-prev" title="Shift+Enter">⮜</button>
      <button class="vibe-acc-find-ctrl" id="vibe-acc-find-next" title="Enter">⮞</button>
      <span class="vibe-acc-find-info" id="vibe-acc-find-info"></span>
      <div class="vibe-ac-suggest" id="vibe-ac-suggest"></div>
    </div>

    <div class="vibe-acc-list"></div>

    <div class="vibe-history-panel" id="vibe-history-panel">
      <div class="vibe-history-head">
        <span>История (прыжки) и закреплённые</span>
        <div class="vibe-history-actions">
          <button class="vibe-history-btn" id="vibe-history-refresh">↻</button>
          <button class="vibe-history-btn" id="vibe-history-clear">🗑</button>
          <button class="vibe-history-btn" id="vibe-history-close">✕</button>
        </div>
      </div>
      <div class="vibe-history-body" id="vibe-history-body"></div>
    </div>

    <div class="vibe-settings-panel" id="vibe-settings-panel">
      <div class="vibe-settings-head">
        <span>Настройки</span>
        <div class="vibe-settings-actions"><button class="vibe-settings-btn" id="vibe-settings-close">✕</button></div>
      </div>
      <div class="vibe-settings-body">
        <div class="vibe-settings-row">
          <input type="checkbox" id="vibe-opt-ctrlf">
          <label for="vibe-opt-ctrlf">Заменять Ctrl+F (открывать панель и фокусировать поиск)</label>
        </div>
        <div class="vibe-settings-row">
          <label style="min-width:210px" for="vibe-render-chunk">Размер пакета отрисовки:</label>
          <input id="vibe-render-chunk" type="number" min="200" step="100" style="width:120px; background:#18191f; color:#ffe37a; border:1px solid #ffe37a55; border-radius:6px; padding:4px 8px;">
          <span style="font-size:12px; opacity:.8;">(на мощных ПК 30000)</span>
        </div>
        <div class="vibe-settings-row">
          <input type="checkbox" id="vibe-silent-sync">
          <label for="vibe-silent-sync">Тихая синхронизация (без прогресса, минимальные перерисовки)</label>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  panelInstance = panel;

  // Ссылки
  searchInput   = panel.querySelector('.vibe-acc-search');
  acBox         = panel.querySelector('#vibe-ac-suggest');
  historyPanelEl= panel.querySelector('#vibe-history-panel');
  settingsPanel = panel.querySelector('#vibe-settings-panel');

  // Кнопки
  panel.querySelector('#vibe-history-toggle').onclick = ()=> toggleHistoryPanel();
  panel.querySelector('#vibe-settings-toggle').onclick = ()=> toggleSettingsPanel(true);

  // Закрытие и горячие клавиши
  const __docClickHandler = (e)=>{ if(!panel.contains(e.target)) hideAutocomplete(); };
  const __escKeyHandler   = (e)=>{
    if(e.key==='Escape'){
      if(settingsPanel && settingsPanel.style.display==='flex'){ e.stopPropagation(); toggleSettingsPanel(false); }
      else if(historyPanelEl && historyPanelEl.style.display==='flex'){ e.stopPropagation(); toggleHistoryPanel(false); }
    }
  };
  document.addEventListener('click', __docClickHandler, true);
  document.addEventListener('keydown', __escKeyHandler, true);

  panel.querySelector('.vibe-acc-close').onclick = ()=>{
    try{ document.removeEventListener('click', __docClickHandler, true); }catch{}
    try{ document.removeEventListener('keydown', __escKeyHandler, true); }catch{}
    const ui = loadUIState();
    ui.search = (searchInput?.value || '');
    saveUIState(ui);
    panel.remove();
    if(toolbarOuter){ toolbarOuter.remove(); toolbarOuter=null; }
    if(scrollOverlay){ scrollOverlay.remove(); scrollOverlay=null; }
    panelInstance = null;
  };

  // Настройки
  initSettingsUI();
  panel.querySelector('#vibe-settings-close').onclick = ()=> toggleSettingsPanel(false);

  // История
  panel.querySelector('#vibe-history-refresh').onclick=()=>renderHistoryPanel();
  panel.querySelector('#vibe-history-clear').onclick=()=>{ clearHistory(); renderHistoryPanel(); showToast('История очищена'); };
  panel.querySelector('#vibe-history-close').onclick =()=>toggleHistoryPanel(false);

  // Поиск/подсказки
  const scheduleAutocomplete = ()=>{
    if(searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(()=>{
      const q = searchInput.value.trim();
      if((q.length>=AC_MIN_CHARS) || /^\d{4,}$/.test(q)){
        updateAutocomplete(q);
      }else{
        hideAutocomplete();
      }
    }, INPUT_DEBOUNCE_MS);
  };
  searchInput.addEventListener('input', scheduleAutocomplete);

  // Навигация по подсказкам + поиск путём/enter
  searchInput.addEventListener('keydown', async (e)=>{
    if(acBox && acBox.style.display!=='none'){
      if(e.key==='ArrowDown' || e.key==='Down'){ e.preventDefault(); moveAC(1); return; }
      if(e.key==='ArrowUp'   || e.key==='Up'){   e.preventDefault(); moveAC(-1); return; }
      if(e.key==='Enter'){ e.preventDefault(); chooseAC(); return; }
      if(e.key==='Escape'){ hideAutocomplete(); return; }
    }
    if(e.key==='Enter'){
      const q=searchInput.value.trim();
      if(q.includes('>')){
        e.preventDefault();
        const names=q.split('>').map(s=>s.trim()).filter(Boolean);
        openPathByNames(names).then(()=>{
          const last=names[names.length-1];
          const row=findRowByTitleInTree(last);
          if(row) row.scrollIntoView({block:'center',behavior:'smooth'});
        });
        hideAutocomplete();
        return;
      }
      e.preventDefault();
      await goToMatch(+1, true);
    }else if(e.key==='F3'){
      e.preventDefault(); await goToMatch(+1,false);
    }else if(e.key==='F2'){
      e.preventDefault(); await goToMatch(-1,false);
    }
  });

  // Внешний тулбар (создаём единожды)
  if(!toolbarOuter){
    toolbarOuter=document.createElement('div');
    toolbarOuter.className='vibe-acc-toolbar-outer';
    toolbarOuter.style.display='none';
    document.body.appendChild(toolbarOuter);
  }

  // FAB overlay поверх списка
  buildScrollOverlay(panel);

  return panel;
}

function toggleHistoryPanel(forceState){
  if(!historyPanelEl) return;
  if(typeof forceState==='boolean'){ historyPanelEl.style.display=forceState?'flex':'none'; }
  else historyPanelEl.style.display=(historyPanelEl.style.display==='flex'?'none':'flex');
  if(historyPanelEl.style.display==='flex') renderHistoryPanel();
}
function toggleSettingsPanel(forceOpen){
  if(!settingsPanel) return;
  settingsPanel.style.display = forceOpen ? 'flex' : 'none';
}
function initSettingsUI(){
  const s = loadSettings();
  const cb = settingsPanel.querySelector('#vibe-opt-ctrlf');
  cb.checked = !!s.replaceCtrlF;
  cb.onchange = ()=>{ const cur=loadSettings(); cur.replaceCtrlF=!!cb.checked; saveSettings(cur); showToast('Настройки сохранены'); };

  const chunkInput = settingsPanel.querySelector('#vibe-render-chunk');
  chunkInput.value = String(s.renderChunk||RENDER_CHUNK);
  chunkInput.onchange = ()=>{
    const v = Math.max(200, Number(chunkInput.value)||RENDER_CHUNK);
    const cur = loadSettings(); cur.renderChunk = v; saveSettings(cur); showToast('Размер пакета сохранён');
  };

  const silentSync = settingsPanel.querySelector('#vibe-silent-sync');
  silentSync.checked = !!s.silentSync;
  silentSync.onchange = ()=>{ const cur=loadSettings(); cur.silentSync=!!silentSync.checked; saveSettings(cur); showToast('Режим синхронизации сохранён'); };
}

function renderHistoryPanel(){
  if(!historyPanelEl) return;
  const body=historyPanelEl.querySelector('#vibe-history-body'); body.innerHTML='';
  const pins = loadPins();
  const rec  = loadHistory().slice(0, 50);

  const addSection = (title, items) => {
    const st=document.createElement('div'); st.className='vibe-history-section-title'; st.textContent=title; body.appendChild(st);
    if(!items.length){ const empty=document.createElement('div'); empty.className='vibe-acc-empty'; empty.textContent='Пусто.'; empty.style.marginLeft='6px'; body.appendChild(empty); return; }

    for(let it of items){
      const row=document.createElement('div');
      row.className='vibe-history-item';
      row.innerHTML=`
        <div class="vibe-history-id">${it.id}</div>
        <div>
          <div class="vibe-history-title" title="${escapeHTML(it.title||'')}">${escapeHTML(it.title||'')}</div>
          <div class="vibe-history-path">${escapeHTML((it.path||[]).join(' > '))}</div>
        </div>
        <div class="vibe-history-pin ${isPinned(it.id)?'pinned':''}" title="Закрепить/открепить">★</div>
      `;
      row.addEventListener('click', async (e)=>{
        if((e.target).classList.contains('vibe-history-pin')) return;
        toggleHistoryPanel(false);
        await jumpToHistoryEntry(it);
      });
      row.querySelector('.vibe-history-pin').addEventListener('click', (e)=>{
        e.stopPropagation();
        togglePin(it); renderHistoryPanel();
      });
      body.appendChild(row);
    }
  };
  addSection('Закреплённые', pins);
  addSection('Недавние', rec);
}

/* FAB overlay */
function buildScrollOverlay(panel){
  if(scrollOverlay) { try { scrollOverlay.remove(); } catch(_){} }

  const list=panel.querySelector('.vibe-acc-list');
  scrollOverlay=document.createElement('div');
  scrollOverlay.className='vibe-scroll-overlay';
  panel.appendChild(scrollOverlay);

  const btnTop=document.createElement('button');
  btnTop.className='vibe-scroll-fab vibe-scroll-fab-top';
  btnTop.textContent='▲';
  const btnBot=document.createElement('button');
  btnBot.className='vibe-scroll-fab vibe-scroll-fab-bot';
  btnBot.textContent='▼';

  btnTop.addEventListener('click', ()=> list.scrollTo({ top:0, behavior:'smooth' }));
  btnBot.addEventListener('click', ()=> list.scrollTo({ top:list.scrollHeight, behavior:'smooth' }));

  scrollOverlay.appendChild(btnTop);
  scrollOverlay.appendChild(btnBot);

  const positionOverlay = ()=>{
    const rectList=list.getBoundingClientRect();
    const rectPanel=panel.getBoundingClientRect();
    const top = rectList.top - rectPanel.top;
    const bottom = rectPanel.bottom - rectList.bottom;
    scrollOverlay.style.top = Math.max(0, top) + 'px';
    scrollOverlay.style.bottom = Math.max(0, bottom) + 'px';
  };
  positionOverlay();

  try { overlayResizeObserver?.disconnect?.(); } catch(_){}
  overlayResizeObserver = new ResizeObserver(positionOverlay);
  overlayResizeObserver.observe(panel);
  overlayResizeObserver.observe(list);

  const updateOpacity = ()=>{
    const nearTop = list.scrollTop < 8;
    const nearBot = list.scrollTop + list.clientHeight > list.scrollHeight - 8;
    btnTop.style.opacity = nearTop ? '.0' : '.45';
    btnBot.style.opacity = nearBot ? '.0' : '.45';
  };
  updateOpacity();
  list.addEventListener('scroll', updateOpacity, {passive:true});
}

/* ======================= АВТОКОМПЛИТ (только по кэшу; пины — после базовых) ======================= */
function hideAutocomplete(){ if(acBox){ acBox.style.display='none'; acBox.innerHTML=''; acActiveIdx=-1; } }
function moveAC(dir){
  const items=acBox.querySelectorAll('.vibe-ac-item'); if(!items.length) return;
  acActiveIdx=(acActiveIdx + dir + items.length) % items.length;
  items.forEach((el,i)=>el.classList.toggle('active', i===acActiveIdx));
  items[acActiveIdx].scrollIntoView({block:'nearest'});
}
function chooseAC(){
  const items=acBox.querySelectorAll('.vibe-ac-item'); if(!items.length) return;
  const el=items[Math.max(0, acActiveIdx)]; const id=el.getAttribute('data-id');
  hideAutocomplete(); if(id) jumpToId(id);
}
function flashSearchError(){
  if(!searchInput) return;
  searchInput.classList.remove('vibe-search-error'); void searchInput.offsetWidth;
  searchInput.classList.add('vibe-search-error');
  gentleBeep(110, 540, 0.025);
  setTimeout(()=> searchInput && searchInput.classList.remove('vibe-search-error'), 700);
}
function acScoreBasic(it, query){
  const q = norm(query);
  const title = norm(it.title||'');
  const idStr = String(it.id||'');
  let s = 0;
  if(idStr.startsWith(query)) s += 180;
  else if(idStr.includes(query)) s += 90;
  if(title.startsWith(q)) s += 140;
  else if(title.includes(q)) s += 90;
  else s += subseqScore(q, title);
  return s;
}
function subseqScore(q, t){
  let qi=0, ti=0, streak=0, bonus=0;
  while(qi<q.length && ti<t.length){
    if(q[qi]===t[ti]){ streak++; bonus += (streak>=2? 2 : 1); qi++; ti++; }
    else { streak=0; ti++; }
  }
  if(qi<q.length) return 0;
  return 30 + Math.min(40, bonus);
}

function updateAutocomplete(query){
  if(!acBox) return;
  if(!query){ hideAutocomplete(); return; }
  if(query.includes('>')){ hideAutocomplete(); return; } // путь набирается вручную

  // 1) БАЗОВЫЕ совпадения — строго из nodeMap
  const base = Array.from(nodeMap.values());
  let baseArr = base.map(it=>({ it, sc: acScoreBasic(it, query) }))
                   .filter(x=> x.sc>0)
                   .sort((a,b)=> b.sc - a.sc)
                   .map(x=>x.it);

  // Если БАЗОВЫХ НЕТ — не показываем НИЧЕГО (даже пины/историю)
  if(baseArr.length===0){
    hideAutocomplete();
    flashSearchError();
    return;
  }

  // 2) ПРИОРИТЕТ: базовые, затем пины/история, но ТОЛЬКО если уже есть базовые
  const used = new Set();
  const final = [];
  for(const it of baseArr){ if(final.length>=SUGGEST_LIMIT) break; if(!used.has(String(it.id))){ final.push(it); used.add(String(it.id)); } }

  if(final.length < SUGGEST_LIMIT){
    const pins = loadPins();
    const hist = loadHistory();
    const extraPool = [...pins, ...hist]; // пины чуть усилены скором, но всё равно после базовых
    const extraSorted = extraPool.map(it=>({ it, sc: acScoreBasic(it, query) + (isPinned(it.id)? 40 : 0) }))
                                 .filter(x=> x.sc>0 && !used.has(String(x.it.id)))
                                 .sort((a,b)=> b.sc - a.sc)
                                 .map(x=>x.it);
    for(const it of extraSorted){
      if(final.length>=SUGGEST_LIMIT) break;
      final.push(it); used.add(String(it.id));
    }
  }

  // Рендер топ-20 (с title-хинтами)
  const html = final.slice(0, SUGGEST_LIMIT).map((it,i)=>{
    const pathArr = it.path || getPathArrayFromMap(it.id);
    const fullTitle = escapeHTML(it.title||'');
    return `
      <div class="vibe-ac-item ${i===0?'active':''}" data-id="${it.id}" title="${fullTitle}">
        <div class="vibe-ac-id">${it.id}</div>
        <div>
          <div class="vibe-ac-title" title="${fullTitle}">${fullTitle}</div>
          <div class="vibe-ac-path">${escapeHTML((pathArr||[]).join(' > '))}</div>
        </div>
      </div>
    `;
  }).join('');
  acBox.innerHTML = html;
  acBox.style.display='block';
  acActiveIdx=0;

  acBox.querySelectorAll('.vibe-ac-item').forEach(item=>{
    item.addEventListener('click', ()=>{ const id=item.getAttribute('data-id'); hideAutocomplete(); if(id) jumpToId(id); });
  });
}

/* ======================= О С Н О В Н О Е  Д Е Р Е В О ======================= */
function getMainItems(){
  let mainTbl=document.querySelector('table[cellpadding="2"] table');
  if(!mainTbl) return [];
  return parseCategoryTable(mainTbl, null);
}

/* ======================= Р А С К Р Ы Т И Е / З А К Р Ы Т И Е ======================= */
function findRowInPanel(id){ return panelInstance?.querySelector(`.vibe-acc-row[data-id="${CSS.escape(String(id))}"]`) || null; }
function findRowByTitleAmong(container, title){
  const t=norm(title);
  return Array.from(container.querySelectorAll(':scope > .vibe-acc-row')).find(el=>norm(el.dataset.title)===t) || null;
}
function findRowByTitleInTree(title){
  const t=norm(title);
  const main=panelInstance?.querySelector('.vibe-acc-list'); if(!main) return null;
  const stack=[...main.querySelectorAll(':scope > .vibe-acc-row')];
  while(stack.length){
    const row=stack.shift();
    if(norm(row.dataset.title)===t) return row;
    const sub=row.nextElementSibling;
    if(sub?.classList?.contains('vibe-acc-sublist')) stack.push(...sub.querySelectorAll(':scope > .vibe-acc-row'));
  }
  return null;
}
async function ensureMainLoaded(){
  const list=panelInstance.querySelector('.vibe-acc-list');
  if(!list.querySelector('.vibe-acc-row')){
    const main=getMainItems();
    await renderItemsChunked(list, main, 'Корень');
  }
}
async function waitForChildren(row){
  let tries=0;
  while(tries<160){
    const sub=row.nextSibling;
    if(sub && sub.classList && sub.classList.contains('vibe-acc-sublist')){
      const hasLoading = !!sub.querySelector('.vibe-acc-empty')?.textContent?.includes('Загрузка');
      const hasRows = !!sub.querySelector('.vibe-acc-row');
      if(hasRows || !hasLoading) return;
    }
    tries++; await sleep(50);
  }
}
async function expandCategory(id){
  const row=findRowInPanel(id); if(!row) return;
  if(row.dataset.opened==='true') return;
  const btn=row.querySelector('.vibe-acc-expand'); if(!btn) return;
  btn.click();
  await waitForChildren(row);
  addToHistory(id);
}

async function onToggleCategory(e, row, catId){
  e.stopPropagation();

  const sub = row.nextElementSibling;
  const isOpen = row.dataset.opened==='true';

  if(isOpen){
    // Закрыть
    row.dataset.opened='false';
    row.querySelector('.vibe-acc-expand').innerHTML='<span style="display:inline-block;transform:translateY(-2px)">▼</span>';

    const st = loadUIState();
    st.openIds = (st.openIds||[]).filter(x=>x!==String(catId));
    saveUIState(st);

    if(sub && sub.classList.contains('vibe-acc-sublist')) sub.remove();
    return;
  }

  // Открыть
  row.dataset.opened='true';
  row.querySelector('.vibe-acc-expand').innerHTML='<span style="display:inline-block;transform:rotate(180deg);transform-origin:center">▲</span>';

  let sublist = document.createElement('div');
  sublist.className='vibe-acc-sublist';
  sublist.innerHTML='<div class="vibe-acc-empty">Загрузка...</div>';
  row.parentNode.insertBefore(sublist, row.nextSibling);

  const st = loadUIState(); const set = new Set(st.openIds||[]); set.add(String(catId)); st.openIds = Array.from(set); saveUIState(st);

  const cached = childrenCache.get(String(catId));
  if(cached){
    // Быстрый кэш
    await renderItemsChunked(sublist, cached.order.map(id=> cached.map.get(id)).filter(Boolean), 'Кэш');
    addToHistory(catId);
    updateToolbar();

    // Тихая синхронизация
    try{
      const fresh = await fetchChildren(catId);
      await reconcileSublistLIS(sublist, catId, fresh, {silent:loadSettings().silentSync});
    }catch(err){ console.error('fetch/reconcile error', err); }
    return;
  }

  // Нет кэша — грузим
  try{
    const fresh = await fetchChildren(catId);
    await renderItemsChunked(sublist, fresh, 'Загрузка');
    childrenCache.set(String(catId), { map:new Map(fresh.map(it=>[String(it.id), it])), order:fresh.map(x=>String(x.id)), ts:Date.now() });
    addToHistory(catId);
    updateToolbar();
  }catch(err){
    sublist.innerHTML = `<div class="vibe-acc-empty">Ошибка загрузки.</div>`;
    console.error(err);
  }
}

/* ======================= П Р Ы Ж К И / П У Т И ======================= */
async function jumpToHistoryEntry(entry){
  if(entry?.pathIds?.length){ await openPathByIds(entry.pathIds); focusRow(entry.id); }
  else focusRow(entry.id);
}
async function jumpToId(id){
  const target=nodeMap.get(id);
  if(target){ const pathIds=getPathIdArray(id); await openPathByIds(pathIds); focusRow(id); return; }
  const hist=loadHistory().find(x=>x.id===id) || loadPins().find(x=>x.id===id);
  if(hist && hist.pathIds?.length){ await openPathByIds(hist.pathIds); focusRow(id); return; }
  showToast('Не удалось определить путь к элементу');
}
async function openPathByIds(pathIds){
  if(!panelInstance || !Array.isArray(pathIds) || !pathIds.length) return;
  await ensureMainLoaded();
  for(let i=0;i<pathIds.length;i++){
    const id=String(pathIds[i]);
    let row=findRowInPanel(id);
    if(!row && i>0){
      const parentId=String(pathIds[i-1]); await expandCategory(parentId); row=findRowInPanel(id);
    }
    if(i<pathIds.length-1) await expandCategory(id);
  }
}
async function openPathByNames(names){
  if(!panelInstance || !Array.isArray(names) || !names.length) return;
  await ensureMainLoaded();
  let container=panelInstance.querySelector('.vibe-acc-list');
  let currentRow=null;

  for(let i=0;i<names.length;i++){
    const title=names[i];
    let targetRow = findRowByTitleAmong(container, title);
    if(!targetRow && currentRow){
      await expandCategory(currentRow.dataset.id);
      const sub=currentRow.nextElementSibling;
      container = sub && sub.classList.contains('vibe-acc-sublist') ? sub : container;
      targetRow = findRowByTitleAmong(container, title);
    }
    if(!targetRow) targetRow = findRowByTitleInTree(title);
    if(!targetRow){ showToast(`Не найден шаг: ${title}`); return; }
    if(i < names.length-1){
      await expandCategory(targetRow.dataset.id);
      const sub=targetRow.nextElementSibling;
      container = sub && sub.classList.contains('vibe-acc-sublist') ? sub : container;
    }else{
      targetRow.scrollIntoView({block:'center', behavior:'smooth'});
      targetRow.classList.add('vibe-acc-find-match'); setTimeout(()=>targetRow.classList.remove('vibe-acc-find-match'), 1200);
    }
    currentRow = targetRow;
  }
}
function focusRow(id){
  let row=findRowInPanel(id);
  if(row){ row.scrollIntoView({block:'center',behavior:'smooth'}); row.classList.add('vibe-acc-find-match'); setTimeout(()=>row.classList.remove('vibe-acc-find-match'),1200); }
  else showToast('Элемент пока не в DOM — раскройте нужного родителя');
}

/* ======================= П О И С К  В  П А Н Е Л И ======================= */
function clearFindHighlights(){
  if(!panelInstance) return;
  const prev = findCache.list[findCache.idx];
  if(prev?.isConnected) prev.classList.remove('vibe-acc-find-match');
}
function setFindInfo(){
  if(!panelInstance) return;
  const info=panelInstance.querySelector('#vibe-acc-find-info');
  const total=findCache.list.length;
  if(!total) info.textContent='';
  else info.textContent=((findCache.idx>=0? findCache.idx+1 : 1) + '/' + total);
}
async function buildMatchesForQuery(q){
  if(findCache.q===q && findCache.list.length && !findCache.building) return;

  clearFindHighlights();
  findCache = { q:q, list:[], idx:-1, building:true };
  if(!q){ setFindInfo(); findCache.building=false; return; }

  const rows = panelInstance.querySelectorAll('.vibe-acc-row');
  const qn = norm(q);

  for(let i=0;i<rows.length;i+=FIND_SCAN_CHUNK){
    const end = Math.min(i+FIND_SCAN_CHUNK, rows.length);
    for(let j=i;j<end;j++){
      const row = rows[j];
      const title = row.dataset.title || row.querySelector('.vibe-acc-title')?.textContent || '';
      const tn = norm(title);
      if(tn.includes(qn) || subseqScore(qn, tn)>0){
        findCache.list.push(row);
      }
    }
    setFindInfo();
    await idle();
  }
  findCache.building=false;
  setFindInfo();
}
async function goToMatch(dir=+1, forceRebuild=false){
  if(!panelInstance) return;
  const q = (searchInput?.value || '').trim();
  if(!q){ return; }

  if(forceRebuild || findCache.q!==q || !findCache.list.length){
    await buildMatchesForQuery(q);
  }
  if(!findCache.list.length){
    flashSearchError();
    return;
  }

  clearFindHighlights();
  if(findCache.idx<0) findCache.idx=0;
  else findCache.idx=(findCache.idx + dir + findCache.list.length) % findCache.list.length;

  const row=findCache.list[findCache.idx];
  if(row?.isConnected){
    row.classList.add('vibe-acc-find-match');
    row.scrollIntoView({block:'center',behavior:'smooth'});
  }
  setFindInfo();
}

/* ======================= Т У Л Б А Р ======================= */
function getSelectedRowsOrdered(){
  if(!panelInstance) return [];
  let ordered=[];
  function dfs(container){
    for(let el of container.children){
      if(el.classList?.contains('vibe-acc-row') && selectedIds.has(el.dataset.id)) ordered.push(el);
      if(el.classList?.contains('vibe-acc-row')){
        let sub=el.nextSibling;
        if(sub && sub.classList.contains('vibe-acc-sublist')) dfs(sub);
      }
    }
  }
  let mainList=panelInstance.querySelector('.vibe-acc-list'); if(mainList) dfs(mainList);
  return ordered;
}
function updateToolbar(){
  if(!toolbarOuter) return;
  if(!panelInstance || !selectedIds.size){
    toolbarOuter.style.display='none'; toolbarOuter.innerHTML=''; return;
  }
  toolbarOuter.style.display='';
  toolbarOuter.innerHTML=`
    <button class="vibe-acc-toolbar-btn" id="vibe-copy-paths">Копировать пути</button>
    <button class="vibe-acc-toolbar-btn" id="vibe-copy-ids">Копировать ID</button>
    <button class="vibe-acc-toolbar-btn" id="vibe-clear-sel">Сброс выделения</button>
  `;
  document.getElementById('vibe-copy-paths')?.addEventListener('click', ()=>{
    const ordered=getSelectedRowsOrdered();
    const arr = ordered.map(el => getPathStringFromRow(el) || getPathString(el.dataset.id));
    copyToClipboard(arr.join('\n')); showToast('Пути скопированы!');
  });
  document.getElementById('vibe-copy-ids')?.addEventListener('click', ()=>{
    let arr=[]; let ordered=getSelectedRowsOrdered(); for(let el of ordered) arr.push(el.dataset.id);
    copyToClipboard(arr.join('\n')); showToast('ID скопированы!');
  });
  document.getElementById('vibe-clear-sel')?.addEventListener('click', ()=>{
    selectedIds.clear(); lastSelectedId=null;
    for(let el of panelInstance.querySelectorAll('.vibe-acc-row.vibe-acc-selected')) el.classList.remove('vibe-acc-selected');
    updateToolbar();
  });
}

/* ======================= О Т К Р Ы Т И Е  П А Н Е Л И / CTRL+F ======================= */
async function openPanelAndInit(){
  let panel=document.getElementById('vibe-acc-panel');
  const uiState = loadUIState();

  if(!panel){
    nodeMap.clear(); selectedIds.clear();
    panel=createPanel();
    let list=panel.querySelector('.vibe-acc-list');
    let main=getMainItems();
    await renderItemsChunked(list, main, 'Корень');
    updateToolbar();

    if(uiState.search){ searchInput.value = uiState.search; }
    for(const id of (uiState.openIds||[])){ try{ await expandCategory(String(id)); }catch(e){ console.warn('restore open failed', id, e); } }
  }

  const input = panel.querySelector('.vibe-acc-search');
  input.focus(); input.select && input.select();
}

// Глобальный перехват Ctrl+F
function globalCtrlFHandler(e){
  const s = loadSettings();
  const isCtrlF = (e.key && e.key.toLowerCase()==='f' && (e.ctrlKey || e.metaKey));
  if(!isCtrlF) return;
  if(s.replaceCtrlF){
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openPanelAndInit();
  }
}
window.addEventListener('keydown', globalCtrlFHandler, true);

/* ======================= П У С К (кнопка) ======================= */
function bindTrigger(){
  let trig=document.createElement('button');
  trig.textContent='⮞ Каталоги (Vibe)';
  trig.style=`
    position:fixed; top:18px; right:0; z-index:99998;
    background:#ffe37a; border-radius:12px 0 0 12px; font-size:19px;
    font-family:'JetBrains Mono',monospace,sans-serif; font-weight:700;
    padding:13px 28px 13px 19px; box-shadow:0 6px 24px #000б; cursor:pointer; transition:background .16s;`;
  trig.onmouseenter=()=>trig.style.background='#fffbe3';
  trig.onmouseleave=()=>trig.style.background='#ffe37a';
  trig.onclick=()=>{ openPanelAndInit(); };
  document.body.appendChild(trig);

  document.addEventListener('keydown',(e)=>{
    const panel=document.getElementById('vibe-acc-panel');
    if(panel && e.key.toLowerCase()==='j' && panel.contains(document.activeElement)){
      e.preventDefault(); toggleHistoryPanel();
    }
  }, true);
}
setTimeout(bindTrigger, 600);

})();
