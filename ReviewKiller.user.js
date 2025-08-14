// ==UserScript==
// @name         Review Killer
// @version      2.3
// @description  Удаление отзывов, письма продавцам; EPIC: The Musical Edition
// @match        https://my.digiseller.ru/asp/inv_of_buyer.asp*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ReviewKiller.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ReviewKiller.user.js
// ==/UserScript==

(function() {
  'use strict';

  // ================= БАЗОВЫЕ КОНСТАНТЫ =================
  const LS_KEY = 'banana_monkey_ids_v1';

  // EPIC-фразы для логов
  const EPIC = {
    start: ['Get in the water', 'Full speed ahead'],
    success: ['Luck runs out'],
    tough: ['Ruthlessness is mercy'],
    empathy: ['I can take the suffering from you'],
    error: ["I'm just a man"],
    wit: ['You rely on wit, and people die on it'],
    open: ['Greet the world with open arms'],
    caution: ['Remember Icarus'],
  };
  const q = (t) => `<span class="epic-quote">“${t}”</span>`;

  // Кэши (все — в памяти вкладки)
  const greetNeededCache = Object.create(null); // надо ли вставлять "Здравствуйте!" сегодня
  const firstLangCache   = Object.create(null); // авто-язык по самой первой странице
  const blockLangMap     = Object.create(null); // текущий язык блока (RU/EN)

  // -------- Контекстный замок продавца (фикс «прыжков» между продавцами)
  const CONTEXT = { lock:false, sellerId:null };
  const fromMessagesRef = /\/asp\/seller_messages\.asp/i.test(document.referrer);

  // ================== СТИЛИ (укорочено) ==================
  const css = `
  @import url('https://fonts.googleapis.com/css2?family=UnifrakturCook:wght@700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700&display=swap');
  #epic-killer-root{position:fixed;top:30px;right:34px;z-index:99999;display:flex;pointer-events:none;font-family:'Montserrat',Arial,sans-serif}
  #epic-main-panel{--ink:#ffeebd;--gold:#f6cd57;--gold2:#ffe25f;--bg1:#19193a;--bg2:#37216d;--card:#251f4ad6;--field:#191c2bd9;--ring:#ffd76a;
    background:linear-gradient(130deg,#19193a 85%,#37216d 100%);border:2.9px solid var(--gold);border-radius:19px;color:var(--ink);
    width:355px;min-height:48px;display:flex;flex-direction:column;pointer-events:auto;box-shadow:0 0 40px 9px #231e4b80,0 0 6px 2px #eec8574d}
  #epic-topbar{display:flex;align-items:center;gap:9px;padding:9px 15px 7px 19px;border-bottom:2px solid #f6cd57b0;background:linear-gradient(90deg,#25204a 85%,#473b7b 100%);border-radius:16px 16px 0 0}
  #epic-flag-btn{margin-left:auto;background:none;border:none;font-size:29px;color:var(--gold2);cursor:pointer;border-radius:50%;padding:0 7px 0 3px;text-shadow:0 2px 8px #1a004eae,0 0 10px #ffda55d5}
  /* Плавное сворачивание/разворачивание (фикс дерганий) */
  #epic-content-wrap{height:0;opacity:0;padding:0 23px 0 21px;overflow:hidden;display:block;transition:height .32s cubic-bezier(.25,.8,.25,1),opacity .22s ease,padding .22s ease;will-change:height,opacity,padding}
  #epic-main-panel:not(.epic-collapsed) #epic-content-wrap{height:var(--epic-content-height,auto);opacity:1;padding:20px 23px 14px 21px}
  #epic-id-row{display:flex;align-items:center;gap:7px}
  #epic-id-input{width:100%;height:43px;font-size:16px;resize:none;border:1.6px solid #f6cd57b0;border-radius:8px;background:var(--field);color:var(--ink);padding:7px 9px;box-shadow:0 0 7px #f6cd5742 inset}
  #epic-kill-btn{height:43px;min-width:110px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:bold;font-family:'UnifrakturCook',serif;background:linear-gradient(93deg,#f6cd57 65%,#ffe25f 100%);color:#2b1d0a;border:none;border-radius:9px}
  #epic-del-btn{background:linear-gradient(90deg,#282e62 35%,#eac762 120%);color:#fffbe7;font-family:'UnifrakturCook',serif;font-size:16px;border:none;border-radius:7px;padding:7px 18px;min-width:135px}
  #epic-clear-btn{background:linear-gradient(90deg,#373f83 35%,#d7d5e3 120%);color:#fffbe9;font-size:15px;border:none;border-radius:7px;padding:6px 11px}
  #epic-log{background:linear-gradient(180deg,#1f1b39,#241f3e);border:1.5px solid #f6cd5742;border-radius:7px;height:56px;width:100%;font-size:13px;overflow-y:auto;padding:5px 6px;color:#ffe25f}
  .epic-quote{font-style:italic;opacity:.9;color:#ffd87a}
  .epic-msg-block{margin-top:8px;background:#251f4ad6;border:1.4px solid #ffe25f4a;border-radius:12px;padding:9px 10px;display:flex;gap:10px}
  .epic-leftcol{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:39px}
  .epic-translate-btn,.epic-copy-btn,.epic-send-btn{width:31px;height:31px;border-radius:9px;border:1px solid #0000;cursor:pointer;display:grid;place-items:center}
  .epic-translate-btn{border-color:#e9c85f99;background:#ffe25f;color:#282a4d;font-weight:900}
  .epic-copy-btn{border-color:#eac55b66;background:linear-gradient(96deg,#ffe25f 70%,#f6cd57 100%);color:#342810;font-weight:700}
  .epic-send-btn{border-color:#7bb9de66;background:linear-gradient(180deg,#d9f2ff,#a7daf6);color:#194b62}
  .epic-plane{width:18px;height:18px;display:block}
  .epic-msg-content{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:6px}
  .epic-msg-block label{font-size:13px;font-weight:800;color:#ffeebd}
  .epic-msg-area{width:100%;min-height:76px;border:1px solid #f6cd5740;border-radius:8px;background:linear-gradient(180deg,#1f1b39cc,#23214acc);color:#ffeebd;line-height:1.35;font-size:13.6px;padding:10px 12px;resize:none;overflow:hidden;outline:none}
  .epic-sep{height:1px;border:none;margin:8px 0 7px 0;background:repeating-linear-gradient(90deg,#ffe25f,#fffbce 6px,#ffe25f 12px)}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ================== РАЗМЕТКА UI ==================
  const root = document.createElement('div'); root.id = 'epic-killer-root';
  const panel = document.createElement('div'); panel.id = 'epic-main-panel'; panel.classList.add('epic-collapsed');
  panel.innerHTML = `
    <div id="epic-topbar">
      <button id="epic-del-btn" class="epic-btn">На удаление</button>
      <button id="epic-clear-btn" class="epic-btn">Очистка</button>
      <button id="epic-flag-btn" aria-expanded="false">🏳️</button>
    </div>
    <div id="epic-content-wrap"><div id="epic-content-inner">
      <div id="epic-id-row">
        <textarea id="epic-id-input" placeholder="ID заказов"></textarea>
        <button id="epic-kill-btn" class="epic-btn">Удалить отзыв</button>
      </div>
      <div id="epic-log"></div>
      <hr class="epic-sep">
      <div id="epic-multimsg-block"></div>
    </div></div>
  `;
  root.appendChild(panel); document.body.appendChild(root);

  // ================== ССЫЛКИ НА ЭЛЕМЕНТЫ ==================
  const delBtn = panel.querySelector('#epic-del-btn');
  const clearBtn = panel.querySelector('#epic-clear-btn');
  const flagBtn = panel.querySelector('#epic-flag-btn');
  const killBtn = panel.querySelector('#epic-kill-btn');
  const logDiv  = panel.querySelector('#epic-log');
  const input   = panel.querySelector('#epic-id-input');
  const wrap    = panel.querySelector('#epic-content-wrap');
  const inner   = panel.querySelector('#epic-content-inner');

  // --- пересчёт высоты для плавной анимации
  function recalcH(){ wrap.style.setProperty('--epic-content-height', inner.scrollHeight + 'px'); }
  if ('ResizeObserver' in window) new ResizeObserver(recalcH).observe(inner);

  // ================== ЛОГГЕР ==================
  function epicLog(msg){ const t = new Date().toLocaleTimeString(); logDiv.innerHTML += `<div>[${t}] ${msg}</div>`; logDiv.scrollTop = logDiv.scrollHeight; recalcH(); }

  // ================== ШАБЛОНЫ ==================
  const templates = {
    ru: { greet:'Здравствуйте!', one:id=>`Отрицательный отзыв по заказу ${id} был аннулирован.`, many:ids=>`Отрицательные отзывы по заказам ${ids.join(', ')} были аннулированы.` },
    en: { greet:'Hello!',        one:id=>`The negative review for order ${id} has been cancelled.`, many:ids=>`Negative reviews for orders ${ids.join(', ')} have been cancelled.` }
  };
  const templatesAPI = {
    // Сборка текста письма с учётом языка и необходимости приветствия
    make(ids, lang, needGreet){
      const t = templates[lang];
      const body = (ids.length===1) ? t.one(ids[0]) : (ids.length>1 ? t.many(ids) : '_______');
      return needGreet ? `${t.greet}\n\n${body}` : body;
    }
  };

  // ================== ПАРС ID (переносы/пробелы/запятые) ==================
  function parseIds(text){ return text.split(/[,\s]+/).map(t=>t.trim()).filter(t=>/^\d+$/.test(t)); }

  function addIdToInput(newId){
    const set = new Set(parseIds(input.value));
    if (set.has(newId)) return false;
    const raw = input.value.trim();
    input.value = (raw ? raw+'\n' : '') + newId;
    return true;
  }

  // ================== ХЕЛПЕРЫ ==================
  function autosizeTA(ta){ if (!ta) return; ta.style.height='auto'; ta.style.height = ta.scrollHeight + 'px'; }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
  function todayRu(){ const d=new Date(); const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear(); return `${dd}.${mm}.${yyyy}`; }
  function toDoc(html){ return new DOMParser().parseFromString(html, 'text/html'); }

  // --- Достаём id_i из URL без учёта регистра ключа (ID_I / id_i / Id_I)
  function getOrderIdFromUrl(href = window.location.href) {
    try {
      const url = new URL(href, location.origin);
      for (const [k, v] of url.searchParams) {
        if (k.toLowerCase() === 'id_i' && /^\d+$/.test(String(v))) return String(v);
      }
    } catch (e) {}
    const m = href.match(/[?&]id_i=(\d+)/i);
    return m ? m[1] : null;
  }

  // ================== СЕТЕВЫЕ ==================
  // Удаление самого отзыва по ID заказа
  async function epicDeleteOrderReview(id){
    try{ await fetch(`/asp/inv_of_buyer.asp?oper=kill&id_i=${encodeURIComponent(id)}`, { credentials:'same-origin' }); return true; }catch{ return false; }
  }

  // По ID заказа вытягиваем sellerId и ник
  async function epicGetSellerInfoByOrderId(orderId){
    try{
      const html = await fetch(`/asp/inv_of_buyer.asp?id_i=${orderId}`, { credentials:'same-origin' }).then(r=>r.text());
      const m = html.match(/seller_info\.asp\?ID_S=(\d+)/i);
      const sellerId = m ? m[1] : null;
      let nickname = null;
      const doc = toDoc(html);
      const row = Array.from(doc.querySelectorAll('tr')).find(tr=>{
        const td = tr.querySelector('td.namerow'); return td && td.textContent.replace(/\s/g,'').toLowerCase().includes('продавец:');
      });
      if (row){ const td = row.querySelector('td.inforow'); if (td){ const t = td.childNodes[0]?.nodeValue || ''; nickname = t.trim(); } }
      return { sellerId, nickname };
    }catch{ return { sellerId:null, nickname:null }; }
  }

  // Удаление сопутствующего письма об отзыве
  async function epicDeleteNegativeMessage(orderId, sellerId){
    try{
      const html = await fetch(`/asp/seller_messages.asp?id_s=${sellerId}`, { credentials:'same-origin' }).then(r=>r.text());
      const msgBlockReg = new RegExp(
        `<font[^>]*>(?:Отрицательный отзыв по заказу ${orderId} аннулирован согласно решению администрации площадки\\.|Negative feedback on order ${orderId} is canceled by decision of the site administration\\.)<\\/font>[\\s\\S]{0,500}?<a[^>]+href="([^"]*del=\\d+[^"]*)"[^>]*>`,
        'i'
      );
      const found = html.match(msgBlockReg);
      if (found && found[1]) {
        let delUrl = found[1];
        if (delUrl.startsWith("?")) delUrl = "/asp/seller_messages.asp"+delUrl;
        else if (!delUrl.startsWith("http")) delUrl = "/asp/"+delUrl;
        await fetch(delUrl, { credentials:'same-origin' });
        return true;
      }
      return false;
    }catch{ return false; }
  }

  // ======= Переход к самой старой странице диалога (умно) =======
  async function fetchOldestPageHTML(sellerId){
    let url = `/asp/seller_messages.asp?id_s=${sellerId}`;
    for (let hops=0; hops<12; hops++){
      const html = await fetch(url, { credentials:'same-origin' }).then(r=>r.text());
      const links = [...html.matchAll(/<a[^>]+href="([^"]*seller_messages\.asp[^"]+)"[^>]*>(\d+)<\/a>/gi)];
      const brackets = [...html.matchAll(/\[(\d+)\]/g)];
      const lastLink = links.length ? links[links.length-1] : null;
      const lastBracketNum = brackets.length ? parseInt(brackets[brackets.length-1][1],10) : 0;
      const lastLinkNum = lastLink ? parseInt(lastLink[2],10) : 0;
      if (lastBracketNum && lastBracketNum > lastLinkNum) return html;
      if (lastLink){
        let href = lastLink[1];
        if (href.startsWith("?")) href = "/asp/seller_messages.asp"+href;
        else if (!href.startsWith("http") && !href.startsWith("/asp/")) href = "/asp/"+href;
        url = href; continue;
      }
      return html;
    }
    return await fetch(`/asp/seller_messages.asp?id_s=${sellerId}`, { credentials:'same-origin' }).then(r=>r.text());
  }

  // Определяем язык самого раннего исходящего сообщения с площадки
  function extractEarliestTextLang(html){
    const doc = toDoc(html);
    const candidates = Array.from(doc.querySelectorAll('table[width="100%"][cellpadding="2"]'));
    let rows = [];
    for (const tb of candidates){
      const trs = Array.from(tb.querySelectorAll('tr'));
      if (trs.some(tr => tr.querySelector('img[src*="mail_"]'))) { rows = trs; break; }
    }
    if (!rows.length) return { lang:'ru', text:'' };

    const getText = (tr)=>{
      const p = tr.querySelector('p'); if (p && p.textContent.trim()) return p.textContent.trim();
      const f = tr.querySelector('font'); if (f && f.textContent.trim()) return f.textContent.trim();
      return '';
    };
    // Снизу вверх: сначала самое раннее исходящее письмо
    for (let i=rows.length-1; i>=0; i--){
      const tr = rows[i];
      if (tr.querySelector('img[src*="mail_out.gif"]')) {
        const t = getText(tr); if (t) return { lang: /[\u0400-\u04FF]/.test(t) ? 'ru' : 'en', text:t };
      }
    }
    // Если исходящего нет — берём самое раннее любое
    for (let i=rows.length-1; i>=0; i--){
      const tr = rows[i]; const t = getText(tr);
      if (t) return { lang: /[\u0400-\u04FF]/.test(t) ? 'ru' : 'en', text:t };
    }
    return { lang:'ru', text:'' };
  }

  async function getSellerInitialLang(sellerId){
    if (firstLangCache[sellerId]) return firstLangCache[sellerId];
    try{
      const html = await fetchOldestPageHTML(sellerId);
      const { lang } = extractEarliestTextLang(html);
      firstLangCache[sellerId] = lang;
      return lang;
    }catch{ return 'ru'; }
  }

  // Было ли сегодня исходящее письмо от нас
  async function epicHasOutgoingToday(sellerId){
    try{
      const html = await fetch(`/asp/seller_messages.asp?id_s=${sellerId}`, { credentials:'same-origin' }).then(r=>r.text());
      const today = todayRu();
      const re = /<tr[^>]*>[\s\S]*?<td class="td_title"[^>]*>\s*(\d{2}\.\d{2}\.\d{4})[\s\S]*?<img[^>]+mail_(out|in)\.gif/gi;
      let m, hasOut=false;
      while((m = re.exec(html)) !== null){ if (m[1]===today && m[2]==='out'){ hasOut=true; break; } }
      return hasOut;
    }catch{ return false; }
  }

  async function ensureGreetNeeded(sellerId){
    if (sellerId in greetNeededCache) return greetNeededCache[sellerId];
    const hasOut = await epicHasOutgoingToday(sellerId);
    greetNeededCache[sellerId] = !hasOut;
    return greetNeededCache[sellerId];
  }

  // ================== ГРУППИРОВКА ПО ПРОДАВЦАМ ==================
  async function getMultiSellerMap(ids){
    const map = {};
    await Promise.all(ids.map(async (id)=>{
      const v = id.trim(); if (!/^\d+$/.test(v)) return;
      const info = await epicGetSellerInfoByOrderId(v);
      const sid  = info.sellerId || 'unknown';
      const nick = info.nickname || sid;
      if (!map[sid]) map[sid] = { ids:[], nickname:nick };
      map[sid].ids.push(v); map[sid].nickname = nick;
    }));
    return map;
  }

  // ================== ОТРИСОВКА БЛОКОВ ПИСЕМ ==================
  async function drawAllSellerMsgs(all){
    // Контекстная фильтрация (если пришли из переписки и знаем конкретного продавца)
    let drawable = all;
    if (CONTEXT.lock && CONTEXT.sellerId && all[CONTEXT.sellerId]) {
      drawable = { [CONTEXT.sellerId]: all[CONTEXT.sellerId] };
    }

    const container = document.getElementById('epic-multimsg-block');
    container.innerHTML = "";

    for (const sid in drawable){
      const ids  = drawable[sid].ids;
      const nick = drawable[sid].nickname || sid;

      if (!(sid in blockLangMap)) blockLangMap[sid] = await getSellerInitialLang(sid);
      const needGreet = await ensureGreetNeeded(sid);

      const block = document.createElement('div'); block.className = 'epic-msg-block';
      const left  = document.createElement('div'); left.className = 'epic-leftcol';

      const translateBtn = document.createElement('button');
      translateBtn.className = 'epic-translate-btn';
      translateBtn.title = (blockLangMap[sid]==='ru') ? 'Русская версия' : 'English version';
      translateBtn.textContent = (blockLangMap[sid]==='ru') ? 'RU' : 'EN';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'epic-copy-btn'; copyBtn.title = 'Скопировать как таблицу: id / ник / Удалён'; copyBtn.textContent = '📋';
      copyBtn.onclick = () => {
        if (!nick || ids.length===0) return;
        const rows = ids.map(id => [id, nick, 'Удалён'].join('\t')).join('\n');
        navigator.clipboard.writeText(rows)
          .then(()=>epicLog('<span style="color:#ffe25f">Скопировано в табличном формате.</span>'),
                ()=>epicLog(`<span style="color:#ffb6b6">Ошибка копирования.</span> ${q(EPIC.empathy[0])}`));
      };

      const mailBtn = document.createElement('button');
      mailBtn.className = 'epic-send-btn'; mailBtn.title = 'Отправить письмо этому продавцу';
      mailBtn.innerHTML = `<svg class="epic-plane" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21V3l21 9-8 2 2 7-6-8-9 8z" fill="currentColor"/></svg>`;

      left.appendChild(translateBtn);
      left.appendChild(copyBtn);
      left.appendChild(mailBtn);

      const content = document.createElement('div'); content.className = 'epic-msg-content';
      content.innerHTML = `<label><b>${nick}</b></label>
        <textarea class="epic-msg-area">${templatesAPI.make(ids, blockLangMap[sid], needGreet)}</textarea>`;
      const ta = content.querySelector('textarea'); autosizeTA(ta); ta.addEventListener('input', ()=>{ autosizeTA(ta); recalcH(); });

      block.appendChild(left); block.appendChild(content); container.appendChild(block);

      // Переключение RU/EN (визуально: RU — русская версия)
      translateBtn.onclick = () => {
        blockLangMap[sid] = (blockLangMap[sid]==='ru') ? 'en' : 'ru';
        translateBtn.textContent = (blockLangMap[sid]==='ru') ? 'RU' : 'EN';
        translateBtn.title = (blockLangMap[sid]==='ru') ? 'Русская версия' : 'English version';
        ta.value = templatesAPI.make(ids, blockLangMap[sid], needGreet);
        autosizeTA(ta); recalcH();
      };

      // Отправка письма
      mailBtn.onclick = async (e)=>{
        e.stopPropagation(); mailBtn.disabled = true;
        const messageText = ta.value.trim();
        if (!messageText || messageText.includes('_______')){
          epicLog('<span style="color:#ffb6b6">Сообщение пустое, отправка отменена.</span>'); mailBtn.disabled=false; return;
        }
        epicLog(`<b>Пробую отправить письмо продавцу #${sid} (${nick}).</b> ${q(EPIC.open[0])}`);
        const params = new URLSearchParams(); params.append('txt_Message', messageText.replace(/\n/g,'\r\n'));
        try{
          const resp = await fetch(`/asp/new_message.asp?id_s=${sid}&new`, { method:'POST', body:params.toString(), credentials:'same-origin', headers:{'Content-Type':'application/x-www-form-urlencoded'} });
          const text = await resp.text();
          if (resp.ok && !text.includes('textarea') && !text.includes('name="txt_Message"')) {
            epicLog(`<span style="color:#87ffbd">Сообщение отправлено.</span>`);
          } else {
            epicLog(`<span style="color:#ffe25f">Отправка завершена, но проверьте переписку вручную.</span> ${q(EPIC.wit[0])}`);
          }
        }catch(e){ epicLog(`<span style="color:#ffb6b6">Ошибка отправки: ${e}</span> ${q(EPIC.error[0])}`); }
        mailBtn.disabled = false;
      };
    }
    recalcH();
  }

  // ================== РЕАКЦИЯ НА ВВОД ID ==================
  function loadIds(){ const d = localStorage.getItem(LS_KEY); if (d!==null) input.value = d; }
  function saveIds(v){ localStorage.setItem(LS_KEY, v); }
  function updateKillBtnText(){ const ids = parseIds(input.value); killBtn.textContent = ids.length>1 ? 'Удалить отзывы' : 'Удалить отзыв'; }

  async function alwaysDraw(){
    const ids = parseIds(input.value);
    if (ids.length===0){ document.getElementById('epic-multimsg-block').innerHTML=""; updateKillBtnText(); recalcH(); return; }
    const all = await getMultiSellerMap(ids);
    await drawAllSellerMsgs(all);
    updateKillBtnText();
  }

  input.addEventListener('input', ()=>{ saveIds(input.value); alwaysDraw(); updateKillBtnText(); });
  window.addEventListener('storage', (e)=>{ if (e.key===LS_KEY && e.newValue!==input.value){ input.value = e.newValue || ''; alwaysDraw(); updateKillBtnText(); }});

  // ================== КНОПКИ ТОПБАРА ==================
  clearBtn.onclick = ()=>{ input.value=''; saveIds(''); epicLog(`<span style="color:#ffe25f">Очередь ID очищена.</span> ${q(EPIC.empathy[0])}`); alwaysDraw(); updateKillBtnText(); };

  // >>> КНОПКА «На удаление» — теперь учитываем любой регистр ID_I/id_i <<<
  delBtn.onclick = ()=>{
    const id = getOrderIdFromUrl();           // <-- Берём ID без учёта регистра ключа
    if (id) {
      const added = addIdToInput(id);
      if (added){ saveIds(input.value); epicLog(`<span style="color:#ffe25f">ID ${id} добавлен в очередь.</span> ${q(EPIC.start[0])}`); alwaysDraw(); updateKillBtnText(); }
      else epicLog(`<span style="color:#ffe25f">ID ${id} уже в списке.</span>`);
    } else {
      epicLog('<span style="color:#ffe25f">ID не найден в ссылке.</span>');
    }
  };

  // Сворачивание/разворачивание панели
  const contentWrap = panel.querySelector('#epic-content-wrap');
  const contentInner = panel.querySelector('#epic-content-inner');
  function recalcContent(){ contentWrap.style.setProperty('--epic-content-height', contentInner.scrollHeight + 'px'); }
  flagBtn.onclick = ()=>{
    const willExpand = panel.classList.contains('epic-collapsed');
    recalcContent();
    requestAnimationFrame(()=>{
      panel.classList.toggle('epic-collapsed');
      flagBtn.setAttribute('aria-expanded', String(willExpand));
      flagBtn.innerHTML = willExpand ? '🏴‍☠️' : '🏳️';
      requestAnimationFrame(recalcContent);
    });
  };

  // ================== УДАЛЕНИЕ ОТЗЫВОВ ==================
  async function epicKill(){
    killBtn.disabled = true; delBtn.disabled = true; clearBtn.disabled = true;
    const idsAll = parseIds(input.value);
    epicLog(`<b>Старт пакетного удаления (${idsAll.length}).</b> ${q(EPIC.start[1])}`);
    if (idsAll.length>=20) epicLog(q(EPIC.caution[0]));

    const { selectionStart:s, selectionEnd:e } = input;
    const toDelete = (s!==e) ? parseIds(input.value.slice(s,e)) : idsAll;
    if (toDelete.length===0){ epicLog('<span style="color:#ffb6b6">Нет валидных ID для удаления.</span>'); killBtn.disabled=false; delBtn.disabled=false; clearBtn.disabled=false; return; }

    const perSeller = {};
    for (const id of toDelete){
      const info = await epicGetSellerInfoByOrderId(id);
      const sid = info.sellerId || 'unknown';
      const nick = info.nickname || sid;
      if (!perSeller[sid]) perSeller[sid] = { ids:[], nickname:nick };

      epicLog(`<b>⚡ Удаляю отзыв</b> <span style="color:#ffe25f">${id}</span> у <b>${nick}</b>. ${q(EPIC.start[0])}`);
      const ok1 = await epicDeleteOrderReview(id);
      epicLog(ok1 ? `<span style="color:#e0ffc0">✅ Отзыв ${id} удалён.</span> ${q(EPIC.success[0])}`
                  : `<span style="color:#ffb6b6">❌ Не удалось удалить ${id}.</span> ${q(EPIC.error[0])}`);

      await sleep(900);
      epicLog(`<span style="color:#ffe25f">Ищу и очищаю сопутствующее сообщение (${id}).</span>`);
      const ok2 = await epicDeleteNegativeMessage(id, sid);
      epicLog(ok2 ? `<span style="color:#ffe25f">🦍 Сообщение удалено.</span>` : `<span style="color:#ffe25f">🦧 Сообщение не найдено/не удалено.</span>`);

      perSeller[sid].ids.push(id); perSeller[sid].nickname = nick;
      await drawAllSellerMsgs(perSeller);
      await sleep(400);
    }
    epicLog(`<b>🏆 Готово. Удалено: ${toDelete.length}.</b> ${q(EPIC.tough[0])}`);
    killBtn.disabled = false; delBtn.disabled = false; clearBtn.disabled = false;
    alwaysDraw();
  }
  killBtn.onclick = epicKill;

  // ================== ИНИЦИАЛИЗАЦИЯ ==================
  // Включаем «контекстный замок» продавца, если пришли из переписки
  (async function initContextLock(){
    const currentOrderId = getOrderIdFromUrl();  // <-- используем новый хелпер
    if (fromMessagesRef && currentOrderId){
      CONTEXT.lock = true;
      try{
        const info = await epicGetSellerInfoByOrderId(currentOrderId);
        CONTEXT.sellerId = info.sellerId || null;
      }catch{ CONTEXT.sellerId = null; }
    }
  })();

  // первичная отрисовка
  const contentObserver = new ResizeObserver(recalcContent); contentObserver.observe(contentInner);
  (function boot(){
    const d = localStorage.getItem(LS_KEY); if (d!==null) input.value = d;
    alwaysDraw(); updateKillBtnText();
  })();

})();
