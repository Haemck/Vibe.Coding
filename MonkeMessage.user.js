// ==UserScript==
// @name         Digiseller: MonkeMessage
// @namespace    http://tampermonkey.net/
// @version      3.10.6
// @description  Панель с чекбоксами, EN-кнопкой (RU/EN), шаблоны c Названием + EN-версией, подсказки (по названию/тексту RU+EN одновременно) с навигацией Tab/Shift+Tab и вставкой по Enter, хоткеи, кеш черновика по продавцу (с ежедневной чисткой и автоочисткой после отправки), Ctrl+Alt-режим редактирования и перетаскивания папок, {hello} с проверкой исходящих за сегодня, тултипы полного текста. Ctrl+Enter — отправить, F7 — фокус, EN — англ. режим/перевод.
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/seller_messages.asp*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeMessage.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeMessage.user.js
// ==/UserScript==

(function() {
    'use strict';

    /* ================== СТИЛИ ================== */
    const style = document.createElement('style');
    style.innerHTML = `
    /* --- Панель --- */
    #vibe-fixed-panel-min {
        position: fixed; top: 186px; right: 30px; width: 500px; min-height: 158px;
        background: #f7f9fa; border: 1.6px solid #bde8bc; border-radius: 12px; z-index: 99999;
        display: flex; flex-direction: column; padding: 18px 16px 10px 16px; gap: 10px; box-sizing: border-box;
        font-family: Verdana, Arial, sans-serif; box-shadow: 0 1px 12px #233c2010; transition: border-color .18s, box-shadow .15s;
    }
    #vibe-fixed-panel-min:focus-within { border-color: #9ae6a8; box-shadow: 0 2px 22px #aadfbd66; }
    #vibe-fixed-input-min {
        flex: 1 1 auto; min-height: 58px; max-height: 170px; resize: vertical; width: 100%;
        font-size: 15px; border: 1.1px solid #c8e7d1; border-radius: 7px; padding: 9px 8px; background: #fafdff; outline: none; color: #23272b;
        transition: border-color .15s; font-family: inherit;
    }
    #vibe-fixed-input-min:focus { border-color: #9ae6a8; background: #e6f9ed; }

    .vibe-row-flex-min { display: flex; align-items: stretch; justify-content:space-between; gap: 17px; width: 100%; }
    .vibe-checkbox-col-min { display: flex; flex-direction: column; gap: 7px; min-width: 108px; flex-shrink: 0; }
    .vibe-checkbox-col-min label { cursor: pointer; display: flex; align-items: center; gap: 4px; border-radius: 5px; padding: 1px 4px 1px 1px; transition: background .12s; font-size: 14px; color: #23272b; }
    .vibe-checkbox-col-min label:hover { background: #e6f9ed; }
    .vibe-checkbox-col-min input[type="checkbox"] { accent-color: #259960; width: 16px; height: 16px; border-radius: 4px; margin-right: 2px; }

    #vibe-fixed-send-min {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 178px; padding: 10px 32px 10px 28px; font-size: 15px;
        font-family: 'Segoe UI', Consolas, Arial, sans-serif; border-radius: 9px;
        border: 1.6px solid #bde8bc; background: #e6f9ed; color: #23272b; font-weight: 600;
        cursor: pointer; user-select: none; position: relative; z-index: 2;
        transition: background .14s, border-color .14s, color .14s, box-shadow .15s, transform .08s cubic-bezier(.32,.04,.62,1.48);
    }
    #vibe-fixed-send-min:hover, #vibe-fixed-send-min:focus { background: #c7f1da; border-color: #9ae6a8; color: #1f794e; }
    #vibe-fixed-send-min:active { background: #b2e7c9; color: #1b6d47; transform: scale(0.97); }
    #vibe-fixed-send-min[disabled] { background: #e2f1e6; border-color: #c8e0cd; color: #9aaea4; cursor: not-allowed; opacity: 0.65; }
    #vibe-templates-bottomtools { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 5px; padding-bottom: 2px; }
    #vibe-templates-bottomtools .vibe-tpl-tool-btn, #vibe-templates-bottomtools #vibe-tpl-add-template { margin: 0; }
    /* --- Кнопка EN (кнопка, НЕ чекбокс) --- */
    #vibe-lang-toggle {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 54px; padding: 10px 12px; font-size: 14px; font-weight: 700;
        border-radius: 9px; border: 1.6px solid #bde8bc; background: #f1fbf6; color: #1f794e;
        cursor: pointer; user-select: none; transition: background .14s, color .14s, border-color .14s, transform .08s;
    }
    #vibe-lang-toggle:hover { background: #dff7ea; }
    #vibe-lang-toggle.active { background: #1f794e; color: #fff; border-color: #1f794e; }

    #vibe-fixed-status-min { min-height: 0px; margin: 0 2px; font-size: 13px; color: #23272b; letter-spacing: .01em; transition: color .14s; }
    .vibe-fixed-status-error { color: #c8584c !important; }
    .vibe-fixed-status-ok { color: #23272b !important; }

    #vibe-tpl-suggestions-block { display: flex; flex-direction: column; gap: 0; margin: 8px 0; position: relative; z-index: 9; }
    .vibe-tpl-suggestion {
        background: #e6f9ed; border: 1.2px solid #bde8bc; border-radius: 8px; color: #23272b; font-size: 14px;
        padding: 9px 14px; margin-bottom: 6px; box-shadow: 0 2px 13px #25996010; cursor: pointer; user-select: none;
        opacity: 0; transform: translateY(15px) scale(0.98);
        animation: vibe-tpl-suggest-fadein 0.26s cubic-bezier(.41,.72,.29,.98) forwards;
        transition: background .15s, border-color .13s, color .14s;
        display: flex; align-items: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .vibe-tpl-suggestion:hover { background: #d2f6e1; border-color: #8be29b; color: #1f794e; }
    .vibe-tpl-suggestion.selected { background: #c7f1da; border-color: #8be29b; color: #1f794e; outline: 1px dashed #8be29b; }
    .vibe-tpl-suggestion .vibe-sug-title { font-weight: 600; margin-right: 8px; }
    .vibe-tpl-suggestion .vibe-sug-sep { opacity:.5; margin: 0 6px; }

    @keyframes vibe-tpl-suggest-fadein {
        0% { opacity: 0; transform: translateY(15px) scale(0.98);}
        65% { opacity: 1; transform: translateY(-4px) scale(1.04);}
        100% { opacity: 1; transform: translateY(0) scale(1);}
    }

    #vibe-templates-block { border-top: 1px solid #e3f2ea; padding-top: 4px; margin: 0 -3px; display: flex; flex-direction: column; gap: 5px; }
    #vibe-templates-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 2px; user-select:none; }
    .vibe-tpl-tab {
        display: flex; align-items: center; background: #e6f9ed; color: #23272b;
        border-radius: 7px 7px 0 0; border: 1.3px solid #bde8bc; border-bottom: none;
        font-size: 13px; font-weight: 500; padding: 4px 13px 4px 12px; cursor: pointer; position: relative;
        max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .vibe-tpl-tab.active, .vibe-tpl-tab:hover { background: #d2f6e1; color: #1f794e; }
    .vibe-tpl-tab .vibe-tpl-tab-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .vibe-tpl-tab .vibe-tpl-tab-action {
        display: none; margin-left: 6px; font-size: 14px; color: #b0b0b0;
        background: transparent; border: none; cursor: pointer; padding: 0 4px; border-radius: 4px; flex: 0 0 auto;
        transition: background .13s, color .13s;
    }
    #vibe-templates-tabs.folder-edit-mode .vibe-tpl-tab .vibe-tpl-tab-action { display: inline-block; }
    .vibe-tpl-tab .vibe-tpl-tab-remove:hover { background: #fde6e4; color: #c8584c; }
    .vibe-tpl-tab .vibe-tpl-tab-edit:hover { background: #e6f9ed; color: #1f794e; }
    .vibe-tpl-tab.dragging { opacity: .7; transform: scale(1.02); }

    #vibe-tpl-add-folder {
        color: #23272b; background: #e6f9ed; border: 1px solid #bde8bc; border-radius: 7px;
        font-size: 13px; padding: 3px 12px; cursor: pointer; transition: background .14s;
    }
    #vibe-tpl-add-folder:hover { background: #c7f1da; }

    #vibe-templates-list { display: flex; flex-direction: column; gap: 3px; min-height: 24px; max-height: 170px; overflow-y: auto; margin-bottom: 2px; overflow-x: hidden; }
    .vibe-template-item {
        display: flex; align-items: center; background: #f7f9fa; border-radius: 7px; border: 1px solid #e6f9ed; font-size: 14px; color: #23272b;
        padding: 10px 12px 10px 8px; margin-bottom: 2px; cursor: pointer; gap: 8px; transition: background .14s, border-color .12s; position: relative; user-select: none; max-width: 100%; box-sizing: border-box; min-height: 26px;
    }
    .vibe-template-item:hover, .vibe-template-item.selected { background: #e6f9ed; border-color: #bde8bc; }
    .vibe-template-item .vibe-tpl-mainline { display:flex; align-items:center; gap:8px; flex:1 1 auto; min-width:0; }
    .vibe-template-item .vibe-tpl-title { font-weight: 600; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vibe-template-item .vibe-tpl-sep { opacity:.5; }
    .vibe-template-item span.vibe-tpl-item-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 0%; min-width: 0; display: block; max-width: 100%; }

    .vibe-tpl-star { color: #e5b218; margin-right: 2px; font-size: 17px; cursor: pointer; transition: filter .13s; font-family: monospace; font-weight: bold; }
    .vibe-tpl-star.inactive { color: #b1b1a6; filter: grayscale(1) brightness(1.15); }

    .vibe-tpl-edit, .vibe-tpl-remove {
        color: #a0a0a0; font-size: 15px; cursor: pointer; margin-left: 5px; transition: color .13s; background: none; border: none; border-radius: 2px; padding: 1px 3px; font-family: monospace; font-weight: bold;
    }
    .vibe-tpl-edit:hover { color: #23272b; background: #e6f9ed; }
    .vibe-tpl-remove:hover { color: #c8584c; background: #fde6e4; }

    .vibe-tpl-hotkey { background: #e6f9ed; border: 1px solid #bde8bc; border-radius: 4px; color: #23272b; font-size: 12px; padding: 1px 8px 0; margin-left: 9px; font-family: monospace; cursor: pointer; opacity: .82; transition: background .11s; }
    .vibe-tpl-hotkey:hover { background: #d2f6e1; opacity: 1; }

    .vibe-tpl-empty { font-size: 13px; color: #b5b5b5; padding: 10px 0 4px 3px; }

    /* --- Модалки --- */
    .vibe-tpl-modal-bg { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; background: #233c2044; z-index: 999999; display: flex; align-items: center; justify-content: center; }
    .vibe-tpl-modal { background: #fafdff; border-radius: 11px; border: 2px solid #bde8bc; padding: 28px 24px 16px; box-shadow: 0 8px 48px #25996013; min-width: 320px; min-height: 80px; display: flex; flex-direction: column; gap: 11px; position: relative; z-index: 9999999; }
    .vibe-tpl-modal label { font-size: 14px; color: #23272b; margin-bottom: 4px; }
    .vibe-tpl-modal input, .vibe-tpl-modal textarea { width: 100%; font-size: 14px; padding: 6px 9px; border-radius: 6px; border: 1px solid #bde8bc; margin-bottom: 9px; color: #23272b; background: #fafdff; }
    .vibe-tpl-modal .vibe-tpl-hotkey-input { width: 100%; min-height: 32px; font-size: 13px; margin-bottom: 8px; border: none; background: #e6f9ed; color: #23272b; border-radius: 5px; text-align: left; padding: 7px 10px; font-family: monospace; letter-spacing: 0.04em; outline: none; user-select: none; pointer-events: none; }
    .vibe-tpl-modal .vibe-tpl-modal-actions { display: flex; gap: 11px; margin-top: 5px; flex-wrap: wrap; }
    .vibe-tpl-modal .vibe-tpl-btn { border-radius: 7px; padding: 6px 19px; font-size: 14px; border: none; font-weight: 600; cursor: pointer; color: #fff; background: #259960; transition: background .13s; }
    .vibe-tpl-modal .vibe-tpl-btn:hover { background: #1f794e; }
    .vibe-tpl-modal .vibe-tpl-btn.cancel { background: #dadada; color: #606060; font-weight: 500; }
    .vibe-tpl-modal .vibe-tpl-btn.cancel:hover { background: #bbb; }

    /* --- Виджет заказа --- */
    #vibe-zakaz-widget { position: absolute; left: 0; top: -46px; background: #e6f9ed; border: 1.2px solid #bde8bc; border-radius: 8px; box-shadow: 0 4px 24px #25996013; padding: 8px 13px 10px 10px; z-index: 200; display: flex; align-items: center; gap: 10px; min-width: 180px; transition: box-shadow .14s, border-color .12s; font-family: inherit; opacity: 1; animation: vibe-fade-in 0.18s; }
    @keyframes vibe-fade-in { 0%{opacity:0; transform:translateY(10px);} 100%{opacity:1; transform:translateY(0);} }
    #vibe-zakaz-widget.hide { display: none !important; }
    #vibe-zakaz-widget input { border: 1.1px solid #bde8bc; border-radius: 6px; padding: 4px 10px; font-size: 14px; width: 90px; background: #fff; color: #23272b; outline: none; margin-right: 4px; }
    #vibe-zakaz-widget input:focus { border-color: #23272b; background: #fafdff; }
    #vibe-zakaz-widget button, #vibe-zakaz-widget .zakaz-close-btn { background: #23272b; color: #fff; border: none; border-radius: 5px; font-size: 14px; padding: 5px 13px; cursor: pointer; transition: background .12s; margin-left: 0; }
    #vibe-zakaz-widget button:hover { background: #1f794e; }

    /* --- Нижние кнопки: +шаблон / Импорт / Экспорт --- */
    .vibe-tpl-tool-btn {
        padding: 6px 14px; border-radius: 7px; border: 1px solid #bde8bc; background: #e6f9ed; color: #23272b;
        font-size: 13px; font-family: inherit; font-weight: 600; cursor: pointer; transition: background .14s, color .13s, border-color .14s, transform .06s;
    }
    .vibe-tpl-tool-btn:hover { background: #c7f1da; color: #1f794e; border-color: #9ae6a8; }
    .vibe-tpl-tool-btn:active { transform: translateY(1px); }

    @media (max-width: 650px) {
        #vibe-fixed-panel-min { width: 97vw; left: 1vw; right: 1vw; min-width: 0; padding: 7vw 2vw 3vw; }
        .vibe-row-flex-min { flex-direction: column; gap: 10px; }
        #vibe-fixed-send-min, #vibe-lang-toggle { width: 100%; height: 42px; min-width: 0; }
        #vibe-templates-list { max-height: 130px; }
    }
    `;
    document.head.appendChild(style);

    /* ================== HTML ================== */
    const panel = document.createElement('div');
    panel.id = 'vibe-fixed-panel-min';
    panel.innerHTML = `
        <div style="position:relative;">
            <div id="vibe-zakaz-widget" class="hide">
                <label for="vibe-zakaz-input-widget">№ заказа</label>
                <input id="vibe-zakaz-input-widget" type="text" autocomplete="off" placeholder="123456">
                <button type="button" id="vibe-zakaz-insert-btn">OK</button>
                <button type="button" class="zakaz-close-btn" title="Закрыть">&times;</button>
            </div>
            <textarea id="vibe-fixed-input-min" placeholder="Ваше сообщение… (Ctrl+Enter, Tab/Shift+Tab — подсказки, Enter — вставить, EN — англ. режим/перевод)" rows="5"></textarea>
        </div>
        <div class="vibe-row-flex-min">
            <div class="vibe-checkbox-col-min">
                <label title="Уведомить в WM Keeper">
                    <input type="checkbox" id="vibe-fixed-wmkeeper-min"> WM Keeper
                </label>
                <label title="Уведомить на Email">
                    <input type="checkbox" id="vibe-fixed-email-min"> Email
                </label>
            </div>
            <div>
            <button id="vibe-lang-toggle" title="EN режим/перевод: если в поле шаблон — переключим язык, иначе откроем переводчик">EN</button>
            <button id="vibe-fixed-send-min" title="Отправить (Ctrl+Enter)"><span>Отправить</span></button>
            </div>
        </div>
        <div id="vibe-tpl-suggestions-block"></div>
        <div id="vibe-fixed-status-min"></div>
        <div id="vibe-templates-block"></div>
    `;
    document.body.appendChild(panel);

    /* ================ Переменные =============== */
    let sellerId = null, sellerName = null, sellerNameCache = {};
    function getSellerId() {
        if (sellerId !== null) return sellerId;
        const m = location.search.match(/id_s=(\d+)/);
        sellerId = m ? m[1] : null;
        return sellerId;
    }
    async function fetchSellerName(id) {
        if (!id) return null;
        if (sellerNameCache[id]) return sellerNameCache[id];
        try {
            const res = await fetch('/asp/seller_info.asp?id_s=' + encodeURIComponent(id), { credentials: 'same-origin' });
            const html = await res.text();
            const m = html.match(/<td class="namerow"><nobr>ПСЕВДОНИМ:<\/nobr><\/td>\s*<td class="inforow"[^>]*>([\s\S]*?)<\/td>/i);
            if (m && m[1]) {
                let txt = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
                txt = txt.split('[')[0].replace(/\s+/g, ' ').trim();
                sellerNameCache[id] = txt;
                return txt;
            }
        } catch(e) {}
        return '';
    }

    const textarea = document.getElementById('vibe-fixed-input-min');
    const sendBtn = document.getElementById('vibe-fixed-send-min');
    const keeperChk = document.getElementById('vibe-fixed-wmkeeper-min');
    const emailChk = document.getElementById('vibe-fixed-email-min');
    const statusDiv = document.getElementById('vibe-fixed-status-min');
    const suggestionsBlock = document.getElementById('vibe-tpl-suggestions-block');
    const langBtn = document.getElementById('vibe-lang-toggle');

    // --- Виджет Zakaz ---
    const zakazWidget = document.getElementById('vibe-zakaz-widget');
    const zakazInput = document.getElementById('vibe-zakaz-input-widget');
    const zakazOkBtn = document.getElementById('vibe-zakaz-insert-btn');
    const zakazCloseBtn = zakazWidget.querySelector('.zakaz-close-btn');
    let zakazCallback = null;

    function showZakazWidget(callback) {
        zakazInput.value = '';
        zakazWidget.classList.remove('hide');
        zakazCallback = callback;
        setTimeout(() => zakazInput.focus(), 100);
    }
    function hideZakazWidget() { zakazWidget.classList.add('hide'); zakazCallback = null; }
    zakazCloseBtn.onclick = hideZakazWidget;
    zakazOkBtn.onclick = function() {
        const val = zakazInput.value.trim();
        if (!val) { zakazInput.focus(); return; }
        if (zakazCallback) zakazCallback(val);
        hideZakazWidget();
    };
    zakazInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') zakazOkBtn.click();
        else if (e.key === 'Escape') hideZakazWidget();
    });

    /* ===== КЕШ ЧЕРНОВИКА ПО ПРОДАВЦУ + ежедневная очистка ===== */
    const DRAFT_PREFIX = 'vibe_msg_draft_';
    const LAST_CLEAN_KEY = 'vibe_msg_draft_last_clean';
    let suppressDraftSave = false;

    function todayStr() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,'0');
        const day = String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${day}`;
    }
    function todayDDMMYYYY() {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const yy = d.getFullYear();
        return `${dd}.${mm}.${yy}`;
    }
    function dailyDraftCleanup() {
        const t = todayStr();
        const prev = localStorage.getItem(LAST_CLEAN_KEY);
        if (prev !== t) {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && k.startsWith(DRAFT_PREFIX)) localStorage.removeItem(k);
            }
            localStorage.setItem(LAST_CLEAN_KEY, t);
        }
    }
    dailyDraftCleanup();

    function loadDraft() {
        const id = getSellerId();
        if (!id) return;
        const val = localStorage.getItem(DRAFT_PREFIX + id);
        if (val) textarea.value = val;
    }
    function saveDraft() {
        if (suppressDraftSave) return;
        const id = getSellerId();
        if (!id) return;
        localStorage.setItem(DRAFT_PREFIX + id, textarea.value);
    }
    loadDraft();

    /* ===== EN-состояние, последний шаблон и переменные ===== */
    let enMode = false;
    let lastTplRef = null; // {folder, idx}
    let lastVars = { seller: null, zakaz: null };

    function setEnMode(on) {
        enMode = !!on;
        langBtn.classList.toggle('active', enMode);
    }

    function openYandexTranslate(text) {
        const dir = enMode ? 'en-ru' : 'ru-en';
        const url = 'https://translate.yandex.ru/?lang=' + dir + '&text=' + encodeURIComponent(text || '');
        window.open(url, '_blank', 'noopener');
    }

    /* ====== {hello}: проверка исходящих за сегодня (для подстановки) ====== */
    function helloCacheKey(id) { return `vibe_msg_out_today_${id}_${todayStr()}`; }

    async function hasOutgoingToday(id) {
        if (!id) return false;
        const k = helloCacheKey(id);
        const cached = localStorage.getItem(k);
        if (cached === '1') return true;
        if (cached === '0') return false;

        try {
            const res = await fetch(`/asp/seller_messages.asp?id_s=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
            const html = await res.text();
            const ddmmyyyy = todayDDMMYYYY();
            const rowRe = /<tr[\s\S]*?<td class="td_title"[^>]*>\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})\s+[0-9]{2}:[0-9]{2}:[0-9]{2}[\s\S]*?<\/tr>/gi;
            let m, found = false;
            while ((m = rowRe.exec(html))) {
                const rowHtml = m[0];
                const dateStr = m[1];
                if (dateStr === ddmmyyyy && /mail_out\.gif/i.test(rowHtml)) { found = true; break; }
            }
            localStorage.setItem(k, found ? '1' : '0');
            return found;
        } catch {
            return false;
        }
    }

    async function getHelloText(lang /* 'ru'|'en' */) {
        const id = getSellerId();
        const sent = await hasOutgoingToday(id);
        if (sent) return '';
        return (lang === 'en') ? 'Hello.' : 'Здравствуйте.';
    }

    async function replaceVarsInTemplate(text, opts = { lang: 'ru' }) {
        let out = text || '';
        const id = getSellerId();

        if (/{hello}/i.test(out)) {
            const hello = await getHelloText(opts.lang === 'en' ? 'en' : 'ru');
            out = out.replace(/{hello}/gi, hello);
        }

        if (/{seller}/i.test(out)) {
            if (!lastVars.seller && id) {
                let name = sellerNameCache[id] || sellerName;
                if (!name) name = await fetchSellerName(id);
                sellerName = name;
                lastVars.seller = name || lastVars.seller;
            }
            out = out.replace(/{seller}/gi, (lastVars.seller ?? '[?]'));
        }

        if (/{Zakaz}/i.test(out) && lastVars.zakaz) {
            out = out.replace(/{Zakaz}/gi, lastVars.zakaz);
        }

        return out;
    }

    function insertTemplateObject(tpl, ref) {
        const lang = (enMode && tpl.text_en) ? 'en' : 'ru';
        const baseText = (lang === 'en') ? (tpl.text_en || tpl.text) : tpl.text;

        (async () => {
            let filled = await replaceVarsInTemplate(baseText, { lang });

            if (/{Zakaz}/i.test(baseText) && !lastVars.zakaz) {
                showZakazWidget((orderNum) => {
                    lastVars.zakaz = orderNum;
                    const finalText = filled.replace(/({Zakaz})/gi, orderNum);
                    textarea.value = finalText;
                    textarea.focus();
                    textarea.dispatchEvent(new Event('input'));
                });
                return;
            }
            textarea.value = filled;
            textarea.focus();
            textarea.dispatchEvent(new Event('input'));

            lastTplRef = ref || locateTplRef(tpl);

            if (lang === 'en' && !tpl.text_en) openYandexTranslate(filled);
        })();
    }

    function insertTemplateText(tplText) {
        const tpl = findTplByTextExact(tplText) || { title:null, text: tplText, favorite:false, hotkey:null, text_en:null };
        insertTemplateObject(tpl, locateTplRef(tpl));
    }

    /* ================== Хранение шаблонов ================== */
    const TPL_KEY = 'vibe_msg_templates_v3';
    function getDefaultTemplates() {
        return {
            folderOrder: ['Общие', 'Возвраты'],
            folders: {
                "Общие": [
                    { title: "Получено",  text: "{hello} Спасибо за обращение. Ваше сообщение получено.", text_en: "{hello} Thank you for reaching out. Your message has been received.", favorite: true,  hotkey: null },
                    { title: "Нужен номер", text: "{hello} Пожалуйста, уточните номер заказа: {Zakaz}", text_en: "{hello} Please provide your order number: {Zakaz}", favorite: false, hotkey: null },
                    { title: "Отправлен", text: "{hello} Здравствуйте, {Seller}! Ваш заказ {Zakaz} отправлен.", text_en: "{hello} Hello, {Seller}! Your order {Zakaz} has been shipped.", favorite: false, hotkey: null }
                ],
                "Возвраты": [
                    { title: "Срок возврата", text: "{hello} Ваш возврат будет обработан в течение 3 рабочих дней.", text_en: "{hello} Your refund will be processed within 3 business days.", favorite: false, hotkey: null }
                ]
            },
            activeFolder: "Общие"
        };
    }
    function normalizeTpl(t) {
        return {
            title: typeof t.title === 'string' ? t.title : null,
            text: t.text || '',
            text_en: t.text_en || null,
            favorite: !!t.favorite,
            hotkey: t.hotkey || null
        };
    }
    function loadTemplates() {
        let data = localStorage.getItem(TPL_KEY);
        if (!data) return getDefaultTemplates();
        try {
            const parsed = JSON.parse(data);
            if (!parsed.folderOrder || !Array.isArray(parsed.folderOrder)) parsed.folderOrder = Object.keys(parsed.folders || {});
            for (const f in parsed.folders) parsed.folders[f] = (parsed.folders[f] || []).map(normalizeTpl);
            if (!parsed.activeFolder || (!parsed.folders[parsed.activeFolder] && parsed.activeFolder !== '_fav')) {
                parsed.activeFolder = parsed.folderOrder[0] || '_fav';
            }
            return parsed;
        } catch { return getDefaultTemplates(); }
    }
    function saveTemplates(tpls) { localStorage.setItem(TPL_KEY, JSON.stringify(tpls)); }
    let templates = loadTemplates();
    function ensureFolderOrder() {
        const names = Object.keys(templates.folders);
        const set = new Set(templates.folderOrder || []);
        for (const n of names) if (!set.has(n)) templates.folderOrder.push(n);
        templates.folderOrder = templates.folderOrder.filter(n => names.includes(n));
    }
    ensureFolderOrder();

    function getAllFavorites(tpls) {
        const favs = [];
        Object.keys(tpls.folders).forEach(folder => {
            (tpls.folders[folder] || []).forEach((tpl, idx) => { if (tpl.favorite) favs.push({ ...tpl, folder, idx }); });
        });
        return favs;
    }
    function findTplByTextExact(text) {
        for (const f of Object.keys(templates.folders)) {
            const arr = templates.folders[f] || [];
            for (let i=0;i<arr.length;i++) if ((arr[i].text || '').trim() === text.trim()) return arr[i];
        }
        return null;
    }
    function locateTplRef(tpl) {
        if (!tpl) return null;
        for (const f of Object.keys(templates.folders)) {
            const arr = templates.folders[f] || [];
            for (let i=0;i<arr.length;i++) if (arr[i] === tpl) return { folder: f, idx: i };
        }
        return null;
    }
    function getTplByRef(ref) {
        if (!ref) return null;
        const arr = templates.folders[ref.folder] || [];
        return arr[ref.idx] || null;
    }

    /* ================== Редактирование папок (Ctrl+Alt) ================== */
    let pressedCtrl = false, pressedAlt = false;
    let folderEditMode = false;

    function updateFolderEditModeFromKeys() {
        const newMode = pressedCtrl && pressedAlt;
        if (newMode !== folderEditMode) {
            folderEditMode = newMode;
            const tabsDiv = document.getElementById('vibe-templates-tabs');
            if (tabsDiv) tabsDiv.classList.toggle('folder-edit-mode', folderEditMode);
        }
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Control') pressedCtrl = true;
        if (e.key === 'Alt') pressedAlt = true;
        updateFolderEditModeFromKeys();
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control') pressedCtrl = false;
        if (e.key === 'Alt') pressedAlt = false;
        updateFolderEditModeFromKeys();
    });

    function openRenameFolderModal(oldName) {
        showModal({
            title: `Переименовать папку`,
            customInner: `<label>Новое имя папки</label><input type="text" id="vibe-modal-folder-rename" value="${escapeAttr(oldName)}">`,
            okText: 'Переименовать',
            onOk: () => {
                const input = document.getElementById('vibe-modal-folder-rename');
                let newName = (input.value || '').trim();
                if (!newName) return false;
                if (newName === oldName) return true;
                if (templates.folders[newName]) { showAlert('Папка с таким именем уже существует!'); return false; }
                templates.folders[newName] = templates.folders[oldName];
                delete templates.folders[oldName];
                templates.folderOrder = templates.folderOrder.map(n => n === oldName ? newName : n);
                if (templates.activeFolder === oldName) templates.activeFolder = newName;
                saveTemplates(templates);
                renderTemplates();
            }
        });
    }

    /* ================== Рендер UI ================== */
    const templatesBlock = document.getElementById('vibe-templates-block');

    function renderTemplates() {
        templatesBlock.innerHTML = `
        <div id="vibe-templates-tabs"></div>
        <div id="vibe-templates-list"></div>
        <div id="vibe-templates-bottomtools">
            <button id="vibe-tpl-add-template" class="vibe-tpl-tool-btn" type="button">+ шаблон</button>
            <button id="vibe-tpl-import" class="vibe-tpl-tool-btn" type="button">Импорт</button>
            <button id="vibe-tpl-export" class="vibe-tpl-tool-btn" type="button">Экспорт</button>
        </div>
        `;
        renderTabs();
        renderTplList();
        document.getElementById('vibe-tpl-add-template').onclick = () => openTemplateModal('add');
        document.getElementById('vibe-tpl-import').onclick = onImportClick;
        document.getElementById('vibe-tpl-export').onclick = onExportClick;
        enableWheelScrollIsolation();
    }

    function onExportClick() {
        const blob = new Blob([JSON.stringify(templates, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'templates-vibe.json';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},120);
    }

    function onImportClick() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json,application/json';
        input.onchange = function(e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = function() {
                try {
                    const imported = JSON.parse(reader.result);
                    if (!imported || !imported.folders) throw 1;
                    for (const folder in imported.folders) {
                        const normArr = (imported.folders[folder] || []).map(normalizeTpl);
                        if (!templates.folders[folder]) {
                            templates.folders[folder] = [];
                            if (!templates.folderOrder.includes(folder)) templates.folderOrder.push(folder);
                        }
                        normArr.forEach(tpl => {
                            const exists = templates.folders[folder].some(t => (t.text===tpl.text) && ((t.title||'')===(tpl.title||'')));
                            if (!exists) templates.folders[folder].push(tpl);
                        });
                    }
                    ensureFolderOrder();
                    saveTemplates(templates);
                    renderTemplates();
                    showAlert('Импорт завершён!');
                } catch(e) { showAlert('Ошибка импорта. Неверный формат файла.'); }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function renderTabs() {
        const tabsDiv = document.getElementById('vibe-templates-tabs');
        tabsDiv.innerHTML = '';
        tabsDiv.classList.toggle('folder-edit-mode', folderEditMode);

        const favTab = document.createElement('div');
        favTab.className = 'vibe-tpl-tab' + (templates.activeFolder === '_fav' ? ' active' : '');
        favTab.textContent = 'Избранное';
        favTab.title = 'Избранные шаблоны';
        favTab.onclick = () => { if (favTab._dragging) return; templates.activeFolder = '_fav'; saveTemplates(templates); renderTemplates(); };
        tabsDiv.appendChild(favTab);

        ensureFolderOrder();
        for (const folder of templates.folderOrder) {
            const tab = document.createElement('div');
            tab.className = 'vibe-tpl-tab' + (templates.activeFolder === folder ? ' active' : '');
            tab.title = 'Папка: ' + folder + ' (удерживайте Ctrl+Alt для редактирования и перетаскивания)';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'vibe-tpl-tab-title';
            titleSpan.textContent = folder;
            tab.appendChild(titleSpan);

            const editBtn = document.createElement('button');
            editBtn.className = 'vibe-tpl-tab-action vibe-tpl-tab-edit';
            editBtn.innerHTML = '✎';
            editBtn.title = 'Переименовать папку';
            editBtn.onclick = (e) => { e.stopPropagation(); openRenameFolderModal(folder); };
            tab.appendChild(editBtn);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'vibe-tpl-tab-action vibe-tpl-tab-remove';
            removeBtn.innerHTML = '✕';
            removeBtn.title = 'Удалить папку';
            removeBtn.onclick = e => {
                e.stopPropagation();
                const folderCount = Object.keys(templates.folders).length;
                if (folderCount <= 1) { showAlert('Нельзя удалить последнюю папку.'); return; }
                openDeleteModal(`Удалить папку "${folder}"? Все шаблоны будут удалены.`, () => {
                    delete templates.folders[folder];
                    templates.folderOrder = templates.folderOrder.filter(n => n !== folder);
                    if (templates.activeFolder === folder) {
                        const f = templates.folderOrder[0] || '_fav';
                        templates.activeFolder = f;
                    }
                    saveTemplates(templates);
                    renderTemplates();
                });
            };
            tab.appendChild(removeBtn);

            tab.onclick = () => {
                if (tab._dragging) return;
                templates.activeFolder = folder;
                saveTemplates(templates);
                renderTemplates();
            };

            // Перетаскивание — только при удержании Ctrl+Alt
            tab.addEventListener('mousedown', (e)=>{
                if (!(pressedCtrl && pressedAlt) || e.button!==0) return;
                e.preventDefault();
                let dragging = true; tab._dragging = true;
                tab.classList.add('dragging');
                let startIndex = templates.folderOrder.indexOf(folder);

                const move = (ev)=>{
                    if (!dragging) return;
                    const children = Array.from(tabsDiv.children).filter(el => el!==favTab && el.classList.contains('vibe-tpl-tab'));
                    for (let i=0;i<children.length;i++){
                        const r = children[i].getBoundingClientRect();
                        if (ev.clientX>=r.left && ev.clientX<=r.right && ev.clientY>=r.top && ev.clientY<=r.bottom){
                            const overFolder = templates.folderOrder[i];
                            if (overFolder && overFolder!==folder){
                                const arr = templates.folderOrder;
                                arr.splice(i, 0, arr.splice(startIndex,1)[0]);
                                startIndex = i;
                                saveTemplates(templates);
                                renderTabs();
                            }
                            break;
                        }
                    }
                };
                const up = ()=>{
                    if (!dragging) return;
                    dragging = false; tab._dragging=false;
                    tab.classList.remove('dragging');
                    window.removeEventListener('mousemove', move, true);
                    window.removeEventListener('mouseup', up, true);
                };
                window.addEventListener('mousemove', move, true);
                window.addEventListener('mouseup', up, true);
            });

            tabsDiv.appendChild(tab);
        }

        const addBtn = document.createElement('button');
        addBtn.id = 'vibe-tpl-add-folder';
        addBtn.type = 'button';
        addBtn.textContent = '+ Папка';
        addBtn.title = 'Добавить папку';
        addBtn.onclick = () => openFolderModal();
        tabsDiv.appendChild(addBtn);
    }

    function renderTplList() {
        const listDiv = document.getElementById('vibe-templates-list');
        listDiv.innerHTML = '';
        let tplList = [];
        if (templates.activeFolder === '_fav') {
            tplList = getAllFavorites(templates);
        } else {
            tplList = (templates.folders[templates.activeFolder] || []).map((tpl, idx)=>({ ...tpl, folder: templates.activeFolder, idx }));
        }
        if (tplList.length === 0) {
            listDiv.innerHTML = `<div class="vibe-tpl-empty">Нет шаблонов</div>`;
            return;
        }
        tplList.forEach((tpl, idx) => {
            const item = document.createElement('div');
            item.className = 'vibe-template-item';
            const fullTitle = (tpl.title ? `Название: ${tpl.title}\n` : '') + `Текст: ${tpl.text}`;
            item.title = fullTitle;

            const star = document.createElement('span');
            star.className = 'vibe-tpl-star' + (tpl.favorite ? '' : ' inactive');
            star.innerHTML = '★';
            star.title = tpl.favorite ? 'Убрать из избранного' : 'В избранное';
            star.onclick = e => {
                e.stopPropagation();
                const folder = tpl.folder ?? templates.activeFolder;
                const arr = templates.folders[folder];
                if (!arr) return;
                const realIdx = (templates.activeFolder === '_fav') ? tpl.idx : idx;
                arr[realIdx].favorite = !arr[realIdx].favorite;
                saveTemplates(templates);
                renderTemplates();
            };
            item.appendChild(star);

            const main = document.createElement('div');
            main.className = 'vibe-tpl-mainline';

            if (tpl.title && tpl.title.trim()) {
                const titleSpan = document.createElement('span');
                titleSpan.className = 'vibe-tpl-title';
                titleSpan.textContent = tpl.title.trim();
                titleSpan.title = tpl.title.trim();
                main.appendChild(titleSpan);

                const sep = document.createElement('span');
                sep.className = 'vibe-tpl-sep';
                sep.textContent = '—';
                main.appendChild(sep);
            }

            const textSpan = document.createElement('span');
            textSpan.className = 'vibe-tpl-item-text';
            const preview = (tpl.text || '').length > 90 ? (tpl.text || '').slice(0,90) + '…' : (tpl.text || '');
            textSpan.textContent = preview;
            textSpan.title = tpl.text || '';
            main.appendChild(textSpan);

            item.appendChild(main);

            const folderForIdx = tpl.folder ?? templates.activeFolder;
            const realIdx = (templates.activeFolder === '_fav') ? tpl.idx : idx;

            if (tpl.hotkey) {
                const hotkey = document.createElement('span');
                hotkey.className = 'vibe-tpl-hotkey';
                hotkey.title = 'Изменить горячую клавишу';
                hotkey.textContent = tpl.hotkey.label;
                hotkey.onclick = e => { e.stopPropagation(); openHotkeyModal(tpl, realIdx, folderForIdx); };
                item.appendChild(hotkey);
            } else {
                const hotkeyAdd = document.createElement('span');
                hotkeyAdd.className = 'vibe-tpl-hotkey';
                hotkeyAdd.style.opacity = '0.62';
                hotkeyAdd.style.cursor = 'pointer';
                hotkeyAdd.title = 'Назначить горячую клавишу';
                hotkeyAdd.textContent = 'Set';
                hotkeyAdd.onclick = e => { e.stopPropagation(); openHotkeyModal(tpl, realIdx, folderForIdx); };
                item.appendChild(hotkeyAdd);
            }

            item.onclick = function(e) {
                if (
                    e.target !== star &&
                    !e.target.className.includes('vibe-tpl-edit') &&
                    !e.target.className.includes('vibe-tpl-remove') &&
                    !e.target.className.includes('vibe-tpl-hotkey')
                ) {
                    insertTemplateObject(tpl, { folder: folderForIdx, idx: realIdx });
                }
            };

            const editBtn = document.createElement('button');
            editBtn.className = 'vibe-tpl-edit';
            editBtn.title = 'Редактировать';
            editBtn.innerHTML = 'E';
            editBtn.onclick = e => { e.stopPropagation(); openTemplateModal('edit', tpl, folderForIdx, realIdx); };
            item.appendChild(editBtn);

            const delBtn = document.createElement('button');
            delBtn.className = 'vibe-tpl-remove';
            delBtn.title = 'Удалить';
            delBtn.innerHTML = 'X';
            delBtn.onclick = e => {
                e.stopPropagation();
                openDeleteModal('Удалить шаблон?', () => {
                    templates.folders[folderForIdx].splice(realIdx, 1);
                    saveTemplates(templates);
                    renderTemplates();
                });
            };
            item.appendChild(delBtn);

            listDiv.appendChild(item);
        });
    }

    function enableWheelScrollIsolation() {
        const listDiv = document.getElementById('vibe-templates-list');
        if (!listDiv._wheelGuardAdded) {
            listDiv.addEventListener('wheel', function(e) {
                const up = e.deltaY < 0 && listDiv.scrollTop > 0;
                const down = e.deltaY > 0 && listDiv.scrollTop < (listDiv.scrollHeight - listDiv.clientHeight - 1);
                if (up || down) { e.stopPropagation(); }
                else if (listDiv.scrollHeight > listDiv.clientHeight) { e.preventDefault(); }
            }, { passive: false });
            listDiv._wheelGuardAdded = true;
        }
    }

    /* ========== Модалки/алерты ========== */
    function openFolderModal() {
        showModal({
            title: 'Добавить папку',
            customInner: `<label>Название папки</label><input type="text" id="vibe-modal-folder-name" value="">`,
            okText: 'Создать',
            onOk: () => {
                let name = (document.getElementById('vibe-modal-folder-name').value || '').trim();
                if (!name) return false;
                if (templates.folders[name]) { showAlert('Папка с таким именем уже существует!'); return false; }
                templates.folders[name] = [];
                templates.folderOrder.push(name);
                templates.activeFolder = name;
                saveTemplates(templates);
                renderTemplates();
            }
        });
    }

    function openTemplateModal(mode, tplObj, folder, idx) {
        const isEdit = (mode === 'edit');
        const vTitle = isEdit && tplObj ? (tplObj.title || '') : '';
        const vText  = isEdit && tplObj ? (tplObj.text || '') : '';
        const vEn    = isEdit && tplObj ? (tplObj.text_en || '') : '';
        showModal({
            title: isEdit ? 'Редактировать шаблон' : 'Добавить шаблон',
            customInner: `
                <label>Название (необязательно)</label>
                <input type="text" id="vibe-modal-tpl-title" value="${escapeAttr(vTitle)}">
                <label>Текст шаблона</label>
                <textarea rows="5" id="vibe-modal-tpl-text">${escapeText(vText)}</textarea>
                <label>Английская версия (необязательно)</label>
                <textarea rows="5" id="vibe-modal-tpl-en">${escapeText(vEn)}</textarea>
            `,
            okText: isEdit ? 'Сохранить' : 'Добавить',
            onOk: () => {
                const title = document.getElementById('vibe-modal-tpl-title').value.trim() || null;
                const text  = document.getElementById('vibe-modal-tpl-text').value.trim();
                const text_en = (document.getElementById('vibe-modal-tpl-en').value || '').trim() || null;
                if (!text) return false;
                if (isEdit) {
                    (templates.folders[folder] || [])[idx] = normalizeTpl({ ...tplObj, title, text, text_en, favorite: tplObj.favorite, hotkey: tplObj.hotkey });
                } else {
                    templates.folders[templates.activeFolder].push(normalizeTpl({ title, text, text_en, favorite:false, hotkey:null }));
                }
                saveTemplates(templates);
                renderTemplates();
            }
        });
    }

    function showModal({ title, label, value, textarea, okText, onOk, customInner, extraButtons }) {
        const old = document.getElementById('vibe-tpl-modal-bg'); if (old) old.remove();
        const bg = document.createElement('div'); bg.className = 'vibe-tpl-modal-bg'; bg.id = 'vibe-tpl-modal-bg';
        const modal = document.createElement('div'); modal.className = 'vibe-tpl-modal';
        let inner = ``; /* Убрали крестик закрытия — есть кнопка Отмена */

        if (title) inner += `<label style="font-weight:bold;">${title}</label>`;
        if (customInner) inner += customInner;
        else if (label) {
            inner += `<label>${label}</label>`;
            inner += textarea ? `<textarea rows="5">${value ? escapeText(value) : ""}</textarea>`
                              : `<input type="text" value="${value ? escapeAttr(value) : ""}">`;
        }
        inner += `
        <div class="vibe-tpl-modal-actions">
            <button class="vibe-tpl-btn">${okText || 'OK'}</button>
            <button class="vibe-tpl-btn cancel">Отмена</button>
            ${extraButtons ? extraButtons.map(btn =>
                `<button class="vibe-tpl-btn ${btn.className || ''}" style="${btn.style||''}">${btn.text}</button>`
            ).join('') : ''}
        </div>`;
        modal.innerHTML = inner; bg.appendChild(modal); document.body.appendChild(bg);
        modal.querySelector('.cancel').onclick = () => bg.remove();
        modal.querySelector('.vibe-tpl-btn:not(.cancel):not(.remove-hotkey)').onclick = () => {
            if (customInner) { if (onOk && onOk() === false) return; }
            else if (onOk) { if (onOk() === false) return; }
            bg.remove();
        };
        if (extraButtons) {
            extraButtons.forEach((btn, i) => {
                modal.querySelectorAll('.vibe-tpl-btn')[i+2].onclick = function() {
                    if (btn.onClick && btn.onClick() === false) return;
                    bg.remove();
                };
            });
        }
    }
    function openDeleteModal(message, onDelete) { showModal({ title: message, customInner: `<div style="font-size:14px;margin-bottom:2px;"></div>`, okText: 'Удалить', onOk: () => { onDelete(); } }); }
    function showAlert(msg) { showModal({ title: msg, okText: 'OK', onOk: () => {} }); }

    /* ===== Хоткеи шаблонов (глобально) ===== */
    function openHotkeyModal(tpl, tplIdx, folderName) {
        let current = tpl.hotkey && tpl.hotkey.label ? tpl.hotkey.label : '';
        let keyData = tpl.hotkey ? {...tpl.hotkey} : null;
        showModal({
            title: 'Назначить горячую клавишу',
            customInner: `
            <div style="font-size:14px;margin-bottom:6px;">Нажмите нужное сочетание клавиш<br>(например: <b>Ctrl+Shift+2</b>)</div>
            <input class="vibe-tpl-hotkey-input" value="${escapeAttr(current)}" readonly>
            `,
            okText: 'Сохранить',
            onOk: () => {
                let folder = folderName; let idx = tplIdx;
                if (!templates.folders[folder] || !templates.folders[folder][idx]) return false;
                if (keyData && keyData.code) {
                    if (isHotkeyAssigned(keyData, templates.folders[folder][idx])) { showAlert('Это сочетание уже используется!'); return false; }
                    templates.folders[folder][idx].hotkey = {...keyData};
                }
                saveTemplates(templates); renderTemplates();
            },
            extraButtons: [{
                text: 'Удалить хоткей', className: 'remove-hotkey', style: 'background:#dadada;color:#606060;font-weight:500;margin-left:10px;',
                onClick: () => {
                    let folder = folderName; let idx = tplIdx;
                    if (!templates.folders[folder] || !templates.folders[folder][idx]) return false;
                    templates.folders[folder][idx].hotkey = null;
                    saveTemplates(templates); renderTemplates();
                }
            }]
        });
        const modal = document.getElementById('vibe-tpl-modal-bg');
        const input = modal.querySelector('.vibe-tpl-hotkey-input');
        input.focus(); input.style.pointerEvents = 'auto';
        input.addEventListener('keydown', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (!e.key || ['Shift','Control','Alt','Meta'].includes(e.key)) return;
            const norm = normalizeKeyEvent(e);
            input.value = norm.label; keyData = {...norm};
        });
    }
    function normalizeKeyEvent(e) {
        let code = e.code; let mods = [];
        if (e.ctrlKey) mods.push('Ctrl'); if (e.shiftKey) mods.push('Shift');
        if (e.altKey) mods.push('Alt'); if (e.metaKey) mods.push('Meta');
        let label = (mods.length ? mods.join('+')+'+' : '') + keyDisplay(code);
        return { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, code, key: e.key, label };
    }
    function keyDisplay(code) {
        if (code.startsWith('Key')) return code.slice(3).toUpperCase();
        if (code.startsWith('Digit')) return code.slice(5);
        if (code === 'Space') return 'Space';
        return code;
    }
    function isHotkeyAssigned(hotkey, skipTpl) {
        for (const folder in templates.folders) {
            for (const tpl of templates.folders[folder]) {
                if (tpl === skipTpl) continue;
                if (tpl.hotkey && tpl.hotkey.code === hotkey.code
                    && !!tpl.hotkey.ctrl === !!hotkey.ctrl
                    && !!tpl.hotkey.shift === !!hotkey.shift
                    && !!tpl.hotkey.alt === !!hotkey.alt
                    && !!tpl.hotkey.meta === !!hotkey.meta
                ) return true;
            }
        }
        return false;
    }
    document.addEventListener('keydown', function(e) {
        const modalOpen = !!document.getElementById('vibe-tpl-modal-bg'); if (modalOpen) return;
        const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        for (const folder in templates.folders) {
            for (const tpl of templates.folders[folder]) {
                if (!tpl.hotkey) continue;
                if (tpl.hotkey.code === e.code && !!tpl.hotkey.ctrl === !!e.ctrlKey && !!tpl.hotkey.shift === !!e.shiftKey && !!tpl.hotkey.alt === !!e.altKey && !!tpl.hotkey.meta === !!e.metaKey) {
                    insertTemplateObject(tpl, locateTplRef(tpl));
                    e.preventDefault(); e.stopPropagation(); return;
                }
            }
        }
    }, true);

    /* === Подсказки: поиск одновременно по RU+EN (+ title), навигация Tab/Shift+Tab и Enter === */
    let suggestionIndex = -1;
    let suggestionData = [];

    function clearSuggestionSelection() {
        suggestionIndex = -1;
        const items = suggestionsBlock.querySelectorAll('.vibe-tpl-suggestion');
        items.forEach(it => it.classList.remove('selected'));
    }
    function selectSuggestionAt(idx) {
        const items = suggestionsBlock.querySelectorAll('.vibe-tpl-suggestion');
        items.forEach(it => it.classList.remove('selected'));
        if (!items.length) return;
        suggestionIndex = (idx + items.length) % items.length;
        const el = items[suggestionIndex];
        el.classList.add('selected');
        el.scrollIntoView({ block:'nearest' });
    }

    function safeLower(s){ return (s||'').toString().trim().toLowerCase(); }
    function scoreTitle(title, q) {
        const t = safeLower(title);
        if (!t || !q) return -1;
        if (t === q) return 20000;
        if (t.startsWith(q)) return 12000;
        if (t.includes(q)) return 9000;
        return -1;
    }
    function scoreText(text, q) {
        const t = safeLower(text);
        if (!t || !q) return -1;
        if (t === q) return 10000;
        if (t.startsWith(q)) return 5000;
        if (t.includes(q)) return (1000 - Math.abs(t.length - q.length));
        return -1;
    }

    function showSuggestions(value) {
        suggestionsBlock.innerHTML = '';
        clearSuggestionSelection();
        suggestionData = [];

        const q = safeLower(value);
        if (!q) return;

        try {
            const all = [];
            Object.keys(templates.folders).forEach(folder => {
                (templates.folders[folder] || []).forEach((tpl, idx) => all.push({tpl, folder, idx}));
            });

            const found = all.map(obj => {
                    const titleSc = scoreTitle(obj.tpl.title, q);
                    const ruSc = scoreText(obj.tpl.text, q);
                    const enSc = scoreText(obj.tpl.text_en, q);
                    const score = Math.max(titleSc, ruSc, enSc);
                    let matchLang = null;
                    if (score === enSc) matchLang = 'en';
                    else if (score === ruSc) matchLang = 'ru';
                    else matchLang = null;
                    return { ...obj, score, matchLang };
                })
                .filter(o => o.score > 0)
                .sort((a,b)=> b.score - a.score)
                .slice(0,5);

            if (!found.length) return;

            suggestionData = found.map(f => ({ folder:f.folder, idx:f.idx, tpl:f.tpl }));

            found.forEach(obj => {
                const el = document.createElement('div');
                el.className = 'vibe-tpl-suggestion';

                const displayText = enMode
                    ? (obj.tpl.text_en || obj.tpl.text || '')
                    : (obj.tpl.text || obj.tpl.text_en || '');
                const preview = (displayText || '').length > 160 ? (displayText || '').slice(0,160)+'…' : (displayText || '');

                if (obj.tpl.title && obj.tpl.title.trim()) {
                    const t = document.createElement('span');
                    t.className = 'vibe-sug-title';
                    t.textContent = obj.tpl.title.trim();
                    el.appendChild(t);

                    const s = document.createElement('span');
                    s.className = 'vibe-sug-sep';
                    s.textContent = '—';
                    el.appendChild(s);

                    const p = document.createElement('span');
                    p.textContent = preview;
                    el.appendChild(p);
                    el.title = (obj.tpl.title ? `Название: ${obj.tpl.title}\n` : '') + `Текст: ${displayText || ''}`;
                } else {
                    el.textContent = preview;
                    el.title = displayText || '';
                }

                el.addEventListener('click', function() {
                    insertTemplateObject(obj.tpl, { folder: obj.folder, idx: obj.idx });
                    suggestionsBlock.innerHTML = '';
                    clearSuggestionSelection();
                });

                suggestionsBlock.appendChild(el);
            });
        } catch (e) {
            // не роняем подсказки
        }
    }

    /* ======== РАСПОЗНАВАНИЕ «в поле — шаблон?» c терпимым {hello} ======== */
    function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
    function helloRegexFragment() {
        return '(?:\\s*(?:Здравствуйте|Hello)[\\s\\.,!\\?\\-—:;()"' + "'«»…~*]*|\\s*)";
    }
    async function detectTplFromTextarea() {
        const current = textarea.value.trim();
        if (!current) return null;

        const id = getSellerId();
        if (id && !sellerName) sellerName = sellerNameCache[id] || await fetchSellerName(id);
        const sName = sellerName ? escRe(sellerName) : '.+?';

        const TOK_HELLO = '\u0001';
        const TOK_SELLER = '\u0002';
        const TOK_ZAKAZ = '\u0003';

        function buildPattern(baseText) {
            if (!baseText) return null;
            let tmp = baseText.replace(/\{hello\}\s*/gi, TOK_HELLO)
                              .replace(/\{seller\}/gi, TOK_SELLER)
                              .replace(/\{Zakaz\}/gi, TOK_ZAKAZ);
            let pat = escRe(tmp);
            pat = pat.replace(/\s+/g, '\\s*');
            pat = pat.replace(new RegExp(TOK_SELLER, 'g'), sName);
            pat = pat.replace(new RegExp(TOK_ZAKAZ, 'g'), '(.+?)');
            pat = pat.replace(new RegExp(TOK_HELLO, 'g'), helloRegexFragment());
            return new RegExp('^' + pat + '$', 'iu');
        }

        const candidates = [];
        for (const folder in templates.folders) {
            (templates.folders[folder] || []).forEach((tpl, idx) => candidates.push({ tpl, folder, idx }));
        }

        for (const c of candidates) {
            let re = buildPattern(c.tpl.text);
            if (re) {
                const m = current.match(re);
                if (m) { if (m[1]) lastVars.zakaz = m[1]; if (sellerName) lastVars.seller = sellerName; return c; }
            }
            re = buildPattern(c.tpl.text_en);
            if (re) {
                const m = current.match(re);
                if (m) { if (m[1]) lastVars.zakaz = m[1]; if (sellerName) lastVars.seller = sellerName; return c; }
            }
        }
        return null;
    }

    /* ===== EN-кнопка ===== */
    async function handleTranslateBtnClick() {
        const detected = await detectTplFromTextarea();

        if (!detected) {
            openYandexTranslate(textarea.value.trim());
            return;
        }
        const tpl = detected.tpl;
        const goingToEn = !enMode;

        if (goingToEn) {
            if (!tpl.text_en) {
                openYandexTranslate(textarea.value.trim());
                return;
            }
            setEnMode(true);
            let base = tpl.text_en;
            let out = await replaceVarsInTemplate(base, { lang: 'en' });
            if (/{Zakaz}/i.test(base) && !lastVars.zakaz) {
                showZakazWidget((orderNum) => {
                    lastVars.zakaz = orderNum;
                    out = out.replace(/({Zakaz})/gi, orderNum);
                    textarea.value = out;
                    textarea.dispatchEvent(new Event('input'));
                });
            } else {
                textarea.value = out;
                textarea.dispatchEvent(new Event('input'));
            }
        } else {
            setEnMode(false);
            let base = tpl.text;
            let out = await replaceVarsInTemplate(base, { lang: 'ru' });
            if (/{Zakaz}/i.test(base) && !lastVars.zakaz) {
                showZakazWidget((orderNum) => {
                    lastVars.zakaz = orderNum;
                    out = out.replace(/({Zakaz})/gi, orderNum);
                    textarea.value = out;
                    textarea.dispatchEvent(new Event('input'));
                });
            } else {
                textarea.value = out;
                textarea.dispatchEvent(new Event('input'));
            }
        }
    }

    /* ========== Вспомогательное ========== */
    function syncBtnHeight() {
        const col = document.querySelector('.vibe-checkbox-col-min');
        if (!col) return;
        const colHeight = col.offsetHeight;
        sendBtn.style.height = colHeight + 'px';
        langBtn.style.height = colHeight + 'px';
    }
    setTimeout(syncBtnHeight, 10);
    window.addEventListener('resize', syncBtnHeight);
    function checkFlexDirection() {
        const row = document.querySelector('.vibe-row-flex-min');
        if (getComputedStyle(row).flexDirection === 'column') {
            sendBtn.style.height = '42px';
            langBtn.style.height = '42px';
        } else {
            syncBtnHeight();
        }
    }
    window.addEventListener('resize', checkFlexDirection);
    setTimeout(checkFlexDirection, 10);

    async function sendMsg() {
        const sellerId = getSellerId();
        const message = textarea.value.trim().replace(/\n/g, '\r\n');
        if (!sellerId) { statusDiv.textContent = 'Не найден ID продавца!'; statusDiv.className = 'vibe-fixed-status-error'; return; }
        if (!message) { statusDiv.textContent = 'Введите сообщение'; statusDiv.className = 'vibe-fixed-status-error'; textarea.focus(); return; }
        statusDiv.textContent = 'Отправка...'; statusDiv.className = ''; sendBtn.disabled = true;
        const form = new URLSearchParams();
        form.append('txt_Message', message);
        if (keeperChk.checked) form.append('SendKeeper', 'Yes');
        if (emailChk.checked) form.append('SendEmail', 'Yes');
        try {
            const res = await fetch(`/asp/new_message.asp?id_s=${sellerId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString(), credentials: 'same-origin'
            });
            if (res.ok) {
                localStorage.setItem(helloCacheKey(sellerId), '1');
                // Удаляем черновик и блокируем автосохранение до перезагрузки
                suppressDraftSave = true;
                localStorage.removeItem(DRAFT_PREFIX + sellerId);

                statusDiv.textContent = 'Отправлено!'; statusDiv.className = 'vibe-fixed-status-ok';
                setTimeout(() => location.reload(), 550);
                return;
            } else {
                statusDiv.textContent = 'Ошибка отправки: ' + res.status; statusDiv.className = 'vibe-fixed-status-error';
            }
        } catch {
            statusDiv.textContent = 'Ошибка соединения!'; statusDiv.className = 'vibe-fixed-status-error';
        }
        sendBtn.disabled = false;
    }

    // Навигация подсказок Tab / Shift+Tab + вставка по Enter
    textarea.addEventListener('keydown', e => {
        if (e.ctrlKey && (e.key === 'Enter' || e.keyCode === 13)) { sendMsg(); return; }
        if (e.key === 'Tab') {
            const items = suggestionsBlock.querySelectorAll('.vibe-tpl-suggestion');
            if (items.length) {
                e.preventDefault();
                if (e.shiftKey) selectSuggestionAt((suggestionIndex - 1 + items.length) % items.length);
                else selectSuggestionAt((suggestionIndex + 1) % items.length);
                return;
            }
        }
        if (e.key === 'Enter') {
            const items = suggestionsBlock.querySelectorAll('.vibe-tpl-suggestion');
            if (items.length && suggestionIndex >= 0) {
                e.preventDefault();
                const s = suggestionData[suggestionIndex];
                if (s) insertTemplateObject(s.tpl, { folder: s.folder, idx: s.idx });
                suggestionsBlock.innerHTML = '';
                clearSuggestionSelection();
            }
        }
    });

    sendBtn.addEventListener('click', sendMsg);
    document.addEventListener('keydown', e => { if (e.key === "F7") textarea.focus(); });
    window.addEventListener('mousedown', function(e) { if (e.button === 4) { e.preventDefault(); e.stopImmediatePropagation(); sendMsg(); } }, true);
    document.addEventListener('keydown', function(e) { if (e.code === 'F15') { e.preventDefault(); sendMsg(); } });

    // Клик по EN — распознать: шаблон или нет
    langBtn.addEventListener('click', () => { handleTranslateBtnClick(); });

    // Обновление подсказок + кеш черновика
    textarea.addEventListener('input', function() {
        statusDiv.textContent = ''; statusDiv.className = '';
        saveDraft();
        showSuggestions(textarea.value);
    });

    window.addEventListener('DOMContentLoaded', ()=>{ syncBtnHeight(); showSuggestions(textarea.value); });

    // Первый рендер
    renderTemplates();
    showSuggestions(textarea.value);

    // Утилиты экранирования
    function escapeAttr(str) { return String(str).replace(/[&"<>'`]/g, ch=>({ '&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;','`':'&#96;' }[ch])); }
    function escapeText(str) { return String(str).replace(/[&<>]/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[ch])); }
})();
