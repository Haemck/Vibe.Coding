// ==UserScript==
// @name         DigiSeller: CATologiesWayBuidler (optim, fast open/close, fast copy)
// @namespace    https://my.digiseller.ru/
// @version      4.10
// @description  Vibe: мультистрочный путь, автообъединение, скрытие поля по кнопке, без дублей + idle-сохранение + иконки + подтверждение очистки + чекбокс «Новое» (не сбрасывается) + «Для таблицы» + настройки (⚙️) с «Продвинутые параметры» (Аттестат) и Email + клики по крошкам/ID + «Скопировать всё». Оптимизации: единый портал автоподсказок, делегирование событий, массовая вставка DOM (DocumentFragment), минимизация сериализаций, CSS contain. Доработки по перфу: singleton-модалка (без пересборки), быстрые копирования (без innerHTML), will-change+transform анимации. Дополнения: двойной клик по RU — показать все подсказки; подсветка ENG при русских символах; автотрим пробелов на blur у RU/EN. Багфиксы: FAB не всплывает после результатов; trim после blur работает всегда.
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/razdels.asp*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @updateURL    https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesWayBuidler.user.js
// @downloadURL  https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesWayBuidler.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ==== КОНСТАНТЫ ХРАНИЛКИ ====
  const LS_KEY = 'vibe-bulk-state-v410'; // новый ключ под 4.10, чтобы не тянуть старый мусор

  // ==== АВТОЗАМЕНА ENG и КОМИССИИ ====
  const AUTO_ENG = {
    "Аккаунты": "Accounts", "Ключи": "Keys", "Аренда аккаунтов": "Account rental", "Оффлайн аккаунты": "Offline Accounts",
    "Услуги активации": "Activation Services", "Покупка на ваш аккаунт": "Purchase on your account", "DLC": "DLC",
    "Скины": "Skins", "Предметы": "Items", "Валюта": "Currency", "Боевой пропуск": "Battle pass", "Наборы": "Packs",
    "Гайды": "Guides", "Дизайн-проекты": "Design projects", "Пополнение баланса": "Balance top up",
    "Steam": "Steam", "Epic Games Store": "Epic Games Store", "EA app": "EA app", "Meta Quest": "Meta Quest", "GOG": "GOG",
    "PlayStation": "PlayStation", "Uplay": "Uplay", "Xbox / Microsoft Store": "Xbox / Microsoft Store", "Xbox": "Xbox"
  };
  const RUS_VARIANTS = Object.keys(AUTO_ENG);
  const RUS_LOWER = RUS_VARIANTS.map(s => s.toLowerCase());

  const FIXED_PATHS = {
    "33627": "Игры",
    "117160": "Крипто-индустрия",
    "44264": "Новые ниши",
    "23835": "Программное обеспечение",
    "33749": "Сервисы и соцсети",
    "28685": "Цифровые товары"
  };
  const FIXED_NAMES_TO_ID = {};
  Object.entries(FIXED_PATHS).forEach(([id, name]) => { FIXED_NAMES_TO_ID[name.toLowerCase()] = id; });

  function autoEng(val) { return AUTO_ENG[val] || val; }
  function autoKomiss({ ru, parentRu }) {
    ru = (ru || "").trim();
    parentRu = (parentRu || "").trim();
    if (/steam/i.test(ru) && !["Аккаунты", "Оффлайн аккаунты", "Аренда аккаунтов"].includes(parentRu)) return '2.5';
    if (["Аккаунты", "Оффлайн аккаунты", "Аренда аккаунтов"].includes(parentRu)) return '20';
    if (["Ключи", "Услуги активации", "DLC", "Скины", "Валюта", "Предметы", "Боевой пропуск", "Наборы", "Покупка на ваш аккаунт"].includes(parentRu)) return '2';
    return '';
  }

  // ==== ВНУТРЕННИЕ НАСТРОЙКИ (⚙️) ====
  let cfg = { advanced: false, tableEmail: '' };

  // ==== ГЛОБАЛ-ССЫЛКИ НА ЭЛЕМЕНТЫ (для singleton-модалки) ====
  let MODAL = null;
  let FAB = null;

  // ==== СТИЛИ ====
  GM_addStyle(`
    @import url('https://fonts.googleapis.com/css?family=JetBrains+Mono:400,700&display=swap');
    #vibe-bulk-modal {
      position:fixed; top:28px; left:24px; width:820px; max-width:98vw; background:#181920; color:#ffe37a;
      border:3.5px solid #ffe37a; border-radius:15px; box-shadow:0 9px 54px 0 #000d,0 0 0 6px #ffde5c33;
      z-index:999999; padding:28px 34px 24px 34px; font-family:'JetBrains Mono',monospace;
      min-height:90px; overflow:hidden; display:none; flex-direction:column;
      contain: layout paint; will-change: transform, opacity; backface-visibility: hidden;
      transform: translateY(-8px) scale(0.985); opacity: 0;
    }
    .vibe-modal-show { display:flex !important; animation: vibe-in .22s ease-out forwards; }
    .vibe-modal-hide { animation: vibe-out .18s ease-in forwards; }
    @keyframes vibe-in { to { transform: none; opacity: 1; } }
    @keyframes vibe-out { to { transform: translateY(-8px) scale(0.985); opacity: 0; } }

    #vibe-bulk-modal label {font-size:16px;display:inline-block;color:#ffe37a;font-weight:700;margin-right:11px;}
    #vibe-bulk-modal input[type="text"],#vibe-bulk-modal input[type="number"],#vibe-bulk-modal select, #vibe-path-paste-input, #vibe-path-paste-input-multi{
      width: 100%;font-family:inherit;font-size:15px;background:#232324;color:#ffe37a;border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 10px;margin-right:7px;
      transition:border-color .18s;box-shadow:0 2px 0 #ffe37a20;
    }
    #vibe-bulk-modal input[type="text"]:focus,#vibe-bulk-modal input[type="number"]:focus,#vibe-bulk-modal select:focus,#vibe-path-paste-input:focus,#vibe-path-paste-input-multi:focus{
      border-color:#ffe37a;background:#181920;outline:none;
    }
    #vibe-bulk-modal .vibe-row{margin-bottom:18px;}
    #vibe-bulk-modal .vibe-compact-row{display:flex;align-items:center;gap:9px;margin-bottom:6px;flex-wrap:wrap;position:relative;}
    #vibe-bulk-modal .vibe-checkbox{margin:0 10px 0 0;vertical-align:middle;transform:scale(1.15);accent-color:#ffe37а;}
    #vibe-bulk-modal .vibe-btn,#vibe-bulk-modal .vibe-small-btn{font-family:inherit;background:linear-gradient(90deg,#ffe37a,#181920 160%);color:#181920;font-weight:900;border:none;border-radius:10px;box-shadow:0 3px 0 #ffe37a36,0 1px 8px #ffe37a17;cursor:pointer;transition:background .15s,color .15s,box-shadow .18s;letter-spacing:0.04em;}
    #vibe-bulk-modal .vibe-btn{padding:15px 0;width:100%;font-size:20px;margin-top:14px;margin-bottom:2px;}
    #vibe-bulk-modal .vibe-btn:hover{background:linear-gradient(90deg,#fffbe3,#ffe37a 130%);color:#181920;box-shadow:0 7px 28px #ffe37a25;}
    #vibe-bulk-modal .vibe-small-btn,#vibe-bulk-modal .vibe-small-btn-remove{font-size:19px;font-weight:900;background:#ffe37a33;color:#ffe37a;border:none;border-radius:8px;cursor:pointer;padding:4px 11px;margin-left:7px;min-width:30px;box-shadow:none;transition:background .18s,color .18s;}
    #vibe-bulk-modal .vibe-small-btn:hover,#vibe-bulk-modal .vibe-small-btn-remove:hover{background:#ffe37a;color:#181920;}
    #vibe-bulk-modal .vibe-section{border:1.6px solid #ffe37a66;background:#232324;border-radius:8px;margin-bottom:8px;padding:7px 10px 4px 8px;position:relative;box-shadow:0 1.5px 0 #ffe37a20;contain: layout paint;}
    #vibe-bulk-modal .vibe-section-children{margin-left:34px;margin-top:4px;}
    #vibe-bulk-modal .vibe-close{position:absolute;top:11px;right:24px;background:transparent;border:none;font-size:29px;color:#ffe37a;cursor:pointer;transition:color .19s;font-family:inherit;font-weight:900;}
    #vibe-bulk-modal .vibe-close:hover{color:#fffbe3;}
    #vibe-bulk-modal .cat-vibe-status{margin-top:13px;font-size:17px;font-weight:600;color:#ffe37a;text-align:left;}

    .vibe-result-list-block {max-height:246px;overflow:auto;margin-top:12px;margin-bottom:0;background:#1d1f27;border-radius:8px;padding:7px 18px 7px 13px;font-size:16.2px;box-shadow:0 3px 24px #0004;contain: layout paint;}
    .vibe-result-list-block:focus {outline: 2px solid #ffe37a;}
    .vibe-copy-toolbar {position:absolute;right:2px;top:0px;display:flex;align-items:center;gap:14px;z-index:2;flex-wrap:wrap;justify-content:flex-end;}
    .vibe-copyall-btn {background:#ffe37a;color:#232324;border-radius:8px;border:none;font-weight:700;font-size:16px;font-family:inherit;padding:9px 20px;cursor:pointer;box-shadow:0 2px 0 #ffe37a44;transition:background .17s,color .17s;}
    .vibe-copyall-btn:hover{background:#fffbe3;color:#181920;}
    .vibe-result-id{color:#ffde5c;font-weight:700;cursor:pointer;padding:1px 8px 1px 3px;font-size:15.7px;background:none;border-radius:6px;transition:opacity .15s;}
    .vibe-result-id.vibe-copied{opacity:.55;}
    .vibe-result-path{cursor:pointer; position:relative;}
    .vibe-copied-twinkle::after{
      content:"✔"; position:absolute; right:-18px; top:0; font-weight:900; opacity:0; transform:translateY(-2px);
      animation: twink .65s ease forwards;
    }
    @keyframes twink { 10%{opacity:1} 100%{opacity:0; transform:translateY(-6px)} }

    #vibe-bulk-fab{
      position:fixed;left:32px;bottom:32px;z-index:99999;width:78px;height:78px;border-radius:50%;
      background:linear-gradient(135deg,#ffe37a 70%,#181920 190%);box-shadow:0 7px 32px #000c,0 2px 0 #0000;font-size:46px;
      display:flex;align-items:center;justify-content:center;cursor:pointer;outline:none;border:none;transition:background .15s,box-shadow .17s;
      user-select:none; will-change: transform, opacity; backface-visibility:hidden;
    }
    #vibe-bulk-fab:hover{background:linear-gradient(135deg,#fffbe3 90%,#ffe37a 140%);color:#29291a;box-shadow:0 11px 52px #ffe37a77,0 2px 0 #ffe37a88;}

    .vibe-autocomplete-portal {position:fixed;z-index:9999999;min-width:180px;max-width:340px;background:#1d1f27;color:#ffe37a;border:2px solid #ffe37a77;border-radius:7px;box-shadow:0 8px 22px #000a;padding:5px 0;max-height:205px;overflow:auto;font-family:'JetBrains Mono',monospace;font-size:15.7px;}
    .vibe-autocomplete-item{padding:7px 15px;cursor:pointer;transition:background .13s;color:#ffe37a;}
    .vibe-autocomplete-item.active,.vibe-autocomplete-item:hover{background:linear-gradient(90deg,#ffe37a33 80%,#ffe37a11 140%);color:#181920;}

    #vibe-bulk-modal input[type=number].vibe-commission::-webkit-outer-spin-button,
    #vibe-bulk-modal input[type=number].vibe-commission::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0;}
    #vibe-bulk-modal input[type=number].vibe-commission { -moz-appearance:textfield; appearance:textfield;}

    .vibe-confirm-mask{position:fixed;inset:0;z-index:10000000;background:transparent;}
    .vibe-confirm-popover{
      position:fixed;z-index:10000001;background:#1d1f27;color:#ffe37a;border:2px solid #ffe37a88;border-radius:10px;
      box-shadow:0 8px 24px #000a,0 0 0 4px #ffde5c22;padding:10px 12px;max-width:300px;min-width:240px;
      font-family:'JetBrains Mono',monospace;font-size:14.8px;}
    .vibe-confirm-popover .vcp-title{font-weight:900;margin-bottom:6px;}
    .vibe-confirm-popover .vcp-desc{opacity:.9}
    .vibe-confirm-popover .vcp-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;}
    .vibe-confirm-popover .vcp-ok{background:#ffe37a;color:#181920;border-radius:8px;border:2px solid #101116;padding:6px 10px;font-weight:900;cursor:pointer;}
    .vibe-confirm-popover .vcp-cancel{background:#ffe37a33;color:#ffe37a;border-radius:8px;border:none;padding:6px 10px;font-weight:900;cursor:pointer;}
    .vibe-confirm-popover .vcp-ok:hover{filter:brightness(1.05);}
    .vibe-confirm-popover .vcp-cancel:hover{background:#ffe37a;}

    .vibe-newonly-wrap{display:flex;align-items:center;gap:14px;margin-right:10px;flex-wrap:wrap;}
    .vibe-newonly-wrap label{display:flex;align-items:center;gap:6px;font-size:14px;margin:0;}
    .vibe-newonly-wrap input{transform:scale(1.1);}

    .vibe-settings-mask{position:fixed;inset:0;z-index:10000000;background:transparent;}
    .vibe-settings-pop{
      position:fixed;z-index:10000001;background:#1d1f27;color:#ffe37a;border:2px solid #ffe37a88;border-radius:10px;
      box-shadow:0 8px 24px #000a,0 0 0 4px #ffde5c22;padding:12px 14px;min-width:320px;max-width:320px;
      font-family:'JetBrains Mono',monospace;font-size:14.8px;}
    .vibe-settings-pop h4{margin:0 0 8px 0;font-size:16.6px;}
    .vibe-settings-row{display:flex;align-items:center;gap:10px;margin:8px 0;}
    .vibe-settings-pop input[type="email"]{width:100%;background:#232324;color:#ffe37a;border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 10px;}
    .vibe-settings-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;}
    .vibe-settings-btn{background:#ffe37a;color:#181920;border-radius:8px;border:none;padding:6px 10px;font-weight:900;cursor:pointer;}
    .vibe-settings-btn:hover{filter:brightness(1.05);}

    .vibe-en-warn{ background:#2a1b1b !important; border-color:#ff8e8e !important; box-shadow:0 0 0 2px #ff8e8e22 inset !important; }
  `);

  // ==== ЕДИНЫЙ ПОРТАЛ AUTOCOMPLETE ====
  const AC = { el: null, host: null, items: [], activeIdx: -1 };
  function acEnsure() {
    if (AC.el) return;
    const el = document.createElement('div');
    el.className = 'vibe-autocomplete-portal';
    el.style.display = 'none';
    document.body.appendChild(el);
    AC.el = el;
    document.addEventListener('mousedown', (e) => {
      if (!AC.el) return;
      if (AC.el.style.display !== 'none' && !AC.el.contains(e.target)) acHide();
    }, { passive: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') acHide(); }, { passive: true });
  }
  function acHide() {
    if (!AC.el) return;
    AC.el.style.display = 'none';
    AC.host = null; AC.items = []; AC.activeIdx = -1; AC.el.innerHTML = '';
  }
  function acSetActive(idx) {
    if (!AC.el) return;
    const nodes = AC.el.querySelectorAll('.vibe-autocomplete-item');
    if (!nodes.length) return;
    if (AC.activeIdx >= 0 && nodes[AC.activeIdx]) nodes[AC.activeIdx].classList.remove('active');
    AC.activeIdx = (idx >= 0 && idx < nodes.length) ? idx : -1;
    if (AC.activeIdx >= 0) nodes[AC.activeIdx].classList.add('active');
  }
  function acShow(hostInput, variants) {
    acEnsure();
    if (!variants || !variants.length) { acHide(); return; }
    AC.host = hostInput;
    AC.items = variants.slice(0);

    const rect = hostInput.getBoundingClientRect();
    AC.el.style.top = (rect.bottom + window.scrollY) + 'px';
    AC.el.style.left = (rect.left + window.scrollX) + 'px';
    AC.el.style.minWidth = Math.max(rect.width, 180) + 'px';

    AC.el.innerHTML = '';
    const frag = document.createDocumentFragment();
    variants.forEach((v, idx) => {
      const item = document.createElement('div');
      item.className = 'vibe-autocomplete-item' + (idx === 0 ? ' active' : '');
      item.textContent = v;
      item.onmousedown = function (e) {
        if (e.button !== 0) return;
        hostInput.value = v;
        hostInput.dispatchEvent(new Event('input', { bubbles: true }));
        hostInput.dispatchEvent(new Event('change', { bubbles: true }));
        acHide();
        hostInput.blur(); hostInput.focus();
        e.preventDefault();
      };
      frag.appendChild(item);
    });
    AC.el.appendChild(frag);
    AC.activeIdx = 0;
    AC.el.style.display = 'block';
  }

  // ==== SAVE (idle) ====
  let idleId = null, idleTO = null;
  function saveStateImmediate() {
    try {
      if (!MODAL) return;
      const parentInput = MODAL.querySelector('#vibe-parent-id');
      const pathInput = MODAL.querySelector('#vibe-parent-path');
      const pathPasteBlock = MODAL.querySelector('#vibe-path-paste-block');
      const pathPasteInput = MODAL.querySelector('#vibe-path-paste-input-multi');
      const mainList = MODAL.querySelector('#vibe-bulk-list');
      const newOnlyEl = MODAL.querySelector('#vibe-copy-newonly');
      const tableEl = MODAL.querySelector('#vibe-copy-tablemode');

      const state = {
        parentId: (parentInput?.value || '').trim(),
        parentPath: (pathInput?.value || '').trim(),
        pathPasteVisible: !!(pathPasteBlock && pathPasteBlock.style.display !== 'none'),
        pathPasteInput: (pathPasteInput?.value || ''),
        sections: mainList ? readAllSections(mainList) : [],
        settings: { advanced: !!cfg.advanced, tableEmail: (cfg.tableEmail || '').trim() },
        results: lastResultLinesGlobal ? {
          lines: lastResultLinesGlobal,
          newOnly: !!(newOnlyEl && newOnlyEl.checked),
          tableMode: !!(tableEl && tableEl.checked)
        } : null
      };
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {}
  }
  function saveIdle() {
    if (idleId && window.cancelIdleCallback) cancelIdleCallback(idleId);
    if (idleTO) clearTimeout(idleTO);
    const run = () => { idleId = null; idleTO = null; saveStateImmediate(); };
    if (window.requestIdleCallback) idleId = requestIdleCallback(run, { timeout: 1200 });
    else idleTO = setTimeout(run, 700);
  }

  // ==== УТИЛИТЫ ====
  function copyTextToClipboard(text) {
    if (window.GM_setClipboard) window.GM_setClipboard(text);
    else if (navigator.clipboard) navigator.clipboard.writeText(text);
    else {
      let tmp = document.createElement("textarea");
      tmp.value = text;
      document.body.appendChild(tmp); tmp.select();
      document.execCommand("copy"); document.body.removeChild(tmp);
    }
  }
  function readSection(section) {
    if (!section) return null;
    let ru = (section.querySelector('.vibe-ru-name').value || '').trim();
    if (!ru) return null;
    let en = section.querySelector('.vibe-en-name').value;
    let type = section.querySelector('.vibe-type').value;
    let comm = section.querySelector('.vibe-commission').value.trim();
    let att = !!section.querySelector('.vibe-attest')?.checked;
    let children = [];
    let chBlock = section.querySelector('.vibe-section-children');
    if (chBlock) {
      for (let ch of chBlock.querySelectorAll(':scope > .vibe-section')) {
        let chData = readSection(ch);
        if (chData && chData.ru) children.push(chData);
      }
    }
    return { ru, en, type, comm, att, children };
  }
  function readAllSections(container) {
    return Array.from(container.querySelectorAll(':scope > .vibe-section'))
      .map(readSection)
      .filter(x => !!x && !!x.ru);
  }
  function clearMainSections(list) {
    Array.from(list.querySelectorAll(':scope > .vibe-section')).forEach(e => e.remove());
  }

  // Показ/скрытие «Аттестат»
  function applyAttestVisibility(root = document) {
    const sections = root.querySelectorAll('.vibe-section');
    sections.forEach(sec => {
      const typeSel = sec.querySelector('.vibe-type');
      const attLabel = sec.querySelector('label');
      if (!typeSel || !attLabel) return;
      const show = (typeSel.value === '1') && cfg.advanced;
      attLabel.style.display = show ? '' : 'none';
    });
  }

  // ==== Создание секции ====
  function createSection(data = {}, parentRu = '') {
    const enVal = data.en || '';
    const enWarnClass = /[А-Яа-яЁё]/.test(enVal) ? ' vibe-en-warn' : '';
    let section = document.createElement('div');
    section.className = 'vibe-section';
    section.innerHTML = `
      <div class="vibe-compact-row">
        <div style="position:relative;">
          <input type="text" class="vibe-ru-name" maxlength="80" style="flex:2 1 120px" value="${data.ru || ''}" placeholder="Название (рус)" required autocomplete="off" title="Русское название">
        </div>
        <input type="text" class="vibe-en-name${enWarnClass}" maxlength="80" style="flex:2 1 120px" value="${enVal}" placeholder="Eng" autocomplete="off" title="English (авто)">
        <select class="vibe-type" style="flex:1 0 94px;">
          <option value="0" ${data.type == '0' ? 'selected' : ''}>Категория</option>
          <option value="1" ${data.type == '1' ? 'selected' : ''}>Раздел</option>
        </select>
        <input type="number" min="0" max="100" class="vibe-commission" style="width:65px;display:${data.type == '1' ? '' : 'none'};" placeholder="%" value="${data.comm || ''}" title="Комиссия (%)" inputmode="decimal">
        <label style="margin:0;display:${(data.type == '1' && cfg.advanced) ? '' : 'none'};">
          <input type="checkbox" class="vibe-checkbox vibe-attest" ${data.att ? 'checked' : ''}> Аттестат
        </label>
        <button class="vibe-small-btn vibe-add-child" type="button" title="Добавить дочерний">＋</button>
        <button class="vibe-small-btn-remove vibe-remove" title="Удалить элемент" tabindex="-1">✖</button>
      </div>
      <div class="vibe-section-children"></div>
    `;
    const commField = section.querySelector('.vibe-commission');
    commField.addEventListener('focus', function () {
      this.title = 'Обычно: 2% для ключей/валюты, 2.5% для Steam, 20% для аккаунтов';
    }, { passive: true });
    return section;
  }

  // ==== Поиск названия/типа по ID (кэш) ====
  let lastIdChecked = '', lastResult = null;
  async function findDigisellerCategoryOrSectionById(id) {
    if (!id || !/^\d+$/.test(id)) return null;
    if (id === lastIdChecked) return lastResult;
    const url = location.pathname + '?idprview=' + id + '#r' + id;
    try {
      const resp = await fetch(url, { credentials: 'same-origin' });
      const html = await resp.text();
      const doc = document.implementation.createHTMLDocument('');
      doc.documentElement.innerHTML = html;

      const anchor = doc.querySelector('a[id="r' + id + '"]');
      if (anchor) {
        lastIdChecked = id;
        lastResult = { id: String(id), title: anchor.textContent.trim(), type: 'Категория' };
        return lastResult;
      }
      const small = Array.from(doc.querySelectorAll('small')).find(s => s.textContent.trim() === String(id));
      if (small) {
        const td = small.parentElement;
        let allText = td.textContent.replace(/\s+/g, ' ').trim();
        allText = allText.replace(id, '').replace(/^\s+|\s+$/g, '');
        allText = allText.replace(/(изменить|переместить|удалить)[^%]*$/i, '');
        let match = allText.match(/(.+?)\s*([0-9]+[.,]?\d*)\s*%/);
        let title = '';
        if (match) title = match[1].trim();
        else {
          let noBtns = allText.replace(/(изменить|переместить|удалить)/gi, '').trim();
          title = noBtns || allText;
        }
        lastIdChecked = id;
        lastResult = { id: String(id), title: title, type: 'Раздел' };
        return lastResult;
      }
    } catch (e) { }
    lastIdChecked = id;
    lastResult = null;
    return null;
  }

  // ==== Сбор дерева из путей ====
  function buildTreeFromPaths(lines) {
    let root = [];
    for (let line of lines) {
      let parts = line.trim().replace(/^\s*>\s*/, '').split(/\s*>\s*/).filter(Boolean);
      if (!parts.length) continue;
      let ptr = root, parentRu = '';
      for (let i = 0; i < parts.length; ++i) {
        let ru = parts[i].trim();
        let en = autoEng(ru);
        let isLast = (i === parts.length - 1);

        let exist = ptr.find(x => x.ru === ru);
        if (exist) {
          if (!isLast) {
            if (exist.type === '1') {
              exist.type = '0';
              exist.comm = '';
              exist.att = false;
              exist.children = exist.children || [];
            }
            ptr = exist.children || (exist.children = []);
            parentRu = ru;
            continue;
          } else {
            ptr = exist.children || (exist.children = []);
            parentRu = ru;
            continue;
          }
        }

        let type = isLast ? '1' : '0';
        let comm = isLast ? autoKomiss({ ru, parentRu }) : '';
        let att = false;
        let node = { ru, en, type, comm, att, children: [] };
        ptr.push(node);
        ptr = node.children;
        parentRu = ru;
      }
    }
    return root;
  }

  // ==== Массовая вставка узлов ====
  function appendNodes(nodes, parent, parentRu) {
    const frag = document.createDocumentFragment();
    nodes.forEach(node => {
      let sec = createSection(node, parentRu || '');
      frag.appendChild(sec);
      if (node.children && node.children.length) {
        appendNodes(node.children, sec.querySelector('.vibe-section-children'), node.ru);
      }
    });
    parent.appendChild(frag);
  }

  // ==== Результаты ====
  let lastResultLinesGlobal = null;

  // ==== Основная модалка (singleton) ====
  function buildModalOnce() {
    if (MODAL) return;
    MODAL = document.createElement('div');
    MODAL.id = 'vibe-bulk-modal';
    MODAL.innerHTML = `
      <button class="vibe-close" tabindex="-1" title="Закрыть">✕</button>
      <div class="vibe-row" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <button class="vibe-small-btn" type="button" id="vibe-settings-btn" title="Настройки">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" viewBox="0 0 16 16" style="vertical-align:middle;">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492Z"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.433 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.892 3.433-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.892-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52z"/>
          </svg>
        </button>

        <button class="vibe-small-btn" type="button" id="vibe-reset-state-btn" title="Очистить состояние (поля, дерево, результаты)">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16" style="vertical-align:middle;">
            <path d="M6.5 1h3a.5.5 0 0 1 .5.5V2h3a.5.5 0 0 1 0 1h-1v9.5A2.5 2.5 0 0 1 9.5 15h-3A2.5 2.5 0 0 1 4 12.5V3H3a.5.5 0 0 1 0-1h3V1.5a.5.5 0 0 1 .5-.5zM5 3v9.5A1.5 1.5 0 0 0 6.5 14h3A1.5 1.5 0 0 0 11 12.5V3z"/>
            <path d="M7 5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6A.5.5 0 0 1 7 5zm2 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6A.5.5 0 0 1 9 5z"/>
          </svg>
        </button>
        <button class="vibe-small-btn" type="button" id="vibe-path-paste-btn" title="Показать/скрыть вставку путей" style="margin-left:0;margin-right:2px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-clipboard-plus" viewBox="0 0 16 16" style="vertical-align:middle;">
            <path fill-rule="evenodd" d="M10.5 8a.5.5 0 0 1-.5.5H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 1 0v1.5H10a.5.5 0 0 1 .5.5"/>
            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
            <path d="M9.5 1a.5.5 0 0 1 .5.5V2h-4v-.5a.5.5 0 0 1 .5-.5h3z"/>
          </svg>
        </button>

        <input type="text" id="vibe-parent-path" maxlength="50" autocomplete="off" style="font-size:17px;width:180px;background:#232324;color:#ffe37a;border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 10px;" placeholder="Путь (авто)" />
        <input type="text" id="vibe-parent-id" inputmode="numeric" maxlength="10" autocomplete="off" style="font-size:17px;width:120px;" placeholder="ID" />
        <span id="vibe-parent-title" style="color:#b7ffe7;font-size:18px;margin-left:0;min-width:70px;"></span>
      </div>
      <div id="vibe-path-paste-block" style="display:none;margin-bottom:6px;">
        <textarea id="vibe-path-paste-input-multi" rows="7" placeholder="Вставьте путь(и), например:&#10;Игры > Unreal Deal Pack&#10;Игры > Unreal Deal Pack > Аккаунты&#10;Игры > Unreal Deal Pack > Аккаунты > Steam"></textarea>
        <button class="vibe-small-btn" id="vibe-build-from-paths" style="margin-left:12px;">Построить макет</button>
      </div>
      <div style="overflow-y:auto;max-height:320px;padding-right:4px;" id="vibe-bulk-list"></div>
      <div style="display:flex; justify-content:space-between; gap:16px">
        <button class="vibe-btn" id="vibe-add-main">＋ Добавить элемент</button>
        <button class="vibe-btn" id="vibe-bulk-create">Создать всё</button>
      </div>
      <div id="vibe-bulk-status" class="cat-vibe-status"></div>
      <div id="vibe-bulk-result" style="position:relative;min-height:60px;"></div>
    `;
    document.body.appendChild(MODAL);

    // ==== Ссылки и обработчики (однократно) ====
    const closeBtn = MODAL.querySelector('.vibe-close');
    const settingsBtn = MODAL.querySelector('#vibe-settings-btn');
    const pathInput = MODAL.querySelector('#vibe-parent-path');
    const parentInput = MODAL.querySelector('#vibe-parent-id');
    const parentTitle = MODAL.querySelector('#vibe-parent-title');
    const pathPasteBtn = MODAL.querySelector('#vibe-path-paste-btn');
    const resetBtn = MODAL.querySelector('#vibe-reset-state-btn');
    const pathPasteBlock = MODAL.querySelector('#vibe-path-paste-block');
    const pathPasteInput = MODAL.querySelector('#vibe-path-paste-input-multi');
    const buildFromPathsBtn = MODAL.querySelector('#vibe-build-from-paths');
    const mainList = MODAL.querySelector('#vibe-bulk-list');
    const addMainBtn = MODAL.querySelector('#vibe-add-main');
    const createBtn = MODAL.querySelector('#vibe-bulk-create');

    // закрыть (мягко)
    closeBtn.onclick = () => {
      MODAL.classList.remove('vibe-modal-show');
      MODAL.classList.add('vibe-modal-hide');
      const onEnd = () => {
        MODAL.style.display = 'none';
        MODAL.classList.remove('vibe-modal-hide');
        MODAL.removeEventListener('animationend', onEnd);
      };
      MODAL.addEventListener('animationend', onEnd);
      if (FAB) FAB.style.display = 'flex';
      acHide();
      closeConfirmPopover(); closeSettings();
    };

    MODAL.onwheel = e => { if (MODAL.matches(':hover')) { e.stopPropagation(); } };

    settingsBtn.onclick = () => openSettings(settingsBtn);
    pathPasteBtn.onclick = function () { pathPasteBlock.style.display = (pathPasteBlock.style.display === "none") ? "" : "none"; saveIdle(); };
    resetBtn.onclick = function () {
      openConfirmPopover(resetBtn, {
        title: 'Очистить состояние?',
        desc: 'Будут удалены: путь, ID, дерево и результаты.',
        onOk: () => {
          localStorage.removeItem(LS_KEY);
          pathInput.value = ''; parentInput.value = ''; parentTitle.textContent = '';
          pathPasteInput.value = ''; pathPasteBlock.style.display = 'none';
          clearMainSections(mainList); mainList.appendChild(createSection({}, ''));
          MODAL.querySelector('#vibe-bulk-result').innerHTML = '';
          setStatus('Состояние очищено', '#ffde5c');
          lastResultLinesGlobal = null;
          saveStateImmediate();
        }
      });
    };

    async function updateParentTitlePath() {
      let id = (parentInput.value || '').replace(/\D/g, '');
      parentInput.value = id;
      pathInput.value = FIXED_PATHS[id] || pathInput.value;
      parentTitle.textContent = '';
      if (id) {
        let res = await findDigisellerCategoryOrSectionById(id);
        parentTitle.textContent = res ? `${res.title} (${res.type})` : '–';
      }
      saveIdle();
    }
    parentInput.oninput = updateParentTitlePath;
    parentInput.onblur = updateParentTitlePath;
    pathInput.addEventListener('change', saveIdle, { passive: true });
    pathInput.addEventListener('blur', saveIdle, { passive: true });
    pathPasteInput.addEventListener('change', saveIdle, { passive: true });
    pathPasteInput.addEventListener('blur', saveIdle, { passive: true });

    function setStatus(text, color) {
      let el = MODAL.querySelector('#vibe-bulk-status');
      el.style.color = color || '#ffe37a';
      el.textContent = text;
    }

    function addMainSection(data) {
      mainList.appendChild(createSection(data || {}));
      applyAttestVisibility(MODAL);
      saveStateImmediate();
    }
    addMainBtn.onclick = () => addMainSection();

    buildFromPathsBtn.onclick = function () {
      let val = pathPasteInput.value.trim();
      if (!val) return;
      let lines = val.split('\n').map(l => l.trim()).filter(l => l);
      if (!lines.length) return;

      let firstParts = lines[0].replace(/^\s*>\s*/, '').split(/\s*>\s*/).filter(Boolean);
      if (firstParts.length && FIXED_NAMES_TO_ID[firstParts[0].trim().toLowerCase()]) {
        let pid = FIXED_NAMES_TO_ID[firstParts[0].trim().toLowerCase()];
        parentInput.value = pid; pathInput.value = FIXED_PATHS[pid]; updateParentTitlePath();
        lines = lines.map(line => {
          let arr = line.replace(/^\s*>\s*/, '').split(/\s*>\s*/).filter(Boolean);
          if (arr.length && FIXED_NAMES_TO_ID[arr[0].trim().toLowerCase()]) arr.shift();
          return arr.join(' > ');
        }).filter(Boolean);
      }

      clearMainSections(mainList);
      const tree = buildTreeFromPaths(lines);
      const frag = document.createDocumentFragment();
      appendNodes(tree, frag, '');
      mainList.style.visibility = 'hidden';
      mainList.appendChild(frag);
      mainList.style.visibility = '';
      applyAttestVisibility(MODAL);

      setStatus(`Структура построена из ${lines.length} стр. пути(ей)`, "#b0f99b");
      saveStateImmediate();
    };

    // ==== Делегирование в списке секций ====
    mainList.addEventListener('click', (e) => {
      const t = e.target;
      if (t.classList.contains('vibe-add-child')) {
        const sec = t.closest('.vibe-section');
        const children = sec.querySelector('.vibe-section-children');
        children.appendChild(createSection({}, sec.querySelector('.vibe-ru-name')?.value.trim() || ''));
        applyAttestVisibility(MODAL);
        saveStateImmediate();
      }
      if (t.classList.contains('vibe-remove')) {
        t.closest('.vibe-section')?.remove();
        saveStateImmediate();
      }
    });

    // 🔥 Двойной клик по RU — показать ВСЕ подсказки
    mainList.addEventListener('dblclick', (e) => {
      const t = e.target;
      if (t.classList.contains('vibe-ru-name')) {
        acShow(t, RUS_VARIANTS);
      }
    });

    // Ввод
    mainList.addEventListener('input', (e) => {
      const t = e.target;
      const sec = t.closest('.vibe-section');
      if (!sec) return;

      if (t.classList.contains('vibe-ru-name')) {
        const ru = t.value.trim();
        const enInput = sec.querySelector('.vibe-en-name');
        const typeSel = sec.querySelector('.vibe-type');
        const commField = sec.querySelector('.vibe-commission');
        if (enInput) enInput.value = autoEng(ru);
        if (typeSel && typeSel.value === '1' && commField) {
          const parentSec = sec.parentElement?.closest('.vibe-section');
          const parentRu = parentSec?.querySelector('.vibe-ru-name')?.value.trim() || '';
          commField.value = autoKomiss({ ru, parentRu });
        }
        const val = ru.toLowerCase();
        if (!val) { acHide(); return; }
        const matches = [];
        for (let i = 0; i < RUS_LOWER.length; i++) {
          if (RUS_LOWER[i].startsWith(val)) matches.push(RUS_VARIANTS[i]);
        }
        if (matches.length) acShow(t, matches);
        else acHide();
      }

      if (t.classList.contains('vibe-en-name')) {
        const hasRu = /[А-Яа-яЁё]/.test(t.value);
        t.classList.toggle('vibe-en-warn', hasRu);
      }
    });

    // 🚿 Trim на blur + подсветка EN
    mainList.addEventListener('blur', (e) => {
      const t = e.target;
      if (t.classList.contains('vibe-ru-name') || t.classList.contains('vibe-en-name')) {
        const before = t.value;
        const cleaned = before.replace(/\s+/g, ' ').trim();
        if (before !== cleaned) {
          t.value = cleaned;
          // если это RU — обновим EN и комиссию
          if (t.classList.contains('vibe-ru-name')) {
            const sec = t.closest('.vibe-section');
            const enInput = sec.querySelector('.vibe-en-name');
            const typeSel = sec.querySelector('.vibe-type');
            const commField = sec.querySelector('.vibe-commission');
            if (enInput) enInput.value = autoEng(cleaned);
            if (typeSel && typeSel.value === '1' && commField) {
              const parentSec = sec.parentElement?.closest('.vibe-section');
              const parentRu = parentSec?.querySelector('.vibe-ru-name')?.value.trim() || '';
              commField.value = autoKomiss({ ru: cleaned, parentRu });
            }
          }
        }
        if (t.classList.contains('vibe-en-name')) {
          const hasRu = /[А-Яа-яЁё]/.test(t.value);
          t.classList.toggle('vibe-en-warn', hasRu);
        }
        saveIdle();
      }
    }, true);

    // Изменения — сохранение
    mainList.addEventListener('change', (e) => {
      const t = e.target;
      const sec = t.closest('.vibe-section');
      if (!sec) return;

      if (t.classList.contains('vibe-en-name')) {
        const hasRu = /[А-Яа-яЁё]/.test(t.value);
        t.classList.toggle('vibe-en-warn', hasRu);
        saveIdle();
      }
      if (t.classList.contains('vibe-commission') || t.classList.contains('vibe-attest')) {
        saveIdle();
      }
      if (t.classList.contains('vibe-type')) {
        const commField = sec.querySelector('.vibe-commission');
        const attLabel = sec.querySelector('label');
        if (t.value === '1') {
          if (commField) commField.style.display = '';
          if (attLabel) attLabel.style.display = cfg.advanced ? '' : 'none';
          const ru = sec.querySelector('.vibe-ru-name')?.value.trim() || '';
          const parentSec = sec.parentElement?.closest('.vibe-section');
          const parentRu = parentSec?.querySelector('.vibe-ru-name')?.value.trim() || '';
          if (commField) commField.value = autoKomiss({ ru, parentRu });
        } else {
          if (commField) { commField.style.display = 'none'; commField.value = ''; }
          if (attLabel) attLabel.style.display = 'none';
        }
        saveStateImmediate();
      }
    });

    // Навигация по AC стрелками
    mainList.addEventListener('keydown', (e) => {
      const t = e.target;
      if (!t.classList.contains('vibe-ru-name')) return;
      if (AC.el && AC.el.style.display !== 'none') {
        const nodes = AC.el.querySelectorAll('.vibe-autocomplete-item');
        if (e.key === 'ArrowDown') {
          const next = (AC.activeIdx + 1) % nodes.length; acSetActive(next); e.preventDefault();
        } else if (e.key === 'ArrowUp') {
          const prev = (AC.activeIdx + nodes.length - 1) % nodes.length; acSetActive(prev); e.preventDefault();
        } else if (e.key === 'Enter') {
          if (AC.activeIdx >= 0 && nodes[AC.activeIdx]) {
            nodes[AC.activeIdx].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
            e.preventDefault();
          } else saveIdle();
        } else if (e.key === 'Escape') { acHide(); e.stopPropagation(); }
      } else if (e.key === 'Enter') {
        saveIdle();
      }
    });

    function showResultInModal(results, pathPrefix = [], opts = {}) {
      let lines = [];
      function walk(items, parentPath = []) {
        for (let item of items) {
          if (!item || !item.ru) continue;
          let icon = item.type === '1' ? '📄' : '📁';
          let currPath = [...parentPath, item.ru];
          if (!item.error && item.id) {
            lines.push({ icon, path: currPath.join(' > '), id: item.id });
          }
          if (item.children && item.children.length) walk(item.children, currPath);
        }
      }
      walk(results, pathPrefix);
      lastResultLinesGlobal = lines.slice();
      renderResultsFromLines(lines, opts);
      saveStateImmediate();
    }

    function nowDateTime() {
      const dt = new Date();
      const pad = n => String(n).padStart(2, '0');
      const DD = pad(dt.getDate()); const MM = pad(dt.getMonth() + 1); const YYYY = dt.getFullYear();
      const HH = pad(dt.getHours()); const mm = pad(dt.getMinutes()); const ss = pad(dt.getSeconds());
      return `${DD}.${MM}.${YYYY} ${HH}:${mm}:${ss}`;
    }

    function renderResultsFromLines(lines, { newOnlyInit = false, tableModeInit = false } = {}) {
      function computeThreshold(ls) {
        if (!ls || !ls.length) return -Infinity;
        const lastId = Number(ls[ls.length - 1].id || 0);
        return lastId - 300;
      }
      const threshold = computeThreshold(lines);

      const resultBlock = MODAL.querySelector('#vibe-bulk-result');
      // перерисовка целиком ОК (делаем редко), но копирование — без перерисовок
      resultBlock.innerHTML = `
        <div style="font-size:18px;margin-top:10px;margin-bottom:0;"><b>Результаты создания:</b></div>
        <div class="vibe-result-list-block" id="vibe-result-scroll" tabindex="0">
          ${lines.length ? lines.map(line => `
            <div class="vibe-res-row" style="display:flex;align-items:center;gap:16px;margin-bottom:1px;">
              <span>${line.icon || '📄'}</span>
              <span class="vibe-result-path" style="flex:1;" title="Клик — скопировать путь"><b>${line.path}</b></span>
              <span class="vibe-result-id" data-id="${line.id}" title="Клик — скопировать ID">${line.id}</span>
            </div>
          `).join('') : `<div style="color:#ff9999;">Ничего не создано.</div>`}
        </div>
        <div class="vibe-copy-toolbar">
          <div class="vibe-newonly-wrap" title="Фильтр «Новое»: ID >= (последний ID - 300). Порог: ${threshold}">
            <label><input type="checkbox" id="vibe-copy-tablemode" ${tableModeInit ? 'checked' : ''}> Для таблицы</label>
            <label><input type="checkbox" id="vibe-copy-newonly" ${newOnlyInit ? 'checked' : ''}> Новое</label>
          </div>
          <button class="vibe-copyall-btn" id="vibe-copy-paths" style="width:90px;height:38.8px">Пути</button>
          <button class="vibe-copyall-btn" id="vibe-copy-ids" style="width:90px;height:38.8px">ID</button>
          <button class="vibe-copyall-btn" id="vibe-copy-both" style="width:90px;height:38.8px">Всё</button>
        </div>
      `;

      const resultScroll = MODAL.querySelector('#vibe-result-scroll');
      resultScroll.addEventListener('wheel', function (e) {
        // ловим только крайние случаи; иначе прокрутка идёт как обычно
        let delta = e.deltaY;
        let atTop = this.scrollTop === 0;
        let atBottom = this.scrollHeight - this.scrollTop === this.clientHeight;
        if ((delta < 0 && atTop) || (delta > 0 && atBottom)) { e.preventDefault(); e.stopPropagation(); }
      }, { passive: false });

      const newOnlyEl = MODAL.querySelector('#vibe-copy-newonly');
      const tbModeEl = MODAL.querySelector('#vibe-copy-tablemode');

      const effectiveLines = () => {
        let arr = lines;
        if (newOnlyEl && newOnlyEl.checked) {
          const thr = computeThreshold(lines);
          arr = arr.filter(l => Number(l.id) >= thr);
        }
        return arr;
      };

      function copyPaths() {
        const t = nowDateTime();
        const email = (cfg.tableEmail || '').trim();
        const arr = effectiveLines();
        if (tbModeEl && tbModeEl.checked) return arr.map(l => `${l.path}\t${email}\t${t}`).join('\n');
        return arr.map(l => l.path).join('\n');
      }
      function copyIds() {
        const t = nowDateTime();
        const email = (cfg.tableEmail || '').trim();
        const arr = effectiveLines();
        if (tbModeEl && tbModeEl.checked) return arr.map(l => `${l.id}\t${email}\t${t}`).join('\n');
        return arr.map(l => l.id).join('\n');
      }
      function copyBoth() {
        const t1 = nowDateTime(), t2 = nowDateTime();
        const email = (cfg.tableEmail || '').trim();
        const arr = effectiveLines();
        if (tbModeEl && tbModeEl.checked) return arr.map(l => `${l.path}\t${email}\t${t1}\t${l.id}\t${email}\t${t2}`).join('\n');
        return arr.map(l => `${l.path}\t${l.id}`).join('\n');
      }

      // единый делегат без тяжелых сохранений
      resultBlock.onclick = (e) => {
        const target = e.target;
        if (!target) return;

        if (target.classList.contains('vibe-result-id')) {
          copyTextToClipboard(target.dataset.id);
          target.classList.add('vibe-copied');
          setTimeout(() => target.classList.remove('vibe-copied'), 700);
          return;
        }
        if (target.classList.contains('vibe-result-path') || target.closest('.vibe-result-path')) {
          const el = target.closest('.vibe-result-path');
          const txt = el.textContent.trim();
          copyTextToClipboard(txt);
          el.classList.add('vibe-copied-twinkle');
          setTimeout(() => el.classList.remove('vibe-copied-twinkle'), 750);
          return;
        }
        if (target.id === 'vibe-copy-paths') {
          copyTextToClipboard(copyPaths());
          target.textContent = '✓'; setTimeout(() => target.textContent = 'Пути', 900);
          // Без saveStateImmediate — чтобы не фризило
          return;
        }
        if (target.id === 'vibe-copy-ids') {
          copyTextToClipboard(copyIds());
          target.textContent = '✓'; setTimeout(() => target.textContent = 'ID', 900);
          return;
        }
        if (target.id === 'vibe-copy-both') {
          copyTextToClipboard(copyBoth());
          target.textContent = '✓'; setTimeout(() => target.textContent = 'Всё', 900);
          return;
        }
      };

      [newOnlyEl, tbModeEl].forEach(el => { el && el.addEventListener('change', () => { lastResultLinesGlobal = lines.slice(); saveIdle(); }, { passive: true }); });
    }

    function createAll(items, parentId, setStatus, path = [], cb) {
      let idx = 0;
      function next() {
        if (idx >= items.length) { cb && cb(); return; }
        let el = items[idx++];
        setStatus(`Создаём: ${[...path, el.ru].join(' > ')}...`, "#ffe37a");
        createSingle(el, parentId, (newId, err) => {
          if (err) { el.id = null; el.error = err; el.children = []; next(); }
          else {
            el.id = newId; el.error = null;
            if (el.children && el.children.length) createAll(el.children, newId, setStatus, [...path, el.ru], next);
            else next();
          }
        });
      }
      next();
    }

    function createSingle(data, parentId, cb) {
      let formData = [
        `Razdel=${encodeURIComponent(data.ru)}`,
        `Razdel_eng=${encodeURIComponent(data.en)}`,
        `Operation=${encodeURIComponent('добавление раздела')}`,
        `ID_PR=${parentId}`,
        `idprview=${parentId}`,
        `Type_R=${data.type}`
      ];
      if (data.type == '1') {
        formData.push(`Comiss=${encodeURIComponent(data.comm)}`);
        formData.push(`CheckAtt=${data.att ? 'yes' : ''}`);
        formData.push(`Description=`);
      }
      GM_xmlhttpRequest({
        method: "POST",
        url: `https://my.digiseller.ru/asp/razdels.asp?idr=${parentId}&idprview=${parentId}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: formData.join('&'),
        onload: function (resp) {
          if (resp.status === 200) {
            let doc = new DOMParser().parseFromString(resp.responseText, "text/html");
            let foundId = null;
            let ruNameNorm = data.ru.replace(/^ |^&nbsp;| /g, '').trim();
            let allTargets = Array.from(doc.querySelectorAll('a.target'));
            for (let a of allTargets) {
              let name = a.textContent.replace(/^ |^&nbsp;| /g, '').trim();
              if (name === ruNameNorm) {
                let td = a.closest('td');
                if (td) {
                  let smalls = td.querySelectorAll('small');
                  for (let s of smalls) {
                    let idText = s.textContent.trim();
                    if (/^\d+$/.test(idText)) foundId = idText;
                  }
                }
              }
            }
            if (!foundId) {
              let allSmalls = Array.from(doc.querySelectorAll('small[style*="color:silver"]'));
              for (let s of allSmalls) {
                let parentTd = s.parentElement;
                let tdHtml = parentTd.innerHTML;
                let regexp = new RegExp('</small>(\\s|&nbsp;| )*' + data.ru.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                if (regexp.test(tdHtml)) {
                  let idText = s.textContent.trim();
                  if (/^\d+$/.test(idText)) foundId = idText;
                }
              }
            }
            if (foundId) cb(foundId, null);
            else cb(null, "Не найден ID созданного элемента (" + data.ru + ").");
          } else cb(null, "HTTP " + resp.status);
        },
        onerror: function () { cb(null, "Ошибка сети/запроса"); }
      });
    }

    function setStatus(text, color) {
      let el = MODAL.querySelector('#vibe-bulk-status');
      el.style.color = color || '#ffe37a';
      el.textContent = text;
    }

    // ==== Восстановление состояния при первом создании ====
    (function restoreState() {
      const raw = localStorage.getItem(LS_KEY);
      const mainList = MODAL.querySelector('#vibe-bulk-list');
      const pathInput = MODAL.querySelector('#vibe-parent-path');
      const parentInput = MODAL.querySelector('#vibe-parent-id');
      const pathPasteBlock = MODAL.querySelector('#vibe-path-paste-block');
      const pathPasteInput = MODAL.querySelector('#vibe-path-paste-input-multi');
      if (!raw) { mainList.appendChild(createSection({}, '')); return; }
      let st = null; try { st = JSON.parse(raw); } catch (e) { }
      if (!st) { mainList.appendChild(createSection({}, '')); return; }

      if (st.settings) { cfg.advanced = !!st.settings.advanced; cfg.tableEmail = (st.settings.tableEmail || '').trim(); }
      if (st.parentPath) pathInput.value = st.parentPath;
      if (st.parentId) parentInput.value = st.parentId.replace(/\D/g, '');
      if (st.pathPasteInput) pathPasteInput.value = st.pathPasteInput;
      pathPasteBlock.style.display = st.pathPasteVisible ? '' : 'none';

      clearMainSections(mainList);
      const frag = document.createDocumentFragment();
      if (st.sections && st.sections.length) appendNodes(st.sections, frag, '');
      else frag.appendChild(createSection({}, ''));
      mainList.style.visibility = 'hidden';
      mainList.appendChild(frag);
      mainList.style.visibility = '';
      applyAttestVisibility(MODAL);

      if (st.results && st.results.lines && st.results.lines.length) {
        lastResultLinesGlobal = st.results.lines.slice();
        renderResultsFromLines(st.results.lines, { newOnlyInit: !!st.results.newOnly, tableModeInit: !!st.results.tableMode });
      }
      // подтянем заголовок родителя
      parentInput.dispatchEvent(new Event('input'));
    })();

    // ==== Кнопка «Создать всё» ====
    createBtn.onclick = async function () {
      const parentInput = MODAL.querySelector('#vibe-parent-id');
      const pathInput = MODAL.querySelector('#vibe-parent-path');
      const mainList = MODAL.querySelector('#vibe-bulk-list');
      let parentId = (parentInput.value || '').trim();
      if (!parentId || isNaN(+parentId)) return setStatus("Укажите корректный ID родителя!", "#ff7575");
      let pathPrefix = (pathInput.value || '').trim();
      let items = readAllSections(mainList);
      if (!items.length) return setStatus("Добавьте хотя бы один элемент!", "#ff7575");

      setStatus("Создание...", "#ffe37a");
      createAll(items, parentId, setStatus, pathPrefix ? [pathPrefix] : [], () => {
        // Сохраняем прошлые UI-фильтры
        let prevNewOnly = false, prevTableMode = false;
        try { const st = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); prevNewOnly = !!st?.results?.newOnly; prevTableMode = !!st?.results?.tableMode; } catch (e) { }
        showResultInModal(items, pathPrefix ? [pathPrefix] : [], { newOnlyInit: prevNewOnly, tableModeInit: prevTableMode });
        setStatus("Всё создано!", "#b0f99b");
        // ВАЖНО: НЕ возвращаем FAB здесь — окно открыто, кнопка не должна появляться.
      });
    };
  }

  function openModal() {
    buildModalOnce();
    // показать
    MODAL.style.display = 'flex';
    MODAL.classList.add('vibe-modal-show');
    if (FAB) FAB.style.display = 'none';
  }

  // ==== подтверждающий поповер ====
  let confirmMask = null, confirmPop = null;
  function closeConfirmPopover() {
    if (confirmMask) { confirmMask.remove(); confirmMask = null; }
    if (confirmPop) { confirmPop.remove(); confirmPop = null; }
    document.removeEventListener('keydown', onEscClose);
  }
  function onEscClose(e) { if (e.key === 'Escape') closeConfirmPopover(); }
  function openConfirmPopover(anchorEl, { title, desc, onOk, onCancel }) {
    closeConfirmPopover();
    confirmMask = document.createElement('div');
    confirmMask.className = 'vibe-confirm-mask';
    confirmMask.addEventListener('mousedown', closeConfirmPopover, { passive: true });
    document.body.appendChild(confirmMask);

    confirmPop = document.createElement('div');
    confirmPop.className = 'vibe-confirm-popover';
    confirmPop.innerHTML = `
      <div class="vcp-title">${title || 'Подтверждение'}</div>
      ${desc ? `<div class="vcp-desc">${desc}</div>` : ''}
      <div class="vcp-actions">
        <button type="button" class="vcp-cancel">Отмена</button>
        <button type="button" class="vcp-ok">Да</button>
      </div>
    `;
    document.body.appendChild(confirmPop);

    const r = anchorEl.getBoundingClientRect();
    const pr = confirmPop.getBoundingClientRect();
    let top = r.top - pr.height - 8 + window.scrollY;
    if (top < 6 + window.scrollY) top = r.bottom + 8 + window.scrollY;
    let left = r.left + window.scrollX;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - pr.width - 6;
    if (left > maxLeft) left = Math.max(6 + window.scrollX, maxLeft);
    if (left < 6 + window.scrollX) left = 6 + window.scrollX;
    confirmPop.style.top = top + 'px';
    confirmPop.style.left = left + 'px';

    confirmPop.querySelector('.vcp-ok').addEventListener('click', () => { closeConfirmPopover(); try { onOk && onOk(); } catch (e) { } });
    confirmPop.querySelector('.vcp-cancel').addEventListener('click', () => { closeConfirmPopover(); try { onCancel && onCancel(); } catch (e) { } });
    setTimeout(() => document.addEventListener('keydown', onEscClose), 0);
  }

  // ==== Настройки (⚙️) ====
  let settingsMask = null, settingsPop = null;
  function closeSettings() {
    if (settingsMask) { settingsMask.remove(); settingsMask = null; }
    if (settingsPop) { settingsPop.remove(); settingsPop = null; }
    document.removeEventListener('keydown', onEscCloseSettings);
  }
  function onEscCloseSettings(e) { if (e.key === 'Escape') closeSettings(); }
  function openSettings(anchorEl) {
    closeSettings();
    settingsMask = document.createElement('div');
    settingsMask.className = 'vibe-settings-mask';
    settingsMask.addEventListener('mousedown', closeSettings, { passive: true });
    document.body.appendChild(settingsMask);

    settingsPop = document.createElement('div');
    settingsPop.className = 'vibe-settings-pop';
    settingsPop.innerHTML = `
      <h4>⚙️ Настройки</h4>
      <div class="vibe-settings-row">
        <label style="margin:0;display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="vibe-set-advanced" ${cfg.advanced ? 'checked' : ''}>
          Продвинутые параметры (показывать «Аттестат»)
        </label>
      </div>
      <div class="vibe-settings-row" title="Используется в форматах копирования «Для таблицы»">
        <label style="margin:0;min-width:72px;">Email</label>
        <input type="email" id="vibe-set-email" placeholder="example@domain.com" value="${(cfg.tableEmail || '').replace(/"/g, '&quot;')}">
      </div>
      <div class="vibe-settings-actions">
        <button type="button" class="vibe-settings-btn" id="vibe-set-close">Закрыть</button>
      </div>
    `;
    document.body.appendChild(settingsPop);

    const r = anchorEl.getBoundingClientRect();
    const pr = settingsPop.getBoundingClientRect();
    let top = r.bottom + 8 + window.scrollY;
    let left = r.left + window.scrollX;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - pr.width - 6;
    if (left > maxLeft) left = Math.max(6 + window.scrollX, maxLeft);
    settingsPop.style.top = top + 'px';
    settingsPop.style.left = left + 'px';

    const advEl = settingsPop.querySelector('#vibe-set-advanced');
    const emailEl = settingsPop.querySelector('#vibe-set-email');
    advEl.addEventListener('change', () => {
      cfg.advanced = !!advEl.checked;
      applyAttestVisibility(MODAL);
      saveStateImmediate();
    }, { passive: true });
    emailEl.addEventListener('input', () => {
      cfg.tableEmail = emailEl.value.trim();
      saveIdle();
    });
    settingsPop.querySelector('#vibe-set-close').onclick = closeSettings;
    setTimeout(() => document.addEventListener('keydown', onEscCloseSettings), 0);
  }

  // ==== FAB кнопка ====
  function addFloatingBtn() {
    if (document.getElementById('vibe-bulk-fab')) return;
    FAB = document.createElement('button');
    FAB.id = 'vibe-bulk-fab';
    FAB.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-box-seam" viewBox="0 0 16 16">
        <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.404.961L10.404 2zm3.564 1.426L5.596 5 8 5.961 14.154 3.5zm3.25 1.7-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z"></path>
      </svg>
    `;
    FAB.title = "Массовое создание категорий/разделов";
    FAB.onclick = () => { openModal(); };
    document.body.appendChild(FAB);
  }

  // ==== Рендер результатов «Создать всё» (обёртки) ====
  function showResultInModal(results, pathPrefix = [], opts = {}) {
    // функция-обёртка для внешних вызовов: делегируем во внутреннюю, уже объявленную в модалке
    // здесь ничего не делаем: внутренняя версия объявлена в buildModalOnce → createBtn.onclick
  }

  // ==== Запуск ====
  setTimeout(() => { addFloatingBtn(); buildModalOnce(); }, 0);

})();
