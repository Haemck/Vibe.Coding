// ==UserScript==
// @name         Digiseller: CATologies
// @namespace    https://ggsel.com/
// @version      3.9
// @description  Аккордеон категорий/разделов. Фаззи-поиск (название/ID/путь «A > B > C») с пошаговым раскрытием. История с пинами. Мультивыделение, копирование ID/полных путей (из DOM, сверху-вниз). Круглые FAB-кнопки прокрутки поверх контента. Esc закрывает историю. Настройки: «Заменять Ctrl+F» (глобально перехватывает системный поиск и открывает панель).
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/razdels.asp*
// @grant        GM_addStyle
// @updateURL    https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologies.user.js
// @downloadURL  https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologies.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ======================= К О Н С Т А Н Т Ы =======================
    const INPUT_DEBOUNCE_MS = 1000; // Дилей показа результатов/подсказок после последнего ввода
    const LS_HISTORY_KEY    = 'vibe_digi_history_v2'; // [{id,title,type,pathIds[],path[],ts,freq}]
    const LS_PINS_KEY       = 'vibe_digi_pins_v1';    // [{id,title,type,pathIds[],path[],ts}]
    const LS_SETTINGS_KEY   = 'vibe_digi_settings_v1';// { replaceCtrlF: true }

    // ======================= С Т И Л И =======================
    GM_addStyle(`
        .vibe-acc-panel {
            position: fixed; top: 0; right: 0;
            width: 750px; max-width: 99vw; height: 100vh;
            z-index: 999999;
            background: #181920;
            box-shadow: -3px 0 40px 0 #000d, 0 0 0 4px #ffde5c55;
            border-left: 5px solid #ffe37a;
            display: flex; flex-direction: column;
            font-family: 'JetBrains Mono','Fira Mono','Consolas',monospace,sans-serif;
        }
        .vibe-acc-header{
            padding:22px 40px 12px 38px;
            background:linear-gradient(90deg,#222228 85%,#ffde5c 300%);
            color:#ffe37a;font-size:22px;font-weight:700;letter-spacing:1.2px;
            border-bottom:3px solid #ffe37a; box-shadow:0 4px 0 0 #241f10;
            display:flex; align-items:center; gap:12px; min-height:60px;
        }
        .vibe-acc-header-title{ flex:1; }
        .vibe-acc-btn{
            border:none;background:none;color:#ffe37a;cursor:pointer;font-size:20px;padding:6px 10px;border-radius:8px;
            transition:background .15s,color .15s;
        }
        .vibe-acc-btn:hover{ background:#ffe37a22;color:#fffbe3; }
        .vibe-acc-close{ font-size:26px; margin-left:2px; margin-left: 15px;
        margin-bottom: 4px;
        }

        .vibe-acc-search-wrap{
            background:#222328; border-bottom:3px solid #ffe37a; padding:10px 36px;
            display:grid; grid-template-columns:1fr auto auto auto; grid-gap:10px; align-items:center; position:relative;
        }
        .vibe-acc-search{
            border:none; background:#18191f; border-radius:8px; font-size:18px; color:#ffe37a; padding:10px 14px; outline:none;
            box-shadow:0 0 0 1px #ffde5c33; transition:box-shadow .14s;
        }
        .vibe-acc-search:focus{ box-shadow:0 0 0 2px #ffe37a, 0 0 0 4px #ffde5c25; }
        .vibe-acc-find-ctrl{ min-width:90px; background:none; border:none; color:#ffe37a; font-size:16px; font-weight:700; cursor:pointer; opacity:.85; }
        .vibe-acc-find-ctrl[disabled]{ opacity:.25; pointer-events:none; }
        .vibe-acc-find-info{ color:#ffe37a; font-size:15px; min-width:44px; text-align:center; }

        .vibe-acc-list{
            position:relative; flex:1 1 auto; overflow-y:auto;
            padding:24px 32px 20px 32px; display:flex; flex-direction:column; gap:13px;
        }
        .vibe-acc-divider{ height:4px; background:linear-gradient(90deg,#ffe37a 0%,#2b2310 100%); border-radius:2px; margin:0 0 24px; }

        .vibe-acc-row{
            display:flex; align-items:center; gap:13px; user-select:none;
            border-radius:11px; background:linear-gradient(90deg,#24232a 75%,#3d3222 110%);
            color:#ffe37a; font-size:19px; padding:9px 12px 9px 16px;
            border:2.2px solid #ffe37a28; box-shadow:0 1px 0 0 #ffe37a13;
            font-weight:500; cursor:pointer; transition:background .12s, color .12s, border .14s; position:relative;
        }
        .vibe-acc-row:hover{ background:linear-gradient(90deg,#2a2522 88%,#ffe37a18 115%); color:#fffbe3; }
        .vibe-acc-row[data-opened="true"]{ border-color:#ffde5c; background:linear-gradient(90deg,#292618 82%,#ffde5c33 140%); }
        .vibe-acc-row.vibe-acc-selected{ border-color:#ffe37a; background:linear-gradient(90deg,#fffbe366 80%,#ffde5c44 120%); color:#181920; box-shadow:0 0 0 2px #ffe37a90; }

        .vibe-acc-id{ min-width:78px; font-size:16.5px; color:#d3be79; text-align:left; user-select:text; font-weight:600; cursor:pointer; }
        .vibe-acc-id.vibe-id-copied{ color:#181920!important; background:#ffe37a; border-radius:5px; padding:2px 8px; font-weight:700; position:relative; }

        .vibe-acc-title{ flex:0 1 320px; font-weight:600; font-size:20px; color:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .vibe-acc-desc{ min-width:44px; font-size:17px; color:#ffda4f; font-weight:500; margin-left:2px; margin-right:10px; letter-spacing:.4px; }

        .vibe-acc-btns{ margin-left:auto; display:flex; gap:10px; align-items:center; }
        .vibe-acc-expand{ background:none; border:none; color:#ffe37a; font-size:21px; cursor:pointer; padding:0 7px; }
        .vibe-acc-expand:hover{ color:#ffcc43; }

        .vibe-acc-sublist{
            margin:-10px 0 6px 34px; padding-left:13px; padding-top:10px;
            border-left:2.5px solid #ffe37a55; display:flex; flex-direction:column; gap:8px;
            background:linear-gradient(90deg,#232224 70%,#ffe37a08 140%); border-radius:0 0 7px 7px;
        }
        .vibe-acc-empty{ margin:18px 0 0 13px; color:#ffcc43; font-size:17px; }
        .vibe-acc-find-match{ background:#ffe37a55; color:#000; border-radius:6px; box-shadow:0 2px 4px #ffe37a60; z-index:10; outline:2px solid #ffe37a; }

        /* ВНЕШНИЙ ТУЛБАР */
        .vibe-acc-toolbar-outer{
            position:fixed; left:calc(100vw - 750px - 182px); top:32px; z-index:1000000;
            display:flex; flex-direction:column; gap:13px; pointer-events:none;
        }
        .vibe-acc-toolbar-btn{
            background:#ffe37a; color:#232218; border:none; font-size:15px; font-weight:700; border-radius:7px; padding:11px 19px;
            box-shadow:0 1px 8px #ffecb855, 0 0 0 1.2px #ffe37a; cursor:pointer; opacity:.94; transition:box-shadow .13s, background .13s; min-width:142px; text-align:left; pointer-events:all;
        }
        .vibe-acc-toolbar-btn:hover{ box-shadow:0 2px 18px #ffe37aaa; background:#fffbe3; }

        /* АВТОКОМПЛИТ */
        .vibe-ac-suggest{
            position:absolute; left:36px; right:36px; top:58px; z-index:1000001;
            background:#13141a; border:2px solid #ffe37a; border-radius:10px; box-shadow:0 10px 30px #000a; overflow:hidden;
            max-height:320px; overflow-y:auto; display:none;
        }
        .vibe-ac-item{ display:grid; grid-template-columns:80px 1fr; gap:8px; align-items:center; padding:8px 12px; color:#ffe37a; cursor:pointer; font-size:15px; border-bottom:1px dashed #ffe37a22; }
        .vibe-ac-item:last-child{ border-bottom:none; }
        .vibe-ac-item:hover, .vibe-ac-item.active{ background:#ffe37a22; color:#fffbe3; }
        .vibe-ac-id{ font-weight:700; color:#d3be79; }
        .vibe-ac-title{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .vibe-ac-path{ font-size:12px; color:#cdbb78; opacity:.9; margin-left:8px; }

        /* ИСТОРИЯ */
        .vibe-history-panel{
            position:absolute; right:14px; top:60px; z-index:1000002;
            width:640px; max-width:calc(100vw - 100px);
            background:#14151b; border:2px solid #ffe37a; border-radius:12px; box-shadow:0 12px 36px #000c;
            display:none; flex-direction:column; max-height:70vh; overflow:hidden;
        }
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

        /* Оверлей с круглыми FAB-кнопками прокрутки (всегда поверх) */
        .vibe-scroll-overlay{
            position:absolute; left:0; right:0;
            pointer-events:none; z-index:1000003;
        }
        .vibe-scroll-fab{
            position:absolute; left:8px;
            width:40px; height:32px; box-sizing:border-box;
            border-radius:10%; border:none; background:#ffe37a; color:#232218;
            font-size:16px; font-weight:900; display:flex; align-items:center; justify-content:center;
            cursor:pointer; opacity:.35; box-shadow:0 2px 10px #000a; transition:opacity .15s, transform .15s, background .15s;
            pointer-events:auto;
        }
        .vibe-scroll-fab:hover{ opacity:.98; background:#fffbe3; transform:scale(1.02); }
        .vibe-scroll-fab-top{ top:5px; transform:translateY(2px); }
        .vibe-scroll-fab-bot{ bottom:5px; transform:translateY(-2px); }

        /* НАСТРОЙКИ */
        .vibe-settings-panel{
            position:absolute; right:14px; top:60px; z-index:1000002;
            width:420px; max-width:calc(100vw - 100px);
            background:#14151b; border:2px solid #ffe37a; border-radius:12px; box-shadow:0 12px 36px #000c;
            display:none; flex-direction:column; max-height:60vh; overflow:hidden;
            color:#ffe37a; font-size:18px;
        }
        .vibe-settings-head{ display:flex; align-items:center; gap:10px; padding:10px 12px; background:#1d1f27; border-bottom:2px solid #ffe37a; font-weight:700; }
        .vibe-settings-body{ padding:12px 14px; display:grid; gap:12px; }
        .vibe-settings-row{ display:flex; align-items:center; gap:10px; }
        .vibe-settings-row label{ cursor:pointer; user-select:none; }
        .vibe-settings-btn{ background:#ffe37a; color:#232218; border:none; font-size:13px; font-weight:700; border-radius:7px; padding:6px 10px; cursor:pointer; }
        .vibe-settings-actions{ margin-left:auto; display:flex; gap:8px; }

        @media (max-width:1200px){ .vibe-acc-toolbar-outer{ left:8px!important; top:16px!important; } }
        @media (max-width:900px){
            .vibe-acc-panel{ width:98vw!important; min-width:0; }
            .vibe-acc-title{ max-width:32vw; }
            .vibe-acc-toolbar-outer{ left:8px!important; top:14px!important; }
            .vibe-history-panel{ right:6px; width:calc(100vw - 20px); }
            .vibe-settings-panel{ right:6px; width:calc(100vw - 20px); }
        }
    `);

    // ======================= С О С Т О Я Н И Е =======================
    let nodeMap      = new Map(); // id -> {id,title,desc,type,parentId}
    let panelInstance = null;
    let selectedIds   = new Set();
    let lastSelectedId = null;
    let toolbarOuter   = null;

    // Поиск / автокомплит
    let searchTimeout = null;
    let searchInput   = null;
    let acBox         = null;
    let acActiveIdx   = -1;
    let searchMatches = [];
    let matchIdx      = 0;
    let idSearchMode  = false;

    // История/пины
    let historyPanel  = null;

    // Оверлей FAB
    let scrollOverlay = null;

    // Настройки
    let settingsPanel = null;

    // ======================= У Т И Л И Т Ы =======================
    function settingsDefault(){ return { replaceCtrlF: true }; }
    function loadSettings(){
        try{
            const raw = localStorage.getItem(LS_SETTINGS_KEY);
            return raw ? Object.assign(settingsDefault(), JSON.parse(raw)) : settingsDefault();
        }catch{ return settingsDefault(); }
    }
    function saveSettings(s){
        try{ localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(s)); }catch{}
    }

    function copyToClipboard(str) {
        if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(str);
        const t = document.createElement('textarea'); t.value = str; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    function showToast(msg) {
        let el = document.createElement('div');
        el.textContent = msg;
        el.style = `position:fixed; top:19px; left:19px; z-index:9999999; background:#ffe37a; color:#181920;
                    font-size:17px; padding:10px 25px; border-radius:12px; font-weight:700; box-shadow:0 6px 28px #000c; opacity:0.97; transition:opacity .4s;`;
        document.body.appendChild(el);
        setTimeout(() => el.style.opacity = '0', 1100);
        setTimeout(() => el.remove(), 1500);
    }
    const normBase = s => (s||'').toString().trim().replace(/\s+/g,' ');
    const norm     = s => normBase(s).toLowerCase().replace(/ё/g,'е');

    // Путь из nodeMap (кэш)
    function getPathArrayFromMap(id){
        let arr=[], cur=nodeMap.get(id);
        while(cur){ arr.unshift(cur.title); cur = cur.parentId ? nodeMap.get(cur.parentId) : null; }
        return arr;
    }
    function getPathIdArray(id){
        let arr=[], cur=nodeMap.get(id);
        while(cur){ arr.unshift(cur.id); cur = cur.parentId ? nodeMap.get(cur.parentId) : null; }
        return arr;
    }
    function getPathStringFromMap(id){ return getPathArrayFromMap(id).join(' > '); }

    // Путь из DOM (всегда полный)
    function getPathArrayFromRow(row){
        const arr=[];
        let cur=row;
        while(cur && cur.classList && cur.classList.contains('vibe-acc-row')){
            const titleEl = cur.querySelector('.vibe-acc-title');
            const title = (titleEl?.textContent || cur.dataset.title || '').trim();
            arr.unshift(title);
            const container = cur.parentElement;
            if(!container) break;
            if(container.classList.contains('vibe-acc-sublist')){
                cur = container.previousElementSibling; // .vibe-acc-row
            }else{
                break;
            }
        }
        return arr;
    }
    function getPathIdArrayFromRow(row){
        const arr=[]; let cur=row;
        while(cur && cur.classList && cur.classList.contains('vibe-acc-row')){
            arr.unshift(cur.dataset.id);
            const container = cur.parentElement;
            if(!container) break;
            if(container.classList.contains('vibe-acc-sublist')){
                cur = container.previousElementSibling;
            }else break;
        }
        return arr;
    }
    function getPathStringFromRow(row){ return getPathArrayFromRow(row).join(' > '); }

    // Общая обёртка: сначала DOM (если видно), иначе — кэш
    function getPathString(id){
        const row = findRowInPanel(id);
        if(row) return getPathStringFromRow(row);
        return getPathStringFromMap(id);
    }

    function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
    function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    // ======================= И С Т О Р И Я / П И Н Ы =======================
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

    // ======================= П А Н Е Л Ь / U I =======================
    function createPanel(){
        let old=document.getElementById('vibe-acc-panel'); if(old) old.remove();

        const panel=document.createElement('div');
        panel.id='vibe-acc-panel';
        panel.className='vibe-acc-panel';
        panel.innerHTML=`
            <div class="vibe-acc-header">
                <span class="vibe-acc-header-title">Каталоги Digiseller</span>
                <button class="vibe-acc-btn" id="vibe-settings-toggle" title="Настройки (Ctrl+F)">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" class="bi bi-gear-fill" viewBox="0 0 16 16">
                   <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                </svg>
                </button>
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
                        <button class="vibe-history-btn" id="vibe-history-refresh">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-counterclockwise" viewBox="0 0 16 16">
                          <path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2z"/>
                          <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466"/>
                        </svg>
                        </button>
                        <button class="vibe-history-btn" id="vibe-history-clear">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill" viewBox="0 0 16 16">
                          <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0"/>
                        </svg>
                        </button>
                        <button class="vibe-history-btn" id="vibe-history-close">✕</button>
                    </div>
                </div>
                <div class="vibe-history-body" id="vibe-history-body"></div>
            </div>

            <div class="vibe-settings-panel" id="vibe-settings-panel">
                <div class="vibe-settings-head">
                    <span>Настройки</span>
                    <div class="vibe-settings-actions">
                        <button class="vibe-settings-btn" id="vibe-settings-close">✕</button>
                    </div>
                </div>
                <div class="vibe-settings-body">
                    <div class="vibe-settings-row">
                        <input type="checkbox" id="vibe-opt-ctrlf">
                        <label for="vibe-opt-ctrlf">Заменять Ctrl+F (открывать панель и фокусировать поиск)</label>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        panelInstance = panel;

        // ссылки на элементы
        searchInput = panel.querySelector('.vibe-acc-search');
        acBox       = panel.querySelector('#vibe-ac-suggest');
        historyPanel= panel.querySelector('#vibe-history-panel');
        settingsPanel=panel.querySelector('#vibe-settings-panel');

        // закрыть панель
        panel.querySelector('.vibe-acc-close').onclick=()=>{
            panel.remove();
            if(toolbarOuter) toolbarOuter.remove();
            if(scrollOverlay) scrollOverlay.remove();
        };

        // настройки
        panel.querySelector('#vibe-settings-toggle').onclick = ()=> toggleSettingsPanel(true);
        panel.querySelector('#vibe-settings-close').onclick  = ()=> toggleSettingsPanel(false);
        initSettingsUI();

        // история
        panel.querySelector('#vibe-history-toggle').onclick=()=>toggleHistoryPanel();
        panel.querySelector('#vibe-history-refresh').onclick=()=>renderHistoryPanel();
        panel.querySelector('#vibe-history-clear').onclick=()=>{ clearHistory(); renderHistoryPanel(); showToast('История очищена'); };
        panel.querySelector('#vibe-history-close').onclick=()=>toggleHistoryPanel(false);
        // Esc закрывает историю/настройки
        document.addEventListener('keydown', (e)=>{
            if(e.key==='Escape'){
                if(settingsPanel && settingsPanel.style.display==='flex'){ e.stopPropagation(); toggleSettingsPanel(false); }
                else if(historyPanel && historyPanel.style.display==='flex'){ e.stopPropagation(); toggleHistoryPanel(false); }
            }
        }, true);

        // поиск: показываем подсказки ТОЛЬКО при фокусе и непустом значении
        const scheduleSearchUpdate = ()=>{
            if(searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(()=>{
                updateSearchMatches();
                if(document.activeElement===searchInput){
                    const q=searchInput.value.trim();
                    if(q && !q.includes('>')) updateAutocomplete(q);
                    else hideAutocomplete();
                }
            }, INPUT_DEBOUNCE_MS);
        };
        searchInput.addEventListener('input', scheduleSearchUpdate);
        searchInput.addEventListener('focus', ()=>{
            if(searchInput.value.trim() && !searchInput.value.includes('>')){
                scheduleSearchUpdate();
            }
        });
        searchInput.addEventListener('blur', ()=>{
            // даём шанс клику по подсказке
            setTimeout(()=>{ if(document.activeElement!==searchInput) hideAutocomplete(); }, 120);
        });

        searchInput.addEventListener('keydown', (e)=>{
            // автокомплит навигация
            if(acBox && acBox.style.display!=='none'){
                if(e.key==='ArrowDown' || e.key==='Down'){ e.preventDefault(); moveAC(1); return; }
                if(e.key==='ArrowUp'   || e.key==='Up'){   e.preventDefault(); moveAC(-1); return; }
                if(e.key==='Enter'){ e.preventDefault(); chooseAC(); return; }
                if(e.key==='Escape'){ hideAutocomplete(); return; }
            }
            // путь "A > B > C"
            if(e.key==='Enter'){
                const q=searchInput.value.trim();
                if(q.includes('>')){
                    e.preventDefault();
                    const names=q.split('>').map(s=>s.trim()).filter(Boolean);
                    openPathByNames(names).then(()=> {
                        const last=names[names.length-1];
                        const row=findRowByTitleInTree(last);
                        if(row) row.scrollIntoView({block:'center',behavior:'smooth'});
                    });
                    hideAutocomplete();
                    return;
                }
                // навигация по найденным
                if(e.shiftKey) goToMatch(-1,false,true);
                else goToMatch(1,false,true);
            }
        });
        panel.querySelector('#vibe-acc-find-prev').onclick=()=>goToMatch(-1,false,true);
        panel.querySelector('#vibe-acc-find-next').onclick=()=>goToMatch(1,false,true);

        // клик вне подсказок — скрываем
        acBox.addEventListener('mousedown', (e)=>{ e.preventDefault(); }, true); // чтобы кликом по подсказке не терять фокус
        document.addEventListener('click',(e)=>{ if(!panel.contains(e.target)) hideAutocomplete(); }, true);

        // Внешний тулбар
        if(!toolbarOuter){
            toolbarOuter=document.createElement('div');
            toolbarOuter.className='vibe-acc-toolbar-outer';
            toolbarOuter.style.display='none';
            document.body.appendChild(toolbarOuter);
        }

        // FAB overlay (поверх списка)
        buildScrollOverlay(panel);

        // Обновлять подсказки при изменениях DOM ТОЛЬКО если поле в фокусе
        const list=panel.querySelector('.vibe-acc-list');
        const mo=new MutationObserver(()=>{
            if(document.activeElement===searchInput){
                const q=searchInput.value.trim();
                if(q && !q.includes('>')) updateAutocomplete(q);
            }
        });
        mo.observe(list, {childList:true, subtree:true});

        return panel;
    }

    function toggleHistoryPanel(forceState){
        if(!historyPanel) return;
        if(typeof forceState==='boolean'){ historyPanel.style.display=forceState?'flex':'none'; }
        else historyPanel.style.display=(historyPanel.style.display==='flex'?'none':'flex');
        if(historyPanel.style.display==='flex') renderHistoryPanel();
    }

    function toggleSettingsPanel(forceOpen){
        if(!settingsPanel) return;
        settingsPanel.style.display = forceOpen ? 'flex' : 'none';
    }
    function initSettingsUI(){
        const s = loadSettings();
        const cb = settingsPanel.querySelector('#vibe-opt-ctrlf');
        cb.checked = !!s.replaceCtrlF;
        cb.addEventListener('change', ()=>{
            const cur = loadSettings();
            cur.replaceCtrlF = !!cb.checked;
            saveSettings(cur);
            showToast('Настройки сохранены');
        });
    }

    function renderHistoryPanel(){
        if(!historyPanel) return;
        const body=historyPanel.querySelector('#vibe-history-body'); body.innerHTML='';

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
                        <div class="vibe-history-title">${escapeHTML(it.title||'')}</div>
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
                    togglePin(it);
                    renderHistoryPanel();
                });
                body.appendChild(row);
            }
        };

        addSection('Закреплённые', pins);
        addSection('Недавние', rec);
    }

    // ======================= FAB overlay =======================
    function buildScrollOverlay(panel){
        if(scrollOverlay) scrollOverlay.remove();

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

        const ro=new ResizeObserver(positionOverlay);
        ro.observe(panel); ro.observe(list);

        const updateOpacity = ()=>{
            const nearTop = list.scrollTop < 8;
            const nearBot = list.scrollTop + list.clientHeight > list.scrollHeight - 8;
            btnTop.style.opacity = nearTop ? '.0' : '.45';
            btnBot.style.opacity = nearBot ? '.0' : '.45';
        };
        updateOpacity();
        list.addEventListener('scroll', updateOpacity, {passive:true});
    }

    // ======================= А В Т О К О М П Л И Т (устойчивый + фаззи) =======================
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
    function buildIndexFromDom(){
        if(!panelInstance) return [];
        const rows=findAllRows(panelInstance);
        const out=[];
        const seen=new Set();
        for(const row of rows){
            const id=row.dataset.id;
            if(!id || seen.has(id)) continue;
            seen.add(id);
            const title=(row.dataset.title || row.querySelector('.vibe-acc-title')?.textContent || '').trim();
            const pathArr=getPathArrayFromRow(row);
            const pathIds=getPathIdArrayFromRow(row);
            const type=row.querySelector('.vibe-acc-expand') ? 'category' : 'section';
            out.push({id, title, type, path:pathArr, pathIds});
        }
        return out;
    }
    function subseqScore(q, t){
        let qi=0, ti=0, hits=0, streak=0, bonus=0;
        while(qi<q.length && ti<t.length){
            if(q[qi]===t[ti]){ hits++; streak++; bonus += (streak>=2? 2 : 1); qi++; ti++; }
            else { streak=0; ti++; }
        }
        if(qi<q.length) return 0;
        return 30 + Math.min(40, bonus);
    }
    function tokenScore(q, t){
        const qTokens = normBase(q).toLowerCase().split(' ').filter(Boolean);
        const tTokens = new Set(normBase(t).toLowerCase().split(' ').filter(Boolean));
        let got=0;
        for(const tok of qTokens){ if(tTokens.has(tok)) got++; }
        return got*12;
    }
    function scoreItem(item, query, pinIdsSet){
        const q = norm(query);
        const title = norm(item.title||'');
        const idStr = String(item.id||'');
        const pathStr = norm((item.path||[]).join(' > '));

        let s = 0;
        if(idStr.startsWith(query)) s += 180;
        if(idStr.includes(query))  s += 90;

        if(title.startsWith(q)) s += 140;
        else if(title.includes(q)) s += 90;
        else s += subseqScore(q, title);

        if(pathStr.startsWith(q)) s += 70;
        else if(pathStr.includes(q)) s += 45;
        else s += Math.floor(subseqScore(q, pathStr)/2);

        s += tokenScore(query, (item.title||'')) / 2;
        s += tokenScore(query, (item.path||[]).join(' ')) / 2;

        if(pinIdsSet?.has(item.id)) s += 40;

        return s;
    }
    function updateAutocomplete(query){
        if(!acBox) return;
        if(!query || document.activeElement!==searchInput){ hideAutocomplete(); return; }
        if(query.includes('>')){ hideAutocomplete(); return; }

        const dom = buildIndexFromDom();
        const mapItems = Array.from(nodeMap.values()).map(n=>({
            id:n.id, title:n.title, type:n.type, path:getPathArrayFromMap(n.id), pathIds:getPathIdArray(n.id)
        }));

        const hist = loadHistory();
        const pins = loadPins();
        const pinSet = new Set(pins.map(p=>p.id));

        const byId = new Map();
        const put = (it) => {
            if(!it?.id) return;
            if(!byId.has(it.id)) byId.set(it.id, it);
            else {
                const cur = byId.get(it.id);
                if((!cur.title || cur.title.length<it.title?.length) && it.title) cur.title = it.title;
                if((!cur.path || cur.path.length<it.path?.length) && it.path) cur.path = it.path;
                if((!cur.pathIds || cur.pathIds.length<it.pathIds?.length) && it.pathIds) cur.pathIds = it.pathIds;
                if(!cur.type && it.type) cur.type = it.type;
            }
        };
        dom.forEach(put); mapItems.forEach(put); hist.forEach(put); pins.forEach(put);

        const arr = Array.from(byId.values()).filter(it=>{
            const q=norm(query);
            return (
                String(it.id).includes(query) ||
                norm(it.title||'').includes(q) ||
                norm((it.path||[]).join(' > ')).includes(q) ||
                subseqScore(q, norm(it.title||''))>0 ||
                subseqScore(q, norm((it.path||[]).join(' > ')))>0
            );
        }).map(it=>({ it, sc: scoreItem(it, query, pinSet) }))
          .sort((a,b)=> b.sc - a.sc).slice(0, 20).map(x=>x.it);

        if(!arr.length){ hideAutocomplete(); return; }

        acBox.innerHTML=arr.map((it,i)=>`
            <div class="vibe-ac-item ${i===0?'active':''}" data-id="${it.id}">
                <div class="vibe-ac-id">${it.id}</div>
                <div>
                    <div class="vibe-ac-title">${escapeHTML(it.title||'')}</div>
                    <div class="vibe-ac-path">${escapeHTML((it.path||[]).join(' > '))}</div>
                </div>
            </div>
        `).join('');
        acBox.style.display='block'; acActiveIdx=0;

        acBox.querySelectorAll('.vibe-ac-item').forEach(item=>{
            item.addEventListener('click', ()=>{
                const id=item.getAttribute('data-id'); hideAutocomplete(); if(id) jumpToId(id);
            });
        });
    }

    // ======================= П А Р С И Н Г / F E T C H =======================
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
        let doc=document.implementation.createHTMLDocument('');
        doc.documentElement.innerHTML=html;

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

    // ======================= Р Е Н Д Е Р =======================
    async function renderList(container, items){
        container.innerHTML='';
        if(!items || !items.length){
            let empty=document.createElement('div'); empty.className='vibe-acc-empty'; empty.textContent='Нет подкатегорий или разделов.'; container.appendChild(empty); return;
        }
        for(let item of items) container.appendChild(renderRow(item));
    }

    function renderRow(item){
        let row=document.createElement('div');
        row.className='vibe-acc-row';
        row.dataset.title=item.title;
        row.dataset.id=item.id;

        // ID (клик — ID, Alt — ПОЛНЫЙ путь из DOM)
        let idSpan=document.createElement('span');
        idSpan.className='vibe-acc-id';
        idSpan.textContent=item.id;
        idSpan.title='Клик — скопировать ID (в отдельной строке). Alt+клик — скопировать полный путь.';
        idSpan.onclick=function (e){
            e.stopPropagation();
            if(e.altKey){
                const rowEl = idSpan.closest('.vibe-acc-row');
                const path  = rowEl ? getPathStringFromRow(rowEl) : getPathString(item.id);
                copyToClipboard(path);
                idSpan.classList.add('vibe-id-copied'); idSpan.textContent='Путь скопирован!';
                setTimeout(()=>{ idSpan.textContent=item.id; idSpan.classList.remove('vibe-id-copied'); }, 1100);
            }else{
                copyToClipboard(String(item.id));
                idSpan.classList.add('vibe-id-copied'); idSpan.textContent='Скопировано!';
                setTimeout(()=>{ idSpan.textContent=item.id; idSpan.classList.remove('vibe-id-copied'); }, 1100);
            }
        };
        row.appendChild(idSpan);

        // Название
        let titleSpan=document.createElement('span');
        titleSpan.className='vibe-acc-title';
        titleSpan.textContent=item.title;
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
            expand.onclick=async function(e){
                e.stopPropagation();
                if(row.dataset.opened==='true'){
                    let sub=row.nextSibling;
                    if(sub && sub.classList.contains('vibe-acc-sublist')) sub.remove();
                    row.dataset.opened='false';
                    expand.innerHTML='<span style="display:inline-block;transform:translateY(-2px)">▼</span>';
                }else{
                    row.dataset.opened='true';
                    expand.innerHTML='<span style="display:inline-block;transform:rotate(180deg);transform-origin:center">▲</span>';
                    let sub=document.createElement('div'); sub.className='vibe-acc-sublist';
                    sub.innerHTML='<div class="vibe-acc-empty">Загрузка...</div>';
                    row.parentNode.insertBefore(sub, row.nextSibling);
                    const children=await fetchChildren(item.id);
                    await renderList(sub, children);
                    addToHistory(item.id);
                    updateToolbar();
                    updateSearchMatches(false);
                }
            };
            btns.appendChild(expand);
        }
        row.appendChild(btns);

        // клики: выделение Ctrl/Shift, обычный — открыть/в историю
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
                if(item.type==='category' && !e.target.closest('.vibe-acc-btns')) btns.querySelector('.vibe-acc-expand')?.click();
            }
        });

        return row;
    }

    // ======================= О С Н О В Н О Е  Д Е Р Е В О =======================
    function getMainItems(){
        let mainTbl=document.querySelector('table[cellpadding="2"] table');
        if(!mainTbl) return [];
        return parseCategoryTable(mainTbl, null);
    }

    // ======================= ПОШАГОВОЕ РАСКРЫТИЕ =======================
    function findRowInPanel(id){
        return panelInstance?.querySelector(`.vibe-acc-row[data-id="${CSS.escape(String(id))}"]`) || null;
    }
    function findRowByTitleAmong(container, title){
        const t=norm(title);
        return Array.from(container.querySelectorAll(':scope > .vibe-acc-row')).find(el=>norm(el.dataset.title)===t) || null;
    }
    function findRowByTitleInTree(title){
        const t=norm(title);
        const main=panelInstance?.querySelector('.vibe-acc-list');
        if(!main) return null;
        const stack=[...main.querySelectorAll(':scope > .vibe-acc-row')];
        while(stack.length){
            const row=stack.shift();
            if(norm(row.dataset.title)===t) return row;
            const sub=row.nextElementSibling;
            if(sub?.classList?.contains('vibe-acc-sublist')){
                stack.push(...sub.querySelectorAll(':scope > .vibe-acc-row'));
            }
        }
        return null;
    }
    async function ensureMainLoaded(){
        const list=panelInstance.querySelector('.vibe-acc-list');
        if(!list.querySelector('.vibe-acc-row')){
            const main=getMainItems();
            await renderList(list, main);
        }
    }
    async function waitForChildren(row){
        let tries=0;
        while(tries<160){ // ~8с
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
        const btn=row.querySelector('.vibe-acc-expand'); if(!btn) return; // не категория
        btn.click();
        await waitForChildren(row);
        addToHistory(id);
    }
    async function openPathByIds(pathIds){
        if(!panelInstance || !Array.isArray(pathIds) || !pathIds.length) return;
        await ensureMainLoaded();
        for(let i=0;i<pathIds.length;i++){
            const id=String(pathIds[i]);
            let row=findRowInPanel(id);
            if(!row && i>0){
                const parentId=String(pathIds[i-1]);
                await expandCategory(parentId);
                row=findRowInPanel(id);
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
                targetRow.classList.add('vibe-acc-find-match');
                setTimeout(()=>targetRow.classList.remove('vibe-acc-find-match'), 1200);
            }
            currentRow = targetRow;
        }
    }
    function focusRow(id){
        let row=findRowInPanel(id);
        if(row){ row.scrollIntoView({block:'center',behavior:'smooth'}); row.classList.add('vibe-acc-find-match'); setTimeout(()=>row.classList.remove('vibe-acc-find-match'),1200); }
        else showToast('Элемент пока не в DOM — раскройте нужного родителя');
    }

    // ======================= П Р Ы Ж К И =======================
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

    // ======================= П О И С К (подсветка на панели) =======================
    function findAllRows(panel){
        let arr=[]; let stack=Array.from(panel.querySelectorAll('.vibe-acc-list > .vibe-acc-row'));
        while(stack.length){
            let el=stack.shift();
            if(el.classList.contains('vibe-acc-row')) arr.push(el);
            let sub=el.nextSibling;
            if(sub && sub.classList.contains('vibe-acc-sublist')) stack.push(...sub.querySelectorAll(':scope > .vibe-acc-row'));
        }
        return arr;
    }
    function updateSearchMatches(jumpToFirst=true){
        if(!panelInstance) return;
        let val=searchInput.value.trim();
        searchMatches=[]; matchIdx=0; idSearchMode=false;

        if(val.includes('>')){ updateFindInfo(); return; }

        let all=findAllRows(panelInstance);
        all.forEach(row=>{
            let titleEl=row.querySelector('.vibe-acc-title');
            if(titleEl) titleEl.innerHTML=escapeHTML(titleEl.textContent);
            row.classList.remove('vibe-acc-find-match');
        });

        if(/^\d{4,}$/.test(val)){
            let found=all.find(row=>row.dataset.id===val);
            if(found){ searchMatches=[found]; idSearchMode=true; }
            else{
                findNodeById(val).then(node=>{
                    if(node) showToast(`ID: ${val}\n${node.type}: ${node.title}`);
                    else showToast('Категория или раздел не найдены');
                });
            }
        }else if(val.length>0){
            const q=norm(val);
            const regSafe = new RegExp(val.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
            all.forEach(row=>{
                const titleRaw=row.querySelector('.vibe-acc-title')?.textContent || '';
                const tNorm=norm(titleRaw);
                if(tNorm.includes(q) || subseqScore(q, tNorm)>0){
                    searchMatches.push(row);
                    const titleEl=row.querySelector('.vibe-acc-title');
                    if(titleEl){
                        titleEl.innerHTML=escapeHTML(titleRaw).replace(regSafe, m=>`<span style="background:#ffe37a;color:#181920">${m}</span>`);
                    }
                }
            });
        }
        if(jumpToFirst) goToMatch(1,true,false);
        updateFindInfo();
    }
    function updateFindInfo(){
        let info=panelInstance.querySelector('#vibe-acc-find-info');
        if(!searchMatches.length) info.textContent='';
        else info.textContent=(matchIdx ? (matchIdx+1) : 1) + '/' + searchMatches.length;
    }
    function goToMatch(dir, forceToFirst, scrollNow=false){
        if(!searchMatches.length) return;
        if(forceToFirst) matchIdx=0; else matchIdx=(matchIdx + dir + searchMatches.length) % searchMatches.length;
        searchMatches.forEach((row,idx)=>row.classList.toggle('vibe-acc-find-match', idx===matchIdx));
        let match=searchMatches[matchIdx];
        if(match && (scrollNow || idSearchMode)){ match.scrollIntoView({block:'center',behavior:'smooth'}); match.focus && match.focus(); }
        updateFindInfo();
    }

    // ======================= Т У Л Б А Р =======================
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

    // ======================= О Т К Р Ы Т И Е  П А Н Е Л И  /  CTRL+F =======================
    async function openPanelAndInit(){
        let panel=document.getElementById('vibe-acc-panel');
        if(!panel){
            // сбрасываем состояние только при первом открытии
            nodeMap.clear(); selectedIds.clear();

            panel=createPanel();
            let list=panel.querySelector('.vibe-acc-list');
            let main=getMainItems();
            await renderList(list, main);
            updateToolbar();
            updateSearchMatches();
        }
        // фокус в поиск
        const input = panel.querySelector('.vibe-acc-search');
        input.focus();
        input.select && input.select();
    }

    // Глобальный перехват Ctrl+F (по настройке)
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
    // Ставим слушатель на ранней стадии — до открытия панели и при любых фокусах
    window.addEventListener('keydown', globalCtrlFHandler, true);
    document.addEventListener('keydown', globalCtrlFHandler, true);

    // ======================= П У С К (кнопка-лента) =======================
    function bindTrigger(){
        let trig=document.createElement('button');
        trig.textContent='⮞ Каталоги (Vibe)';
        trig.style=`
            position:fixed; top:18px; right:0; z-index:99998;
            background:#ffe37a; border-radius:12px 0 0 12px; font-size:19px;
            font-family:'JetBrains Mono',monospace,sans-serif; font-weight:700;
            padding:13px 28px 13px 19px; box-shadow:0 6px 24px #000b; cursor:pointer; transition:background .16s;
        `;
        trig.onmouseenter=()=>trig.style.background='#fffbe3';
        trig.onmouseleave=()=>trig.style.background='#ffe37a';
        trig.onclick=()=>{ openPanelAndInit(); };

        document.body.appendChild(trig);

        // Горячая клавиша истории (J) — только когда панель открыта
        document.addEventListener('keydown',(e)=>{
            const panel=document.getElementById('vibe-acc-panel');
            if(panel && e.key.toLowerCase()==='j' && panel.contains(document.activeElement)){
                e.preventDefault();
                toggleHistoryPanel();
            }
        }, true);
    }

    setTimeout(bindTrigger, 600);
})();
