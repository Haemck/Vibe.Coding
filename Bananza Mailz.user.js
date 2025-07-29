// ==UserScript==
// @name         Digiseler: Bananza Mailz
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  Bananza Mailz — авторассылка с максимально лояльной проверкой (игнор пустых строк, html-entities и кавычек). Полный лог! 🦍🍌
// @author       vibe.coding
// @match        https://my.digiseller.ru/*
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/Bananza%20Mailz.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/Bananza%20Mailz.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Ультра-лояльная нормализация и сравнение сообщений ---
    function normalizeForCompare(text) {
        text = (text || '').replace(/\r\n|\r/g, '\n');
        text = text.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
        let lines = text.split('\n').map(s => s.trim());
        // Оставляем только непустые строки (полное игнорирование пустых!)
        let norm = lines.filter(line => line !== '');
        // Удаляем кавычки в начале и конце первой/последней строки
        if (norm.length && /^['"]/.test(norm[0])) norm[0] = norm[0].slice(1);
        if (norm.length && /['"]$/.test(norm[norm.length-1])) norm[norm.length-1] = norm[norm.length-1].slice(0,-1);
        return norm.join('\n');
    }
    function superUltraCompare(a, b) {
        return normalizeForCompare(a) === normalizeForCompare(b);
    }

    const APPS_SCRIPT_API_URL = 'https://script.google.com/macros/s/AKfycbzKBKQ7OkXV_nEpdvP4y5QZj6lHFQg2p8oNE_gwCU_B3MPFjyqWDbQPNXq7OeaP74Ya/exec';
    const BANANZA_STATE = 'bananza_mailz_open';
    const BANANZA_STORE = 'bananza_mailz_data';
    const BANANZA_TTL_MS = 1000 * 60 * 30;
    const BANANZA_SEND_DELAY_MS = 200;
    const SHEET_URL = "https://docs.google.com/spreadsheets/d/1mI9IbQ0DMAi6ZIb3B9PrkIL1wrl8AtWe_NhcHvI34rY/edit?usp=sharing";

    let sellers = [], message = '', logs = [], errors = [];
    let isSending = false, monkeProgress = 0, cancel = false, pausedAt = 0;
    let lastUpdate = 0;
    let bananzaPanel = null;
    let monkeBtn = null;

    function bananzaDebugLog(...args) { console.log('[BananzaMailz]', ...args); }
    function saveBananzaStore() {
        const store = { sellers, message, logs, errors, isSending, monkeProgress, cancel, pausedAt, lastUpdate: Date.now() };
        localStorage.setItem(BANANZA_STORE, JSON.stringify(store));
    }
    function loadBananzaStore() {
        let store = null;
        try { store = JSON.parse(localStorage.getItem(BANANZA_STORE) || ''); } catch {}
        if (store && typeof store === 'object' && store.sellers && Array.isArray(store.sellers)) {
            sellers = store.sellers || [];
            message = store.message || '';
            logs = store.logs || [];
            errors = store.errors || [];
            isSending = !!store.isSending;
            monkeProgress = store.monkeProgress || 0;
            cancel = false;
            pausedAt = store.pausedAt || 0;
            lastUpdate = store.lastUpdate || 0;
            if (isSending && pausedAt === 0 && monkeProgress > 0 && monkeProgress < sellers.length) {
                isSending = false;
                pausedAt = monkeProgress;
            }
            if (monkeProgress >= sellers.length) {
                isSending = false;
                pausedAt = 0;
            }
        }
    }
    function stateIsFresh() {
        return !!sellers.length && (Date.now() - lastUpdate < BANANZA_TTL_MS);
    }
    function createMonkeyBtn() {
        if (document.getElementById('bananza-monke-btn')) return;
        monkeBtn = document.createElement('div');
        monkeBtn.id = 'bananza-monke-btn';
        monkeBtn.title = 'Открыть/Скрыть Bananza Mailz';
        monkeBtn.innerHTML = '🐒';
        monkeBtn.className = 'bananza-fab bananza-fab-show';
        monkeBtn.onclick = function() { hideMonkeyBtn(() => showBananzaPanel()); };
        document.body.appendChild(monkeBtn);
    }
    function hideMonkeyBtn(cb) {
        if (!monkeBtn) return;
        monkeBtn.classList.remove('bananza-fab-show');
        monkeBtn.classList.add('bananza-fab-hide');
        setTimeout(() => {
            monkeBtn.style.display = 'none';
            monkeBtn.style.opacity = '0';
            if (cb) cb();
        }, 270);
    }
    function showMonkeyBtn() {
        if (!monkeBtn) createMonkeyBtn();
        monkeBtn.style.display = '';
        monkeBtn.style.opacity = '';
        setTimeout(() => {
            monkeBtn.classList.remove('bananza-fab-hide');
            monkeBtn.classList.add('bananza-fab-show');
        }, 10);
    }
    function showBananzaPanel(forceReload) {
        if (bananzaPanel && document.body.contains(bananzaPanel)) {
            renderBananzaPanel();
            return;
        }
        bananzaPanel = document.createElement('div');
        bananzaPanel.id = 'bananza-mailz-popup';
        bananzaPanel.className = 'bananza-panel bananza-panel-show';
        bananzaPanel.innerHTML = `
            <div class="bananza-head">
                <span style="font-size: 26px; vertical-align: -3px;">🍌</span>
                <span class="bananza-title">Bananza Mailz</span>
                <button id="bananza-mailz-reload" title="Обновить список" class="bananza-action-btn">⟳</button>
                <button id="bananza-mailz-table" title="Открыть Google Таблицу" class="bananza-action-btn">Таблица</button>
                <button id="bananza-mailz-close" title="Свернуть окно" class="bananza-mailz-close" style="margin-left:auto;">✖</button>
            </div>
            <div class="bananza-info">
                <b>Продавцов:</b> <span style="color:#f7c926" id="bananza-count">…</span>
            </div>
            <div id="bananza-go-msg" class="bananza-msg">…</div>
            <div class="bananza-actions">
                <button id="bananza-go-start-btn" class="ds-bananza-glow-btn ds-green">БАНАНЫ ВСЕМ!</button>
                <button id="bananza-go-cancel-btn" style="margin-left:12px;display:none;" class="ds-bananza-glow-btn ds-grey">⏸ Пауза</button>
            </div>
            <div id="bananza-go-progress" class="bananza-progress"></div>
            <div id="bananza-go-log" class="bananza-log"></div>
        `;
        document.body.appendChild(bananzaPanel);

        setTimeout(()=>{ enableVibeScroll('bananza-go-msg'); enableVibeScroll('bananza-go-log'); },80);
        positionBananzaPanel();
        window.addEventListener('resize', positionBananzaPanel);

        document.getElementById('bananza-mailz-close').onclick = function() { hideBananzaPanel(); };
        document.getElementById('bananza-mailz-reload').onclick = function() { loadBananzaData(true); };
        document.getElementById('bananza-mailz-table').onclick = function() { window.open(SHEET_URL, '_blank'); };
        document.getElementById('bananza-go-start-btn').onclick = ()=>{
            if (!isSending) {
                window._bananzaNeedConfirm = true;
                renderBananzaPanel();
            }
        };
        document.getElementById('bananza-go-cancel-btn').onclick = ()=>{ cancel = true; };
        renderBananzaPanel();
        localStorage.setItem(BANANZA_STATE, '1');
        if (forceReload || !stateIsFresh()) loadBananzaData();
    }
    function hideBananzaPanel() {
        if (bananzaPanel && document.body.contains(bananzaPanel)) {
            bananzaPanel.classList.remove('bananza-panel-show');
            bananzaPanel.classList.add('bananza-panel-hide');
            setTimeout(() => {
                if (bananzaPanel.parentNode) bananzaPanel.parentNode.removeChild(bananzaPanel);
                bananzaPanel = null;
                showMonkeyBtn();
            }, 320);
        } else {
            showMonkeyBtn();
        }
        localStorage.setItem(BANANZA_STATE, '0');
        window.removeEventListener('resize', positionBananzaPanel);
    }
    function positionBananzaPanel() {
        if (!bananzaPanel) return;
        bananzaPanel.style.position = 'fixed';
        bananzaPanel.style.right = '134px';
        bananzaPanel.style.bottom = '15px';
        bananzaPanel.style.zIndex = '1000999';
    }
    function renderBananzaPanel() {
        document.getElementById('bananza-count').textContent = sellers.length;
        let msgEl = document.getElementById('bananza-go-msg');
        if (msgEl) msgEl.textContent = message || 'Сообщение не указано!';
        let startBtn = document.getElementById('bananza-go-start-btn');
        let cancelBtn = document.getElementById('bananza-go-cancel-btn');
        let confirmDiv = document.getElementById('bananza-go-confirm-wrap');
        if (confirmDiv) confirmDiv.remove();
        if (window._bananzaNeedConfirm) {
            confirmDiv = document.createElement('div');
            confirmDiv.id = 'bananza-go-confirm-wrap';
            confirmDiv.style.display = 'flex';
            confirmDiv.style.gap = '12px';
            confirmDiv.style.marginBottom = '7px';
            let confirmBtn = document.createElement('button');
            confirmBtn.className = 'ds-bananza-glow-btn ds-yellow';
            confirmBtn.textContent = 'Подтвердить';
            confirmBtn.onclick = function() {
                window._bananzaNeedConfirm = false;
                renderBananzaPanel();
                startBananzaSend(pausedAt > 0 ? pausedAt : 0);
            };
            let reloadBtn = document.createElement('button');
            reloadBtn.className = 'ds-bananza-glow-btn ds-grey';
            reloadBtn.textContent = 'Обновить данные';
            reloadBtn.onclick = function() {
                window._bananzaNeedConfirm = false;
                renderBananzaPanel();
                loadBananzaData(true);
            };
            confirmDiv.appendChild(confirmBtn);
            confirmDiv.appendChild(reloadBtn);
            let actions = document.querySelector('.bananza-actions');
            if (actions) actions.parentNode.insertBefore(confirmDiv, actions.nextSibling);
            startBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        } else {
            startBtn.style.display = '';
            if (pausedAt > 0 && !isSending) {
                startBtn.disabled = false;
                startBtn.textContent = 'Продолжить рассылку';
            } else if (isSending) {
                startBtn.disabled = true;
                startBtn.textContent = 'Продолжить рассылку';
            } else {
                startBtn.disabled = !sellers.length;
                startBtn.textContent = 'БАНАНЫ ВСЕМ!';
            }
            cancelBtn.style.display = isSending ? '' : 'none';
        }
        let prog = '';
        if (isSending || pausedAt > 0) {
            let done = Math.max(pausedAt, monkeProgress, 0);
            prog = `Рассылка: ${done}/${sellers.length}`;
            if (errors.length) prog += ` <span style="color:#ff8585;">Ошибок: ${errors.length}</span>`;
            if (pausedAt > 0 && !isSending) prog += ` <span style="color:#ffe37e;font-size:13px;">[Пауза]</span>`;
        }
        document.getElementById('bananza-go-progress').innerHTML = prog;
        document.getElementById('bananza-go-log').innerHTML = logs.map(e=>e).join('') || `<span style="color:#777">Лог пуст</span>`;
        saveBananzaStore();
    }
    function logBananza(msg, error = false) {
        logs.push(`<div style="color:${error ? '#f98b8b' : '#e1f8a7'};">${msg}</div>`);
        renderBananzaPanel();
        let logDiv = document.getElementById('bananza-go-log');
        if (logDiv) logDiv.scrollTop = logDiv.scrollHeight;
    }
    function loadBananzaData(forceReload) {
        if (!bananzaPanel) return;
        document.getElementById('bananza-count').textContent = '…';
        document.getElementById('bananza-go-msg').textContent = 'Загрузка данных...';
        fetch(APPS_SCRIPT_API_URL + '?action=get_data').then(r=>r.json()).then(data=>{
            sellers = Array.isArray(data.sellers) ? data.sellers : [];
            message = (data.message || '').trim();
            logs = [];
            errors = [];
            monkeProgress = 0;
            cancel = false;
            pausedAt = 0;
            isSending = false;
            lastUpdate = Date.now();
            renderBananzaPanel();
            saveBananzaStore();
        }).catch(e=>{
            document.getElementById('bananza-go-msg').textContent = 'Ошибка загрузки данных!';
            logBananza(String(e), true);
        });
    }
    async function startBananzaSend(startIdx = 0) {
        isSending = true; cancel = false; renderBananzaPanel();
        logBananza(`🍌 Запуск рассылки с позиции ${startIdx+1} из ${sellers.length}...`);
        let checkFrom = Math.max(0, startIdx - 2);
        for (let j = checkFrom; j < startIdx; ++j) {
            const id = String(sellers[j].id || sellers[j]);
            let uniqueMsg = (sellers[j].message || '').trim();
            let globalMsg = (message || '').trim();
            let toSend = uniqueMsg ? uniqueMsg : globalMsg;
            if (!toSend) { logBananza(`[${j+1}] ID ${id}: нет сообщения, пропущено (ревизия)`, true); continue; }
            logBananza(`[${j+1}] ID ${id}: ревизия последнего сообщения...`);
            try {
                let lastMsg = await getLastSellerMsg(id);
                console.log('[BananzaMailz][Отправлено]:', toSend.split('\n'));
                console.log('[BananzaMailz][Получено]:', lastMsg.split('\n'));
                if (superUltraCompare(lastMsg, toSend)) {
                    logBananza(`[${j+1}] ID ${id}: уже отправлено (ревизия)`, false);
                    await sendLogToSheet(id, 'Уже отправлено (ревизия)', `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                } else {
                    logBananza(`[${j+1}] ID ${id}: отправляю повторно (ревизия)...`);
                    await sendMsgToSeller(id, toSend, j+1);
                }
            } catch(e) {
                logBananza(`[${j+1}] ID ${id}: ошибка при ревизии: ${e.message||e}`, true);
                errors.push(id);
                await sendLogToSheet(id, 'Ошибка ревизии: ' + (e.message||e));
            }
            monkeProgress = j+1; pausedAt = 0; renderBananzaPanel(); saveBananzaStore();
            if (j < startIdx-1) await sleep(BANANZA_SEND_DELAY_MS);
        }
        for (let i = startIdx; i < sellers.length; ++i) {
            if (cancel) {
                pausedAt = i; isSending = false;
                logBananza(`<b>Рассылка поставлена на паузу. Можно продолжить в любой момент.</b>`, true);
                renderBananzaPanel(); saveBananzaStore(); return;
            }
            const id = String(sellers[i].id || sellers[i]);
            let uniqueMsg = (sellers[i].message || '').trim();
            let globalMsg = (message || '').trim();
            let toSend = uniqueMsg ? uniqueMsg : globalMsg;
            if (!toSend) { logBananza(`[${i+1}] ID ${id}: нет сообщения, пропущено`, true); continue; }
            logBananza(`[${i+1}] ID ${id}: проверяю последнее сообщение...`);
            try {
                let lastMsg = await getLastSellerMsg(id);
                console.log('[BananzaMailz][Отправлено]:', toSend.split('\n'));
                console.log('[BananzaMailz][Получено]:', lastMsg.split('\n'));
                if (superUltraCompare(lastMsg, toSend)) {
                    logBananza(`[${i+1}] ID ${id}: уже отправлено, пропускаем!`);
                    await sendLogToSheet(id, 'Уже отправлено', `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                } else {
                    logBananza(`[${i+1}] ID ${id}: отправляю...`);
                    await sendMsgToSeller(id, toSend, i+1);
                }
            } catch(e) {
                logBananza(`[${i+1}] ID ${id}: ошибка: ${e.message||e}`, true);
                errors.push(id);
                await sendLogToSheet(id, 'Ошибка: ' + (e.message||e));
            }
            monkeProgress = i+1; pausedAt = 0; renderBananzaPanel(); saveBananzaStore();
            if (i < sellers.length-1) await sleep(BANANZA_SEND_DELAY_MS);
        }
        isSending = false; pausedAt = 0; renderBananzaPanel();
        let finalMsg = (errors.length === 0)
            ? 'Рассылка завершена, все обезьяны получили бананы 🍌🐒'
            : `Рассылка завершена, <b>не все обезьяны получили бананы!</b> (${errors.length} ошибок)`;
        logBananza(`<div style="font-size:16px;color:${errors.length?'#ff8585':'#b6ff79'};margin-top:7px;">${finalMsg}</div>`);
        saveBananzaStore();
    }
    function sendMsgToSeller(id, msg, idx) {
        return new Promise((resolve, reject) => {
            const msgCRLF = msg.replace(/\r?\n/g, '\r\n');
            GM_xmlhttpRequest({
                method: "POST",
                url: `https://my.digiseller.ru/asp/new_message.asp?id_s=${id}`,
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                data: `txt_Message=${encodeURIComponent(msgCRLF)}`,
                onload: function(response) {
                    if (response.status === 200 && !response.finalUrl.includes('login.asp')) {
                        setTimeout(() => {
                            getLastSellerMsg(id).then(lastMsg => {
                                console.log('[BananzaMailz][Отправлено]:', msg.split('\n'));
                                console.log('[BananzaMailz][Получено]:', lastMsg.split('\n'));
                                if (superUltraCompare(lastMsg, msg)) {
                                    logBananza(`[${idx}] ID ${id}: OK, сообщение подтверждено!`);
                                    sendLogToSheet(id, 'OK', `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                                    resolve();
                                } else {
                                    logBananza(`[${idx}] ID ${id}: последнее сообщение НЕ совпало!`, true);
                                    sendLogToSheet(id, 'Ошибка: Последнее сообщение не совпало', `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                                    reject(new Error('Последнее сообщение не совпало'));
                                }
                            }).catch(e=>{
                                logBananza(`[${idx}] ID ${id}: ошибка при получении последнего сообщения: ${e.message||e}`, true);
                                sendLogToSheet(id, 'Ошибка: ' + (e.message||e), `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                                reject(new Error('Ошибка при проверке сообщения'));
                            });
                        }, 800);
                    } else if (response.finalUrl && response.finalUrl.includes('login.asp')) {
                        reject(new Error('Ошибка авторизации! Перезайдите в аккаунт Digiseller!'));
                    } else {
                        reject(new Error('Ошибка отправки. Код: ' + response.status));
                    }
                },
                onerror: function() { reject(new Error('Ошибка сети или CORS')); }
            });
        });
    }
    function getLastSellerMsg(id) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`,
                onload: function(response) {
                    if (response.status === 200) {
                        let temp = document.createElement('div');
                        temp.innerHTML = response.responseText;
                        let trs = temp.querySelectorAll('table[cellpadding="2"] tr');
                        if (trs.length === 0) return reject(new Error("Нет сообщений!"));
                        let firstTr = trs[0];
                        let font = firstTr.querySelector('font[color="b2b2b2"]');
                        if (font) {
                            let msg = font.innerHTML.replace(/<br\s*\/?>/gi, "\n").replace(/<.*?>/g,"").trim();
                            console.log('[BananzaMailz][Получено от Digiseller]:', msg.split('\n'));
                            resolve(msg);
                        } else { reject(new Error("Не удалось извлечь текст сообщения.")); }
                    } else { reject(new Error("Ошибка запроса: " + response.status)); }
                },
                onerror: function() { reject(new Error("Ошибка сети или CORS")); }
            });
        });
    }
    function sendLogToSheet(id, log, url) {
        let logValue = log;
        if (url) {
            let safeLog = String(log).replace(/"/g, '""');
            logValue = `=HYPERLINK("${url}";"${safeLog}")`;
        }
        fetch(APPS_SCRIPT_API_URL + `?action=set_log&id=${encodeURIComponent(id)}&log=${encodeURIComponent(logValue)}`)
        .then(r=>r.json()).catch(()=>{});
    }
    function sleep(ms) { return new Promise(res=>setTimeout(res,ms)); }
    function enableVibeScroll(id) {
        const el = typeof id === "string" ? document.getElementById(id) : id;
        if (!el) return;
        el.addEventListener('wheel', function(e) {
            const scrollTop = el.scrollTop, scrollHeight = el.scrollHeight, clientHeight = el.clientHeight, delta = e.deltaY;
            const atTop = scrollTop === 0 && delta < 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight && delta > 0;
            if ((delta < 0 && !atTop) || (delta > 0 && !atBottom)) {
                el.scrollTop += delta;
                e.stopPropagation();
                e.preventDefault();
            } else if (atTop || atBottom) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, { passive: false });
    }
    // --- Стили ---
    let style = document.createElement('style');
    style.textContent = `
.bananza-fab {
    position: fixed;
    right: 100px;
    bottom: 20px;
    width: 40px; height: 40px;
    background: rgba(32,34,42,0.97);
    color: gold;
    border-radius: 50%;
    border: 2px solid gold;
    box-shadow: 0 6px 26px #0009;
    font-size: 24px;
    display: flex;
    align-items: center; justify-content: center;
    cursor: pointer;
    opacity: 1; transform: scale(1);
    z-index: 1000999;
    transition: opacity 0.25s, transform 0.23s;
}
.bananza-mailz-close{
    position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
    background: rgba(38,38,42,0.87); border-radius: 25%; border: 2px solid gold; color: gold;
    font-size: 22px; font-weight: bold; cursor: pointer; opacity: 0.88; z-index:10; transition: background .15s, opacity .15s, box-shadow .15s;
    box-shadow: 0 3px 14px #0005;
}
#bananza-mailz-close:hover { opacity: 1; background: #2c2f38; box-shadow: 0 6px 26px #0008;}
.bananza-fab-show {
    opacity: 1;
    pointer-events: auto;
    transform: scale(1);
    transition: opacity 0.27s, transform 0.19s;
}
.bananza-fab-hide {
    opacity: 0;
    pointer-events: none;
    transform: scale(0.78) translateY(24px);
    transition: opacity 0.23s, transform 0.18s;
}
.bananza-fab:hover { filter: brightness(1.15);}
.bananza-panel {
    position: fixed;
    right: 34px;
    bottom: 30px;
    z-index: 1000999;
    min-width: 360px;
    max-width: 480px;
    max-height: 640px;
    background: rgba(28,32,44,0.98);
    color: #ffe37e;
    border-radius: 19px;
    font-size: 17px;
    box-shadow: 0 10px 38px #000b,0 1.5px 4px #000a;
    border: 2px solid gold;
    padding: 22px 23px 16px 17px;
    margin-bottom: 18px;
    box-sizing: border-box;
    animation: vibeGrowIn .23s;
    display: flex;
    flex-direction: column;
    min-height: 220px;
    opacity: 1;
    transform: scale(1);
    transition: opacity 0.32s, transform 0.22s;
}
.bananza-panel-show {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
    transition: opacity 0.32s, transform 0.22s;
}
.bananza-panel-hide {
    opacity: 0;
    transform: scale(0.96) translateY(32px);
    pointer-events: none;
    transition: opacity 0.22s, transform 0.16s;
}
.bananza-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 20px;
    font-weight: bold;
    color: gold;
}
.bananza-title { color: gold; font-size: 19px; font-weight: bold; margin-left: 4px;}
.bananza-action-btn {
    background: none;
    border: none;
    color: gold;
    font-size: 17px;
    cursor: pointer;
    border-radius: 8px;
    transition: background .13s;
    padding: 2px 7px;
    margin-left: 2px;
}
.bananza-action-btn:hover { background:#24262d; }
.bananza-info { margin-bottom: 6px; font-size: 16.5px;}
.bananza-msg {
    background: #292e39;
    padding: 10px 12px;
    border-radius: 8px;
    margin: 4px 0 10px 0;
    font-size: 16px;
    color: #ffe37e;
    max-height: 85px;
    overflow: auto;
    width: 100%;
    word-break: break-word;
    overflow-wrap: break-word;
    white-space: pre-line;
    box-sizing: border-box;
    display: block;
    min-width: 0;
    scrollbar-width: thin;
    scrollbar-color: gold #23272b;
}
.bananza-actions { margin-bottom:7px; }
.bananza-progress { font-size:15px; margin-bottom:3px; }
.bananza-log {
    text-align:left;
    font-size:15px;
    max-height:110px;
    overflow:auto;
    border-radius:7px;
    background:#23242c;
    padding:7px 8px 6px 13px;
    color:#e1f8a7;
    min-height:26px;
    scrollbar-width: thin;
    scrollbar-color: gold #23272b;
}
.ds-bananza-glow-btn { transition: box-shadow 0.16s, filter 0.13s; font-size: 16px; padding: 7px 19px 7px 16px; border-radius:8px;min-width:140px;font-weight:600;}
.ds-green { background: #bfff79; color: #212; border: none;}
.ds-green:hover { box-shadow: 0 0 18px 0 #8be881cc, 0 1px 8px #cafcd1b0;}
.ds-yellow { background: #ffe37e; color: #222; border: none; }
.ds-yellow:hover { box-shadow: 0 0 18px 0 #ffe37ecc, 0 1px 8px #fff7c1b0; filter: brightness(1.08); }
.ds-grey { background: #444; color: #ffe37e; border:none; }
.ds-grey:hover { background: #555; color: #fffbe0; box-shadow: 0 0 10px #ffe37e55; }
.ds-bananza-glow-btn:disabled { opacity:.74; filter:grayscale(0.23);}
@keyframes vibeGrowIn { from { opacity:0; transform:scale(0.91) translateY(34px);} to { opacity:1; transform:none; } }
`;
    document.head.appendChild(style);

    loadBananzaStore();
    setTimeout(createMonkeyBtn, 40);
    setTimeout(() => {
        if (pausedAt > 0 && monkeProgress < sellers.length) {
            showBananzaPanel();
        }
    }, 100);

})();
