// ==UserScript==
// @name         Review Killer
// @version      2.0
// @description  Удаление отзывов, письма продавцам; EPIC: The Musical Edition
// @match        https://my.digiseller.ru/asp/inv_of_buyer.asp*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ReviewKiller.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ReviewKiller.user.js
// ==/UserScript==

(function () {
  'use strict';

  // --- Ключи и кэши ---
  const LS_KEY = 'banana_monkey_ids_v1';
  const greetNeededCache = Object.create(null);
  const firstLangCache = Object.create(null);   // автоопределённый язык по самой первой странице
  const blockLangMap = Object.create(null);     // текущий выбранный язык в блоке (RU/EN)

  // --- EPIC-цитаты для логгера ---
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

  // =================== СТИЛИ (как в прошлой версии) ===================
  const css = `
  @import url('https://fonts.googleapis.com/css2?family=UnifrakturCook:wght@700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700&display=swap');
  #epic-main-panel{
    --ink:#ffeebd; --ink-muted:#d8c79a; --gold:#f6cd57; --gold-soft:#ffe25f;
    --bg1:#19193a; --bg2:#37216d; --card:#251f4ad6; --field:#191c2bd9; --ring:#ffd76a;
    --shadow-in:0 0 7px #f6cd5742 inset;
  }
  #epic-killer-root{position:fixed;top:30px;right:34px;z-index:99999;display:flex;pointer-events:none;font-family:'Montserrat',Arial,sans-serif}
  #epic-main-panel{background:linear-gradient(130deg,#19193a 85%,#37216d 100%);border:2.9px solid var(--gold);border-radius:19px;overflow:hidden;box-shadow:0 0 40px 9px #231e4b80,0 0 6px 2px #eec8574d;width:355px;min-height:48px;color:var(--ink);display:flex;flex-direction:column;pointer-events:auto;transition:box-shadow .2s,background .2s,border-radius .15s}
  #epic-topbar{display:flex;align-items:center;gap:9px;padding:9px 15px 7px 19px;border-bottom:2px solid #f6cd57b0;background:linear-gradient(90deg,#25204a 85%,#473b7b 100%);border-radius:16px 16px 0 0;min-height:48px}
  #epic-topbar .epic-btn{min-width:110px;height:37px;margin-right:5px}
  #epic-flag-btn{margin-left:auto;background:none;border:none;font-size:29px;color:var(--gold-soft);cursor:pointer;border-radius:50%;padding:0 7px 0 3px;text-shadow:0 2px 8px #1a004eae,0 0 10px #ffda55d5;transition:color .18s,text-shadow .23s}

  /* Плавное сворачивание/разворачивание */
  #epic-content-wrap{height:0;opacity:0;padding:0 23px 0 21px;overflow:hidden;display:block;transition:height .32s cubic-bezier(.25,.8,.25,1),opacity .22s ease,padding .22s ease;will-change:height,opacity,padding}
  #epic-main-panel:not(.epic-collapsed) #epic-content-wrap{height:var(--epic-content-height,auto);opacity:1;padding:20px 23px 14px 21px}
  #epic-main-panel.epic-collapsed{box-shadow:0 0 18px 3px #231e4b38,0 0 6px 2px #eec8574d;border-radius:19px}
  #epic-content-inner{display:block}

  #epic-id-row{display:flex;align-items:center;gap:7px}
  #epic-id-input{width:100%;height:43px;font-size:16px;resize:none;border:1.6px solid #f6cd57b0;border-radius:8px;background:var(--field);color:var(--ink);padding:7px 9px;box-shadow:var(--shadow-in)}
  #epic-id-input::placeholder{color:var(--ink-muted)}
  #epic-id-input:focus{outline:none;box-shadow:0 0 0 2px var(--ring),var(--shadow-in)}
  #epic-kill-btn{height:43px;min-width:110px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:bold;font-family:'UnifrakturCook',serif;background:linear-gradient(93deg,#f6cd57 65%,#ffe25f 100%);color:#2b1d0a;border:none;border-radius:9px;box-shadow:0 1px 7px #ffe25f55,0 2px 9px #21160e29}

  #epic-del-btn{background:linear-gradient(90deg,#282e62 35%,#eac762 120%);color:#fffbe7;font-family:'UnifrakturCook',serif;font-size:16px;letter-spacing:.5px;border:none;border-radius:7px;box-shadow:0 0 8px #ffd96f86,0 2px 16px #25204845;padding:7px 18px;min-width:135px;cursor:pointer;font-weight:700;text-shadow:0 0 4px #22182d,0 2px 2px #9a7100ad}
  #epic-clear-btn{background:linear-gradient(90deg,#373f83 35%,#d7d5e3 120%);color:#fffbe9;font-size:15px;border:none;border-radius:7px;box-shadow:0 0 6px #a5baff80,0 2px 9px #2e315849;padding:6px 11px;cursor:pointer;font-weight:700;text-shadow:0 0 3px #241c38,0 1px 2px #7779a7b3}

  #epic-log{background:linear-gradient(180deg,#1f1b39,#241f3e);border:1.5px solid #f6cd5742;border-radius:7px;height:56px;width:100%;font-size:13px;overflow-y:auto;padding:5px 6px;color:#ffe25f;box-shadow:var(--shadow-in)}
  .epic-quote{font-style:italic;opacity:.9;color:#ffd87a}

  .epic-msg-block{margin-top:8px;background:#251f4ad6;border:1.4px solid #ffe25f4a;border-radius:12px;padding:9px 10px;display:flex;gap:10px;box-shadow:0 6px 14px #09081966 inset,0 0 7px #f6cd5732}
  .epic-leftcol{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:39px}
  .epic-translate-btn{width:31px;height:31px;border-radius:9px;border:1px solid #e9c85f99;cursor:pointer;font-weight:900;display:grid;place-items:center;background:#ffe25f;color:#282a4d;box-shadow:0 1px 6px #ffe25f43}
  .epic-copy-btn{width:31px;height:31px;border-radius:9px;border:1px solid #eac55b66;cursor:pointer;display:grid;place-items:center;background:linear-gradient(96deg,#ffe25f 70%,#f6cd57 100%);color:#342810;font-weight:700;box-shadow:0 1px 4px #2d1c0070}
  .epic-send-btn{width:31px;height:31px;border-radius:9px;border:1px solid #7bb9de66;cursor:pointer;display:grid;place-items:center;background:linear-gradient(180deg,#d9f2ff,#a7daf6);color:#194b62;box-shadow:0 1px 5px #5ac8fa42;transition:transform .12s ease}
  .epic-send-btn:active{transform:translateY(1px) scale(.98)}
  .epic-plane{width:18px;height:18px;display:block}

  .epic-msg-content{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:6px}
  .epic-msg-block label{font-size:13px;font-weight:800;color:var(--ink);letter-spacing:.02em}
  .epic-msg-area{width:100%;min-height:76px;border:1px solid #f6cd5740;border-radius:8px;background:linear-gradient(180deg,#1f1b39cc,#23214acc);color:var(--ink);line-height:1.35;font-size:13.6px;padding:10px 12px;resize:none;overflow:hidden;outline:none;user-select:text;cursor:text;font-family:'Montserrat',Arial,sans-serif;box-shadow:var(--shadow-in)}
  .epic-msg-area:focus{box-shadow:0 0 0 2px var(--ring),var(--shadow-in)}
  .epic-sep{height:1px;border:none;margin:8px 0 7px 0;background:repeating-linear-gradient(90deg,#ffe25f,#fffbce 6px,#ffe25f 12px)}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // =================== Разметка UI ===================
  const root = document.createElement('div'); root.id = 'epic-killer-root';
  const epicPanel = document.createElement('div'); epicPanel.id = 'epic-main-panel'; epicPanel.classList.add('epic-collapsed');
  epicPanel.innerHTML = `
    <div id="epic-topbar">
      <button id="epic-del-btn" class="epic-btn">На удаление</button>
      <button id="epic-clear-btn" class="epic-btn">Очистка</button>
      <button id="epic-flag-btn" aria-expanded="false">🏳️</button>
    </div>
    <div id="epic-content-wrap">
      <div id="epic-content-inner">
        <div id="epic-id-row">
          <textarea id="epic-id-input" placeholder="ID заказов"></textarea>
          <button id="epic-kill-btn" class="epic-btn">Удалить отзыв</button>
        </div>
        <div id="epic-log"></div>
        <hr class="epic-sep">
        <div id="epic-multimsg-block"></div>
      </div>
    </div>
  `;
  root.appendChild(epicPanel); document.body.appendChild(root);

  // =================== Селекторы и утилиты UI ===================
  const delBtn = epicPanel.querySelector('#epic-del-btn');
  const clearBtn = epicPanel.querySelector('#epic-clear-btn');
  const flagBtn = epicPanel.querySelector('#epic-flag-btn');
  const killBtn = epicPanel.querySelector('#epic-kill-btn');
  const logDiv  = epicPanel.querySelector('#epic-log');
  const input   = epicPanel.querySelector('#epic-id-input');
  const multiMsgBlock = epicPanel.querySelector('#epic-multimsg-block');
  const wrap = epicPanel.querySelector('#epic-content-wrap');
  const inner = epicPanel.querySelector('#epic-content-inner');

  function recalcContentHeight(){ wrap.style.setProperty('--epic-content-height', inner.scrollHeight + 'px'); }
  if ('ResizeObserver' in window) new ResizeObserver(recalcContentHeight).observe(inner);

  function autosizeTA(ta){ if(!ta) return; ta.style.height='auto'; ta.style.height = ta.scrollHeight + 'px'; }
  function epicLog(msg){ const t=new Date().toLocaleTimeString(); logDiv.innerHTML += `<div>[${t}] ${msg}</div>`; logDiv.scrollTop=logDiv.scrollHeight; recalcContentHeight(); }

  // =================== Шаблоны ===================
  const templates = {
    ru: { greet:'Здравствуйте!', one:id=>`Отрицательный отзыв по заказу ${id} был аннулирован.`, many:ids=>`Отрицательные отзывы по заказам ${ids.join(', ')} были аннулированы.` },
    en: { greet:'Hello!',        one:id=>`The negative review for order ${id} has been cancelled.`, many:ids=>`Negative reviews for orders ${ids.join(', ')} have been cancelled.` }
  };

  // =================== Парсер ID (запятая/пробел/Enter) ===================
  function parseIds(text){
    return text.split(/[,\s]+/).map(t=>t.trim()).filter(t=>/^\d+$/.test(t));
  }
  function addIdToInput(newId){
    const set = new Set(parseIds(input.value));
    if(set.has(newId)) return false;
    const raw = input.value.trim();
    input.value = (raw ? raw+'\n' : '') + newId;
    return true;
  }

  // =================== Навигация к САМOЙ СТАРОЙ странице ===================
  /**
   * Надёжно доходим до последней (самой старой) страницы:
   *  - грузим текущую /seller_messages.asp?id_s=SID
   *  - если последний элемент в «Страницы: …» — [N] (без ссылки), это и есть финальная страница → возвращаем HTML
   *  - иначе берём ПОСЛЕДНЮЮ ссылку <a ...>X</a> (самое большое число), переходим по ней и повторяем
   *  Итераций немного (обычно 1), лимит на всякий случай — 12.
   */
  async function fetchOldestPageHTML(sellerId){
    let url = `/asp/seller_messages.asp?id_s=${sellerId}`;
    for (let hops = 0; hops < 12; hops++) {
      const html = await fetch(url, { credentials:'same-origin' }).then(r=>r.text());
      // найдём последнюю ссылку-страницу и последнее число в квадратных скобках
      const links = [...html.matchAll(/<a[^>]+href="([^"]*seller_messages\.asp[^"]+)"[^>]*>(\d+)<\/a>/gi)];
      const brackets = [...html.matchAll(/\[(\d+)\]/g)];
      const lastLink = links.length ? links[links.length-1] : null;
      const lastBracketNum = brackets.length ? parseInt(brackets[brackets.length-1][1],10) : 0;
      const lastLinkNum = lastLink ? parseInt(lastLink[2],10) : 0;

      // если последний видимый номер — в квадратных скобках и он больше любого линка → мы на самой старой странице
      if (lastBracketNum && lastBracketNum > lastLinkNum) return html;

      // иначе прыгаем по последней ссылке (обычно это и будет самая старая)
      if (lastLink) {
        let href = lastLink[1];
        if (href.startsWith("?")) href = "/asp/seller_messages.asp" + href;
        else if (!href.startsWith("http") && !href.startsWith("/asp/")) href = "/asp/" + href;
        url = href;
        continue;
      }
      // если ссылок нет вообще — диалог одно-страничный
      return html;
    }
    // fallback — вернём то, что есть по базовой ссылке
    return await fetch(`/asp/seller_messages.asp?id_s=${sellerId}`, { credentials:'same-origin' }).then(r=>r.text());
  }

  /**
   * Достаём САМЫЙ РАННИЙ осмысленный текст.
   * Приоритет: самое раннее исходящее (mail_out.gif); если нет — любое самое раннее с текстом.
   */
  function extractEarliestTextLang(html){
    const box = document.createElement('div'); box.innerHTML = html;

    // находим таблицу с сообщениями по наличию иконок mail_in/out
    const candidates = Array.from(box.querySelectorAll('table[width="100%"][cellpadding="2"]'));
    let rows = [];
    for (const tb of candidates) {
      const trs = Array.from(tb.querySelectorAll('tr'));
      if (trs.some(tr => tr.querySelector('img[src*="mail_"]'))) { rows = trs; break; }
    }
    if (!rows.length) return { lang: 'ru', text: '' };

    // идём СНИЗУ ВВЕРХ — внизу самая старая часть
    const pickText = (tr) => {
      // текст бывает в <p> или прямо внутри <font>
      const p = tr.querySelector('p'); if (p && p.textContent.trim()) return p.textContent.trim();
      const f = tr.querySelector('font'); if (f && f.textContent.trim()) return f.textContent.trim();
      return '';
    };

    // 1) ищем самое раннее ИСХОДЯЩЕЕ с текстом
    for (let i = rows.length - 1; i >= 0; i--) {
      const tr = rows[i];
      if (tr.querySelector('img[src*="mail_out.gif"]')) {
        const t = pickText(tr);
        if (t) return { lang: /[\u0400-\u04FF]/.test(t) ? 'ru' : 'en', text: t };
      }
    }
    // 2) если не нашли — берём самое раннее ЛЮБОЕ с текстом
    for (let i = rows.length - 1; i >= 0; i--) {
      const tr = rows[i];
      const t = pickText(tr);
      if (t) return { lang: /[\u0400-\u04FF]/.test(t) ? 'ru' : 'en', text: t };
    }
    return { lang: 'ru', text: '' };
  }

  // авто-определение языка по самому первому сообщению (с кэшем)
  async function getSellerInitialLang(sellerId){
    if (firstLangCache[sellerId]) return firstLangCache[sellerId];
    try{
      const html = await fetchOldestPageHTML(sellerId);
      const { lang } = extractEarliestTextLang(html);
      firstLangCache[sellerId] = lang;
      return lang;
    } catch {
      return 'ru';
    }
  }

  // =================== Проверка «сегодня уже писали?» ===================
  function todayRu(){ const d=new Date(); const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear(); return `${dd}.${mm}.${yyyy}`; }
  async function epicHasOutgoingToday(sellerId){
    try{
      const html = await fetch(`/asp/seller_messages.asp?id_s=${sellerId}`, { credentials:'same-origin' }).then(r=>r.text());
      const today = todayRu();
      const re = /<tr[^>]*>[\s\S]*?<td class="td_title"[^>]*>\s*(\d{2}\.\d{2}\.\d{4})[\s\S]*?<img[^>]+mail_(out|in)\.gif/gi;
      let m, hasOut=false;
      while((m=re.exec(html))!==null){ if(m[1]===today && m[2]==='out'){ hasOut = true; break; } }
      return hasOut;
    }catch{ return false; }
  }
  async function ensureGreetNeeded(sellerId){
    if (sellerId in greetNeededCache) return greetNeededCache[sellerId];
    const hasOut = await epicHasOutgoingToday(sellerId);
    greetNeededCache[sellerId] = !hasOut;
    return greetNeededCache[sellerId];
  }

  // =================== Формирование текста письма ===================
  const templatesAPI = {
    makeSellerMsg(ids, lang, needGreet){
      const t = templates[lang];
      const body = (ids.length===1) ? t.one(ids[0]) : (ids.length>1 ? t.many(ids) : '_______');
      return needGreet ? `${t.greet}\n\n${body}` : body;
    }
  };

  // =================== Вытягиваем ID продавцов по заказам ===================
  async function epicGetSellerInfoByOrderId(orderId){
    try{
      const html = await fetch(`/asp/inv_of_buyer.asp?id_i=${orderId}`, { credentials:'same-origin' }).then(r=>r.text());
      const sellerId = html.match(/seller_info\.asp\?ID_S=(\d+)/i)?.[1] || null;
      let nick = null;
      const dom = document.createElement('div'); dom.innerHTML = html;
      const tr = Array.from(dom.querySelectorAll('tr')).find(tr => {
        const td = tr.querySelector('td.namerow');
        return td && td.textContent.replace(/\s/g,'').toLowerCase().includes('продавец:');
      });
      if(tr){ const td = tr.querySelector('td.inforow'); if(td){ const t = td.childNodes[0]?.nodeValue || ''; nick = t.trim(); } }
      return { sellerId, nickname:nick };
    }catch{ return { sellerId:null, nickname:null }; }
  }
  async function getMultiSellerMap(ids){
    const map = {};
    await Promise.all(ids.map(async (id)=>{
      const v=id.trim(); if(!/^\d+$/.test(v)) return;
      const info = await epicGetSellerInfoByOrderId(v);
      const sid = info.sellerId || 'unknown'; const nick = info.nickname || sid;
      if(!map[sid]) map[sid] = { ids:[], nickname:nick };
      map[sid].ids.push(v); map[sid].nickname = nick;
    }));
    return map;
  }

  // =================== Рисуем блоки писем ===================
  async function drawAllSellerMsgs(all){
    multiMsgBlock.innerHTML = "";
    for(const sid in all){
      const ids = all[sid].ids;
      const nick = all[sid].nickname || sid;

      // авто-язык по самой первой странице (если пользователь ещё не менял)
      if (!(sid in blockLangMap)) {
        blockLangMap[sid] = await getSellerInitialLang(sid);
      }

      // приветствие по «сегодня уже писали или нет»
      const needGreet = await ensureGreetNeeded(sid);

      // блок
      const block = document.createElement('div'); block.className = 'epic-msg-block';

      // левая колонка
      const leftCol = document.createElement('div'); leftCol.className = 'epic-leftcol';

      const translateBtn = document.createElement('button');
      translateBtn.className = 'epic-translate-btn';
      translateBtn.title = (blockLangMap[sid] === 'ru') ? 'Русская версия' : 'English version';
      translateBtn.textContent = (blockLangMap[sid] === 'ru') ? 'RU' : 'EN';

      const btnCopy = document.createElement('button');
      btnCopy.className = 'epic-copy-btn';
      btnCopy.title = 'Скопировать как таблицу: id / ник / Удалён';
      btnCopy.textContent = '📋';
      btnCopy.onclick = function(){
        if(!nick || ids.length===0) return;
        const rows = ids.map(id => [id, nick, 'Удалён'].join('\t')).join('\n');
        navigator.clipboard.writeText(rows).then(
          () => epicLog('<span style="color:#ffe25f">Скопировано в табличном формате.</span>'),
          () => epicLog(`<span style="color:#ffb6b6">Ошибка копирования.</span> ${q(EPIC.empathy[0])}`)
        );
      };

      const mailBtn = document.createElement('button');
      mailBtn.className = 'epic-send-btn';
      mailBtn.title = 'Отправить письмо этому продавцу';
      mailBtn.innerHTML = `<svg class="epic-plane" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21V3l21 9-8 2 2 7-6-8-9 8z" fill="currentColor"/></svg>`;

      leftCol.appendChild(translateBtn);
      leftCol.appendChild(btnCopy);
      leftCol.appendChild(mailBtn);

      // контент
      const msgContent = document.createElement('div'); msgContent.className = 'epic-msg-content';
      msgContent.innerHTML = `
        <label><b>${nick}</b></label>
        <textarea class="epic-msg-area">${templatesAPI.makeSellerMsg(ids, blockLangMap[sid], needGreet)}</textarea>
      `;

      block.appendChild(leftCol);
      block.appendChild(msgContent);
      multiMsgBlock.appendChild(block);

      // автосайз для шаблона
      const ta = msgContent.querySelector('.epic-msg-area');
      autosizeTA(ta);
      ta.addEventListener('input', () => { autosizeTA(ta); recalcContentHeight(); });

      // ручное переключение RU/EN
      translateBtn.onclick = function () {
        blockLangMap[sid] = (blockLangMap[sid] === 'ru') ? 'en' : 'ru';
        translateBtn.textContent = (blockLangMap[sid] === 'ru') ? 'RU' : 'EN';
        translateBtn.title = (blockLangMap[sid] === 'ru') ? 'Русская версия' : 'English version';
        ta.value = templatesAPI.makeSellerMsg(ids, blockLangMap[sid], needGreet);
        autosizeTA(ta); recalcContentHeight();
      };

      // отправка письма
      mailBtn.onclick = async function(e){
        e.stopPropagation(); mailBtn.disabled = true;
        const messageText = ta.value.trim();
        if(!messageText || messageText.includes('_______')){
          epicLog('<span style="color:#ffb6b6">Сообщение пустое, отправка отменена.</span>');
          mailBtn.disabled = false; return;
        }
        epicLog(`<b>Пробую отправить письмо продавцу #${sid} (${nick}).</b> ${q(EPIC.open[0])}`);
        const params = new URLSearchParams(); params.append('txt_Message', messageText.replace(/\n/g,'\r\n'));
        try{
          const resp = await fetch(`/asp/new_message.asp?id_s=${sid}&new`, {
            method:'POST', body:params.toString(), credentials:'same-origin',
            headers:{'Content-Type':'application/x-www-form-urlencoded'}
          });
          const text = await resp.text();
          if (resp.ok && !text.includes('textarea') && !text.includes('name="txt_Message"')) {
            epicLog(`<span style="color:#87ffbd">Сообщение отправлено.</span>`);
          } else {
            epicLog(`<span style="color:#ffe25f">Отправка завершена, но проверьте переписку вручную.</span> ${q(EPIC.wit[0])}`);
          }
        }catch(e){
          epicLog(`<span style="color:#ffb6b6">Ошибка отправки: ${e}</span> ${q(EPIC.error[0])}`);
        }
        mailBtn.disabled = false;
      };
    }
    recalcContentHeight();
  }

  // =================== Реакция на ввод ID ===================
  function loadIdsFromStorage(){ const d = localStorage.getItem(LS_KEY); if (d!==null) input.value = d; }
  function saveIdsToStorage(v){ localStorage.setItem(LS_KEY, v); }
  input.addEventListener('input', () => { saveIdsToStorage(input.value); epicAlwaysDrawSellerMsgs(); updateKillBtnText(); });
  loadIdsFromStorage();
  window.addEventListener('storage', (e) => { if (e.key===LS_KEY && e.newValue!==input.value) { input.value = e.newValue || ''; epicAlwaysDrawSellerMsgs(); updateKillBtnText(); }});
  function updateKillBtnText(){ const ids = parseIds(input.value); killBtn.textContent = ids.length>1 ? 'Удалить отзывы' : 'Удалить отзыв'; }

  async function epicAlwaysDrawSellerMsgs(){
    const ids = parseIds(input.value);
    if(ids.length===0){ multiMsgBlock.innerHTML=""; updateKillBtnText(); recalcContentHeight(); return; }
    const all = await getMultiSellerMap(ids);
    await drawAllSellerMsgs(all);
    updateKillBtnText();
  }
  epicAlwaysDrawSellerMsgs();

  // =================== Кнопки топбара ===================
  clearBtn.onclick = () => { input.value=''; saveIdsToStorage(''); epicLog(`<span style="color:#ffe25f">Очередь ID очищена.</span> ${q(EPIC.empathy[0])}`); epicAlwaysDrawSellerMsgs(); updateKillBtnText(); };
  delBtn.onclick = () => {
    const m = window.location.href.match(/[?&]id_i=(\d+)/);
    if (m && m[1]) {
      const added = addIdToInput(m[1]);
      if (added) { saveIdsToStorage(input.value); epicLog(`<span style="color:#ffe25f">ID ${m[1]} добавлен в очередь.</span> ${q(EPIC.start[0])}`); epicAlwaysDrawSellerMsgs(); updateKillBtnText(); }
      else epicLog(`<span style="color:#ffe25f">ID ${m[1]} уже в списке.</span>`);
    } else epicLog('<span style="color:#ffe25f">ID не найден в ссылке.</span>');
  };
  flagBtn.onclick = () => {
    const willExpand = epicPanel.classList.contains('epic-collapsed');
    recalcContentHeight();
    requestAnimationFrame(() => {
      epicPanel.classList.toggle('epic-collapsed');
      flagBtn.setAttribute('aria-expanded', String(willExpand));
      flagBtn.innerHTML = willExpand ? '🏴‍☠️' : '🏳️';
      requestAnimationFrame(recalcContentHeight);
    });
  };

  // =================== Удаление отзывов (без изменений логики) ===================
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
  async function epicDeleteOrderReview(id){ try{ await fetch(`/asp/inv_of_buyer.asp?oper=kill&id_i=${encodeURIComponent(id)}`, { credentials:'same-origin' }); return true; }catch{ return false; } }
  async function epicDeleteNegativeMessage(orderId, sellerId){
    try{
      const html = await fetch(`/asp/seller_messages.asp?id_s=${sellerId}`, { credentials:'same-origin' }).then(r=>r.text());
      const msgBlockReg = new RegExp(
        `<font[^>]*>(?:Отрицательный отзыв по заказу ${orderId} аннулирован согласно решению администрации площадки\\.|Negative feedback on order ${orderId} is canceled by decision of the site administration\\.)<\\/font>[\\s\\S]{0,500}?<a[^>]+href="([^"]*del=\\d+[^"]*)"[^>]*>`,
        'i'
      );
      const found = html.match(msgBlockReg);
      if(found && found[1]){
        let delUrl = found[1];
        if(delUrl.startsWith("?")) delUrl = "/asp/seller_messages.asp"+delUrl;
        else if(!delUrl.startsWith("http")) delUrl = "/asp/"+delUrl;
        await fetch(delUrl, { credentials:'same-origin' });
        return true;
      }
      return false;
    }catch{ return false; }
  }
  async function epicKill(){
    killBtn.disabled = true; delBtn.disabled = true; clearBtn.disabled = true;

    const idsAll = parseIds(input.value);
    epicLog(`<b>Старт пакетного удаления (${idsAll.length}).</b> ${q(EPIC.start[1])}`);
    if(idsAll.length>=20) epicLog(q(EPIC.caution[0]));

    const {selectionStart:s, selectionEnd:e} = input;
    const toDelete = (s!==e) ? parseIds(input.value.slice(s,e)) : idsAll;
    if(toDelete.length===0){ epicLog('<span style="color:#ffb6b6">Нет валидных ID для удаления.</span>'); killBtn.disabled=false; delBtn.disabled=false; clearBtn.disabled=false; return; }

    const perSeller = {};
    for(const idToKill of toDelete){
      const info = await epicGetSellerInfoByOrderId(idToKill);
      const sellerId = info.sellerId || 'unknown';
      const nickname = info.nickname || sellerId;
      if(!perSeller[sellerId]) perSeller[sellerId] = { ids:[], nickname };

      epicLog(`<b>⚡ Удаляю отзыв</b> <span style="color:#ffe25f">${idToKill}</span> у <b>${nickname}</b>. ${q(EPIC.start[0])}`);

      const ok1 = await epicDeleteOrderReview(idToKill);
      epicLog(ok1 ? `<span style="color:#e0ffc0">✅ Отзыв ${idToKill} удалён.</span> ${q(EPIC.success[0])}`
                  : `<span style="color:#ffb6b6">❌ Не удалось удалить ${idToKill}.</span> ${q(EPIC.error[0])}`);

      await sleep(900);

      epicLog(`<span style="color:#ffe25f">Ищу и очищаю сопутствующее сообщение (${idToKill}).</span>`);
      const ok2 = await epicDeleteNegativeMessage(idToKill, sellerId);
      epicLog(ok2 ? `<span style="color:#ffe25f">🦍 Сообщение удалено.</span>` : `<span style="color:#ffe25f">🦧 Сообщение не найдено/не удалено.</span>`);

      perSeller[sellerId].ids.push(idToKill); perSeller[sellerId].nickname = nickname;
      await drawAllSellerMsgs(perSeller);
      await sleep(400);
    }

    epicLog(`<b>🏆 Готово. Удалено: ${toDelete.length}.</b> ${q(EPIC.tough[0])}`);
    killBtn.disabled = false; delBtn.disabled = false; clearBtn.disabled = false;
    epicAlwaysDrawSellerMsgs();
  }
  killBtn.onclick = epicKill;
})();
