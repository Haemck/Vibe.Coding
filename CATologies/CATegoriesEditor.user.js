// ==UserScript==
// @name         GGSEL Category Editor • vibe (gold theme) — drag+hover like CATologiesEditor (+ event hook)
// @namespace    ggsel.quick.editor
// @version      3.3.0
// @description  Ввод digi_catalog → поиск admin id (POST /categories-ajax), парс edit-формы, безопасное сохранение по ID (PUT через AJAX JSON, без редиректов), расширенный лог. Basic dev:pewpew. Модалка со скроллом, не вылезает за экран, ПЕРЕТАСКИВАНИЕ и сохранение позиции. Кнопки с hover-перекраской, FAB с pop-in анимацией. Добавлены forbidden_type, preorder_date (показывать при «Предзаказ»), tag, platform, max_cnt_sell. Фиксы: seo_text(id), CSS border-top. Связка: слушает событие `vibe:cqe-open` и автоподставляет digi + жмёт «Загрузить» с антидублирующей защитой (1.5s). Добавлены: автоподсказки RU→EN для подкатегории и хлебных крошек, подсказки мин.цены, кнопка «Переделать в Покупку…», автозагрузка по вставке ID, 500=успех, красная подсветка «Тип контента» при «Платформа/Софт».
// @author       vibe
// @match        https://my.digiseller.ru/asp/razdels.asp*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      admin.ggsel.com
// @updateURL    https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATegoriesEditor.user.js
// @downloadURL  https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATegoriesEditor.user.js
// ==/UserScript==

