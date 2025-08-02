// ==UserScript==
// @name         MonkeMessage
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Фиксированное поле для отправки сообщений в DigiSeller. POST прямо на сервер, чекбоксы, автообновление страницы после отправки!
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/seller_messages.asp*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeMessage.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeMessage.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ==== СТИЛИ ====
    const style = document.createElement('style');
    style.innerHTML = `
    #vibe-fixed-panel {
        position: fixed;
        top: 70px;
        right: 30px;
        width: 410px;
        min-height: 290px;
        background: #fff;
        border: 2px solid #d00;
        border-radius: 15px;
        box-shadow: 0 2px 18px #0002;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        padding: 18px 18px 14px 18px;
        gap: 12px;
    }
    #vibe-fixed-panel:focus-within { border-color: #4694e0; box-shadow: 0 4px 30px #0003;}
    #vibe-fixed-input {
        flex: 1 1 auto;
        min-height: 100px;
        max-height: 220px;
        resize: vertical;
        width: 100%;
        font-size: 16px;
        font-family: inherit;
        border: 1.5px solid #c5c5c5;
        border-radius: 8px;
        padding: 10px;
        background: #fafbfe;
        outline: none;
        transition: border-color .2s;
    }
    #vibe-fixed-input:focus { border-color: #4694e0;}
    .vibe-checkbox-row {
        display: flex;
        align-items: center;
        gap: 18px;
        font-size: 15px;
        margin: 2px 0 2px 2px;
        color: #444;
    }
    .vibe-checkbox-row label {
        cursor: pointer;
        user-select: none;
        margin-right: 12px;
    }
    #vibe-fixed-send {
        width: 100%;
        padding: 12px 0;
        font-size: 17px;
        font-weight: bold;
        color: #fff;
        background: linear-gradient(90deg,#38b236 0,#3885e2 100%);
        border: none;
        border-radius: 9px;
        cursor: pointer;
        box-shadow: 0 1px 5px 0 #0001;
        transition: background .15s;
    }
    #vibe-fixed-send:hover,
    #vibe-fixed-send:focus { background: linear-gradient(90deg,#46c346 0,#437be7 100%);}
    @media (max-width: 900px) {
        #vibe-fixed-panel { width: 99vw; right: 1vw; left: 1vw; }
    }
    `;
    document.head.appendChild(style);

    // ==== HTML ПАНЕЛЬ ====
    const panel = document.createElement('div');
    panel.id = 'vibe-fixed-panel';
    panel.innerHTML = `
        <textarea id="vibe-fixed-input" placeholder="Введите сообщение... (Ctrl+Enter — отправить)" rows="7"></textarea>
        <div class="vibe-checkbox-row">
            <label>
                <input type="checkbox" id="vibe-fixed-wmkeeper">
                оповестить по WM Keeper
            </label>
            <label>
                <input type="checkbox" id="vibe-fixed-email">
                оповестить по Email
            </label>
        </div>
        <button id="vibe-fixed-send">Отправить</button>
        <div id="vibe-fixed-status" style="color:#367e37;margin:3px 2px 0 2px;font-size:14px;"></div>
    `;
    document.body.appendChild(panel);

    // ==== ВСПОМОГАТЕЛЬНЫЕ ====

    function getSellerId() {
        const m = location.search.match(/id_s=(\d+)/);
        return m ? m[1] : null;
    }

    const textarea = document.getElementById('vibe-fixed-input');
    const sendBtn = document.getElementById('vibe-fixed-send');
    const keeperChk = document.getElementById('vibe-fixed-wmkeeper');
    const emailChk = document.getElementById('vibe-fixed-email');
    const statusDiv = document.getElementById('vibe-fixed-status');

    async function sendMsg() {
        const sellerId = getSellerId();
        // === КРИТИЧЕСКИЙ МОМЕНТ: заменяем \n на \r\n ===
        const message = textarea.value.trim().replace(/\n/g, '\r\n');
        if (!sellerId) {
            statusDiv.textContent = 'Ошибка: не найден ID продавца (id_s) в ссылке!';
            statusDiv.style.color = "#bb2222";
            return;
        }
        if (message.length === 0) {
            textarea.focus();
            statusDiv.textContent = 'Введите сообщение';
            statusDiv.style.color = "#bb2222";
            return;
        }
        statusDiv.textContent = 'Отправка...';
        statusDiv.style.color = "#6b8b30";
        sendBtn.disabled = true;

        const form = new URLSearchParams();
        form.append('txt_Message', message);
        if (keeperChk.checked) form.append('SendKeeper', 'Yes');
        if (emailChk.checked) form.append('SendEmail', 'Yes');

        try {
            const res = await fetch(`/asp/new_message.asp?id_s=${sellerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: form.toString(),
                credentials: 'same-origin'
            });

            if (res.ok) {
                location.reload();
                return;
            } else {
                statusDiv.textContent = 'Ошибка отправки! Код ' + res.status;
                statusDiv.style.color = "#bb2222";
            }
        } catch (err) {
            statusDiv.textContent = 'Ошибка соединения!';
            statusDiv.style.color = "#bb2222";
        }
        sendBtn.disabled = false;
    }

    textarea.addEventListener('keydown', function(e) {
        if (e.ctrlKey && (e.key === 'Enter' || e.keyCode === 13)) {
            sendMsg();
        }
    });
    sendBtn.addEventListener('click', sendMsg);

    document.addEventListener('keydown', function(e) {
        if (e.key === "F7") textarea.focus();
    });
})();
// Теперь переносы строк в отправке будут в точности как у стандартной формы DigiSeller.
