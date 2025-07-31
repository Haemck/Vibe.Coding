// ==UserScript==
// @name         Review Killer 🦍🍌 BananaMultiSeller v6.6
// @version      6.8
// @description  Мультипродавец: быстрые письма, копипаст ников/ID, удаление отзывов с банановым вайбом! + перевод сообщений EN/RU (локально для блока)
// @match        https://my.digiseller.ru/asp/inv_of_buyer.asp*
// @grant        none
// @updateURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ReviewKiller.user.js
// @downloadURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ReviewKiller.user.js
// ==/UserScript==

(function() {
    'use strict';

    const LS_KEY = 'banana_monkey_ids_v1';

    // ===== СТИЛИ =====
    const pirateStyle = `
    @import url('https://fonts.googleapis.com/css2?family=Pirata+One&display=swap');
    #banana-pirate-root {
        position: fixed;
        top: 60px; right: 40px;
        z-index: 99999;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 0px;
    }
    #banana-podsnos-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 110px;
        height: 48px;
        margin-right: 0px;
        background: linear-gradient(85deg, #1e2328 50%, #555555 100%);
        color: #e5c774;
        font-size: 18px;
        border: 2.2px dashed #c6a759;
        border-radius: 10px 0 0 10px;
        letter-spacing: 1px;
        font-family: 'Pirata One', cursive, Arial, sans-serif;
        box-shadow: 0 2px 12px #1e13056b;
        cursor: pointer;
        transition: background 0.2s, box-shadow 0.2s;
        position: relative;
        left: 0;
        top: 0;
        z-index: 100002;
    }
    #banana-podsnos-btn:active {
        box-shadow: 0 0 2px #3b240b;
    }
    #banana-pirate-panel {
        background: linear-gradient(135deg, #3b240b 90%, #7e5521 100%);
        border: 3px solid #e6b800;
        border-radius: 0 15px 15px 0;
        box-shadow: 0 0 28px 8px #2a1804c9;
        padding: 27px 27px 18px 27px;
        width: 410px;
        min-height: 380px;
        color: #ffecb3;
        font-family: 'Segoe UI', Arial, sans-serif;
        transition: box-shadow 0.2s;
        position: relative;
        left: 0;
        display: flex;
        flex-direction: column;
    }
    #banana-collapse-btn {
        position: absolute;
        top: 13px;
        right: 17px;
        background: none;
        border: none;
        font-size: 27px;
        cursor: pointer;
        color: #ffffff;
        z-index: 10005;
        transition: color 0.15s;
        outline: none;
        user-select: none;
    }
    #banana-collapse-btn:hover {
        color: #ffe39b;
        text-shadow: 0 2px 8px #ae7e17;
    }
    #banana-pirate-panel.banana-collapsed {
        width: 320px;
        min-width: 100px;
        min-height: 54px;
        max-height: 60px;
        overflow: hidden;
        padding: 10px 25px 6px 25px;
        background: linear-gradient(90deg,#3b240b 60%, #7e5521 100%);
        border-radius: 0 17px 17px 0;
        box-shadow: 0 0 10px 3px #2a180430;
        display: flex;
        align-items: center;
        justify-content: flex-start;
    }
    #banana-pirate-panel.banana-collapsed *:not(h2):not(#banana-collapse-btn) {
        display: none !important;
    }
    #banana-pirate-panel h2 {
        margin: 0 0 10px 0;
        font-size: 29px;
        color: #f6de83;
        font-family: 'Pirata One', cursive, Arial, sans-serif;
        letter-spacing: 1.2px;
        text-shadow: 2px 2px 5px #321a02b2;
        text-align: left;
        padding-bottom: 4px;
        border-bottom: 1.7px dashed #e0bc65;
    }
    #banana-pirate-panel.banana-collapsed h2 {
        font-size: 24px;
        padding: 0;
        margin: 0;
        border: none;
    }
    .pirate-label {
        font-size:16px;
        color: #ffe085;
        margin-bottom: 3px;
        letter-spacing: 0.2px;
        font-family: 'Segoe UI', Arial, sans-serif;
    }
    #banana-id-row {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        width: 100%;
        gap: 8px;
        margin-bottom: 0;
    }
    #banana-id-input {
        width: 100%;
        height: 80px;
        font-size: 17px;
        border: 1.7px solid #ad8533;
        border-radius: 8px;
        background: #201103ad;
        color: #f3d280;
        resize: vertical;
        padding: 7px;
        font-family: 'Segoe UI', Arial, sans-serif;
        box-shadow: 0 0 6px #8a6f3a85 inset;
        min-width: 0;
    }
    #banana-kill-btn {
        height: 48px;
        min-width: 130px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        white-space: pre-line;
        font-size: 19px;
        font-weight: bold;
        background: linear-gradient(90deg, #ffe39b 60%, #f3d280 100%);
        color: #3a2a13;
        border: none;
        outline: none;
        border-radius: 10px;
        box-shadow: 0 1px 6px #66552e2a;
        font-family: 'Pirata One', cursive, Arial, sans-serif;
        margin-left: 0;
        margin-top: 0;
        margin-bottom: 0;
        margin-right: 0;
        transition: background 0.19s;
    }
    #banana-kill-btn:active {
        background: #ffe5ab;
    }
    .pirate-btn {
        font-size: 17px;
        padding: 8px 22px;
        margin: 4px 0px 12px 0;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        color: #321b01;
        font-weight: bold;
        font-family: 'Pirata One', cursive, Arial, sans-serif;
        background: linear-gradient(93deg, #f3d280 70%, #ffe39b 100%);
        box-shadow: 1px 1px 6px #21150570;
        outline: none;
        transition: background 0.2s, box-shadow 0.2s;
    }
    .pirate-btn:disabled {
        background: #6d614e;
        color: #a4946d;
        cursor: not-allowed;
        opacity: 0.68;
    }
    #banana-log {
        background: #22170bca;
        border: 1.5px solid #7e5521;
        border-radius: 7px;
        height: 95px;
        width: 100%;
        margin-top: 2px;
        font-size: 15px;
        overflow-y: auto;
        padding: 6px;
        color: #ffe39b;
        font-family: 'Segoe UI', Arial, sans-serif;
        box-shadow: 0 0 8px #3a2715b2 inset;
    }
    #banana-multimsg-block {
        margin-top: 9px;
        margin-bottom: 4px;
        width: 100%;
    }
    .banana-msg-block {
        margin-bottom: 10px;
        background: #31260fbe;
        border: 1.5px dashed #e0bc65;
        border-radius: 10px;
        padding: 8px 5px 9px 8px;
        font-family: 'Segoe UI', Arial, sans-serif;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 10px;
        min-width: 0;
        width: 100%;
        position: relative;
    }
    .banana-translate-btn {
        margin-left: 0px;
        margin-top: 2px;
        width: 36px;
        height: 36px;
        background: #ffe39b;
        border-radius: 7px;
        border: none;
        color: #4d3800;
        font-size: 17px;
        font-weight: 900;
        box-shadow: 0 1px 6px #d8c13b42;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        padding: 0;
        outline: none;
    }
    .banana-translate-btn:active {
        background: #fad74a;
    }
    .banana-send-btn {
        margin-left: 0px;
        margin-top: 45px;
        width: 36px;
        height: 36px;
        background: #c2edfd;
        border-radius: 7px;
        border: none;
        color: #0598ba;
        font-size: 18px;
        font-weight: 900;
        box-shadow: 0 1px 6px #3ec8fa3b;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        padding: 0;
        outline: none;
    }
    .banana-send-btn:active {
        background: #a5dbe8;
    }
    .banana-msg-content {
        flex: 1 1 65%;
        min-width: 0;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        gap: 7px;
    }
    .banana-msg-block label {
        font-size: 15px;
        font-weight: bold;
        color: #ffe085;
        font-family: 'Segoe UI', Arial, sans-serif;
    }
    .banana-msg-area {
        width: 100%;
        min-height: 60px;
        max-height: 160px;
        border: none;
        font-size: 15px;
        padding: 8px 10px 8px 0px;
        background: transparent;
        color: #ffe39b;
        resize: none;
        outline: none;
        user-select: all;
        cursor: pointer;
        font-family: 'Segoe UI', Arial, sans-serif;
        margin-top: 4px;
        margin-bottom: 2px;
        box-sizing: border-box;
        display: block;
    }
    .banana-msg-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 54px;
        max-width: 62px;
        align-items: stretch;
        justify-content: flex-start;
        margin-left: 6px;
        margin-right: 2px;
    }
    .banana-msg-btn {
        font-size: 16px;
        padding: 6px 7px 6px 7px;
        border-radius: 5px;
        border: none;
        cursor: pointer;
        color: #543b0e;
        font-weight: 600;
        background: linear-gradient(96deg, #ffe39b 60%, #f3d280 100%);
        box-shadow: 0 1px 4px #85661424;
        font-family: inherit;
        outline: none;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .banana-msg-btn:active {
        background: #e3c051;
    }
    .banana-msg-btn[title*="id для этого продавца"] {
        font-family: inherit !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        letter-spacing: 0.05em;
    }
    .banana-mail-icon {
        width: 22px; height: 22px; display: inline-block;
        vertical-align: middle;
        margin: 0 0 0 0;
        filter: drop-shadow(0 0 2px #54e2ff) drop-shadow(0 0 5px #0994bc);
        pointer-events: none;
    }
    .banana-mail-icon path {
        fill: #40cfff !important;
        stroke: #fff !important;
        stroke-width: 1.6 !important;
    }
    .pirate-sep {
        height: 1.5px;
        background: repeating-linear-gradient(90deg, #e6b800, #fffde6 4px, #e6b800 7px);
        border: none;
        margin: 8px 0 11px 0;
    }
    `;
    // ===== СТИЛИ КОНЕЦ =====

    const pirateStyleElem = document.createElement('style');
    pirateStyleElem.textContent = pirateStyle;
    document.head.appendChild(pirateStyleElem);

    // ==== UI ====
    const root = document.createElement('div');
    root.id = 'banana-pirate-root';

    // Кнопка “под снос”
    const podsnosBtn = document.createElement('button');
    podsnosBtn.id = 'banana-podsnos-btn';
    podsnosBtn.className = 'pirate-btn';
    podsnosBtn.innerHTML = '💀 Под снос';

    // Основная панель
    const piratePanel = document.createElement('div');
    piratePanel.id = 'banana-pirate-panel';
    piratePanel.innerHTML = `
        <button id="banana-collapse-btn" title="Свернуть/развернуть окно">🏳️</button>
        <h2>Review Killer</h2>
        <span class="pirate-label">Введи <b>ID отзывов</b> (каждый с новой строки):</span>
        <div id="banana-id-row">
            <textarea id="banana-id-input" placeholder="Пример:\n255100014\n255100015"></textarea>
            <button id="banana-kill-btn" class="pirate-btn">Удалить отзыв</button>
        </div>
        <div id="banana-log"></div>
        <hr class="pirate-sep">
        <div id="banana-multimsg-block"></div>
    `;

    root.appendChild(podsnosBtn);
    root.appendChild(piratePanel);
    document.body.appendChild(root);

    // Управление
    const killBtn = piratePanel.querySelector('#banana-kill-btn');
    const logDiv = piratePanel.querySelector('#banana-log');
    const input = piratePanel.querySelector('#banana-id-input');
    const collapseBtn = piratePanel.querySelector('#banana-collapse-btn');
    const multiMsgBlock = piratePanel.querySelector('#banana-multimsg-block');
    let isRunning = false;
    // --- Логгер в банановый блок!
    function pirateLog(msg) {
        const time = new Date().toLocaleTimeString();
        logDiv.innerHTML += `<div>[${time}] ${msg}</div>`;
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    // --- RU/EN шаблоны ---
    // <--- СМЕНИТЬ СВОИ АНГЛИЙСКИЕ ШАБЛОНЫ ТУТ! --->
    const templates = {
        ru: {
            greet: "Здравствуйте!",
            one: id => `Отрицательный отзыв по заказу ${id} был аннулирован.`,
            many: ids => `Отрицательные отзывы по заказам ${ids.join(', ')} были аннулированы.`
        },
        en: {
            greet: "Hello!",
            one: id => `The negative review for order ${id} has been cancelled.`,
            many: ids => `Negative reviews for orders ${ids.join(', ')} have been cancelled.`
        }
    };
    // --- Сохраняем/грузим ID отзывов
    function loadIdsFromStorage() {
        const data = localStorage.getItem(LS_KEY);
        if (data !== null) {
            input.value = data;
        }
    }
    function saveIdsToStorage(newVal) {
        localStorage.setItem(LS_KEY, newVal);
    }
    input.addEventListener('input', function() {
        saveIdsToStorage(input.value);
        bananaAlwaysDrawSellerMsgs();
        updateKillBtnText();
    });
    loadIdsFromStorage();
    window.addEventListener('storage', function(e) {
        if (e.key === LS_KEY && e.newValue !== input.value) {
            input.value = e.newValue || '';
            bananaAlwaysDrawSellerMsgs();
            updateKillBtnText();
        }
    });

    // --- Динамическая надпись на кнопке удаления
    function updateKillBtnText() {
        let ids = input.value
            .split(/[\r\n]+/)
            .map(x => x.trim())
            .filter(x => x.length > 0 && /^\d+$/.test(x));
        if (ids.length > 1) {
            killBtn.textContent = 'Удалить отзывы';
        } else {
            killBtn.textContent = 'Удалить отзыв';
        }
    }
    updateKillBtnText();

    // --- Свернуть панель (замена на флаг)
    setTimeout(() => {
        piratePanel.classList.add('banana-collapsed');
        collapseBtn.innerText = "🏳️";
    }, 100);
    collapseBtn.addEventListener('click', () => {
        piratePanel.classList.toggle('banana-collapsed');
        collapseBtn.innerText = piratePanel.classList.contains('banana-collapsed') ? "🏳️" : "🏴‍☠️";
    });

    // --- Копировать сообщение по клику
    multiMsgBlock.onclick = function(e) {
        if (e.target.classList.contains('banana-msg-area')) {
            e.target.select();
            document.execCommand('copy');
            pirateLog('<span style="color:#c6a759">Сообщение скопировано</span>');
        }
    };

    // --- Генерация сообщения для одного продавца
    function makeSellerMsg(ids, lang) {
    let t = templates[lang];
    let msg = ""; // Приветствие временно отключено
    // msg += t.greet + "\n\n"; // ← закомментировали эту строку

    if (ids.length === 1) {
        msg += t.one(ids[0]);
    } else if (ids.length > 1) {
        msg += t.many(ids);
    } else {
        msg += "_______";
    }
    return msg;
}


    // --- Асинхронно получаем по всем id продавца и ник
    async function getMultiSellerMap(ids) {
        let map = {};
        let promises = ids.map(async id => {
            let idTrimmed = id.trim();
            if (!/^\d+$/.test(idTrimmed)) return;
            let sellerInfo = await bananaMonkeyGetSellerInfoByOrderId(idTrimmed);
            let sellerId = sellerInfo.sellerId || 'unknown';
            let nickname = sellerInfo.nickname || sellerId;
            if (!map[sellerId]) map[sellerId] = {ids: [], nickname};
            map[sellerId].ids.push(idTrimmed);
            map[sellerId].nickname = nickname;
        });
        await Promise.all(promises);
        return map;
    }

    // --- Глобальная карта языка для каждого блока
    const blockLangMap = {};

    function drawAllSellerMsgs(all) {
        multiMsgBlock.innerHTML = "";
        for (let sid in all) {
            let ids = all[sid].ids;
            let nick = all[sid].nickname || sid;
            if (!(sid in blockLangMap)) blockLangMap[sid] = 'ru';

            let block = document.createElement('div');
            block.className = 'banana-msg-block';

            // --- Кнопка перевода
            let translateBtn = document.createElement('button');
            translateBtn.className = 'banana-translate-btn';
            translateBtn.title = (blockLangMap[sid] === 'ru') ? 'Перевести на English' : 'Switch to Russian';
            translateBtn.innerHTML = (blockLangMap[sid] === 'ru') ? 'EN' : 'RU';

            // --- Кнопка письма
            let mailBtn = document.createElement('button');
            mailBtn.className = 'banana-send-btn';
            mailBtn.title = 'Отправить письмо этому продавцу';
            mailBtn.innerHTML = `<svg class="banana-mail-icon" viewBox="0 0 24 24"><path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm2-.001L12 13l8-7.001V18H4V5.999zM4.21 4.5l7.3 6.389c.308.271.762.271 1.07 0l7.3-6.389A2 2 0 0 0 20 4H4c-.072 0-.143.005-.21.5z" /></svg>`;

            // --- Колонка слева
            let leftCol = document.createElement('div');
            leftCol.style.display = 'flex';
            leftCol.style.flexDirection = 'column';
            leftCol.style.alignItems = 'center';
            leftCol.style.justifyContent = 'flex-start';
            leftCol.style.gap = '10px';
            leftCol.appendChild(translateBtn);
            leftCol.appendChild(mailBtn);

            // --- Содержимое сообщения
            let msgContent = document.createElement('div');
            msgContent.className = 'banana-msg-content';
            msgContent.innerHTML = `
                <label>Сообщение для продавца <b>${nick}</b>:</label>
                <textarea class="banana-msg-area" readonly>${makeSellerMsg(ids, blockLangMap[sid])}</textarea>
            `;

            // --- Кнопки справа (id/ник)
            let msgActions = document.createElement('div');
            msgActions.className = 'banana-msg-actions';

            let btnTable = document.createElement('button');
btnTable.className = 'banana-msg-btn';
btnTable.innerHTML = '📋';
btnTable.title = 'Скопировать как таблицу: id / ник / Удалён';
btnTable.onclick = function() {
    if (!nick || ids.length === 0) return;
    let rows = ids.map(id => [id, nick, 'Удалён'].join('\t')).join('\n');
    try {
        navigator.clipboard.writeText(rows);
        pirateLog('<span style="color:#f6de83">Скопировано в табличном формате</span>');
    } catch (e) {
        pirateLog('<span style="color:#d5545f">Ошибка копирования!</span>');
    }
};
msgActions.appendChild(btnTable);


            block.appendChild(leftCol);
            block.appendChild(msgContent);
            block.appendChild(msgActions);
            multiMsgBlock.appendChild(block);

            // --- Перевод только для этого блока
            translateBtn.onclick = function() {
                blockLangMap[sid] = (blockLangMap[sid] === 'ru') ? 'en' : 'ru';
                translateBtn.innerHTML = (blockLangMap[sid] === 'ru') ? 'EN' : 'RU';
                translateBtn.title = (blockLangMap[sid] === 'ru') ? 'Перевести на English' : 'Switch to Russian';
                msgContent.querySelector('.banana-msg-area').value = makeSellerMsg(ids, blockLangMap[sid]);
            };

            // --- Отправка письма только для этого блока
            mailBtn.onclick = async function(e) {
                e.stopPropagation();
                mailBtn.disabled = true;
                let messageText = msgContent.querySelector('.banana-msg-area').value.trim();
                if (!messageText || messageText.includes('_______')) {
                    pirateLog('<span style="color:#d5545f">Сообщение пустое, отправка отменена!</span>');
                    mailBtn.disabled = false;
                    return;
                }
                pirateLog(`<b>Пробую отправить сообщение продавцу #${sid} (${nick})...</b>`);
                const params = new URLSearchParams();
                let fixedMsg = messageText.replace(/\n/g, '\r\n');
                params.append("txt_Message", fixedMsg);
                try {
                    const resp = await fetch(`/asp/new_message.asp?id_s=${sid}&new`, {
                        method: "POST",
                        body: params.toString(),
                        credentials: 'same-origin',
                        headers: { "Content-Type": "application/x-www-form-urlencoded" }
                    });
                    const text = await resp.text();
                    if (resp.ok && !text.includes('textarea') && !text.includes('name="txt_Message"')) {
                        pirateLog(`<span style="color:#27d800">Сообщение успешно отправлено продавцу #${sid}!</span>`);
                    } else {
                        pirateLog(`<span style="color:#e0bc65">Отправка завершена, но возможно что-то не так. Проверьте переписку вручную!</span>`);
                    }
                } catch (e) {
                    pirateLog(`<span style="color:#d5545f">Ошибка отправки сообщения: ${e}</span>`);
                }
                mailBtn.disabled = false;
            };
        }
    }

    // --- Всегда отрисовываем блок сообщений для введённых id
    async function bananaAlwaysDrawSellerMsgs() {
        let ids = input.value
            .split(/[\r\n]+/)
            .map(x => x.trim())
            .filter(x => x.length > 0 && /^\d+$/.test(x));
        if (ids.length === 0) {
            multiMsgBlock.innerHTML = "";
            updateKillBtnText();
            return;
        }
        let all = await getMultiSellerMap(ids);
        drawAllSellerMsgs(all);
        updateKillBtnText();
    }
    bananaAlwaysDrawSellerMsgs();
    // --- Основная логика удаления ОДНОГО или НЕСКОЛЬКИХ отзывов
    async function pirateKill(ids) {
        isRunning = true;
        killBtn.disabled = true;
        podsnosBtn.disabled = true;
        let perSeller = {};
        let lines = input.value.split(/\r?\n/);
        let selectionStart = input.selectionStart, selectionEnd = input.selectionEnd;

        // Если выделено несколько строк — удаляем их все
        let toDelete = [];
        if (selectionStart !== selectionEnd) {
            let selected = input.value.slice(selectionStart, selectionEnd).split(/\r?\n/).map(x=>x.trim()).filter(x=>/^\d+$/.test(x));
            toDelete = selected;
        }
        if (toDelete.length === 0) {
            toDelete = lines.map(x=>x.trim()).filter(x=>/^\d+$/.test(x));
        }
        if (toDelete.length === 0) {
            pirateLog('<span style="color:#d5545f">Нет валидных ID для удаления!</span>');
            isRunning = false;
            killBtn.disabled = false;
            podsnosBtn.disabled = false;
            return;
        }
        for (let idToKill of toDelete) {
            let sellerInfo = await bananaMonkeyGetSellerInfoByOrderId(idToKill);
            let sellerId = sellerInfo.sellerId || 'unknown';
            let nickname = sellerInfo.nickname || sellerId;
            if (!perSeller[sellerId]) perSeller[sellerId] = {ids: [], nickname};

            pirateLog(`<b>Штурмую отзыв</b> <span style="color:#ffe39b">${idToKill}</span> у продавца <b>${nickname}</b>...`);

            let ok1 = await bananaMonkeyDeleteOrderReview(idToKill);
            if (!ok1) {
    pirateLog(`<span style="color:#d5545f">❌ Не удалось удалить отзыв ${idToKill}!</span>`);
} else {
    pirateLog(`<span style="color:#b9ff9a">✅ Удалён отзыв ${idToKill}!</span>`);
    // Не стираем ничего из textarea!
}


            await sleep(1100);

            // Здесь теперь всегда пишем лог о поиске сообщения!
            pirateLog(`<span style="color:#e0bc65">Пробую найти и удалить сообщение с отзывом (${idToKill})…</span>`);
            let ok2 = await bananaMonkeyDeleteNegativeMessage(idToKill, sellerId);
            if (ok2) {
                pirateLog(`<span style="color:#f2d264">🦍 Удалено сообщение с отзывом (${idToKill})</span>`);
            } else {
                pirateLog(`<span style="color:#d9aa5f">🦧 Сообщение с отзывом (${idToKill}) не найдено или не удалено</span>`);
            }

            perSeller[sellerId].ids.push(idToKill);
            perSeller[sellerId].nickname = nickname;
            drawAllSellerMsgs(perSeller);

            await sleep(500);
        }
        pirateLog(`<b>🍌 Готово. Удалено отзывов: ${toDelete.length}</b>`);
        isRunning = false;
        killBtn.disabled = false;
        podsnosBtn.disabled = false;
        bananaAlwaysDrawSellerMsgs();
    }

    // --- Хелперы и сетевые функции ---

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async function bananaMonkeyDeleteOrderReview(id) {
        try {
            const url = `/asp/inv_of_buyer.asp?oper=kill&id_i=${encodeURIComponent(id)}`;
            await fetch(url, { credentials: 'same-origin' });
            return true;
        } catch (e) {
            return false;
        }
    }
    async function bananaMonkeyGetSellerInfoByOrderId(orderId) {
        try {
            let html = await fetch(`/asp/inv_of_buyer.asp?id_i=${orderId}`, { credentials: 'same-origin' }).then(r => r.text());
            let sellerId = null;
            let m = html.match(/seller_info\.asp\?ID_S=(\d+)/i);
            if (m) sellerId = m[1];
            let nick = null;
            let dom = document.createElement('div');
            dom.innerHTML = html;
            let tr = Array.from(dom.querySelectorAll('tr')).find(tr => {
                let td = tr.querySelector('td.namerow');
                return td && td.textContent.replace(/\s/g,'').toLowerCase().includes('продавец:');
            });
            if (tr) {
                let td = tr.querySelector('td.inforow');
                if (td) {
                    let text = td.childNodes[0]?.nodeValue || '';
                    nick = text.trim();
                }
            }
            return {sellerId, nickname: nick};
        } catch {
            return {sellerId:null, nickname:null};
        }
    }

    // --- Самый надёжный паттерн удаления сообщений (универсальный)
    async function bananaMonkeyDeleteNegativeMessage(orderId, sellerId) {
        try {
            let url = `/asp/seller_messages.asp?id_s=${sellerId}`;
            let html = await fetch(url, { credentials:'same-origin' }).then(r => r.text());
            let msgBlockReg = new RegExp(
                `<font[^>]*>(?:Отрицательный отзыв по заказу ${orderId} аннулирован согласно решению администрации площадки\\.|Negative feedback on order ${orderId} is canceled by decision of the site administration\\.)<\\/font>[\\s\\S]{0,500}?<a[^>]+href="([^"]*del=\\d+[^"]*)"[^>]*>`,
                'i'
            );
            let found = html.match(msgBlockReg);
            if (found && found[1]) {
                let delUrl = found[1];
                if (delUrl.startsWith("?")) delUrl = "/asp/seller_messages.asp" + delUrl;
                else if (!delUrl.startsWith("http")) delUrl = "/asp/" + delUrl;
                await fetch(delUrl, {credentials:'same-origin'});
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    // --- КНОПКА УДАЛЕНИЯ (один/несколько)
    killBtn.onclick = () => {
        if (isRunning) return;
        let ids = input.value
            .split(/[\r\n]+/)
            .map(x => x.trim())
            .filter(x => x.length > 0 && /^\d+$/.test(x));
        if (ids.length === 0) {
            pirateLog('<span style="color:#d5545f">Нет ID для удаления!</span>');
            return;
        }
        pirateLog(`<b>Капитан отдал приказ стереть ${ids.length > 1 ? 'несколько отзывов' : 'один отзыв'}!</b>`);
        pirateKill(ids);
    };

    // --- КНОПКА "ПОД СНОС"
    podsnosBtn.onclick = () => {
        const match = window.location.href.match(/[?&]id_i=(\d+)/);
        if (match && match[1]) {
            let currentVal = input.value.trim();
            let ids = currentVal ? currentVal.split(/[\r\n]+/) : [];
            if (!ids.includes(match[1])) {
                ids.push(match[1]);
                input.value = ids.join('\n');
                saveIdsToStorage(input.value);
                pirateLog(`<span style="color:gold">ID ${match[1]} добавлен в очередь на казнь!</span>`);
                bananaAlwaysDrawSellerMsgs();
            } else {
                pirateLog(`<span style="color:#e6b800">ID ${match[1]} уже есть в списке!</span>`);
            }
        } else {
            pirateLog('<span style="color:#d5545f">ID не найден в ссылке!</span>');
        }
    };
})();
