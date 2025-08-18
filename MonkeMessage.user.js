// ==UserScript==
// @name         Digiseller: MonkeMessage
// @namespace    http://tampermonkey.net/
// @version      3.8.3
// @description  Панель с чекбоксами, зелёной кнопкой, системой шаблонов, автозаполняемыми {Seller}/{Zakaz}, подсказками, импортом/экспортом. Ctrl+Enter отправить, F7 — фокус
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/seller_messages.asp*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeMessage.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeMessage.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ================== СТИЛИ ==================
    const style = document.createElement('style');
    style.innerHTML = `#vibe-fixed-panel-min {
        position: fixed;
        top: 186px;
        right: 30px;
        width: 500px;
        min-height: 158px;
        background: #f7f9fa;
        border: 1.6px solid #bde8bc;
        border-radius: 12px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        padding: 18px 16px 10px 16px;
        gap: 10px;
        box-sizing: border-box;
        font-family: Verdana, Arial, sans-serif;
        box-shadow: 0 1px 12px #233c2010;
        transition: border-color .18s, box-shadow .15s;
    }
    #vibe-fixed-panel-min:focus-within {
        border-color: #9ae6a8;
        box-shadow: 0 2px 22px #aadfbd66;
    }
    #vibe-fixed-input-min {
        flex: 1 1 auto;
        min-height: 58px;
        max-height: 170px;
        resize: vertical;
        width: 100%;
        font-size: 15px;
        border: 1.1px solid #c8e7d1;
        border-radius: 7px;
        padding: 9px 8px;
        background: #fafdff;
        outline: none;
        color: #23272b;
        transition: border-color .15s;
        font-family: inherit;
    }
    #vibe-fixed-input-min:focus {
        border-color: #9ae6a8;
        background: #e6f9ed;
    }
    .vibe-row-flex-min {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        justify-content: space-between;
        gap: 17px;
        width: 100%;
    }
    .vibe-checkbox-col-min {
        display: flex;
        flex-direction: column;
        gap: 7px;
        justify-content: center;
        align-items: flex-start;
        min-width: 108px;
        flex-shrink: 0;
    }
    .vibe-checkbox-col-min label {
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 5px;
        padding: 1px 4px 1px 1px;
        transition: background .12s;
        font-size: 14px;
        color: #23272b;
    }
    .vibe-checkbox-col-min label:hover {
        background: #e6f9ed;
    }
    .vibe-checkbox-col-min input[type="checkbox"] {
        accent-color: #259960;
        width: 16px; height: 16px;
        border-radius: 4px;
        margin: 0 2px 0 0;
    }
    #vibe-fixed-send-min {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 178px;
        padding: 10px 32px 10px 28px;
        font-size: 15px;
        font-family: 'Segoe UI', Consolas, Arial, sans-serif;
        border-radius: 9px;
        border: 1.6px solid #bde8bc;
        background: #e6f9ed;
        color: #23272b;
        font-weight: 600;
        box-shadow: none;
        outline: none;
        cursor: pointer;
        text-decoration: none !important;
        margin: 0 6px 0 0;
        letter-spacing: .01em;
        user-select: none;
        position: relative;
        z-index: 2;
        pointer-events: auto;
        transition:
            background 0.14s cubic-bezier(.55,.15,.46,1.06),
            border-color 0.14s cubic-bezier(.55,.15,.46,1.06),
            color 0.14s cubic-bezier(.55,.15,.46,1.06),
            box-shadow 0.15s,
            transform 0.08s cubic-bezier(.32,.04,.62,1.48);
    }
    #vibe-fixed-send-min:hover,
    #vibe-fixed-send-min:focus {
        background: #c7f1da;
        border-color: #9ae6a8;
        color: #1f794e;
    }
    #vibe-fixed-send-min:active {
        background: #b2e7c9;
        color: #1b6d47;
        transform: scale(0.97);
    }
    #vibe-fixed-send-min[disabled] {
        background: #e2f1e6;
        border-color: #c8e0cd;
        color: #9aaea4;
        cursor: not-allowed;
        opacity: 0.65;
    }
    #vibe-fixed-status-min {
        min-height: 0px;
        margin: 0 2px;
        font-size: 13px;
        color: #23272b;
        letter-spacing: .01em;
        transition: color .14s;
    }
    .vibe-fixed-status-error { color: #c8584c !important; }
    .vibe-fixed-status-ok { color: #23272b !important; }
    #vibe-tpl-suggestions-block {
        display: flex;
        flex-direction: column;
        gap: 0;
        margin: 8px 0 8px 0;
        min-height: 0;
        position: relative;
        z-index: 9;
    }
    .vibe-tpl-suggestion {
        background: #e6f9ed;
        border: 1.2px solid #bde8bc;
        border-radius: 8px;
        color: #23272b;
        font-size: 14px;
        padding: 9px 14px;
        margin-bottom: 6px;
        box-shadow: 0 2px 13px #25996010;
        cursor: pointer;
        user-select: none;
        opacity: 0;
        transform: translateY(15px) scale(0.98);
        animation: vibe-tpl-suggest-fadein 0.26s cubic-bezier(.41,.72,.29,.98) forwards;
        transition: background .15s, border-color .13s, color .14s;
        min-height: 26px;
        display: flex;
        align-items: center;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: pre-line;
    }
    .vibe-tpl-suggestion:hover {
        background: #d2f6e1;
        border-color: #8be29b;
        color: #1f794e;
    }
    @keyframes vibe-tpl-suggest-fadein {
        0% { opacity: 0; transform: translateY(15px) scale(0.98);}
        65% { opacity: 1; transform: translateY(-4px) scale(1.04);}
        100% { opacity: 1; transform: translateY(0) scale(1);}
    }
    #vibe-templates-block {
        border-top: 1px solid #e3f2ea;
        padding: 4px 0 0 0;
        margin: 0px -3px 0 -3px;
        background: transparent;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    #vibe-templates-toptools {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
        flex-wrap: wrap;
    }
    .vibe-tpl-tool-btn {
        padding: 3px 14px;
        border-radius: 7px;
        border: 1px solid #bde8bc;
        background: #e6f9ed;
        color: #23272b;
        font-size: 13px;
        font-family: inherit;
        cursor: pointer;
        transition: background .14s, color .13s;
        font-weight: 500;
    }
    .vibe-tpl-tool-btn:hover {
        background: #c7f1da;
        color: #1f794e;
    }
    #vibe-templates-tabs {
        display: flex;
        flex-direction: row;
        gap: 6px;
        margin-bottom: 2px;
        flex-wrap: wrap;
    }
    .vibe-tpl-tab {
        display: flex;
        align-items: center;
        background: #e6f9ed;
        color: #23272b;
        border-radius: 7px 7px 0 0;
        border: 1.3px solid #bde8bc;
        border-bottom: none;
        font-size: 13px;
        font-weight: 500;
        padding: 4px 13px 4px 12px;
        margin-right: 2px;
        cursor: pointer;
        outline: none;
        user-select: none;
        transition: background .14s, color .14s;
        position: relative;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .vibe-tpl-tab.active,
    .vibe-tpl-tab:hover {
        background: #d2f6e1;
        color: #1f794e;
    }
    .vibe-tpl-tab .vibe-tpl-tab-remove {
        margin-left: 6px;
        font-size: 14px;
        color: #b0b0b0;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0 2px;
        border-radius: 3px;
        transition: background .13s;
    }
    .vibe-tpl-tab .vibe-tpl-tab-remove:hover {
        background: #fde6e4;
    }
    #vibe-tpl-add-folder {
        color: #23272b;
        background: #e6f9ed;
        border: 1px solid #bde8bc;
        border-radius: 7px;
        font-size: 13px;
        margin-left: 6px;
        padding: 3px 12px;
        cursor: pointer;
        transition: background .14s;
    }
    #vibe-tpl-add-folder:hover {
        background: #c7f1da;
    }
    #vibe-templates-list {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-height: 24px;
        max-height: 170px;
        overflow-y: auto;
        margin-bottom: 2px;
        overflow-x: hidden;
    }
    .vibe-template-item {
        display: flex;
        align-items: center;
        background: #f7f9fa;
        border-radius: 7px;
        border: 1px solid #e6f9ed;
        font-size: 14px;
        color: #23272b;
        padding: 10px 12px 10px 8px;
        margin-bottom: 2px;
        cursor: pointer;
        gap: 8px;
        transition: background .14s, border-color .12s;
        position: relative;
        user-select: none;
        max-width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        min-height: 26px;
    }
    .vibe-template-item:hover, .vibe-template-item.selected {
        background: #e6f9ed;
        border-color: #bde8bc;
    }
    .vibe-template-item span.vibe-tpl-item-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1 1 0%;
        min-width: 0;
        display: block;
        max-width: 100%;
    }
    .vibe-template-item .vibe-tpl-star {
        color: #e5b218;
        margin-right: 2px;
        font-size: 17px;
        cursor: pointer;
        transition: filter .13s;
        font-family: monospace;
        font-weight: bold;
    }
    .vibe-template-item .vibe-tpl-star.inactive {
        color: #b1b1a6;
        filter: grayscale(1) brightness(1.15);
    }
    .vibe-template-item .vibe-tpl-edit,
    .vibe-template-item .vibe-tpl-remove {
        color: #a0a0a0;
        font-size: 15px;
        cursor: pointer;
        margin-left: 5px;
        transition: color .13s;
        background: none;
        border: none;
        border-radius: 2px;
        padding: 1px 3px;
        font-family: monospace;
        font-weight: bold;
    }
    .vibe-template-item .vibe-tpl-edit:hover { color: #23272b; background: #e6f9ed; }
    .vibe-template-item .vibe-tpl-remove:hover { color: #c8584c; background: #fde6e4; }
    .vibe-tpl-hotkey {
        background: #e6f9ed;
        border: 1px solid #bde8bc;
        border-radius: 4px;
        color: #23272b;
        font-size: 12px;
        padding: 1px 8px 0 8px;
        margin-left: 9px;
        margin-right: 0;
        font-family: monospace;
        cursor: pointer;
        opacity: 0.82;
        transition: background .11s;
    }
    .vibe-tpl-hotkey:hover {
        background: #d2f6e1;
        opacity: 1;
    }
    .vibe-tpl-empty {
        font-size: 13px;
        color: #b5b5b5;
        padding: 10px 0 4px 3px;
    }
    .vibe-tpl-modal-bg {
        position: fixed;
        left: 0; top: 0; width: 100vw; height: 100vh;
        background: #233c2044;
        z-index: 999999;
        display: flex; align-items: center; justify-content: center;
    }
    .vibe-tpl-modal {
        background: #fafdff;
        border-radius: 11px;
        border: 2px solid #bde8bc;
        padding: 28px 24px 16px 24px;
        box-shadow: 0 8px 48px #25996013;
        min-width: 260px;
        min-height: 80px;
        display: flex;
        flex-direction: column;
        gap: 11px;
        position: relative;
        z-index: 9999999;
    }
    .vibe-tpl-modal label { font-size: 14px; color: #23272b; margin-bottom: 4px;}
    .vibe-tpl-modal input, .vibe-tpl-modal textarea {
        width: 100%; font-size: 14px; padding: 6px 9px; border-radius: 6px;
        border: 1px solid #bde8bc; margin-bottom: 9px; color: #23272b; background: #fafdff;
    }
    .vibe-tpl-modal .vibe-tpl-hotkey-input {
        width: 100%;
        min-height: 32px;
        font-size: 13px;
        margin-bottom: 8px;
        border: none;
        background: #e6f9ed;
        color: #23272b;
        border-radius: 5px;
        text-align: left;
        padding: 7px 10px;
        font-family: monospace;
        letter-spacing: 0.04em;
        outline: none;
        user-select: none;
        pointer-events: none;
    }
    .vibe-tpl-modal .vibe-tpl-modal-actions {
        display: flex; flex-direction: row; gap: 11px; margin-top: 5px;
    }
    .vibe-tpl-modal .vibe-tpl-btn {
        border-radius: 7px;
        padding: 6px 19px;
        font-size: 14px;
        border: none;
        font-weight: 600;
        cursor: pointer;
        color: #fff;
        background: #259960;
        transition: background .13s;
    }
    .vibe-tpl-modal .vibe-tpl-btn:hover { background: #1f794e; }
    .vibe-tpl-modal .vibe-tpl-btn.cancel {
        background: #dadada; color: #606060; font-weight: 500;
    }
    .vibe-tpl-modal .vibe-tpl-btn.cancel:hover { background: #bbb; }
    .vibe-tpl-modal-close {
        position: absolute;
        right: 11px;
        top: 11px;
        font-size: 19px;
        background: none;
        border: none;
        color: #b0b0b0;
        cursor: pointer;
        transition: color .14s;
    }
    .vibe-tpl-modal-close:hover { color: #c8584c; }
    @media (max-width: 650px) {
        #vibe-fixed-panel-min {
            width: 97vw;
            left: 1vw;
            right: 1vw;
            min-width: 0;
            padding: 7vw 2vw 3vw 2vw;
        }
        .vibe-row-flex-min {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
        }
        #vibe-fixed-send-min {
            width: 100%;
            min-width: 0;
            min-height: 0;
            height: 42px;
        }
        #vibe-templates-list {
            max-height: 130px;
        }
    }
    #vibe-templates-bottomtools {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
        margin-top: 5px;
        padding-bottom: 2px;
    }
    #vibe-templates-bottomtools .vibe-tpl-tool-btn,
    #vibe-templates-bottomtools #vibe-tpl-add-template {
        margin: 0;
    }

    /* ---- Виджет быстрого ввода заказа ---- */
    #vibe-zakaz-widget {
        position: absolute;
        left: 0;
        top: -46px;
        background: #e6f9ed;
        border: 1.2px solid #bde8bc;
        border-radius: 8px;
        box-shadow: 0 4px 24px #25996013;
        padding: 8px 13px 10px 10px;
        z-index: 200;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 180px;
        transition: box-shadow .14s, border-color .12s;
        font-family: inherit;
        opacity: 1;
        animation: vibe-fade-in 0.18s;
    }
    @keyframes vibe-fade-in {
        0% { opacity: 0; transform: translateY(10px);}
        100% { opacity: 1; transform: translateY(0);}
    }
    #vibe-zakaz-widget.hide { display: none !important; }
    #vibe-zakaz-widget input {
        border: 1.1px solid #bde8bc;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 14px;
        width: 90px;
        background: #fff;
        color: #23272b;
        outline: none;
        margin-right: 4px;
    }
    #vibe-zakaz-widget input:focus {
        border-color: #23272b;
        background: #fafdff;
    }
    #vibe-zakaz-widget button, #vibe-zakaz-widget .zakaz-close-btn {
        background: #23272b;
        color: #fff;
        border: none;
        border-radius: 5px;
        font-size: 14px;
        padding: 5px 13px;
        cursor: pointer;
        transition: background .12s;
        margin-left: 0;
    }
    #vibe-zakaz-widget button:hover {
        background: #1f794e;
    }
    #vibe-zakaz-widget .zakaz-close-btn {
        background: none;
        color: #c8584c;
        font-weight: bold;
        font-size: 17px;
        padding: 0 7px;
        margin-left: 3px;
        border: none;
        box-shadow: none;
    }
    #vibe-zakaz-widget .zakaz-close-btn:hover {
        background: #fde6e4;
        color: #b02323;
    }
    #vibe-zakaz-widget label {
        font-size: 13px;
        color: #23272b;
        margin-right: 5px;
        font-weight: 500;
        margin-bottom: 0;
    }
    `; // Обрезано, но здесь все ваши стили без изменений.
    // Для экономии места в этом блоке вставьте все ваши стили из оригинала.
    // Если нужно — могу вставить сюда всё полотно CSS отдельно.
    document.head.appendChild(style);

    // ================== HTML ==================
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
            <textarea id="vibe-fixed-input-min" placeholder="Ваше сообщение… (Ctrl+Enter)" rows="5"></textarea>
        </div>
        <div class="vibe-row-flex-min">
            <div class="vibe-checkbox-col-min">
                <label title="Уведомить в WM Keeper">
                    <input type="checkbox" id="vibe-fixed-wmkeeper-min">
                    WM Keeper
                </label>
                <label title="Уведомить на Email">
                    <input type="checkbox" id="vibe-fixed-email-min">
                    Email
                </label>
            </div>
            <button id="vibe-fixed-send-min" title="Отправить (Ctrl+Enter)">
                <span>Отправить</span>
            </button>
        </div>
        <div id="vibe-tpl-suggestions-block"></div>
        <div id="vibe-fixed-status-min"></div>
        <div id="vibe-templates-block"></div>
    `;
    document.body.appendChild(panel);

    // ================ Переменные ===============
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
            let res = await fetch('/asp/seller_info.asp?id_s=' + encodeURIComponent(id), {
                credentials: 'same-origin'
            });
            let html = await res.text();
            let m = html.match(/<td class="namerow"><nobr>ПСЕВДОНИМ:<\/nobr><\/td>\s*<td class="inforow"[^>]*>([\s\S]*?)<\/td>/i);
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

    // --- Новый виджет Zakaz ---
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
    function hideZakazWidget() {
        zakazWidget.classList.add('hide');
        zakazCallback = null;
    }
    zakazCloseBtn.onclick = hideZakazWidget;
    zakazOkBtn.onclick = function() {
        let val = zakazInput.value.trim();
        if (!val) {
            zakazInput.focus();
            return;
        }
        if (zakazCallback) zakazCallback(val);
        hideZakazWidget();
    };
    zakazInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            zakazOkBtn.click();
        } else if (e.key === 'Escape') {
            hideZakazWidget();
        }
    });

    // Вставка шаблона с заменой {Seller} и {Zakaz}
    async function replaceVarsInTemplate(text) {
        let id = getSellerId();
        if (!id) return text;
        if (/{seller}/i.test(text)) {
            let name = sellerNameCache[id] || sellerName;
            if (!name) name = await fetchSellerName(id);
            sellerName = name;
            text = text.replace(/{seller}/gi, name || '[?]');
        }
        return text;
    }
    function insertTemplateText(tplText) {
        replaceVarsInTemplate(tplText).then(filledText => {
            if (/{Zakaz}/i.test(filledText)) {
                showZakazWidget(function(orderNum) {
                    let finalText = filledText.replace(/({Zakaz})/gi, orderNum);
                    textarea.value = finalText;
                    textarea.focus();
                    textarea.dispatchEvent(new Event('input'));
                });
            } else {
                textarea.value = filledText;
                textarea.focus();
                textarea.dispatchEvent(new Event('input'));
            }
        });
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, ch=>({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
        })[ch]);
    }

    // ================== ХРАНИЛИЩЕ ШАБЛОНОВ (localStorage) ==================
    const TPL_KEY = 'vibe_msg_templates_v3';
    function getDefaultTemplates() {
        return {
            folders: {
                "Общие": [
                    { text: "Спасибо за обращение. Ваше сообщение получено.", favorite: true, hotkey: null },
                    { text: "Пожалуйста, уточните номер заказа: {Zakaz}", favorite: false, hotkey: null },
                    { text: "Здравствуйте, {Seller}! Ваш заказ {Zakaz} отправлен.", favorite: false, hotkey: null }
                ],
                "Возвраты": [
                    { text: "Ваш возврат будет обработан в течение 3 рабочих дней.", favorite: false, hotkey: null }
                ]
            },
            activeFolder: "Общие"
        };
    }
    function loadTemplates() {
        let data = localStorage.getItem(TPL_KEY);
        if (!data) return getDefaultTemplates();
        try {
            return JSON.parse(data);
        } catch {
            return getDefaultTemplates();
        }
    }
    function saveTemplates(tpls) {
        localStorage.setItem(TPL_KEY, JSON.stringify(tpls));
    }
    function getAllFavorites(tpls) {
        const favs = [];
        Object.keys(tpls.folders).forEach(folder => {
            tpls.folders[folder].forEach((tpl, idx) => {
                if (tpl.favorite) favs.push({ ...tpl, folder, idx });
            });
        });
        return favs;
    }
    let templates = loadTemplates();

    // ================== UI ТЕМПЛЕЙТОВ ==================
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
        a.href = url;
        a.download = 'templates-vibe.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},120);
    }
    function onImportClick() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function() {
                try {
                    const imported = JSON.parse(reader.result);
                    if (!imported || !imported.folders) throw 1;
                    for (let folder in imported.folders) {
                        if (!templates.folders[folder]) templates.folders[folder] = [];
                        imported.folders[folder].forEach(tpl => {
                            if (!templates.folders[folder].some(t=>t.text===tpl.text)) {
                                templates.folders[folder].push(tpl);
                            }
                        });
                    }
                    saveTemplates(templates);
                    renderTemplates();
                    showAlert('Импорт завершён!');
                } catch(e) {
                    showAlert('Ошибка импорта. Неверный формат файла.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    function renderTabs() {
        const tabsDiv = document.getElementById('vibe-templates-tabs');
        tabsDiv.innerHTML = '';
        const favTab = document.createElement('div');
        favTab.className = 'vibe-tpl-tab' + (templates.activeFolder === '_fav' ? ' active' : '');
        favTab.textContent = 'Избранное';
        favTab.onclick = () => { templates.activeFolder = '_fav'; saveTemplates(templates); renderTemplates(); };
        tabsDiv.appendChild(favTab);
        Object.keys(templates.folders).forEach(folder => {
            const tab = document.createElement('div');
            tab.className = 'vibe-tpl-tab' + (templates.activeFolder === folder ? ' active' : '');
            tab.textContent = folder;
            tab.onclick = () => { templates.activeFolder = folder; saveTemplates(templates); renderTemplates(); };
            if (Object.keys(templates.folders).length > 1) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'vibe-tpl-tab-remove';
                removeBtn.title = 'Удалить папку';
                removeBtn.innerHTML = '✕';
                removeBtn.onclick = e => {
                    e.stopPropagation();
                    openDeleteModal(`Удалить папку "${folder}"? Все шаблоны будут удалены.`, () => {
                        delete templates.folders[folder];
                        if (templates.activeFolder === folder) {
                            const f = Object.keys(templates.folders)[0];
                            templates.activeFolder = f || '_fav';
                        }
                        saveTemplates(templates);
                        renderTemplates();
                    });
                };
                tab.appendChild(removeBtn);
            }
            tabsDiv.appendChild(tab);
        });
        const addBtn = document.createElement('button');
        addBtn.id = 'vibe-tpl-add-folder';
        addBtn.type = 'button';
        addBtn.textContent = '+ Папка';
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
            tplList = templates.folders[templates.activeFolder] || [];
        }
        if (tplList.length === 0) {
            listDiv.innerHTML = `<div class="vibe-tpl-empty">Нет шаблонов</div>`;
            return;
        }
        tplList.forEach((tpl, idx) => {
            const item = document.createElement('div');
            item.className = 'vibe-template-item';
            item.title = tpl.text.length > 90 ? tpl.text : '';
            // Звезда
            const star = document.createElement('span');
            star.className = 'vibe-tpl-star' + (tpl.favorite ? '' : ' inactive');
            star.innerHTML = '★';
            star.title = tpl.favorite ? 'Убрать из избранного' : 'В избранное';
            star.onclick = e => {
                e.stopPropagation();
                if (templates.activeFolder === '_fav') {
                    const folder = tpl.folder;
                    const tplsArr = templates.folders[folder];
                    if (tplsArr && tplsArr[tpl.idx]) {
                        tplsArr[tpl.idx].favorite = !tplsArr[tpl.idx].favorite;
                    }
                } else {
                    templates.folders[templates.activeFolder][idx].favorite = !tpl.favorite;
                }
                saveTemplates(templates);
                renderTemplates();
            };
            item.appendChild(star);
            // Текст
            const span = document.createElement('span');
            span.textContent = tpl.text.length > 90 ? tpl.text.slice(0, 90) + '…' : tpl.text;
            span.className = "vibe-tpl-item-text";
            item.appendChild(span);
            // Кнопка/лейбл горячей клавиши
            if (tpl.hotkey) {
                const hotkey = document.createElement('span');
                hotkey.className = 'vibe-tpl-hotkey';
                hotkey.title = 'Изменить горячую клавишу';
                hotkey.textContent = tpl.hotkey.label;
                hotkey.onclick = e => {
                    e.stopPropagation();
                    // Передаём папку и индекс!
                    if (templates.activeFolder === '_fav') {
                        openHotkeyModal(tpl, tpl.idx, tpl.folder);
                    } else {
                        openHotkeyModal(tpl, idx, templates.activeFolder);
                    }
                };
                item.appendChild(hotkey);
            } else {
                const hotkeyAdd = document.createElement('span');
                hotkeyAdd.className = 'vibe-tpl-hotkey';
                hotkeyAdd.style.opacity = '0.62';
                hotkeyAdd.style.cursor = 'pointer';
                hotkeyAdd.title = 'Назначить горячую клавишу';
                hotkeyAdd.textContent = 'Set';
                hotkeyAdd.onclick = e => {
                    e.stopPropagation();
                    if (templates.activeFolder === '_fav') {
                        openHotkeyModal(tpl, tpl.idx, tpl.folder);
                    } else {
                        openHotkeyModal(tpl, idx, templates.activeFolder);
                    }
                };
                item.appendChild(hotkeyAdd);
            }
            // Вставить в поле по клику
            item.onclick = function(e) {
                if (
                    e.target !== star &&
                    !e.target.className.includes('vibe-tpl-edit') &&
                    !e.target.className.includes('vibe-tpl-remove') &&
                    !e.target.className.includes('vibe-tpl-hotkey')
                ) {
                    insertTemplateText(tpl.text);
                }
            };
            // Редактировать
            const editBtn = document.createElement('button');
            editBtn.className = 'vibe-tpl-edit';
            editBtn.title = 'Редактировать';
            editBtn.innerHTML = 'E';
            editBtn.onclick = e => {
                e.stopPropagation();
                if (templates.activeFolder === '_fav') {
                    openTemplateModal('edit', tpl, tpl.folder, tpl.idx);
                } else {
                    openTemplateModal('edit', tpl, templates.activeFolder, idx);
                }
            };
            item.appendChild(editBtn);
            // Удалить
            const delBtn = document.createElement('button');
            delBtn.className = 'vibe-tpl-remove';
            delBtn.title = 'Удалить';
            delBtn.innerHTML = 'X';
            delBtn.onclick = e => {
                e.stopPropagation();
                openDeleteModal('Удалить шаблон?', () => {
                    if (templates.activeFolder === '_fav') {
                        templates.folders[tpl.folder].splice(tpl.idx, 1);
                    } else {
                        templates.folders[templates.activeFolder].splice(idx, 1);
                    }
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
                if (up || down) {
                    e.stopPropagation();
                } else if (listDiv.scrollHeight > listDiv.clientHeight) {
                    e.preventDefault();
                }
            }, { passive: false });
            listDiv._wheelGuardAdded = true;
        }
    }

    // ========== МОДАЛКИ ==========
    function openFolderModal() {
        showModal({
            title: 'Добавить папку',
            label: 'Название папки',
            value: '',
            okText: 'Создать',
            onOk: (name) => {
                name = name.trim();
                if (!name) return;
                if (templates.folders[name]) {
                    showAlert('Папка с таким именем уже существует!');
                    return false;
                }
                templates.folders[name] = [];
                templates.activeFolder = name;
                saveTemplates(templates);
                renderTemplates();
            }
        });
    }
    function openTemplateModal(mode, tplObj, folder, idx) {
        let val = mode === 'edit' && tplObj ? tplObj.text : '';
        showModal({
            title: mode === 'edit' ? 'Редактировать шаблон' : 'Добавить шаблон',
            label: 'Текст шаблона',
            value: val,
            textarea: true,
            okText: mode === 'edit' ? 'Сохранить' : 'Добавить',
            onOk: (text) => {
                text = text.trim();
                if (!text) return false;
                if (mode === 'edit') {
                    (templates.folders[folder] || [])[idx].text = text;
                } else {
                    templates.folders[templates.activeFolder].push({ text, favorite: false, hotkey: null });
                }
                saveTemplates(templates);
                renderTemplates();
            }
        });
    }
    function showModal({ title, label, value, textarea, okText, onOk, customInner, extraButtons }) {
        const old = document.getElementById('vibe-tpl-modal-bg');
        if (old) old.remove();
        const bg = document.createElement('div');
        bg.className = 'vibe-tpl-modal-bg';
        bg.id = 'vibe-tpl-modal-bg';
        const modal = document.createElement('div');
        modal.className = 'vibe-tpl-modal';
        let inner = `
        <button class="vibe-tpl-modal-close" title="Закрыть">&times;</button>
    `;
        if (title) inner += `<label style="font-weight:bold;">${title}</label>`;
        if (customInner) {
            inner += customInner;
        } else if (label) {
            inner += `<label>${label}</label>`;
            inner += textarea
                ? `<textarea rows="5">${value ? value.replace(/</g,"&lt;") : ""}</textarea>`
            : `<input type="text" value="${value ? value.replace(/"/g,"&quot;") : ""}">`;
        }
        inner += `
        <div class="vibe-tpl-modal-actions">
            <button class="vibe-tpl-btn">${okText || 'OK'}</button>
            <button class="vibe-tpl-btn cancel">Отмена</button>
            ${extraButtons ? extraButtons.map(btn =>
                                              `<button class="vibe-tpl-btn ${btn.className || ''}" style="${btn.style||''}">${btn.text}</button>`
                                             ).join('') : ''}
        </div>
    `;
        modal.innerHTML = inner;
        bg.appendChild(modal);
        document.body.appendChild(bg);
        modal.querySelector('.vibe-tpl-modal-close').onclick = () => bg.remove();
        modal.querySelector('.cancel').onclick = () => bg.remove();
        const input = modal.querySelector(textarea ? 'textarea' : 'input');
        if (input) setTimeout(()=>input.focus(),120);
        // Основная кнопка
        modal.querySelector('.vibe-tpl-btn:not(.cancel):not(.remove-hotkey)').onclick = () => {
            if (customInner) {
                if (onOk && onOk() === false) return;
            } else if (input && onOk) {
                if (onOk(input.value) === false) return;
            } else if (onOk) {
                if (onOk() === false) return;
            }
            bg.remove();
        };
        // Дополнительные кнопки (например, удалить хоткей)
        if (extraButtons) {
            extraButtons.forEach((btn, i) => {
                modal.querySelectorAll('.vibe-tpl-btn')[i+2].onclick = function() {
                    if (btn.onClick && btn.onClick() === false) return;
                    bg.remove();
                };
            });
        }
    }

    function openDeleteModal(message, onDelete) {
        showModal({
            title: message,
            customInner: `<div style="font-size:14px;margin-bottom:2px;"></div>`,
            okText: 'Удалить',
            onOk: () => { onDelete(); }
        });
    }
    function showAlert(msg) {
        showModal({
            title: msg,
            okText: 'OK',
            onOk: () => {}
        });
    }

    // ===== Горячие клавиши для шаблонов =====
    function openHotkeyModal(tpl, tplIdx, folderName) {
        let current = tpl.hotkey && tpl.hotkey.label ? tpl.hotkey.label : '';
        let keyData = tpl.hotkey ? {...tpl.hotkey} : null;
        showModal({
            title: 'Назначить горячую клавишу',
            customInner: `
            <div style="font-size:14px;margin-bottom:6px;">
                Нажмите нужное сочетание клавиш<br>
                (например: <b>Ctrl+Shift+2</b>)
            </div>
            <input class="vibe-tpl-hotkey-input" value="${current}" readonly>
        `,
            okText: 'Сохранить',
            onOk: () => {
                let folder = folderName;
                let idx = tplIdx;
                if (templates.activeFolder === '_fav') {
                    folder = tpl.folder;
                    idx = tpl.idx;
                }
                if (!templates.folders[folder] || !templates.folders[folder][idx]) return false;
                if (keyData && keyData.code) {
                    if (isHotkeyAssigned(keyData, templates.folders[folder][idx])) {
                        showAlert('Это сочетание уже используется!');
                        return false;
                    }
                    templates.folders[folder][idx].hotkey = {...keyData};
                }
                saveTemplates(templates);
                renderTemplates();
            },
            extraButtons: [{
                text: 'Удалить хоткей',
                className: 'remove-hotkey',
                style: 'background:#dadada;color:#606060;font-weight:500;margin-left:10px;',
                onClick: () => {
                    let folder = folderName;
                    let idx = tplIdx;
                    if (templates.activeFolder === '_fav') {
                        folder = tpl.folder;
                        idx = tpl.idx;
                    }
                    if (!templates.folders[folder] || !templates.folders[folder][idx]) return false;
                    templates.folders[folder][idx].hotkey = null;
                    saveTemplates(templates);
                    renderTemplates();
                }
            }]
        });
        const modal = document.getElementById('vibe-tpl-modal-bg');
        const input = modal.querySelector('.vibe-tpl-hotkey-input');
        input.focus();
        input.style.pointerEvents = 'auto';
        input.addEventListener('keydown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!e.key || ['Shift','Control','Alt','Meta'].includes(e.key)) return;
            const norm = normalizeKeyEvent(e);
            input.value = norm.label;
            keyData = {...norm};
        });
    }

    function normalizeKeyEvent(e) {
        let key = e.key;
        let code = e.code;
        if (/^[а-яА-ЯёЁ]$/.test(key) && code.startsWith('Key')) {
            key = code.replace('Key', '').toLowerCase();
        } else if (/^[а-яА-ЯёЁ]$/.test(key) && code.startsWith('Digit')) {
            key = code.replace('Digit', '');
        }
        let mods = [];
        if (e.ctrlKey) mods.push('Ctrl');
        if (e.shiftKey) mods.push('Shift');
        if (e.altKey) mods.push('Alt');
        if (e.metaKey) mods.push('Meta');
        let label = (mods.length ? mods.join('+')+'+' : '') + keyDisplay(code);
        return {
            ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey,
            code, key: key, label
        };
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
        if (document.activeElement === textarea) return;
        for (const folder in templates.folders) {
            for (const tpl of templates.folders[folder]) {
                if (!tpl.hotkey) continue;
                if (
                    tpl.hotkey.code === e.code &&
                    !!tpl.hotkey.ctrl === !!e.ctrlKey &&
                    !!tpl.hotkey.shift === !!e.shiftKey &&
                    !!tpl.hotkey.alt === !!e.altKey &&
                    !!tpl.hotkey.meta === !!e.metaKey
                ) {
                    insertTemplateText(tpl.text);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
        }
    }, true);

    // === Подсказки шаблонов по тексту ===
    function showSuggestions(value) {
        suggestionsBlock.innerHTML = '';
        value = value.trim();
        if (!value) return;
        const allTpls = [];
        Object.keys(templates.folders).forEach(folder => {
            templates.folders[folder].forEach(tpl => allTpls.push(tpl));
        });
        const lower = value.toLowerCase();
        let found = allTpls
            .map(tpl => ({
                tpl, score: (
                    tpl.text.trim().toLowerCase() === lower ? 10000 :
                    tpl.text.trim().toLowerCase().startsWith(lower) ? 5000 :
                    tpl.text.trim().toLowerCase().includes(lower) ? (1000 - Math.abs(tpl.text.length-value.length)) :
                    -1)
            }))
            .filter(obj => obj.score > 0 && obj.tpl.text !== value)
            .sort((a,b) => b.score - a.score)
            .slice(0,5);

        if (!found.length) return;
        found.forEach(obj => {
            const el = document.createElement('div');
            el.className = 'vibe-tpl-suggestion';
            el.textContent = obj.tpl.text.length > 160 ? obj.tpl.text.slice(0,160)+'…' : obj.tpl.text;
            el.title = obj.tpl.text;
            el.onclick = function() {
                insertTemplateText(obj.tpl.text);
                suggestionsBlock.innerHTML = '';
            };
            suggestionsBlock.appendChild(el);
        });
    }

    // ========== ВСПОМОГАТЕЛЬНОЕ ==========
    function syncBtnHeight() {
        const col = document.querySelector('.vibe-checkbox-col-min');
        if (!col) return;
        const colHeight = col.offsetHeight;
        sendBtn.style.height = colHeight + 'px';
    }
    setTimeout(syncBtnHeight, 10);
    window.addEventListener('resize', syncBtnHeight);
    function checkFlexDirection() {
        const row = document.querySelector('.vibe-row-flex-min');
        if (getComputedStyle(row).flexDirection === 'column') {
            sendBtn.style.height = '42px';
        } else {
            syncBtnHeight();
        }
    }
    window.addEventListener('resize', checkFlexDirection);
    setTimeout(checkFlexDirection, 10);

    async function sendMsg() {
        const sellerId = getSellerId();
        const message = textarea.value.trim().replace(/\n/g, '\r\n');
        if (!sellerId) {
            statusDiv.textContent = 'Не найден ID продавца!';
            statusDiv.className = 'vibe-fixed-status-error';
            return;
        }
        if (!message) {
            statusDiv.textContent = 'Введите сообщение';
            statusDiv.className = 'vibe-fixed-status-error';
            textarea.focus();
            return;
        }
        statusDiv.textContent = 'Отправка...';
        statusDiv.className = '';
        sendBtn.disabled = true;
        const form = new URLSearchParams();
        form.append('txt_Message', message);
        if (keeperChk.checked) form.append('SendKeeper', 'Yes');
        if (emailChk.checked) form.append('SendEmail', 'Yes');
        try {
            const res = await fetch(`/asp/new_message.asp?id_s=${sellerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString(),
                credentials: 'same-origin'
            });
            if (res.ok) {
                statusDiv.textContent = 'Отправлено!';
                statusDiv.className = 'vibe-fixed-status-ok';
                setTimeout(() => location.reload(), 550);
                return;
            } else {
                statusDiv.textContent = 'Ошибка отправки: ' + res.status;
                statusDiv.className = 'vibe-fixed-status-error';
            }
        } catch {
            statusDiv.textContent = 'Ошибка соединения!';
            statusDiv.className = 'vibe-fixed-status-error';
        }
        sendBtn.disabled = false;
    }

    textarea.addEventListener('keydown', e => {
        if (e.ctrlKey && (e.key === 'Enter' || e.keyCode === 13)) sendMsg();
    });
    sendBtn.addEventListener('click', sendMsg);
    document.addEventListener('keydown', e => {
        if (e.key === "F7") textarea.focus();
    });
    textarea.addEventListener('input', function() {
        statusDiv.textContent = '';
        statusDiv.className = '';
        showSuggestions(textarea.value);
    });
    window.addEventListener('DOMContentLoaded', syncBtnHeight);
    setTimeout(syncBtnHeight, 150);

    // ========== Первый рендер ==========
    renderTemplates();
    showSuggestions(textarea.value);

})();
