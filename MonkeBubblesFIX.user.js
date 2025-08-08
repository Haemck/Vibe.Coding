// ==UserScript==
// @name         BubblesFix
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Кнопка "удалить", быстрый поиск, копируемая .vibe-date-label, и скрытие даты (оставляем только время) в .vibe-msg-meta. Работает при SPA/ajax переходах.
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/seller_messages.asp*
// @grant        GM_xmlhttpRequest
// @connect      my.digiseller.ru
// @run-at       document-end
// @updateURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeBubblesFIX.user.js
// @downloadURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeBubblesFIX.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ----------------------------------------
    // ГЛОБАЛКА: защита от повторной инициализации между SPA-переходами
    // ----------------------------------------
    let initedOnce = false;
    let lastUrl = location.href;
    let lastMutationRun = 0;

    function mainInit(force) {
        // Запускаем/перезапускаем логику при первом заходе или смене URL/DOM
        if (force || !initedOnce || lastUrl !== location.href) {
            initedOnce = true;
            lastUrl = location.href;

            // Немного отложим на случай отложенного рендера
            setTimeout(() => {
                initRemoveButtonFix();
                insertSearchBoxIntoBtnRow();
                scrollToMessageFromHash();
                enforceTimeInMeta(); // из второго скрипта: дата -> только время
            }, 50);
        }
    }

    // ----------------------------------------
    // 1) КНОПКА "УДАЛИТЬ" (BubblesFix)
    // ----------------------------------------
    function initRemoveButtonFix() {
        const links = document.querySelectorAll('a.target[href*="id_s="][href*="del="]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            const fullUrl = location.origin + location.pathname + href;

            // Ищем подходящую точку вставки
            const bubble = link.closest('.vibe-msg-out') || link.closest('td') || link.parentElement;
            if (!bubble) return;
            let metaBlock = bubble.querySelector('.vibe-msg-meta') || bubble;

            // Не дублируем кнопку в этом же блоке
            if (metaBlock.querySelector('.vibe-remove-btn-soft')) {
                // Но саму старую ссылку удалим, если ещё не
                link.remove();
                return;
            }

            // Создаём кастомную кнопку "удалить"
            const spanBtn = document.createElement('span');
            spanBtn.textContent = 'удалить';
            spanBtn.className = 'vibe-remove-btn-soft';

            spanBtn.addEventListener('click', function (e) {
                e.preventDefault();
                spanBtn.textContent = '...';
                spanBtn.style.opacity = '0.6';

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: fullUrl,
                    onload: function (response) {
                        if (response.status === 200) {
                            location.reload();
                        } else {
                            spanBtn.textContent = 'ошибка';
                            spanBtn.style.backgroundColor = '#ff9900';
                        }
                    },
                    onerror: function () {
                        spanBtn.textContent = 'ошибка сети';
                        spanBtn.style.backgroundColor = '#ff9900';
                    }
                });
            });

            // Заменяем ссылку на нашу кнопку
            link.remove();
            metaBlock.prepend(spanBtn);
        });
    }

    // ----------------------------------------
    // 2) ПОИСК ПО СООБЩЕНИЯМ (MsgFinder)
    // ----------------------------------------
    function insertSearchBoxIntoBtnRow() {
        if (document.getElementById('vibe-searchbox-wrap')) return;

        const btnRow = document.querySelector('.vibe-btn-fake-row');
        if (!btnRow) {
            insertSearchBoxFixed();
            return;
        }

        const box = document.createElement('div');
        box.id = 'vibe-searchbox-wrap';
        box.style.display = 'flex';
        box.style.alignItems = 'center';
        box.style.marginLeft = '16px';
        box.style.position = 'relative';
        box.style.pointerEvents = 'auto';
        box.style.zIndex = '4999';

        box.innerHTML = `
            <input id="vibe-search-input" type="text" tabindex="1" autocomplete="off" placeholder="🔍 Поиск по сообщениям..."
                style="width:200px;max-width:320px;padding:7px 14px;border:1px solid #b4b4b4;border-radius:9px;font-size:14px;background:#f8fafb;outline:none;box-sizing:border-box;flex:0 1 210px;">
            <div id="vibe-search-results"
                style="display:none;position:absolute;top:38px;left:0;width:340px;max-width:96vw;max-height:340px;overflow:auto;background:#fff;border:1px solid #c3c3c3;border-radius:8px;box-shadow:0 2px 12px rgba(80,90,140,.12);z-index:4999;margin-top:0;"></div>
        `;
        btnRow.appendChild(box);

        setupSearchUI();
    }

    function insertSearchBoxFixed() {
        if (document.getElementById('vibe-searchbox-wrap')) return;

        const box = document.createElement('div');
        box.id = 'vibe-searchbox-wrap';
        box.style.position = 'fixed';
        box.style.top = '24px';
        box.style.right = '36px';
        box.style.zIndex = '4444';
        box.style.background = 'none';
        box.style.pointerEvents = 'auto';

        box.innerHTML = `
            <input id="vibe-search-input" type="text" placeholder="🔍 Поиск по сообщениям..."
                style="width:240px;padding:7px 14px;border:1px solid #b4b4b4;border-radius:10px;font-size:15px;background:#f8fafb;outline:none;">
            <div id="vibe-search-results" style="display:none;position:absolute;top:38px;left:0;width:340px;max-width:96vw;max-height:340px;overflow:auto;background:#fff;border:1px solid #c3c3c3;border-radius:8px;box-shadow:0 2px 12px rgba(80,90,140,.12);margin-top:0;"></div>
        `;
        document.body.appendChild(box);

        setupSearchUI();
    }

    function getLastPagesLinks() {
        const pageLinks = Array.from(document.querySelectorAll('a[href*="seller_messages.asp"][class*="target"]'));
        const unique = new Set([window.location.href]);
        pageLinks.forEach(link => unique.add(new URL(link.href, window.location.origin).href));

        return Array.from(unique)
            .map(url => {
                const m = url.match(/id=(\d+)/);
                return { url, id: m ? parseInt(m[1], 10) : 0 };
            })
            .sort((a, b) => a.id - b.id)
            .slice(0, 10)
            .map(o => o.url);
    }

    function parseMessagesFromHTML(html, pageUrl) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rows = doc.querySelectorAll('td.td_title');

        const out = [];
        rows.forEach(td => {
            const tr = td.parentElement;
            const datetime = (td.textContent || '').trim();

            let msgTd = tr.children[2];
            let msg = '';

            if (msgTd) {
                msg = msgTd.innerText.replace(/\s+/g, ' ').trim();
                const onlyLinkOrImg = (
                    msgTd.querySelectorAll('a').length > 0 && msg.replace(/https?:\/\/\S+/g, '').trim().length === 0
                ) || (
                    msgTd.querySelectorAll('img').length > 0 && msg.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().length === 0
                );
                if (onlyLinkOrImg || msg.length < 2) msg = '';
            }
            if (!msg) {
                for (let i = 1; i < tr.children.length; i++) {
                    if (i === 2) continue;
                    const txt = tr.children[i].innerText.replace(/\s+/g, ' ').trim();
                    if (txt.length > msg.length) msg = txt;
                }
            }

            msg = msg
                .replace(/(?:\s*\n)?возможно\s+запрос\s+по\s+заказам[:：]?\s*\[?\d*\]?\s*/gi, '')
                .replace(/^\s*\[\d+\]\s*$/gm, '')
                .replace(/(\n\s*){2,}/g, '\n')
                .trim();

            // Поддерживаем часы 1–2 цифры
            const m = datetime.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/);
            let ts = 0;
            if (m) {
                const pad = s => s.padStart(2, '0');
                const iso = `${m[3]}-${m[2]}-${m[1]}T${pad(m[4])}:${pad(m[5])}:${pad(m[6])}`;
                ts = new Date(iso).getTime() || 0;
            }

            if (msg && !/^Negative feedback on order \d+ is canceled/i.test(msg) && datetime) {
                out.push({ datetime, text: msg, pageUrl, ts });
            }
        });
        return out;
    }

    async function fetchMessagesFromPages(pageUrls) {
        let cache = [];
        await Promise.all(pageUrls.map(url => new Promise(resolve => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload: function (resp) {
                    if (resp.status === 200) {
                        cache = cache.concat(parseMessagesFromHTML(resp.responseText, url));
                    }
                    resolve();
                },
                onerror: resolve
            });
        })));
        return cache;
    }

    function setupSearchUI() {
        if (window.__vibe_search_ui_initialized) return;
        window.__vibe_search_ui_initialized = true;

        const input = document.getElementById('vibe-search-input');
        const results = document.getElementById('vibe-search-results');

        if (!input || !results) return;
// Плавный инерционный скролл колёсиком внутри результатов
let wheelRAF = null;
let wheelVel = 0;
const FRICTION = 0.88;  // 0.8..0.95 — больше = дольше тормозит
const STEP = 0.25;      // 0.2..0.35 — масштаб перемещения
const MIN_STOP = 0.5;   // порог остановки

function wheelStep() {
    const max = results.scrollHeight - results.clientHeight;
    if (max <= 0) { wheelVel = 0; wheelRAF = null; return; }

    results.scrollTop += wheelVel * STEP;

    // Границы контейнера
    if ((results.scrollTop <= 0 && wheelVel < 0) ||
        (results.scrollTop >= max && wheelVel > 0)) {
        wheelVel = 0;
    } else {
        wheelVel *= FRICTION; // затухание
    }

    if (Math.abs(wheelVel) < MIN_STOP) {
        wheelVel = 0;
        wheelRAF = null;
        return;
    }
    wheelRAF = requestAnimationFrame(wheelStep);
}

results.addEventListener('wheel', (e) => {
    // Блокируем скролл страницы и управляем только контейнером
    e.preventDefault();

    // Нормализуем дельту: line(1)->px, page(2)->высота видимой области
    const scale =
        e.deltaMode === 1 ? 16 :
        e.deltaMode === 2 ? results.clientHeight :
        1;

    // Наращиваем "скорость"; 0.6 — сглаживание для тачпадов/резких колёсиков
    wheelVel += e.deltaY * scale * 0.6;

    if (!wheelRAF) {
        wheelRAF = requestAnimationFrame(wheelStep);
    }
}, { passive: false });

        let cache = null;
        let loading = false;
        let lastQuery = '';

        input.addEventListener('input', async function () {
            const query = input.value.trim().toLowerCase();
            lastQuery = query;

            if (!query) {
                results.style.display = 'none';
                results.innerHTML = '';
                return;
            }

            if (!cache && !loading) {
                loading = true;
                input.style.background = '#fff8e5';
                results.style.display = 'block';
                results.innerHTML = '<div style="padding:12px;font-size:14px;color:#999;">Загрузка последних 10 страниц...</div>';

                const pageUrls = getLastPagesLinks();
                cache = await fetchMessagesFromPages(pageUrls);

                loading = false;
                input.style.background = '';
            }

            if (cache) {
                let found = cache.filter(m =>
                    m.text.toLowerCase().includes(query) || m.datetime.toLowerCase().includes(query)
                );
                found = found.sort((a, b) => b.ts - a.ts).slice(0, 30);

                if (lastQuery !== query) return;

                results.innerHTML = (found.length === 0)
                    ? '<div style="padding:12px;font-size:14px;color:#999;">Ничего не найдено</div>'
                    : found.map(m => `
                        <div class="vibe-search-res" style="padding:9px 12px;border-bottom:1px solid #f1f1f1;cursor:pointer;"
                             data-page="${encodeURIComponent(m.pageUrl)}"
                             data-datetime="${encodeURIComponent(m.datetime)}"
                             title="Двойной клик — открыть страницу с этим сообщением и прокрутить">
                            <div style="font-size:13px;color:#6a7a8e;font-weight:600">${m.datetime}</div>
                            <div style="font-size:13px;color:#23273a">${highlight(m.text, query)}</div>
                        </div>
                    `).join('');

                results.style.display = 'block';
            }
        });

        results.addEventListener('dblclick', function (e) {
            const res = e.target.closest('.vibe-search-res');
            if (!res) return;
            const pageUrl = decodeURIComponent(res.getAttribute('data-page'));
            const datetime = encodeURIComponent(res.getAttribute('data-datetime'));
            const finalUrl = pageUrl.split('#')[0] + '#vibe_msg=' + datetime;
            window.location.href = finalUrl;
            results.style.display = 'none';
        });

       document.addEventListener('click', (e) => {
    if (!results.contains(e.target)) {
        results.style.display = 'none';
    }
});


        input.addEventListener('mousedown', () => { input.focus(); });
        input.addEventListener('keydown', e => { e.stopPropagation(); });

        function highlight(text, query) {
            if (!query) return text;
            const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return text.replace(new RegExp(q, 'gi'), m => `<mark style="background:#ffeab5;">${m}</mark>`);
        }
    }

    // ----------------------------------------
    // 3) СКРОЛЛ К СООБЩЕНИЮ ПО ХЭШУ (#vibe_msg=...)
    // ----------------------------------------
    function scrollToMessageFromHash() {
        if (!location.hash.startsWith('#vibe_msg=')) return;

        const datetimeRaw = decodeURIComponent(location.hash.replace(/^#vibe_msg=/, ''));

        function tryScroll(retries) {
            const tds = Array.from(document.querySelectorAll('td.td_title'));
            let found = null;

            for (const td of tds) {
                const tdtext = (td.textContent || '').replace(/\s+/g, ' ').trim();
                const hashtext = datetimeRaw.replace(/\s+/g, ' ').trim();
                if (tdtext === hashtext) { found = td; break; }
            }
            if (!found && datetimeRaw.length > 0) {
                for (const td of tds) {
                    const tdtext = (td.textContent || '').replace(/\s+/g, ' ').trim();
                    if (tdtext && tdtext.startsWith(datetimeRaw.slice(0, -3))) { found = td; break; }
                }
            }

            if (found) {
                found.scrollIntoView({ behavior: 'smooth', block: 'center' });
                found.style.background = '#fffbe1';
                setTimeout(() => found.style.background = '', 2600);
            } else if (retries > 0) {
                setTimeout(() => tryScroll(retries - 1), 300);
            }
        }

        tryScroll(8);
    }

    // ----------------------------------------
    // 4) СКРЫТИЕ ДАТЫ В .vibe-msg-meta (merge второго скрипта)
    //    — жёстко оставляем только время (1–2 цифры часов)
    //    — fallback: CSS-оверлей, если формат неожиданный
    // ----------------------------------------
 function enforceTimeInMeta() {
    const metas = document.querySelectorAll('.vibe-msg-meta');

    metas.forEach(el => {
        const txt = (el.textContent || '').trim();

        // Сохраняем кнопку (если она есть), чтобы не потерялась
        const btn = el.querySelector('.vibe-remove-btn-soft');

        // 1) Формат "DD.MM.YYYY HH:MM:SS"
        let m = txt.match(/\b\d{2}\.\d{2}\.\d{4}\s+(\d{1,2}:\d{2}:\d{2})\b/);
        if (m) {
            el.textContent = m[1]; // только время
        } else if (/^\d{1,2}:\d{2}:\d{2}$/.test(txt)) {
            // Уже только время — не трогаем
        } else {
            // fallback: ищем хотя бы время
            const mTime = txt.match(/\b(\d{1,2}:\d{2}:\d{2})\b/);
            if (mTime) {
                el.textContent = mTime[1];
            } else {
                el.textContent = ''; // ничего не найдено
            }
        }

        // Возвращаем кнопку (если была)
        if (btn) el.prepend(btn);

        el.removeAttribute('data-stripped-date');
    });
}



    // ----------------------------------------
    // СТИЛИ: кнопка, копируемая дата, оверлей времени (fallback)
    // ----------------------------------------
    const style = document.createElement('style');
    style.textContent = `
        /* Кнопка "удалить" */
        .vibe-remove-btn-soft {
            display: inline-block;
            margin-right: 10px;
            padding: 2px 8px;
            background-color: #f6caca;
            color: #993333;
            font-size: 12px;
            font-family: Verdana, Arial, sans-serif;
            border-radius: 8px;
            cursor: pointer;
            user-select: none;
            opacity: 0.85;
            transition: all 0.2s ease-in-out;
            box-shadow: inset 0 0 0 1px #e6b3b3;
        }
        .vibe-remove-btn-soft:hover {
            background-color: #f4baba;
            color: #800000;
            box-shadow: inset 0 0 0 1px #d99999;
        }

        /* .vibe-date-label — можно выделять и копировать */
        .vibe-date-label {
            display: inline-block;
            margin: 4px 0 2px 0;
            padding: 2px 12px;
            background: rgba(100, 110, 140, 0.13);
            color: #404458;
            font-size: 12px;
            font-weight: 600;
            font-family: Verdana, Arial, sans-serif;
            border-radius: 12px;
            letter-spacing: 0.06em;
            box-shadow: 0 1px 5px rgba(80, 90, 140, 0.06);
            border: 1px solid #d3d8ee;
            text-align: center;
            user-select: text !important;
            transition: background 0.2s;
        }

        /* Fallback-оверлей: показываем только время поверх оригинального текста */
        /* контейнер под время-оверлей */


/* чтобы кнопка точно была поверх и имела отступ */
.vibe-remove-btn-soft {
    margin-right: 12px; /* можно оставить 10px, если места хватает */
    position: relative;
    z-index: 3;
}


        /* Поиск */
        #vibe-searchbox-wrap, #vibe-search-input, #vibe-search-results {
            pointer-events: auto !important;
            z-index: 4999 !important;
        }
        #vibe-searchbox-wrap { background: none !important; flex-shrink: 0; }
        #vibe-search-input:focus { border-color:#ffde76; box-shadow:0 0 0 2px #ffde764a; }
        #vibe-search-results {
    min-width: 220px;
    font-size: 13px;              /* <- общий размер текста внутри результатов */
    overscroll-behavior: contain; /* <- не прокидывать скролл наверх (странице) */
}

        .vibe-btn-fake-row { position: relative !important; }
    `;
    document.head.appendChild(style);

    // ----------------------------------------
    // OBSERVERS & EVENTS: поддержка SPA/ajax
    // ----------------------------------------
    const observer = new MutationObserver(() => {
        const now = Date.now();
        if (now - lastMutationRun > 300) {
            lastMutationRun = now;
            mainInit(true);
            // обновляем время в метадате на новых нодах
            enforceTimeInMeta();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('load', () => {
        mainInit(true);
        // На случай отложенной подгрузки — периодически приводим мету к виду "только время"
        setInterval(enforceTimeInMeta, 1500);
    });

    window.addEventListener('popstate', () => mainInit(true));
    window.addEventListener('hashchange', () => mainInit(true));
})();
