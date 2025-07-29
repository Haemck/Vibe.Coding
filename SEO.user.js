// ==UserScript==
// @name         DigiSeller: Order2Sheet (Yellow + Gear)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Кнопка для отправки данных заказа в Google Таблицу + коммент, система операторов и шестерёнка для смены оператора (желтый стиль, всплывающее уведомление)
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/inv_of_buyer.asp*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/SEO.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/SEO.user.js
// ==/UserScript==

(function() {
    'use strict';

    // === ВСТАВЬ СВОЙ URL Apps Script ===
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbygKWgSBaNOotp7EcSdZaWyp3hKyYizF6J4Lvv-MdIR378LDZZarWZmdxfkOzLx86eW/exec';

    // === ЖЕЛТЫЕ СТИЛИ + шестерёнка ===
    const style = `
    #vibe-order2sheet-container {
        position: fixed;
        top: 15px;
        right: 32px;
        z-index: 9999;
        display: flex;
        flex-direction: row;
        gap: 6px;
        align-items: center;
    }
    #vibe-order2sheet-btn {
        background: #ffe480;
        color: #564700;
        border: 2px solid #e2b200;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 700;
        padding: 11px 34px;
        box-shadow: 0 2px 10px #0002;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }
    #vibe-order2sheet-btn:hover {
        background: #fff6c7;
        color: #a2811a;
    }
    #vibe-operator-gear {
        padding: 7px 8px 7px 8px;
        background: #ffe480;
        border: 2px solid #e2b200;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 2px 10px #0001;
        transition: background 0.13s;
        vertical-align: middle;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 38px;
    }
    #vibe-operator-gear:hover {
        background: #fff6c7;
    }
    #vibe-operator-gear svg {
        display: block;
    }
    #vibe-sheet-popup, #vibe-operator-popup {
        position: fixed;
        z-index: 10000;
        top: 70px;
        right: 45px;
        min-width: 340px;
        background: #fffbe7;
        color: #6d5600;
        border: 2px solid #ffe480;
        border-radius: 13px;
        box-shadow: 0 8px 24px #0003;
        padding: 19px 21px 17px 21px;
        display: none;
        flex-direction: column;
        gap: 13px;
    }
    #vibe-sheet-popup label, #vibe-operator-popup label { font-size: 15px; font-weight: 600; }
    #vibe-sheet-popup textarea, #vibe-operator-popup input {
        width: 100%; border-radius: 8px; border: 1px solid #e2b200;
        background: #fffde3; color: #665000; font-size: 15px; padding: 7px; resize: vertical; margin-top: 7px;
    }
    #vibe-sheet-popup .vibe-sheet-actions, #vibe-operator-popup .vibe-sheet-actions {
        display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;
    }
    #vibe-sheet-popup .vibe-sheet-btn, #vibe-operator-popup .vibe-sheet-btn {
        background: #ffe480; color: #7a6700; border: none; padding: 8px 18px; border-radius: 7px;
        font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 6px #0001;
        transition: background 0.14s, color 0.14s;
    }
    #vibe-sheet-popup .vibe-sheet-btn:hover, #vibe-operator-popup .vibe-sheet-btn:hover {
        background: #fff6c7;
        color: #a2811a;
    }
    #vibe-toast {
        position: fixed;
        top: 72px;
        right: 272px;
        min-width: 210px;
        max-width: 310px;
        background: #fff4b7;
        color: #765800;
        border: 2px solid #ffe480;
        border-radius: 10px;
        font-size: 15px;
        padding: 13px 18px 13px 18px;
        box-shadow: 0 4px 18px #0003;
        z-index: 10001;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.6s cubic-bezier(.7,-0.2,.6,1.5);
    }
    #vibe-toast.vibe-toast-show { opacity: 1; pointer-events: auto; }
    `;

    // Вставляем стили
    const styleElem = document.createElement('style');
    styleElem.textContent = style;
    document.head.appendChild(styleElem);

    // Получение данных из страницы
    function extractData() {
        let orderId = '';
        let sellerNick = '';
        const inforows = document.querySelectorAll('td.inforow');
        if (inforows.length > 0) orderId = inforows[0].textContent.trim();
        let trs = document.querySelectorAll('table tr');
        trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length > 1 && tds[0].textContent.includes('ПРОДАВЕЦ:')) {
                sellerNick = tds[1].textContent.replace(/\s*\[.*\]/, '').trim();
            }
        });
        return { orderId, sellerNick };
    }

    // Оператор (кеш)
    async function getOperatorName() {
        let operator = await GM_getValue('vibe_operator', '');
        return operator;
    }
    async function setOperatorName(name) {
        await GM_setValue('vibe_operator', name.trim());
    }

    // Popup "оператор"
    function showOperatorPopup(cb) {
        if (document.getElementById('vibe-operator-popup')) return;
        const popup = document.createElement('div');
        popup.id = 'vibe-operator-popup';
        popup.innerHTML = `
            <label>Оператор:</label>
            <input type="text" id="vibe-operator-input" placeholder="имя и фамилия из ларка" autocomplete="off" />
            <div class="vibe-sheet-actions">
                <button class="vibe-sheet-btn" id="vibe-operator-save">Сохранить</button>
            </div>
        `;
        document.body.appendChild(popup);
        popup.style.display = 'flex';

        // Автофокус на поле
        setTimeout(() => {
            const inp = document.getElementById('vibe-operator-input');
            if (inp) inp.focus();
        }, 80);

        document.getElementById('vibe-operator-save').onclick = async function() {
            const name = document.getElementById('vibe-operator-input').value.trim();
            if (name.length < 3) {
                showToast('Введите корректное имя!');
                return;
            }
            await setOperatorName(name);
            popup.remove();
            cb && cb(name);
        };
    }

    // Popup комментарий
    function showCommentPopup(onSend) {
        if (document.getElementById('vibe-sheet-popup')) return;
        const popup = document.createElement('div');
        popup.id = 'vibe-sheet-popup';
        popup.innerHTML = `
            <label>Комментарий:</label>
            <textarea id="vibe-sheet-comment" rows="3" placeholder="Тут можно добавить комментарий..."></textarea>
            <div class="vibe-sheet-actions">
                <button class="vibe-sheet-btn" id="vibe-sheet-cancel">Отмена</button>
                <button class="vibe-sheet-btn" id="vibe-sheet-send">Записать</button>
            </div>
        `;
        document.body.appendChild(popup);
        popup.style.display = 'flex';

        // Автофокус
        setTimeout(() => {
            const ta = document.getElementById('vibe-sheet-comment');
            if (ta) ta.focus();
        }, 80);

        document.getElementById('vibe-sheet-cancel').onclick = function() {
            popup.remove();
        };
        document.getElementById('vibe-sheet-send').onclick = async function() {
            const comment = document.getElementById('vibe-sheet-comment').value.trim();
            popup.remove();
            onSend && onSend(comment);
        };
    }

    // Всплывающее уведомление (toast)
    function showToast(text = '', ms = 3700) {
        let toast = document.getElementById('vibe-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'vibe-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = text;
        toast.className = 'vibe-toast-show';
        clearTimeout(toast._timer);
        toast.style.opacity = '1';
        toast._timer = setTimeout(() => {
            toast.className = '';
            toast.style.opacity = '0';
        }, ms);
    }

    // Отправка данных в Apps Script
    function sendToSheet({ orderId, sellerNick, comment, operator }) {
        const payload = {
            orderId,
            sellerNick,
            comment,
            operator
        };
        GM_xmlhttpRequest({
            method: "POST",
            url: APPS_SCRIPT_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(payload),
            onload: function(response) {
                try {
                    let resp = JSON.parse(response.responseText);
                    if (resp.result === 'OK') {
                        showToast('Данные успешно записаны!');
                    } else {
                        showToast('Ошибка: ' + (resp.error || 'Неизвестно!'));
                    }
                } catch (e) {
                    showToast('Ошибка отправки или ответа скрипта.');
                }
            },
            onerror: function() {
                showToast('Ошибка сети или сервера!');
            }
        });
    }

    // === Кнопка + шестерёнка ===
    function addMainButton() {
        if (document.getElementById('vibe-order2sheet-container')) return;

        const container = document.createElement('span');
        container.id = 'vibe-order2sheet-container';

        // Основная кнопка
        const btn = document.createElement('button');
        btn.id = 'vibe-order2sheet-btn';
        btn.textContent = 'В Таблицу';

        // Кнопка-шестерёнка
        const gearBtn = document.createElement('button');
        gearBtn.id = 'vibe-operator-gear';
        gearBtn.title = 'Сменить оператора';
        gearBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7" fill="#ffe480" stroke="#e2b200" stroke-width="2"/>
        <g stroke="#b39900" stroke-width="1.2" fill="none">
          <path d="M10 3V0"/><path d="M10 20v-3"/>
          <path d="M3 10H0"/><path d="M20 10h-3"/>
          <path d="M4.1 4.1L2 2"/><path d="M17.9 17.9l-2.1-2.1"/>
          <path d="M4.1 15.9L2 18"/><path d="M17.9 2.1l-2.1 2.1"/>
        </g>
        </svg>`;

        gearBtn.onclick = () => {
            showOperatorPopup();
        };

        // Кнопки в контейнере
        container.appendChild(btn);
        container.appendChild(gearBtn);
        document.body.appendChild(container);

        // Основная логика кнопки
        btn.onclick = async () => {
            let operator = await getOperatorName();
            if (!operator) {
                showOperatorPopup(() => {
                    setTimeout(() => btn.click(), 200);
                });
                return;
            }
            showCommentPopup(async comment => {
                const { orderId, sellerNick } = extractData();
                if (!orderId || !sellerNick) {
                    showToast('Не удалось получить данные заказа или продавца.');
                    return;
                }
                sendToSheet({ orderId, sellerNick, comment, operator });
            });
        };
    }

    // Запуск
    window.addEventListener('DOMContentLoaded', addMainButton);

})();
