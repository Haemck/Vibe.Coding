// ==UserScript==
// @name         Digiseler: Bananza Mailz
// @namespace    http://tampermonkey.net/
// @version      6.2
// @description  Bananza Mailz — авторассылка с максимально лояльной проверкой (игнор пустых строк, html-entities и кавычек). Полный лог! 🦍🍌 + устойчивые парсеры + не блокируемся при отсутствии истории сообщений.
// @author       vibe.coding
// @match        https://my.digiseller.ru/*
// @grant        GM_xmlhttpRequest
// @connect      my.digiseller.ru
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/Bananza%20Mailz.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/Bananza%20Mailz.user.js
// ==/UserScript==

(function() {
    'use strict';

    /** ================= КОНФИГ ================= */
    const APPS_SCRIPT_API_URL   = 'https://script.google.com/macros/s/AKfycbzKBKQ7OkXV_nEpdvP4y5QZj6lHFQg2p8oNE_gwCU_B3MPFjyqWDbQPNXq7OeaP74Ya/exec';
    const BANANZA_STATE         = 'bananza_mailz_open';
    const BANANZA_STORE         = 'bananza_mailz_data';
    const BANANZA_TTL_MS        = 1000 * 60 * 30;
    const BANANZA_SEND_DELAY_MS = 2000;
    const SHEET_URL             = "https://docs.google.com/spreadsheets/d/1mI9IbQ0DMAi6ZIb3B9PrkIL1wrl8AtWe_NhcHvI34rY/edit?usp=sharing";

    const DEBUG_VERBOSE = true;       // подробные логи
    const HTML_SNIPPET_LIMIT = 1200;  // сколько символов HTML ответа показывать в логе
    const VERIFY_RETRY_DELAY = 1500;  // вторая попытка забора сообщения после отправки

    /** =============== СТЕЙТ =============== */
    let sellers = [], message = '', logs = [], errors = [];
    let isSending = false, monkeProgress = 0, cancel = false, pausedAt = 0;
    let lastUpdate = 0;
    let bananzaPanel = null;
    let monkeBtn = null;

    /** =============== УТИЛИТЫ НОРМАЛИЗАЦИИ/СРАВНЕНИЯ =============== */
    function decodeHtmlEntities(str) {
        if (!str) return '';
        const t = document.createElement('textarea');
        t.innerHTML = str;
        return t.value;
    }
    function normalizeForCompare(text) {
        // БАЗОВО: CRLF → LF, декод HTML-сущностей, унификация пробелов/кавычек
        let s = (text || '')
            .replace(/\r\n|\r/g, '\n')
            .replace(/\u00A0/g, ' '); // NBSP → space
        s = decodeHtmlEntities(s)
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");

        // Замены «косметики»
        s = s
            .replace(/[\u200B-\u200D\uFEFF]/g, '')     // zero-width
            .replace(/[“”«»]/g, '"')                   // кавычки в прямые
            .replace(/[‘’]/g, "'")
            .replace(/[ \t]+/g, ' ');                  // множественные пробелы

        let lines = s.split('\n').map(x => x.trim());
        lines = lines.filter(line => line !== '');     // убираем пустые строки
        // если первая/последняя строка в «кавычке» — уберём крайние (мягко)
        if (lines.length && /^['"]/.test(lines[0])) lines[0] = lines[0].slice(1);
        if (lines.length && /['"]$/.test(lines[lines.length-1])) lines[lines.length-1] = lines[lines.length-1].slice(0,-1);
        return lines.join('\n');
    }
    function superUltraCompare(a, b) {
        return normalizeForCompare(a) === normalizeForCompare(b);
    }

    /** =============== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ =============== */
    function bananzaDebugLog(...args) { console.log('[BananzaMailz]', ...args); }
    function saveBananzaStore() {
        const store = { sellers, message, logs, errors, isSending, monkeProgress, cancel, pausedAt, lastUpdate: Date.now() };
        localStorage.setItem(BANANZA_STORE, JSON.stringify(store));
    }
    function loadBananzaStore() {
        let store = null;
        try { store = JSON.parse(localStorage.getItem(BANANZA_STORE) || ''); } catch {}
        if (store && typeof store === 'object' && store.sellers && Array.isArray(store.sellers)) {
            sellers      = store.sellers || [];
            message      = store.message || '';
            logs         = store.logs || [];
            errors       = store.errors || [];
            isSending    = !!store.isSending;
            monkeProgress= store.monkeProgress || 0;
            cancel       = false;
            pausedAt     = store.pausedAt || 0;
            lastUpdate   = store.lastUpdate || 0;
            if (isSending && pausedAt === 0 && monkeProgress > 0 && monkeProgress < sellers.length) {
                isSending = false;
                pausedAt  = monkeProgress;
            }
            if (monkeProgress >= sellers.length) {
                isSending = false;
                pausedAt  = 0;
            }
        }
    }
    function stateIsFresh() {
        return !!sellers.length && (Date.now() - lastUpdate < BANANZA_TTL_MS);
    }

    /** =============== UI =============== */
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
                <button id="bananza-go-export" style="margin-left:auto;" class="ds-bananza-glow-btn ds-grey" title="Экспорт лога в JSON">Экспорт</button>
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
        document.getElementById('bananza-go-export').onclick = exportLog;
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
        const c = document.getElementById('bananza-count');
        if (c) c.textContent = sellers.length;
        const msgEl = document.getElementById('bananza-go-msg');
        if (msgEl) msgEl.textContent = message || 'Сообщение не указано!';

        const startBtn  = document.getElementById('bananza-go-start-btn');
        const cancelBtn = document.getElementById('bananza-go-cancel-btn');
        let confirmDiv  = document.getElementById('bananza-go-confirm-wrap');
        if (confirmDiv) confirmDiv.remove();

        if (window._bananzaNeedConfirm) {
            confirmDiv = document.createElement('div');
            confirmDiv.id = 'bananza-go-confirm-wrap';
            confirmDiv.style.display = 'flex';
            confirmDiv.style.gap = '12px';
            confirmDiv.style.marginBottom = '7px';
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'ds-bananza-glow-btn ds-yellow';
            confirmBtn.textContent = 'Подтвердить';
            confirmBtn.onclick = function() {
                window._bananzaNeedConfirm = false;
                renderBananzaPanel();
                startBananzaSend(pausedAt > 0 ? pausedAt : 0);
            };
            const reloadBtn = document.createElement('button');
            reloadBtn.className = 'ds-bananza-glow-btn ds-grey';
            reloadBtn.textContent = 'Обновить данные';
            reloadBtn.onclick = function() {
                window._bananzaNeedConfirm = false;
                renderBananzaPanel();
                loadBananzaData(true);
            };
            confirmDiv.appendChild(confirmBtn);
            confirmDiv.appendChild(reloadBtn);
            const actions = document.querySelector('.bananza-actions');
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
            const done = Math.max(pausedAt, monkeProgress, 0);
            prog = `Рассылка: ${done}/${sellers.length}`;
            if (errors.length) prog += ` <span style="color:#ff8585;">Ошибок: ${errors.length}</span>`;
            if (pausedAt > 0 && !isSending) prog += ` <span style="color:#ffe37e;font-size:13px;">[Пауза]</span>`;
        }
        const p = document.getElementById('bananza-go-progress');
        if (p) p.innerHTML = prog;
        const l = document.getElementById('bananza-go-log');
        if (l) l.innerHTML = logs.map(e=>e).join('') || `<span style="color:#777">Лог пуст</span>`;

        saveBananzaStore();
    }

    /** =============== ЛОГИ =============== */
    function logBananza(msg, isError = false) {
        logs.push(`<div style="color:${isError ? '#f98b8b' : '#e1f8a7'};">${msg}</div>`);
        renderBananzaPanel();
        const logDiv = document.getElementById('bananza-go-log');
        if (logDiv) logDiv.scrollTop = logDiv.scrollHeight;
    }
    function logDetails(title, pre) {
        const safe = escapeHtml(pre);
        logs.push(
            `<details style="margin:4px 0;"><summary style="cursor:pointer;color:#9fe7ff;">${escapeHtml(title)}</summary><pre style="white-space:pre-wrap;color:#ddd;">${safe}</pre></details>`
        );
        renderBananzaPanel();
        const logDiv = document.getElementById('bananza-go-log');
        if (logDiv) logDiv.scrollTop = logDiv.scrollHeight;
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }
    function exportLog() {
        const data = {
            when: new Date().toISOString(),
            sellersCount: sellers.length,
            progress: monkeProgress,
            pausedAt,
            errors,
            logsRawHtml: logs.join('')
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `bananza-mailz-log-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /** =============== ЗАГРУЗКА ДАННЫХ =============== */
    function loadBananzaData(forceReload) {
        if (!bananzaPanel) return;
        document.getElementById('bananza-count').textContent = '…';
        document.getElementById('bananza-go-msg').textContent = 'Загрузка данных...';
        fetch(APPS_SCRIPT_API_URL + '?action=get_data')
            .then(r=>r.json())
            .then(data=>{
                sellers       = Array.isArray(data.sellers) ? data.sellers : [];
                message       = (data.message || '').trim();
                logs          = [];
                errors        = [];
                monkeProgress = 0;
                cancel        = false;
                pausedAt      = 0;
                isSending     = false;
                lastUpdate    = Date.now();
                renderBananzaPanel();
                saveBananzaStore();
            })
            .catch(e=>{
                document.getElementById('bananza-go-msg').textContent = 'Ошибка загрузки данных!';
                logBananza(String(e), true);
            });
    }

    /** =============== ОСНОВНОЙ ЦИКЛ =============== */
    async function startBananzaSend(startIdx = 0) {
        isSending = true; cancel = false; renderBananzaPanel();
        logBananza(`🍌 Запуск рассылки с позиции ${startIdx+1} из ${sellers.length}...`);

        // Ревизия нескольких предыдущих — чтобы закрыть хвост перед продолжением
        const checkFrom = Math.max(0, startIdx - 2);
        for (let j = checkFrom; j < startIdx; ++j) {
            const id = String(sellers[j]?.id || sellers[j]);
            const uniqueMsg = (sellers[j]?.message || '').trim();
            const globalMsg = (message || '').trim();
            const toSend    = uniqueMsg ? uniqueMsg : globalMsg;

            if (!toSend) { logBananza(`[${j+1}] ID ${id}: нет сообщения, пропущено (ревизия)`, true); continue; }

            logBananza(`[${j+1}] ID ${id}: ревизия последнего сообщения...`);
            try {
                const lastMsg = await getLastSellerMsg(id);
                if (DEBUG_VERBOSE) {
                    logDetails(`Ревизия: исходящее (сырой) для ID ${id}`, toSend);
                    logDetails(`Ревизия: исходящее (norm) для ID ${id}`, normalizeForCompare(toSend));
                    logDetails(`Ревизия: последнее с сайта (сырой) для ID ${id}`, lastMsg);
                    logDetails(`Ревизия: последнее с сайта (norm) для ID ${id}`, normalizeForCompare(lastMsg));
                }
                if (superUltraCompare(lastMsg, toSend)) {
                    logBananza(`[${j+1}] ID ${id}: уже отправлено (ревизия)`, false);
                    await sendLogToSheet(id, 'Уже отправлено (ревизия)', `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                } else {
                    logBananza(`[${j+1}] ID ${id}: отправляю повторно (ревизия)...`);
                    await sendMsgToSeller(id, toSend, j+1);
                }
            } catch(e) {
                if (String(e?.message || e).includes('Авторизац')) {
                    logBananza(`[${j+1}] ID ${id}: ошибка авторизации — остановка. ${e.message||e}`, true);
                    errors.push(id);
                    await sendLogToSheet(id, 'Ошибка авторизации (ревизия): ' + (e.message||e));
                    isSending = false; pausedAt = j; renderBananzaPanel(); saveBananzaStore();
                    return;
                }
                // Теперь: отсутствие сообщений/парс-ошибки — не блокируют, отправляем
                logBananza(`[${j+1}] ID ${id}: ревизию не удалось получить (${e.message||e}). Продолжаю и отправляю...`, true);
                try {
                    await sendMsgToSeller(id, toSend, j+1);
                } catch (e2) {
                    logBananza(`[${j+1}] ID ${id}: ошибка при отправке после неудачной ревизии: ${e2.message||e2}`, true);
                    errors.push(id);
                    await sendLogToSheet(id, 'Ошибка отправки (ревизия fallback): ' + (e2.message||e2));
                }
            }
            monkeProgress = j+1; pausedAt = 0; renderBananzaPanel(); saveBananzaStore();
            if (j < startIdx-1) await sleep(BANANZA_SEND_DELAY_MS);
        }

        // Основная отправка
        for (let i = startIdx; i < sellers.length; ++i) {
            if (cancel) {
                pausedAt = i; isSending = false;
                logBananza(`<b>Рассылка поставлена на паузу. Можно продолжить в любой момент.</b>`, true);
                renderBananzaPanel(); saveBananzaStore(); return;
            }
            const id = String(sellers[i]?.id || sellers[i]);
            const uniqueMsg = (sellers[i]?.message || '').trim();
            const globalMsg = (message || '').trim();
            const toSend    = uniqueMsg ? uniqueMsg : globalMsg;
            if (!toSend) { logBananza(`[${i+1}] ID ${id}: нет сообщения, пропущено`, true); continue; }

            logBananza(`[${i+1}] ID ${id}: проверяю последнее сообщение...`);
            try {
                const lastMsg = await getLastSellerMsg(id);
                if (DEBUG_VERBOSE) {
                    logDetails(`Проверка перед отправкой: исходящее (сырой) для ID ${id}`, toSend);
                    logDetails(`Проверка перед отправкой: исходящее (norm) для ID ${id}`, normalizeForCompare(toSend));
                    logDetails(`Проверка перед отправкой: последнее с сайта (сырой) для ID ${id}`, lastMsg);
                    logDetails(`Проверка перед отправкой: последнее с сайта (norm) для ID ${id}`, normalizeForCompare(lastMsg));
                }
                if (superUltraCompare(lastMsg, toSend)) {
                    logBananza(`[${i+1}] ID ${id}: уже отправлено, пропускаем!`);
                    await sendLogToSheet(id, 'Уже отправлено', `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                } else {
                    logBananza(`[${i+1}] ID ${id}: отправляю...`);
                    await sendMsgToSeller(id, toSend, i+1);
                }
            } catch(e) {
                if (String(e?.message || e).includes('Авторизац')) {
                    logBananza(`[${i+1}] ID ${id}: ошибка авторизации — остановка. ${e.message||e}`, true);
                    errors.push(id);
                    await sendLogToSheet(id, 'Ошибка авторизации: ' + (e.message||e));
                    isSending = false; pausedAt = i; renderBananzaPanel(); saveBananzaStore();
                    return;
                }
                // Теперь это не блокирует: шлём даже если не смогли получить историю
                logBananza(`[${i+1}] ID ${id}: не удалось получить последнее сообщение (${e.message||e}). Продолжаю и отправляю...`, true);
                try {
                    await sendMsgToSeller(id, toSend, i+1);
                } catch (e2) {
                    logBananza(`[${i+1}] ID ${id}: ошибка при отправке (fallback после неудачной проверки): ${e2.message||e2}`, true);
                    errors.push(id);
                    await sendLogToSheet(id, 'Ошибка отправки (fallback): ' + (e2.message||e2));
                }
            }
            monkeProgress = i+1; pausedAt = 0; renderBananzaPanel(); saveBananzaStore();
            if (i < sellers.length-1) await sleep(BANANZA_SEND_DELAY_MS);
        }

        isSending = false; pausedAt = 0; renderBananzaPanel();
        const finalMsg = (errors.length === 0)
            ? 'Рассылка завершена, все обезьяны получили бананы 🍌🐒'
            : `Рассылка завершена, <b>не все обезьяны получили бананы!</b> (${errors.length} ошибок)`;
        logBananza(`<div style="font-size:16px;color:${errors.length?'#ff8585':'#b6ff79'};margin-top:7px;">${finalMsg}</div>`);
        saveBananzaStore();
    }

    /** =============== ОТПРАВКА И ПРОВЕРКА =============== */
    function sendMsgToSeller(id, msg, idx) {
        return new Promise((resolve, reject) => {
            const msgCRLF = msg.replace(/\r?\n/g, '\r\n');
            if (DEBUG_VERBOSE) {
                logDetails(`POST → new_message.asp (ID ${id}) — исходящее (сырой)`, msg);
                logDetails(`POST → new_message.asp (ID ${id}) — исходящее (norm)`, normalizeForCompare(msg));
            }
            GM_xmlhttpRequest({
                method: "POST",
                url: `https://my.digiseller.ru/asp/new_message.asp?id_s=${encodeURIComponent(id)}`,
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                data: `txt_Message=${encodeURIComponent(msgCRLF)}`,
                onload: function(response) {
                    const finalUrl = response.finalUrl || 'нет';
                    const status   = response.status;
                    const headers  = response.responseHeaders || '';
                    const htmlPart = (response.responseText || '').slice(0, HTML_SNIPPET_LIMIT);

                    logBananza(`[${idx}] Ответ сервера: статус=${status}, URL=${finalUrl}`);
                    if (DEBUG_VERBOSE) {
                        logDetails(`HTTP headers (ID ${id})`, headers);
                        logDetails(`HTML snippet (ID ${id})`, htmlPart);
                    }

                    if (status === 200 && !(finalUrl && finalUrl.includes('login.asp'))) {
                        // Подтверждение: забираем последнее сообщение и сравниваем (с повторной попыткой)
                        const verify = () => getLastSellerMsg(id).then(lastMsg => {
                            if (DEBUG_VERBOSE) {
                                logDetails(`Проверка после отправки: последнее с сайта (сырой) для ID ${id}`, lastMsg);
                                logDetails(`Проверка после отправки: последнее с сайта (norm) для ID ${id}`, normalizeForCompare(lastMsg));
                                logDetails(`DIFF (ID ${id})`, prettyDiff(msg, lastMsg));
                            }
                            if (superUltraCompare(lastMsg, msg)) {
                                logBananza(`[${idx}] ID ${id}: OK, сообщение подтверждено!`);
                                sendLogToSheet(id, 'OK', `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                                resolve();
                            } else {
                                logBananza(`[${idx}] ID ${id}: последнее сообщение НЕ совпало! (повторная проверка через ${VERIFY_RETRY_DELAY}мс)`, true);
                                setTimeout(() => {
                                    getLastSellerMsg(id).then(lastMsg2 => {
                                        if (DEBUG_VERBOSE) {
                                            logDetails(`Повторная проверка: последнее (сырой) ID ${id}`, lastMsg2);
                                            logDetails(`Повторная проверка: последнее (norm) ID ${id}`, normalizeForCompare(lastMsg2));
                                            logDetails(`Повторный DIFF (ID ${id})`, prettyDiff(msg, lastMsg2));
                                        }
                                        if (superUltraCompare(lastMsg2, msg)) {
                                            logBananza(`[${idx}] ID ${id}: OK после повторной проверки!`);
                                            sendLogToSheet(id, 'OK (2nd check)', `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                                            resolve();
                                        } else {
                                            logBananza(`[${idx}] ID ${id}: НЕ совпало даже повторно`, true);
                                            sendLogToSheet(id, 'Ошибка: Последнее сообщение не совпало', `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                                            reject(new Error('Последнее сообщение не совпало'));
                                        }
                                    }).catch(e2=>{
                                        logBananza(`[${idx}] ID ${id}: ошибка повторной проверки: ${e2.message||e2}`, true);
                                        sendLogToSheet(id, 'Ошибка повторной проверки: ' + (e2.message||e2), `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${id}`);
                                        reject(new Error('Ошибка при повторной проверке'));
                                    });
                                }, VERIFY_RETRY_DELAY);
                            }
                        });

                        verify().catch(reject);
                    } else if (finalUrl && finalUrl.includes('login.asp')) {
                        reject(new Error('Ошибка авторизации! Перезайдите в аккаунт Digiseller!'));
                    } else {
                        reject(new Error('Ошибка отправки. Код: ' + status));
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
                url: `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${encodeURIComponent(id)}`,
                onload: function(response) {
                    const finalUrl = response.finalUrl || '';
                    const status   = response.status;

                    if (DEBUG_VERBOSE) {
                        logBananza(`[GET lastMsg] ID ${id}: статус=${status}, URL=${finalUrl || 'нет'}`);
                        if (response.responseHeaders) logDetails(`GET headers (ID ${id})`, response.responseHeaders);
                    }

                    if (status === 200) {
                        if (finalUrl.includes('login.asp')) {
                            return reject(new Error('Ошибка авторизации при получении последнего сообщения'));
                        }
                        const html = response.responseText || '';
                        const msg  = extractLastMessageFromHtml(html);
                        if (msg != null && String(msg).trim() !== '') {
                            bananzaDebugLog('[BananzaMailz][Получено от Digiseller]:', msg.split('\n'));
                            resolve(msg);
                        } else {
                            reject(new Error("Нет сообщений!"));
                        }
                    } else {
                        reject(new Error("Ошибка запроса: " + status));
                    }
                },
                onerror: function() { reject(new Error("Ошибка сети или CORS")); }
            });
        });
    }

    // Более устойчивый извлекатель последнего сообщения
    function extractLastMessageFromHtml(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Вариант 1: как раньше — первая строка в таблице
        let fonts = temp.querySelectorAll('table[cellpadding="2"] tr font[color="b2b2b2"]');
        let text = pickFirstNonEmptyFont(fonts);
        if (text) return text;

        // Вариант 2: любой font[color="b2b2b2"]
        fonts = temp.querySelectorAll('font[color="b2b2b2"]');
        text = pickFirstNonEmptyFont(fonts);
        if (text) return text;

        // Вариант 3: содержимое крупных ячеек слева (часто сообщение)
        const bigTds = temp.querySelectorAll('table[cellpadding="2"] tr td[width="100%"], table[cellpadding="2"] tr td[colspan]');
        for (const td of bigTds) {
            const txt = cleanupTd(td);
            if (txt) return txt;
        }

        // Если ни один вариант не дал текст — считаем, что сообщений нет
        return null;

        function pickFirstNonEmptyFont(list) {
            for (const f of list) {
                // Сохраняем переносы
                const copy = f.cloneNode(true);
                // заменим <br> на \n, затем снимем текст
                copy.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                const t = copy.textContent.trim();
                if (t) return t;
            }
            return null;
        }
        function cleanupTd(td) {
            const copy = td.cloneNode(true);
            copy.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
            const txt = copy.textContent.trim();
            return txt || '';
        }
    }

    /** =============== ПОЛЕЗНЫЕ МЕЛОЧИ =============== */
    function prettyDiff(a, b) {
        const A = normalizeForCompare(a).split('\n');
        const B = normalizeForCompare(b).split('\n');
        const max = Math.max(A.length, B.length);
        const lines = [];
        for (let i=0;i<max;i++){
            const la = A[i] ?? '';
            const lb = B[i] ?? '';
            const same = (la === lb);
            lines.push(`${same ? '   =' : '  ≠'} [${i+1}] ${same ? la : (la + '  ⇄  ' + lb)}`);
        }
        return lines.join('\n');
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

    /** =============== СТИЛИ =============== */
    const style = document.createElement('style');
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
.bananza-fab-show { opacity: 1; pointer-events: auto; transform: scale(1); transition: opacity 0.27s, transform 0.19s; }
.bananza-fab-hide { opacity: 0; pointer-events: none; transform: scale(0.78) translateY(24px); transition: opacity 0.23s, transform 0.18s; }
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
.bananza-panel-show { opacity: 1; transform: scale(1); pointer-events: auto; transition: opacity 0.32s, transform 0.22s; }
.bananza-panel-hide { opacity: 0; transform: scale(0.96) translateY(32px); pointer-events: none; transition: opacity 0.22s, transform 0.16s; }
.bananza-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 20px; font-weight: bold; color: gold; }
.bananza-title { color: gold; font-size: 19px; font-weight: bold; margin-left: 4px;}
.bananza-action-btn { background: none; border: none; color: gold; font-size: 17px; cursor: pointer; border-radius: 8px; transition: background .13s; padding: 2px 7px; margin-left: 2px;}
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
    max-height:160px;
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
details > summary { list-style: none; }
details > summary::-webkit-details-marker { display: none; }
@keyframes vibeGrowIn { from { opacity:0; transform:scale(0.91) translateY(34px);} to { opacity:1; transform:none; } }
`;
    document.head.appendChild(style);

    /** =============== ИНИЦИАЛИЗАЦИЯ =============== */
    loadBananzaStore();
    setTimeout(createMonkeyBtn, 40);
    setTimeout(() => {
        if (pausedAt > 0 && monkeProgress < sellers.length) {
            showBananzaPanel();
        }
    }, 100);

    /** =============== ИНТЕГРАЦИЯ С ТАБЛИЦЕЙ =============== */
    function sendLogToSheet(id, log, url) {
        let logValue = log;
        if (url) {
            const safeLog = String(log).replace(/"/g, '""');
            logValue = `=HYPERLINK("${url}";"${safeLog}")`;
        }
        fetch(APPS_SCRIPT_API_URL + `?action=set_log&id=${encodeURIComponent(id)}&log=${encodeURIComponent(logValue)}`)
            .then(r=>r.json()).catch(()=>{});
    }

})();