(function () {
  'use strict';

  /** ================= КОНФИГ ================= */
  const ADMIN_BASE = 'https://admin.ggsel.com';
  const LIST_URL   = `${ADMIN_BASE}/daRfsd/categories`;
  const SHOW_URL   = (id) => `${ADMIN_BASE}/daRfsd/categories/${encodeURIComponent(id)}`;
  const UPDATE_URL = (id) => `${ADMIN_BASE}/daRfsd/categories/${encodeURIComponent(id)}`;
  const AJAX_URL   = `${ADMIN_BASE}/daRfsd/categories-ajax`;

  // 🔒 Basic-авторизация
  const BASIC_AUTH = 'Basic ' + (typeof btoa==='function' ? btoa('dev:pewpew') : 'ZGV2OnBld3Bldw==');

  // ===== СЛОВАРЬ АВТО-EN (как в CATologiesEditor) =====
  const AUTO_ENG = {
    "Аккаунты": "Accounts",
    "Ключи": "Keys",
    "Аренда аккаунтов": "Account rental",
    "Оффлайн аккаунты": "Offline Accounts",
    "Услуги активации": "Activation Services",
    "Покупка на ваш аккаунт": "Purchase on your account",
    "DLC": "DLC",
    "Скины": "Skins",
    "Предметы": "Items",
    "Валюта": "Currency",
    "Боевой пропуск": "Battle pass",
    "Наборы": "Packs",
    "Гайды": "Guides",
    "Дизайн-проекты": "Design projects",
    "Пополнение баланса": "Balance top up",
    "Steam": "Steam",
    "Epic Games Store": "Epic Games Store",
    "EA app": "EA app",
    "Meta Quest": "Meta Quest",
    "GOG": "GOG",
    "PlayStation": "PlayStation",
    "Uplay": "Uplay",
    "Xbox / Microsoft Store": "Xbox / Microsoft Store"
  };
  const RUS_VARIANTS = Object.keys(AUTO_ENG);
  const autoEng = (val) => AUTO_ENG[val] || val;
  const MIN_PRICE_SUGGESTIONS = ['0.1', '149', '449', '999999'];

  // поля, которые всегда безопасны в headless-режиме
  const DEFAULT_SAFE_FIELDS = new Set([
    'url','type_id','content_type_id','min_price','parent_id',
    'title','translations[en][title]',
    'filter_title','translations[en][filter_title]',
    'filter_title_virtual','translations[en][filter_title_virtual]',
    'breadcrumbs_title','translations[en][breadcrumbs_title]',
    'search_title','translations[en][search_title]',
    'seo_title','translations[en][seo_title]',
    'seo_desc','translations[en][seo_desc]',
    'seo_text','translations[en][seo_text]',
    'forbidden_type',
    'preorder_date',       // сервер ждёт ключ — отправляем даже пустой
    'tag',                 // Теги для поиска
    'platform',            // Платформы
    'max_cnt_sell'         // Ограничение кол-ва продаж
  ]);

  // 🚫 бан-лист колонок, которых нет в БД
  const HARD_BLOCK_FIELDS = new Set([
    'show_in_parent_category',
    'is_content_type_filter_enabled'
  ]);

  /** ============== СТИЛИ (включая подсказки и красную подсветку) ============== */
  GM_addStyle(`
    @import url('https://fonts.googleapis.com/css?family=JetBrains+Mono:400,700&display=swap');

    @keyframes vibe-pop-in { 0%{opacity:0; transform:translateY(-24px) scale(0.97);} 100%{opacity:1; transform:none;} }

    #vibe-cqe-fab{
      position:fixed;left:532px;bottom:32px;z-index:999999;
      width:78px;height:78px;border-radius:50%;
      background:linear-gradient(135deg,#ffe37a 70%,#181920 190%);
      box-shadow:0 7px 32px #000c,0 2px 0 #ffe37a66;
      border:4px solid #ffe37a;
      font-size:46px;display:flex;align-items:center;justify-content:center;
      cursor:pointer;border:none;color:#181920;user-select:none;
      transition:background .15s, box-shadow .17s;
      animation:vibe-pop-in .28s cubic-bezier(.26,1.2,.23,1) both;
    }
    #vibe-cqe-fab:hover{ background:linear-gradient(135deg,#fffbe3 90%,#ffe37a 140%); color:#29291a; box-shadow:0 11px 52px #ffe37a77,0 2px 0 #ffe37a88; }

    #vibe-cqe-modal{
      position:fixed;top:28px;left:24px;z-index:1000000;width:min(1040px,98vw);max-height:calc(96vh - 24px);
      background:#181920;color:#ffe37a;border:3.5px solid #ffe37a;border-radius:15px;box-shadow:0 9px 54px #000d,0 0 0 6px #ffde5c33;
      padding:0 0 8px 0;overflow:hidden;display:none;flex-direction:column;font-family:'JetBrains Mono',monospace;
    }

    #vibe-cqe-header{ display:flex;align-items:center;gap:10px;padding:18px 22px 12px 28px;border-bottom:2px solid #ffe37a44; cursor:move; user-select:none; }
    #vibe-cqe-title{font-weight:900;font-size:18.6px;letter-spacing:.02em;flex:1}
    #vibe-cqe-close{ background:transparent;border:none;cursor:pointer;color:#ffe37a;font-weight:900;font-size:28px;line-height:1;padding:4px 8px;border-radius:8px;outline:none }
    #vibe-cqe-close:hover{ color:#fffbe3; background:#ffe37a22; }

    #vibe-cqe-body{padding:14px 28px 8px 28px;overflow:auto;overscroll-behavior:contain}
    #vibe-cqe-footer{ padding:10px 28px 16px 28px;border-top:2px solid #ffe37a44;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#1b1c24 }

    .vibe-field label{font-size:13.8px;font-weight:700;margin-bottom:6px;display:block;color:#ffe37a;}
    .vibe-input,.vibe-select,.vibe-textarea{ width:100%;font-family:inherit;font-size:15px;background:#232324;color:#ffe37a;border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 10px }
    .vibe-input:focus,.vibe-select:focus,.vibe-textarea:focus{ border-color:#ffe37a; outline:none; }
    .vibe-textarea{min-height:84px;resize:vertical}
    .vibe-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}
    .vibe-grid.single{grid-template-columns:1fr}
    .vibe-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .vibe-btn{
      background:linear-gradient(90deg,#ffe37a,#181920 160%);color:#181920;font-weight:900;border:none;border-radius:10px;
      box-shadow:0 3px 0 #ffe37a36,0 1px 8px #ffe37a17;padding:12px 16px;cursor:pointer;transition:background .15s,color .15s,box-shadow .18s; font-size:16px; letter-spacing:.04em;
    }
    .vibe-btn:hover{ background:linear-gradient(90deg,#fffbe3,#ffe37a 130%);color:#181920;box-shadow:0 7px 28px #ffe37a25; }
    .vibe-btn.alt{background:#ffe37a33;color:#ffe37a;box-shadow:none}
    .vibe-btn.alt:hover{ background:linear-gradient(90deg,#fffbe3,#ffe37a 130%); color:#181920; box-shadow:0 7px 28px #ffe37a25; }

    #vibe-cqe-status-top{font-size:13.5px;color:#ffe37a;margin:4px 0 8px 0;white-space:pre-wrap}
    #vibe-cqe-status{font-size:13px;color:#bfe9ff}
    #vibe-cqe-log{margin-top:8px;display:none}
    #vibe-cqe-log pre{ max-height:300px;overflow:auto;background:#1d1f27;border:1.6px solid #ffe37a55;padding:10px;border-radius:8px;margin:0;font-size:12.8px;line-height:1.45;white-space:pre-wrap;color:#ffe37a }

    #vibe-cqe-meta{margin-top:10px;border:1.8px solid #ffe37a66;background:#232324;border-radius:10px;padding:10px 12px}
    .vibe-flags{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 12px;margin-top:8px}
    .vibe-flag{font-size:13.5px;display:flex;align-items:center;gap:8px}
    #wrap_preorder_date{transition:.15s ease}

    /* ===== АВТОКОМПЛИТ (портал) ===== */
    .cqe-autocomplete-portal {
      position:fixed; z-index:99999999; min-width:180px; max-width:360px;
      background:#1d1f27; color:#ffe37a; border:2px solid #ffe37a77; border-radius:7px;
      box-shadow:0 8px 22px #000a; padding:5px 0; max-height:205px; overflow-y:auto;
      font-family:'JetBrains Mono',monospace; font-size:15.7px; display:none;
    }
    .cqe-autocomplete-item{ padding:7px 15px; cursor:pointer; transition:background .13s; color:#ffe37a; }
    .cqe-autocomplete-item.active, .cqe-autocomplete-item:hover{ background:linear-gradient(90deg,#ffe37a33 80%,#ffe37a11 140%); color:#181920; }

    /* Подсветки ошибок/опасных значений */
    .cqe-has-cyrillic { box-shadow: 0 0 0 3px #ff6b6b44 inset !important; border-color:#ff9b9b !important; }
    .cqe-select-danger { border-color:#ff6b6b !important; box-shadow:0 0 0 3px #ff6b6b33 inset !important; color:#ffe0e0 !important; }
  `);

  /** ============== УТИЛИТЫ ============== */
  function el(tag, attrs={}, html=''){ const e=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v)); if(html) e.innerHTML=html; return e; }
  const $ = (sel, root=document)=>root.querySelector(sel);
  const cssEscape = (s)=> String(s).replace(/([ #;?%&,.+*~':"!^$[\]()=>|\/@])/g,'\\$1');
  function setVal(sel, v){ const e=$(sel, modal); if(e) e.value = v==null? '' : String(v); }
  function fill(sel, v){ const e=$(sel, modal); if(e) e.value=v||''; }
  function setCB(sel, v){ const e=$(sel, modal); if(e) e.checked=!!v; }
  function val(sel){ const e=$(sel, modal); return e?(e.value||'').trim():''; }
  function cb(sel){ const e=$(sel, modal); return !!(e&&e.checked); }
  function maskAuth(h){ const x={...h}; if(x.Authorization) x.Authorization='Basic ***'; return x; }
  function decodeURIComponentSafe(s){ try{ return decodeURIComponent(s); }catch(_){ return s; } }

  function log(text){
    if(!logPre) return;
    logPre.textContent += (logPre.textContent?'\n':'') + text;
    logPre.scrollTop = logPre.scrollHeight;
  }
  function setTop(msg, err=false){
    const el = $('#vibe-cqe-status-top', modal);
    el.textContent = msg;
    el.style.color = err ? '#ffb4b4' : '#ffe37a';
    log((err?'[ERROR] ':'')+msg);
  }
  function setStatus(msg, err=false){
    const el = $('#vibe-cqe-status', modal);
    el.textContent = msg;
    el.style.color = err ? '#ffb4b4' : '#bfe9ff';
    log((err?'[ERROR] ':'')+msg);
  }

  const delay = (ms)=> new Promise(r=>setTimeout(r, ms));
  async function waitFor(pred, timeout=4000, step=40){
    const t0 = performance.now();
    while(performance.now()-t0 < timeout){
      try{ if(pred()) return true; }catch(_){}
      await delay(step);
    }
    return false;
  }

  /** ============== HTTP ============== */
  function http(opts){
    log(`HTTP ${opts.method||'GET'} ${opts.url}`);
    if(opts.headers) log('Headers: '+JSON.stringify(maskAuth(opts.headers)));
    if(opts.data) {
      const preview = typeof opts.data==='string' ? decodeURIComponentSafe(opts.data).slice(0,1500) : JSON.stringify(opts.data).slice(0,1500);
      log('Body: '+preview);
    }
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method: opts.method||'GET',
        url: opts.url,
        headers: opts.headers||{},
        data: opts.data,
        responseType: opts.responseType||'text',
        timeout: opts.timeout||30000,
        onload: (res)=>{
          log(`-> status ${res.status}${res.finalUrl?` | finalUrl: ${res.finalUrl}`:''}`);
          if(res.responseHeaders) log('-> respHeaders: ' + String(res.responseHeaders).split(/\r?\n/).slice(0,20).join(' | '));
          if(res.responseText){ log('-> body[0..1500]: '+String(res.responseText).slice(0,1500)); }
          resolve(res);
        },
        onerror: (err)=>{ log('-> onerror: '+JSON.stringify(err)); reject(err); },
        ontimeout: ()=>{ log('-> timeout'); reject(new Error('timeout')); }
      });
    });
  }

  /** ============== FAB + МОДАЛ ============== */
  const fab = el('button',{id:'vibe-cqe-fab',title:'GGSEL Category Quick Editor'},`
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16" width="36" height="36">
      <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"></path>
      <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"></path>
    </svg>
  `);
  document.body.appendChild(fab);

  const modal = el('div',{id:'vibe-cqe-modal',tabindex:'-1'},`
    <div id="vibe-cqe-header">
      <div id="vibe-cqe-title">GGSEL Category Quick Editor</div>
      <button id="vibe-cqe-close" title="Закрыть">✕</button>
    </div>

    <div id="vibe-cqe-body">
      <div id="vibe-cqe-status-top">// статусы и ошибки будут здесь</div>

      <div class="vibe-grid single">
        <div class="vibe-field">
          <div class="vibe-row">
            <input type="text" id="cqe-digi" class="vibe-input" placeholder="Введи Digi ID" style="width:180px;padding: 9px 10px;font-size: 18px;">
            <button class="vibe-btn" id="cqe-load">Загрузить</button>
            <!-- ⚡ Новая кнопка — появляется при «Услуги активации» -->
            <button class="vibe-btn alt" id="cqe-convert" style="display:none;">Переделать в Покупку…</button>
            <label class="vibe-row" style="gap:6px;margin-left:6px;font-size:13.5px;">
              <input type="checkbox" id="cqe-toggle-log"> Лог
            </label>
          </div>
        </div>
      </div>

      <div id="vibe-cqe-choice" style="display:none;">
        <div class="vibe-field">
          <label>Найдено несколько категорий — выбери нужную:</label>
          <div class="vibe-row">
            <select id="cqe-choice-select" class="vibe-select" style="flex:1 1 auto;"></select>
            <button class="vibe-btn alt" id="cqe-choice-apply">Выбрать</button>
          </div>
        </div>
      </div>

      <div id="vibe-cqe-meta" style="display:none;">
        <div class="vibe-grid">
          <div class="vibe-field"><label>Системное имя DIGISELLER</label><input type="text" id="m_sys_name" class="vibe-input" disabled placeholder="—"></div>
          <div class="vibe-field"><label>Родительская категория (имя)</label><input type="text" id="m_parent_name" class="vibe-input" disabled placeholder="—"></div>
        </div>
        <br>
        <div class="vibe-grid">
          <div class="vibe-field"><label>Родительская категория (parent_id)</label><input type="text" id="m_parent_id" class="vibe-input" placeholder="например 187794"></div>
          <div class="vibe-field"><label>Предродительская категория (имя)</label><input type="text" id="m_parentparent_name" class="vibe-input" disabled placeholder="—"></div>
        </div>
        <br>
        <div class="vibe-grid single">
          <div class="vibe-field"><label>ID раздела DIGISELLER</label><input type="text" id="m_digi_id" class="vibe-input" disabled placeholder="—"></div>
        </div>
      </div>

      <div id="vibe-cqe-log"><pre id="cqe-log-pre"></pre></div>

      <div id="cqe-form" style="display:none;margin-top:8px;">
        <div class="vibe-grid">
          <div class="vibe-field"><label>URL</label><input type="text" id="f_url" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <div class="vibe-field"><label>Тип категорий для /games</label><select id="f_type_id" class="vibe-select"></select></div>

          <!-- 🔴 Будем подсвечивать это поле, если выбраны «Платформа/Софт» -->
          <div class="vibe-field"><label>Тип контента</label><select id="f_content_type_id" class="vibe-select"></select></div>

          <!-- Минимальная цена — с подсказками на dblclick -->
          <div class="vibe-field"><label>Минимальная цена</label><input type="text" id="f_min_price" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>

          <div class="vibe-field"><label>Название (ru)</label><input type="text" id="f_title_ru" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <div class="vibe-field"><label>Название (en)</label><input type="text" id="f_title_en" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>

          <!-- Автоподсказки + автоEN для «подкатегории» -->
          <div class="vibe-field"><label>Название как подкатегории (ru)</label><input type="text" id="f_filter_title_ru" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <div class="vibe-field"><label>Название как подкатегории (en)</label><input type="text" id="f_filter_title_en" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>

          <div class="vibe-field"><label>Название как подкатегории у виртуальных категорий (ru)</label><input type="text" id="f_filter_title_virtual_ru" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <div class="vibe-field"><label>Название как подкатегории у виртуальных категорий (en)</label><input type="text" id="f_filter_title_virtual_en" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>

          <!-- Автоподсказки + автоEN для «хлебных крошек» -->
          <div class="vibe-field"><label>Название категории для хлебных крошек (ru)</label><input type="text" id="f_breadcrumbs_title_ru" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <div class="vibe-field"><label>Название категории для хлебных крошек (en)</label><input type="text" id="f_breadcrumbs_title_en" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>

          <div class="vibe-field"><label>Название категории для поиска (ru)</label><input type="text" id="f_search_title_ru" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <div class="vibe-field"><label>Название категории для поиска (en)</label><input type="text" id="f_search_title_en" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>

          <div class="vibe-field"><label>SEO title (ru)</label><input type="text" id="f_seo_title_ru" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <div class="vibe-field"><label>SEO title (en)</label><input type="text" id="f_seo_title_en" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>

          <div class="vibe-field"><label>SEO desc (ru)</label><input type="text" id="f_seo_desc_ru" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <div class="vibe-field"><label>SEO desc (en)</label><input type="text" id="f_seo_desc_en" class="vibe-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>

          <div class="vibe-field"><label>Тип запрещенного товара</label><select id="f_forbidden_type" class="vibe-select"></select></div>

          <div class="vibe-field" id="wrap_preorder_date" style="display:none;">
            <label>Дата релиза (preorder_date)</label>
            <input type="text" id="f_preorder_date" class="vibe-input" placeholder="YYYY-MM-DD HH:MM:SS" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          </div>

          <div class="vibe-field"><label>Теги для поиска на сайте</label><input type="text" id="f_tag" class="vibe-input" placeholder="через запятую" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
          <div class="vibe-field"><label>Платформы</label><input type="text" id="f_platform" class="vibe-input" placeholder="например: Steam, PS5" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>

          <div class="vibe-field"><label>Ограничение кол-ва продаж товаров</label><select id="f_max_cnt_sell" class="vibe-select"></select></div>
        </div>

        <div class="vibe-grid">
          <div class="vibe-field"><label>SEO text (ru)</label><textarea id="f_seo_text_ru" class="vibe-textarea" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea></div>
          <div class="vibe-field"><label>SEO text (en)</label><textarea id="f_seo_text_en" class="vibe-textarea" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea></div>
        </div>

        <div class="vibe-flags" id="cqe-flags"></div>
      </div>
    </div>

    <div id="vibe-cqe-footer">
      <div class="vibe-row" style="gap:12px;">
        <div id="vibe-cqe-status">Готов.</div>
      </div>
      <div class="vibe-row">
        <button class="vibe-btn" id="cqe-save">Сохранить</button>
      </div>
    </div>
  `);
  document.body.appendChild(modal);

  /** ===== Перетаскивание модалки + клемп и сохранение позиции ===== */
  const DRAG_HANDLE = $('#vibe-cqe-header', modal);
  const BODY_SCROLL_WRAP = $('#vibe-cqe-body', modal);
  const POS_KEY = 'vibeCqePos';

  function clampToViewport(el) {
    const rect = el.getBoundingClientRect();
    let top  = parseInt(el.style.top || rect.top);
    let left = parseInt(el.style.left || rect.left);
    const maxTop  = Math.max(0, window.innerHeight - rect.height);
    const maxLeft = Math.max(0, window.innerWidth  - rect.width);
    if (!Number.isFinite(top)) top = 0;
    if (!Number.isFinite(left)) left = 0;
    top  = Math.min(Math.max(0, top ), maxTop );
    left = Math.min(Math.max(0, left), maxLeft);
    el.style.top  = top  + 'px';
    el.style.left = left + 'px';
  }
  function adjustBodyMaxHeight() {
    const rect = modal.getBoundingClientRect();
    const head = DRAG_HANDLE.getBoundingClientRect();
    const foot = $('#vibe-cqe-footer', modal).getBoundingClientRect();
    const modalStyle = getComputedStyle(modal);
    const padT = parseInt(modalStyle.paddingTop)  || 0;
    const padB = parseInt(modalStyle.paddingBottom)||0;
    const avail = Math.max(100, window.innerHeight - (rect.top + (head.height + foot.height + padT + padB) + 24));
    BODY_SCROLL_WRAP.style.maxHeight = avail + 'px';
  }
  (function restorePosition(){
    try{
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if(saved && Number.isFinite(saved.top) && Number.isFinite(saved.left)){
        modal.style.top = saved.top + 'px';
        modal.style.left= saved.left+ 'px';
        clampToViewport(modal);
      }
    }catch(_){}
  })();
  (function enableDragging(){
    let isDragging=false, dx=0, dy=0;
    DRAG_HANDLE.addEventListener('mousedown', (e)=>{
      if(e.button!==0) return;
      const r = modal.getBoundingClientRect();
      isDragging=true; dx=e.clientX - r.left; dy=e.clientY - r.top;
      document.body.style.userSelect='none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e)=>{
      if(!isDragging) return;
      modal.style.top  = (e.clientY - dy)+'px';
      modal.style.left = (e.clientX - dx)+'px';
      clampToViewport(modal);
    });
    document.addEventListener('mouseup', ()=>{
      if(!isDragging) return;
      isDragging=false; document.body.style.userSelect='';
      const top = parseInt(modal.style.top)||modal.getBoundingClientRect().top;
      const left= parseInt(modal.style.left)||modal.getBoundingClientRect().left;
      localStorage.setItem(POS_KEY, JSON.stringify({top,left}));
    });
    const onResize = ()=>{ clampToViewport(modal); adjustBodyMaxHeight(); };
    window.addEventListener('resize', onResize, {passive:true});
    const ro = new ResizeObserver(()=>{ clampToViewport(modal); adjustBodyMaxHeight(); });
    ro.observe(modal);
  })();

  /** ============== UI ============== */
  const logPre = $('#cqe-log-pre', modal);
  const show = () => {
    modal.style.display='flex'; fab.style.display='none'; modal.focus();
    clampToViewport(modal); adjustBodyMaxHeight();
    setTop('Введи digi_catalog и нажми «Загрузить», либо просто вставь ID — загрузка начнётся сама.');
  };
  const hide = () => { modal.style.display='none'; fab.style.display='flex'; };
  $('#vibe-cqe-close', modal).onclick = hide;
  modal.addEventListener('keydown', (e)=>{ if(e.key==='Escape') hide(); });
  $('#cqe-toggle-log', modal).addEventListener('change',e=>{
    $('#vibe-cqe-log', modal).style.display = e.target.checked ? 'block' : 'none';
  });
  fab.onclick = show;
  GM_registerMenuCommand('GGSEL: открыть редактор', show);

  /** ============== Глобальные ============== */
  let lastToken=null, formAction=null, lastId=null, listPageCache=null, lastRow=null;
  let allowedFieldNames = new Set();
  let presentCheckboxes = new Set();
  let flagLabelByName = new Map(); // имя поля → текст лейбла
  let autoLoadGuard = { lastDigi:null, at:0 }; // 🛡️ антидубль «Загрузить»

  // 🔔 авто-загрузка при вставке/замене digi
  let autoInputDebounce = 0;
  let lastAutoInputDigi = null;

  /** ====== вспомогательные ====== */
  function tryPopulateSelectsFromListPage(){
    if(!listPageCache) return;
    const typesMatch = listPageCache.match(/var\s+types\s*=\s*JSON\.parse\('([^']+)'\)/i);
    if(typesMatch){ try{ fillSelect('#f_content_type_id', JSON.parse(typesMatch[1]).map(x=>({value:String(x.id), text:x.title, selected:false}))); }catch(_){ } }
    const catTypesMatch = listPageCache.match(/let\s+categoryTypes\s*=\s*JSON\.parse\('([^']+)'\)/i);
    if(catTypesMatch){ try{ fillSelect('#f_type_id', JSON.parse(catTypesMatch[1]).map(x=>({value:String(x.id), text:x.name, selected:false}))); }catch(_){ } }

    ensureForbiddenTypeOptions();
    ensureMaxCntSellOptions();
    togglePreorderField();
    updateContentTypeDanger(); // 🔴 подсветка при первичном заполнении
  }
  function fillSelect(sel, items){
    const dst=$(sel, modal); if(!dst||!Array.isArray(items)) return;
    dst.innerHTML = '<option value="">— не указан —</option>';
    for(const it of items){
      const o=document.createElement('option');
      o.value = it.value; o.textContent = it.text; if(it.selected) o.selected=true;
      dst.appendChild(o);
    }
  }
  function ensureForbiddenTypeOptions(){
    const elSel = $('#f_forbidden_type', modal);
    if(!elSel) return;
    if(elSel.options.length>0) return;
    const opts = [
      {value:'0', text:'Не запрещен'},
      {value:'1', text:'Сомнительные товары'},
      {value:'2', text:'Товары запрещенные в РКН'},
      {value:'3', text:'Товары запрещенные в РФ'},
      {value:'4', text:'Товары запрещенные не в РФ'}
    ];
    elSel.innerHTML = '';
    opts.forEach(o=>{
      const opt=document.createElement('option');
      opt.value=o.value; opt.textContent=o.text;
      elSel.appendChild(opt);
    });
    elSel.value = '0';
  }
  function ensureMaxCntSellOptions(){
    const elSel = $('#f_max_cnt_sell', modal);
    if(!elSel) return;
    if(elSel.options.length>0) return;
    const opts = [
      {value:'100', text:'100+'},
      {value:'1000', text:'1000+'},
      {value:'', text:'Не указан'}
    ];
    elSel.innerHTML='';
    opts.forEach(o=>{
      const opt=document.createElement('option');
      opt.value=o.value; opt.textContent=o.text;
      if(o.value==='') opt.selected=true;
      elSel.appendChild(opt);
    });
  }
  function isPreorderSelected(){
    const sel = $('#f_type_id', modal);
    if(!sel) return false;
    const t = (sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : sel.options[sel.selectedIndex]?.textContent || '').toLowerCase();
    return t.includes('предзаказ');
  }
  function togglePreorderField(){
    const wrap = $('#wrap_preorder_date', modal);
    if(!wrap) return;
    wrap.style.display = isPreorderSelected() ? 'block' : 'none';
  }
  function updateContentTypeDanger(){
    const sel = $('#f_content_type_id', modal);
    if(!sel) return;
    const txt = (sel.selectedOptions[0]?.textContent || sel.options[sel.selectedIndex]?.textContent || '').toLowerCase();
    const danger = txt.includes('платформа') || txt.includes('софт') || txt.includes('выбран');
    sel.classList.toggle('cqe-select-danger', !!danger); // 🔴/снять
  }
  function pick(doc, selectors){ for(const s of selectors){ const el=doc.querySelector(s); if(el) return el.value||''; } return ''; }
  function copySelectOptions(doc, fromSel, toSel){
    const src=doc.querySelector(fromSel), dst=$(toSel, modal);
    if(!src||!dst){ log(`copySelectOptions: not found ${fromSel} or ${toSel}`); return; }
    dst.innerHTML=''; [...src.options].forEach(o=>{ const opt=document.createElement('option'); opt.value=o.value; opt.textContent=o.textContent; if(o.selected) opt.selected=true; dst.appendChild(opt); });
  }
  function extractCheckboxLabelText(doc, inputEl){
    if(!inputEl) return '';
    const id = inputEl.getAttribute('id');
    if(id){
      const byFor = doc.querySelector(`label[for="${cssEscape(id)}"]`);
      if(byFor) return (byFor.textContent||'').trim();
    }
    const wrapLabel = inputEl.closest('label');
    if(wrapLabel) return (wrapLabel.textContent||'').replace(/\s+/g,' ').trim();
    const grp = inputEl.closest('.m-checkbox,.m-checkbox-list,.form-group,.m-form__group,.row,div');
    const anyLab = grp ? grp.querySelector('label') : null;
    if(anyLab) return (anyLab.textContent||'').replace(/\s+/g,' ').trim();
    return '';
  }
  function collectFormSpec(doc) {
    allowedFieldNames = new Set();
    presentCheckboxes = new Set();
    flagLabelByName = new Map();
    const form = doc.querySelector('form[action*="/daRfsd/categories/"]') || doc.querySelector('form.m-form[action]');
    if (!form) return;
    form.querySelectorAll('input[name],select[name],textarea[name]').forEach(el => {
      const name = el.getAttribute('name'); if (!name) return;
      if (HARD_BLOCK_FIELDS.has(name)) return;
      allowedFieldNames.add(name);
      const type = (el.getAttribute('type')||'').toLowerCase();
      if (type === 'checkbox') {
        presentCheckboxes.add(name);
        const labelText = extractCheckboxLabelText(doc, el) || name;
        flagLabelByName.set(name, labelText);
      }
    });
    log('[FORM] allowedFieldNames ('+allowedFieldNames.size+'): '+[...allowedFieldNames].join(', '));
    log('[FORM] presentCheckboxes ('+presentCheckboxes.size+'): '+[...presentCheckboxes].join(', '));
  }
  function renderFlagsFromSpec() {
    const wrap = $('#cqe-flags', modal);
    if (!wrap) return; wrap.innerHTML = '';
    [...presentCheckboxes].forEach(name => {
      if (HARD_BLOCK_FIELDS.has(name)) return;
      const lblText = flagLabelByName.get(name) || name;
      const lbl = document.createElement('label');
      lbl.className = 'vibe-flag';
      lbl.innerHTML = `<input type="checkbox" id="f_${name.replace(/\W/g,'_')}" data-flag-name="${name}"> ${lblText}`;
      wrap.appendChild(lbl);
    });
  }

  /** ============== CSRF ============== */
  async function ensureCsrfFromList(){
    setTop('Получаю CSRF с листинга категорий…');
    const res=await http({ method:'GET', url:LIST_URL, headers:{
      Authorization:BASIC_AUTH,
      Accept:'text/html,*/*',
      'Accept-Language':'ru,en;q=0.9',
      Referer: LIST_URL,
      Origin: ADMIN_BASE
    } });
    if(res.status===401) throw new Error('401 на /categories (нет доступа)');
    const html=res.responseText||''; listPageCache = html;

    let token=null;
    try{
      const doc = new DOMParser().parseFromString(html,'text/html');
      token = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;
    }catch(_){}
    if(!token){
      const m = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
      if(m) token = m[1];
    }
    if(!token) throw new Error('Не удалось извлечь CSRF из листинга.');
    lastToken = token;
    setTop('CSRF получен.');
    tryPopulateSelectsFromListPage();
  }

  /** ============== Поиск по digi_catalog ============== */
  async function resolveAdminByDigi(digi){
    if(!lastToken){ await ensureCsrfFromList(); }

    const params = new URLSearchParams({
      'datatable[pagination][total]':'1',
      'datatable[pagination][page]':'1',
      'datatable[pagination][perpage]':'50',
      'datatable[pagination][pages]':'1',
      'datatable[sort][sort]':'',
      'datatable[sort][field]':'',
      'datatable[query][generalSearch]': digi
    });

    const res=await http({
      method:'POST',
      url: AJAX_URL,
      headers:{
        Authorization: BASIC_AUTH,
        'X-CSRF-TOKEN': lastToken,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json,*/*',
        'Accept-Language':'ru,en;q=0.9',
        Referer: LIST_URL,
        Origin: ADMIN_BASE
      },
      data: params.toString()
    });

    if(res.status!==200){ setTop('Не удалось получить ajax-данные: '+res.status, true); return null; }

    let data=null; try{ data=JSON.parse(res.responseText||'{}'); }catch(_){}
    const rows = (data && data.data) ? data.data : [];
    if(!rows.length) return null;

    const exact = rows.filter(r => String(r.digi_catalog||'') === String(digi));
    const candidates = exact.length ? exact : rows;

    if(candidates.length === 1){
      const row = candidates[0];
      fill('#f_url', row.url||''); fill('#f_title_ru', row.name||''); fill('#f_min_price', row.min_price||'');
      return { id: row.id, row };
    }

    showChoice(candidates);
    const chosenId = await waitForChoice();
    const chosen = candidates.find(r => String(r.id) === String(chosenId)) || null;
    return chosen ? { id: chosen.id, row: chosen } : null;
  }
  function showChoice(rows){
    const sel = $('#cqe-choice-select', modal);
    sel.innerHTML='';
    rows.forEach(r=>{
      const o=document.createElement('option');
      o.value = String(r.id);
      o.textContent = `id=${r.id} | digi=${r.digi_catalog} | ${r.name||''} | /${r.url||''}`;
      sel.appendChild(o);
    });
    $('#vibe-cqe-choice', modal).style.display = rows.length > 1 ? 'block' : 'none';
  }
  function waitForChoice(){ return new Promise(resolve=>{ $('#cqe-choice-apply', modal).onclick = ()=>{ const id=$('#cqe-choice-select', modal).value; $('#vibe-cqe-choice', modal).style.display='none'; resolve(id||null); }; }); }

  /** ====== МЕТА ====== */
  function findByLabel(doc, txt){
    const labels=[...doc.querySelectorAll('label')];
    const lab=labels.find(l=>(l.textContent||'').trim().includes(txt));
    if(!lab) return '';
    const wrap=lab.closest('.col-md-6,.col-md-5,.row,.form-group,div')||lab.parentElement;
    const inp=wrap&&wrap.querySelector('input[type="text"],input');
    return inp? (inp.value||'') : '';
  }
  function tryAny(doc, sels){ for(const s of sels){ const el=doc.querySelector(s); if(el) return el.value||''; } return ''; }
  function setMetaFromRow(row, digiInput){
    if(!row){ $('#vibe-cqe-meta', modal).style.display='none'; return; }
    setVal('#m_sys_name', '—');
    setVal('#m_parent_name', row.parent_name || '—');
    setVal('#m_parent_id', row.parent_id || '');
    setVal('#m_parentparent_name', row.parentparent_name || '—');
    setVal('#m_digi_id', row.digi_catalog || digiInput || '—');
    $('#vibe-cqe-meta', modal).style.display='block';
  }
  function setMetaFromEditDoc(doc){
    const sys = findByLabel(doc, 'Системное имя DIGISELLER') || tryAny(doc, [
      'input[name="digi_catalog_system_name"]','input[name="digi_system_name"]','input[name="digi_name"]'
    ]);
    if(sys) setVal('#m_sys_name', sys);
    const pid = pick(doc, ['input[name="parent_id"]']); if(pid) setVal('#m_parent_id', pid);
    const digiId = findByLabel(doc,'ID раздела DIGISELLER') || pick(doc,['input#digi_catalog[name="digi_catalog"]']);
    if(digiId) setVal('#m_digi_id', digiId);
  }

  /** ===================== АВТОКОМПЛИТ (портал) + автоEN ===================== */
  let acEl=null, acItems=[], acIdx=-1, acInput=null;
  function ensureAC(){
    if(acEl) return acEl;
    acEl = document.createElement('div');
    acEl.className = 'cqe-autocomplete-portal';
    document.body.appendChild(acEl);
    return acEl;
  }
  function acClose(){ if(!acEl) return; acEl.style.display='none'; acEl.innerHTML=''; acItems=[]; acIdx=-1; acInput=null; }
  function acOpenFor(input, variants, highlight=-1){
    if(!variants || !variants.length){ acClose(); return; }
    ensureAC();
    acEl.innerHTML='';
    acItems = variants.map((v,i)=>{
      const d=document.createElement('div');
      d.className = 'cqe-autocomplete-item' + (i===highlight ? ' active':'' );
      d.textContent = v;
      d.onmousedown = (e)=>{
        if(e.button!==0) return;
        input.value = v;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        acClose();
        setTimeout(()=>input.focus(),0);
        e.preventDefault();
      };
      acEl.appendChild(d);
      return d;
    });
    const r = input.getBoundingClientRect();
    acEl.style.minWidth = Math.max(r.width, 180) + 'px';
    acEl.style.maxWidth = Math.max(r.width+120, 260) + 'px';
    acEl.style.top  = (r.bottom + window.scrollY) + 'px';
    acEl.style.left = (r.left + window.scrollX)   + 'px';
    acEl.style.display = 'block';
    acIdx = highlight; acInput = input;
  }
  function acMove(delta){
    if(!acEl || acItems.length===0) return;
    acIdx = (acIdx + delta + acItems.length) % acItems.length;
    acItems.forEach((el,i)=> el.classList.toggle('active', i===acIdx));
  }
  document.addEventListener('mousedown',(e)=>{ if(acEl && !acEl.contains(e.target)) acClose(); }, {passive:true});
  document.addEventListener('keydown',(e)=>{ if(acEl && e.key==='Escape') acClose(); }, {passive:true});
  window.addEventListener('scroll', ()=>{ if(acEl && acEl.style.display!=='none') acClose(); }, {passive:true});
  const hasCyr = (s)=> /[А-Яа-яЁё]/.test(s||'');
  function bindCyrCheck(enInput){
    if(!enInput || enInput.dataset.cqeBoundCyr) return;
    enInput.addEventListener('input', ()=>{
      if(hasCyr(enInput.value)) enInput.classList.add('cqe-has-cyrillic'); else enInput.classList.remove('cqe-has-cyrillic');
    }, {passive:true});
    if(hasCyr(enInput.value)) enInput.classList.add('cqe-has-cyrillic'); else enInput.classList.remove('cqe-has-cyrillic');
    enInput.dataset.cqeBoundCyr = '1';
  }
  function bindAutoRuEn(ruSel, enSel){
    const ru = $(ruSel, modal), en = $(enSel, modal);
    if(!ru || !en || ru.dataset.cqeBound) return;
    ['autocomplete','autocorrect','autocapitalize','spellcheck'].forEach(attr=>{
      if(attr==='spellcheck') ru.setAttribute(attr,'false'); else ru.setAttribute(attr,'off');
    });
    bindCyrCheck(en);
    ru.addEventListener('input', function(){
      en.value = autoEng(this.value.trim());
      const txt = (this.value||'').trim().toLowerCase();
      if(!txt){ acClose(); return; }
      const list = RUS_VARIANTS.filter(v=>v.toLowerCase().startsWith(txt));
      if(list.length) acOpenFor(ru, list, -1); else acClose();
    }, {passive:true});
    const killNative = (e)=>{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); };
    ru.addEventListener('dblclick', (e)=>{ killNative(e); acOpenFor(ru, RUS_VARIANTS, -1); }, {capture:true});
    ru.addEventListener('keydown', (e)=>{
      if(!acEl || acEl.style.display==='none') return;
      if(e.key==='ArrowDown'){ acMove(1); e.preventDefault(); }
      else if(e.key==='ArrowUp'){ acMove(-1); e.preventDefault(); }
      else if(e.key==='Enter' && acIdx>=0){ acItems[acIdx].dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})); e.preventDefault(); }
      else if(e.key==='Escape'){ acClose(); }
    });
    ru.addEventListener('blur', ()=> setTimeout(acClose, 120), {passive:true});
    ru.dataset.cqeBound = '1';
  }
  function bindMinPriceSuggestions(){
    const inp = $('#f_min_price', modal);
    if(!inp || inp.dataset.cqeMinBound) return;
    ['autocomplete','autocorrect','autocapitalize','spellcheck'].forEach(attr=>{
      if(attr==='spellcheck') inp.setAttribute(attr,'false'); else inp.setAttribute(attr,'off');
    });
    const killNative = (e)=>{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); };
    inp.addEventListener('dblclick', (e)=>{ killNative(e); acOpenFor(inp, MIN_PRICE_SUGGESTIONS, -1); }, {capture:true});
    inp.addEventListener('keydown', (e)=>{
      if(!acEl || acEl.style.display==='none') return;
      if(e.key==='ArrowDown'){ acMove(1); e.preventDefault(); }
      else if(e.key==='ArrowUp'){ acMove(-1); e.preventDefault(); }
      else if(e.key==='Enter' && acIdx>=0){ acItems[acIdx].dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})); e.preventDefault(); }
      else if(e.key==='Escape'){ acClose(); }
    });
    inp.addEventListener('blur', ()=> setTimeout(acClose, 120), {passive:true});
    inp.dataset.cqeMinBound = '1';
  }
  function setupSmartAssistants(){
    bindAutoRuEn('#f_filter_title_ru',      '#f_filter_title_en');       // «подкатегория»
    bindAutoRuEn('#f_breadcrumbs_title_ru', '#f_breadcrumbs_title_en');  // «хлебные крошки»
    bindCyrCheck($('#f_filter_title_en', modal));
    bindCyrCheck($('#f_breadcrumbs_title_en', modal));
    bindMinPriceSuggestions();
    // показать/скрыть кнопку конвертации
    const ruSub = $('#f_filter_title_ru', modal);
    if(ruSub){
      const updateConvertBtn = ()=>{
        const txt = (ruSub.value||'').trim().toLowerCase();
        $('#cqe-convert', modal).style.display = (txt === 'услуги активации') ? 'inline-block' : 'none';
      };
      if(!ruSub.dataset.cqeWatchConvert){
        ruSub.addEventListener('input', updateConvertBtn, {passive:true});
        ruSub.addEventListener('change', updateConvertBtn, {passive:true});
        ruSub.dataset.cqeWatchConvert = '1';
      }
      updateConvertBtn();
    }
  }

  /** ====== КНОПКА «ПЕРЕДЕЛАТЬ В ПОКУПКУ…» ====== */
  function selectOptionByText(sel, textNeedle){
    const s = $(sel, modal); if(!s) return false;
    const tNeedle = (textNeedle||'').trim().toLowerCase();
    for(const opt of s.options){
      const t = (opt.textContent||'').trim().toLowerCase();
      if(t === tNeedle || t.includes(tNeedle)){
        s.value = opt.value;
        s.dispatchEvent(new Event('change', {bubbles:true}));
        return true;
      }
    }
    return false;
  }
  function convertToPurchase(){
    selectOptionByText('#f_content_type_id', 'Покупка на ваш аккаунт'); // 1) тип контента
    updateContentTypeDanger(); // пересчитать красную подсветку
    const RU_TEXT = 'Покупка на ваш аккаунт';
    const EN_TEXT = autoEng(RU_TEXT);
    [['#f_filter_title_ru','#f_filter_title_en'],['#f_breadcrumbs_title_ru','#f_breadcrumbs_title_en']].forEach(([ruSel,enSel])=>{
      const ru = $(ruSel, modal), en=$(enSel, modal);
      if(ru){ ru.value = RU_TEXT; ru.dispatchEvent(new Event('input',{bubbles:true})); }
      if(en){ en.value = EN_TEXT; en.dispatchEvent(new Event('input',{bubbles:true})); }
    });
    bindCyrCheck($('#f_filter_title_en', modal));
    bindCyrCheck($('#f_breadcrumbs_title_en', modal));
    setStatus('Автоперенастройка на «Покупка на ваш аккаунт» выполнена.');
  }
  $('#cqe-convert', modal).addEventListener('click', convertToPurchase);

  /** ============== ЗАГРУЗКА/СОХРАНЕНИЕ ============== */
  $('#f_type_id', modal).addEventListener('change', togglePreorderField);
  $('#f_content_type_id', modal).addEventListener('change', updateContentTypeDanger); // 🔴 подсветка при смене

  // Кнопки
  $('#cqe-load', modal).onclick = () => onLoadByDigi(false);
  $('#cqe-save', modal).onclick = onSaveClick;

  // 🔔 Авто-загрузка при вставке/изменении ID (input/paste/change) — с дебаунсом и нормализацией цифр
  const digiInput = $('#cqe-digi', modal);
  function scheduleAutoLoad(){
    const raw  = (digiInput.value||'').trim();
    const norm = raw.replace(/\D/g,'');             // только цифры
    if(!norm) return;
    if(lastAutoInputDigi === norm) return;          // уже грузили этот ID
    clearTimeout(autoInputDebounce);
    autoInputDebounce = setTimeout(()=>{
      if(digiInput.value !== norm){                 // подправляем поле, если были лишние символы
        digiInput.value = norm;
        digiInput.dispatchEvent(new Event('input', {bubbles:true}));
      }
      onLoadByDigi(true);                           // программно — обойдём антидубль по клику
      lastAutoInputDigi = norm;
    }, 300);
  }
  digiInput.addEventListener('input', scheduleAutoLoad);
  digiInput.addEventListener('paste', ()=> setTimeout(scheduleAutoLoad, 0));
  digiInput.addEventListener('change', scheduleAutoLoad);

  async function onLoadByDigi(isProgrammatic){
    const digi = $('#cqe-digi', modal).value.trim();
    if(!digi){ setTop('Введите digi_catalog.', true); return; }

    // 🛡️ антидубль для ручных кликов (программные вызовы пропускаем)
    if(!isProgrammatic && autoLoadGuard.lastDigi===digi && (Date.now()-autoLoadGuard.at) < 1500){
      log('[AUTO-GUARD] Игнорирую дублирующий вызов onLoadByDigi для digi='+digi);
      return;
    }
    if(isProgrammatic){
      autoLoadGuard.lastDigi = digi;
      autoLoadGuard.at = Date.now();
    }

    try{
      $('#cqe-form', modal).style.display='none';
      $('#vibe-cqe-choice', modal).style.display='none';
      $('#vibe-cqe-meta', modal).style.display='none';
      formAction=null; lastId=null; lastRow=null;
      allowedFieldNames = new Set();
      presentCheckboxes = new Set();
      flagLabelByName = new Map();
      $('#cqe-flags', modal).innerHTML = '';

      await ensureCsrfFromList();

      setTop(`Ищу категорию по digi_catalog=${digi} (POST /categories-ajax)…`);
      const resolved = await resolveAdminByDigi(digi);
      if(!resolved){ setTop('Не удалось найти admin id по этому digi.', true); return; }
      lastId = resolved.id;
      lastRow = resolved.row || null;

      setMetaFromRow(lastRow, digi);

      setTop(`Загружаю форму редактирования категории id=${lastId}…`);
      const res = await http({ method:'GET', url:SHOW_URL(lastId), headers:{
        Authorization:BASIC_AUTH,
        Accept:'text/html,*/*',
        'Accept-Language':'ru,en;q=0.9',
        Referer: LIST_URL,
        Origin: ADMIN_BASE
      } });

      if(res.status===500){
        setTop('Страница редактирования вернула 500. Работаем в headless-режиме (CSRF с листинга).');
        ensureForbiddenTypeOptions();
        ensureMaxCntSellOptions();
        togglePreorderField();
        updateContentTypeDanger();
        $('#cqe-form', modal).style.display='block';
        setupSmartAssistants();
        return;
      }
      if(res.status>=400){
        setTop(`Ошибка ${res.status} при загрузке формы. Headless-режим.`, true);
        ensureForbiddenTypeOptions();
        ensureMaxCntSellOptions();
        togglePreorderField();
        updateContentTypeDanger();
        $('#cqe-form', modal).style.display='block';
        setupSmartAssistants();
        return;
      }

      const html=res.responseText||'';
      const doc=new DOMParser().parseFromString(html,'text/html');

      const tokenEl=doc.querySelector('input[name="_token"]');
      const methodEl=doc.querySelector('input[name="_method"]');
      const formEl=doc.querySelector('form.m-form[action], form[action*="/daRfsd/categories/"]');
      if(tokenEl && methodEl && formEl){
        lastToken=tokenEl.value;
        formAction=formEl.getAttribute('action') || UPDATE_URL(lastId);

        copySelectOptions(doc,'select[name="type_id"]','#f_type_id');
        copySelectOptions(doc,'select[name="content_type_id"]','#f_content_type_id');
        copySelectOptions(doc,'select[name="forbidden_type"]','#f_forbidden_type');
        copySelectOptions(doc,'select[name="max_cnt_sell"]','#f_max_cnt_sell');

        ensureForbiddenTypeOptions();
        ensureMaxCntSellOptions();

        fill('#f_url', pick(doc,['input[name="url"]']));
        fill('#f_min_price', pick(doc,['input[name="min_price"]']));
        fill('#f_title_ru', pick(doc,['input[name="title"]']));
        fill('#f_title_en', pick(doc,['input[name="translations[en][title]"]']));
        fill('#f_filter_title_ru', pick(doc,['input[name="filter_title"]']));
        fill('#f_filter_title_en', pick(doc,['input[name="translations[en][filter_title]"]']));
        fill('#f_filter_title_virtual_ru', pick(doc,['input[name="filter_title_virtual"]']));
        fill('#f_filter_title_virtual_en', pick(doc,['input[name="translations[en][filter_title_virtual]"]']));
        fill('#f_breadcrumbs_title_ru', pick(doc,['input[name="breadcrumbs_title"]']));
        fill('#f_breadcrumbs_title_en', pick(doc,['input[name="translations[en][breadcrumbs_title]"]']));
        fill('#f_search_title_ru', pick(doc,['input[name="search_title"]']));
        fill('#f_search_title_en', pick(doc,['input[name="translations[en][search_title]"]']));
        fill('#f_seo_title_ru', pick(doc,['input[name="seo_title"]']));
        fill('#f_seo_title_en', pick(doc,['input[name="translations[en][seo_title]"]']));
        fill('#f_seo_desc_ru', pick(doc,['input[name="seo_desc"]']));
        fill('#f_seo_desc_en', pick(doc,['input[name="translations[en][seo_desc]"]']));
        fill('#f_seo_text_ru', pick(doc,['textarea[name="seo_text"]','input[name="seo_text"]']));
        fill('#f_seo_text_en', pick(doc,['textarea[name="translations[en][seo_text]"]','input[name="translations[en][seo_text]"]']));

        // ✨ новые поля
        fill('#f_preorder_date', pick(doc,['input[name="preorder_date"]']));
        fill('#f_tag', pick(doc,['input[name="tag"]']));
        fill('#f_platform', pick(doc,['input[name="platform"]']));

        collectFormSpec(doc);
        renderFlagsFromSpec();
        presentCheckboxes.forEach(name => {
          const real = doc.querySelector(`input[name="${cssEscape(name)}"]`);
          const id = `#f_${name.replace(/\W/g,'_')}`;
          if (real) setCB(id, !!(real.checked || real.getAttribute('checked') !== null));
        });

        setMetaFromEditDoc(doc);
        togglePreorderField();
        updateContentTypeDanger(); // 🔴 сразу посчитать подсветку
        setTop('Форма распарсена, можно редактировать и сохранять.');
      } else {
        setTop('Не нашёл форму/токен. Headless-режим (CSRF с листинга).', true);
        ensureForbiddenTypeOptions();
        ensureMaxCntSellOptions();
        togglePreorderField();
        updateContentTypeDanger();
      }

      $('#cqe-form', modal).style.display='block';
      setupSmartAssistants();

    }catch(e){
      setTop('Исключение при загрузке: '+e, true);
      ensureForbiddenTypeOptions();
      ensureMaxCntSellOptions();
      togglePreorderField();
      updateContentTypeDanger();
      $('#cqe-form', modal).style.display='block';
      setupSmartAssistants();
    }
  }

  async function onSaveClick(){
    try{
      if(!lastId){ setStatus('Сначала загрузите категорию по digi.', true); return; }
      if(!lastToken){ await ensureCsrfFromList(); }
      if(!formAction){ formAction = UPDATE_URL(lastId); }

      setStatus('Сохраняю…');

      const body = new URLSearchParams();
      body.set('_token', lastToken);
      body.set('_method', 'PUT');

      const effectiveAllowed = (allowedFieldNames && allowedFieldNames.size) ? new Set(allowedFieldNames) : new Set(DEFAULT_SAFE_FIELDS);
      HARD_BLOCK_FIELDS.forEach(n => effectiveAllowed.delete(n));

      const putIfAllowed = (name, value) => {
        if (!effectiveAllowed.has(name)) return;
        if (value === undefined || value === null) return;
        body.set(name, String(value));
      };
      const applyCheckboxIfAllowed = (name, isChecked) => {
        if (!effectiveAllowed.has(name)) return;
        if (HARD_BLOCK_FIELDS.has(name)) return;
        body.set(name, isChecked ? '1' : '0');
      };

      putIfAllowed('url',             val('#f_url'));
      putIfAllowed('type_id',         val('#f_type_id'));
      putIfAllowed('content_type_id', val('#f_content_type_id'));
      putIfAllowed('forbidden_type',  val('#f_forbidden_type'));

      if (effectiveAllowed.has('min_price')) {
        const mp = val('#f_min_price');
        if (!mp || /^[0-9]+([.,][0-9]+)?$/.test(mp)) putIfAllowed('min_price', mp ? mp.replace(',', '.') : mp);
      }
      putIfAllowed('parent_id',       val('#m_parent_id'));
      putIfAllowed('title',                               val('#f_title_ru'));
      putIfAllowed('translations[en][title]',             val('#f_title_en'));
      putIfAllowed('filter_title',                        val('#f_filter_title_ru'));
      putIfAllowed('translations[en][filter_title]',      val('#f_filter_title_en'));
      putIfAllowed('filter_title_virtual',                val('#f_filter_title_virtual_ru'));
      putIfAllowed('translations[en][filter_title_virtual]', val('#f_filter_title_virtual_en'));
      putIfAllowed('breadcrumbs_title',                   val('#f_breadcrumbs_title_ru'));
      putIfAllowed('translations[en][breadcrumbs_title]', val('#f_breadcrumbs_title_en'));
      putIfAllowed('search_title',                        val('#f_search_title_ru'));
      putIfAllowed('translations[en][search_title]',      val('#f_search_title_en'));
      putIfAllowed('seo_title',                           val('#f_seo_title_ru'));
      putIfAllowed('translations[en][seo_title]',         val('#f_seo_title_en'));
      putIfAllowed('seo_desc',                            val('#f_seo_desc_ru'));
      putIfAllowed('translations[en][seo_desc]',          val('#f_seo_desc_en'));
      putIfAllowed('seo_text',                            val('#f_seo_text_ru'));
      putIfAllowed('translations[en][seo_text]',          val('#f_seo_text_en'));

      // ✨ новые текстовые поля
      putIfAllowed('tag',             val('#f_tag'));
      putIfAllowed('platform',        val('#f_platform'));
      putIfAllowed('max_cnt_sell',    val('#f_max_cnt_sell'));

      // preorder_date — ключ всегда нужен. Если выбран «Предзаказ» — отправим введённое значение, иначе — пусто.
      if (effectiveAllowed.has('preorder_date')) {
        const value = isPreorderSelected() ? val('#f_preorder_date') : '';
        body.set('preorder_date', value);
      }

      const toSendFlags = [...presentCheckboxes].filter(n => !HARD_BLOCK_FIELDS.has(n) && effectiveAllowed.has(n));
      log('[SAVE] flags present (sending): '+toSendFlags.join(', ') + (toSendFlags.length? '':' <none>'));
      toSendFlags.forEach(name => {
        const id = `#f_${name.replace(/\W/g,'_')}`;
        applyCheckboxIfAllowed(name, cb(id));
      });

      const bodyStr = body.toString();
      const referer = SHOW_URL(lastId);

      const res=await http({
        method:'POST',
        url: formAction,
        headers:{
          Authorization: BASIC_AUTH,
          'X-CSRF-TOKEN': lastToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json,*/*',
          'Accept-Language':'ru,en;q=0.9',
          Referer: referer,
          Origin: ADMIN_BASE
        },
        data: bodyStr
      });

      // ✅ даже если 500 — считаем успехом (на сервере изменения применяются)
      if(res.status===419){ setStatus('419 CSRF mismatch — нажмите «Загрузить» и повторите.', true); return; }

      // спец-кейс middlewareCrash (на всякий)
      const bodyText = String(res.responseText||'');
      const middlewareCrash = res.finalUrl && res.finalUrl.endsWith('/daRfsd/categories') &&
                              /Undefined offset: 2/.test(bodyText) &&
                              /AdminHelper\.php/.test(bodyText);
      if (middlewareCrash) { setStatus('Сохранено (редирект упал в middleware, это ок).'); return; }

      if((res.status>=200 && res.status<400) || res.status===500){
        setStatus(`Сохранено (статус ${res.status}).`);
      } else {
        setStatus(`Ошибка сохранения: ${res.status}. Включите «Лог» и пришлите body[0..1500].`, true);
      }

    }catch(e){
      setStatus('Исключение при сохранении: '+e, true);
    }
  }

  /** ============== СВЯЗКА С WATCHER: событие vibe:cqe-open ============== */
  window.addEventListener('vibe:cqe-open', async (ev)=>{
    try{
      const digi = String(ev?.detail?.digi || '').trim();
      if(!digi){ return; }
      log(`[LINK] Получен запрос из SyncWatcher: digi=${digi}`);
      show();
      const inp = $('#cqe-digi', modal);
      if(inp){
        inp.value = digi;
        inp.dispatchEvent(new Event('input', {bubbles:true}));
      }
      // 🔧 чтобы авто-инпут не дал повторный автозапуск
      lastAutoInputDigi = digi;

      // антидубль для внешнего запуска
      autoLoadGuard.lastDigi = digi;
      autoLoadGuard.at = Date.now();
      onLoadByDigi(true);
    }catch(e){
      log('[LINK] Ошибка обработки vibe:cqe-open: '+e);
    }
  }, { passive:true });

  // Глобальный вызов: window.vibeCqeOpen('123456')
  window.vibeCqeOpen = function(digi){
    try{
      window.dispatchEvent(new CustomEvent('vibe:cqe-open', { detail:{ digi:String(digi||'').trim(), source:'global' } }));
    }catch(_){}
  };

  // запуск
})();
