// ==UserScript==
// @name         DigiSeller: CATologiesAutoComiss
// @namespace    https://my.digiseller.ru/
// @version      1.4
// @description  Массовая смена комиссии: перетаскиваемое окно (ЛКМ по заголовку) с запоминанием позиции и клэмпом в вьюпорте. HTTP 2xx = успех. Отчёт скрыт по умолчанию, открывается кнопкой с SVG-иконкой «отчёта».
// @author       vibe.
// @match        https://my.digiseller.ru/asp/razdels.asp*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @updateURL    https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesAutoComiss.user.js
// @downloadURL  https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesAutoComiss.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ==== Стили ====
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css?family=JetBrains+Mono:400,700&display=swap');
        #vibe-multi-modal { position:fixed;top:38px;left:28px;width:500px;max-width:99vw;
            background:#181920;color:#ffe37a;border:3.5px solid #ffe37a;
            border-radius:15px;box-shadow:0 9px 54px 0 #000d,0 0 0 6px #ffde5c33;
            z-index:999999;padding:34px 36px 20px 36px;
            font-family:'JetBrains Mono',monospace;min-height:100px;overflow:hidden;
            display:flex;flex-direction:column;animation:vibe-pop-in .32s cubic-bezier(.23,1.25,.32,1) both;}
        @keyframes vibe-pop-in {0%{opacity:0;transform:translateY(-24px) scale(0.97);}100%{opacity:1;transform:none;}}
        /* Верхняя панель с заголовком и кнопкой отчёта */
        #vibe-multi-modal .vibe-multi-head{
            display:flex;align-items:center;justify-content:normal;margin-bottom:10px;cursor:move;
        }
        #vibe-multi-modal .vibe-multi-title{
            font-size:23px;font-weight:900;letter-spacing:0.04em;color:#ffe37a;user-select:none;
        }
        #vibe-multi-modal .vibe-report-toggle{
            margin-left:12px;display:inline-flex;align-items:center;justify-content:center;
            width:40px;height:40px;border-radius:10px;border:2px solid #ffe37a66;background:#ffe37a22;
            color:#ffe37a;cursor:pointer;transition:background .15s, box-shadow .18s, transform .12s;
        }
        #vibe-multi-modal .vibe-report-toggle:hover{
            background:#ffe37a33;box-shadow:0 3px 10px #0006;
        }
        #vibe-multi-modal .vibe-report-toggle:active{ transform:scale(0.97); }
        #vibe-multi-modal .vibe-report-toggle svg{ width:22px;height:22px;display:block; }

        #vibe-multi-modal label{font-size:14px;color:#ffe37a;opacity:.9;margin-top:6px;margin-bottom:2px;display:block;}
        #vibe-multi-modal textarea, #vibe-multi-modal input[type="text"]{
            font-family:inherit;font-size:16px;background:#232324;color:#ffe37a;
            border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 10px;margin-bottom:6px;box-shadow:0 2px 0 #ffe37a20;}
        #vibe-multi-modal input[type="text"]{width:120px;}
        #vibe-multi-modal textarea{width:100%;min-height:86px;resize:vertical;}
        #vibe-multi-modal .vibe-multi-btn{font-family:inherit;background:linear-gradient(90deg,#ffe37a,#181920 160%);color:#181920;
            font-weight:900;border:none;border-radius:10px;box-shadow:0 3px 0 #ffe37a36,0 1px 8px #ffe37a17;
            cursor:pointer;transition:background .15s,color .15s,box-shadow .18s;letter-spacing:0.04em;
            padding:14px 0;width:100%;font-size:19px;margin-top:11px;}
        #vibe-multi-modal .vibe-multi-btn:hover{background:linear-gradient(90deg,#fffbe3,#ffe37a 130%);color:#181920;box-shadow:0 7px 28px #ffe37a25;}
        #vibe-multi-modal .vibe-close{position:absolute;top:13px;right:24px;background:transparent;border:none;font-size:30px;
            color:#ffe37a;cursor:pointer;transition:color .19s;font-family:inherit;font-weight:900;}
        #vibe-multi-modal .vibe-close:hover{color:#fffbe3;}
        #vibe-multi-modal .vibe-multi-status{margin-top:13px;font-size:17px;font-weight:600;color:#ffe37a;text-align:left;min-height:26px;}
        /* Контейнер отчёта (по умолчанию скрыт) */
        #vibe-multi-modal .vibe-multi-log-wrap{margin-top:10px;}
        #vibe-multi-modal .vibe-multi-log{font-size:14px;background:#22262d;color:#ffe37a;padding:9px 12px;margin:6px 0 0 0;
            border-radius:9px;max-height:220px;overflow:auto;font-family:'JetBrains Mono',monospace;display:none;}
        #vibe-multi-modal .vibe-multi-prog{margin-top:9px;margin-bottom:8px;}
        #vibe-multi-modal .vibe-multi-copybtn{margin-top:9px;margin-bottom:0;display:none;}
        #vibe-multi-fab{position:fixed;left:332px;bottom:32px;z-index:99999;width:78px;height:78px;border-radius:50%;
            background:linear-gradient(135deg,#ffe37a 70%,#181920 190%);
            box-shadow:0 7px 32px #000c,0 2px 0 #ffe37a66;border:4px solid #ffe37a;font-size:42px;
            font-family:'JetBrains Mono',monospace;color:#181920;font-weight:900;cursor:pointer;outline:none;
            border:none;display:flex;align-items:center;justify-content:center;transition:background .15s,box-shadow .17s;
            animation:vibe-pop-in .28s cubic-bezier(.26,1.2,.23,1) both;user-select:none;}
        #vibe-multi-fab:hover{background:linear-gradient(135deg,#fffbe3 90%,#ffe37a 140%);color:#29291a;box-shadow:0 11px 52px #ffe37a77,0 2px 0 #ffe37a88;}
    `);

    // ==== Логгер (пишет и в консоль, и в окно, если оно есть) ====
    function log(msg, ...rest) {
        console.log('[VibeMulti]', msg, ...rest);
        const l = document.getElementById('vibe-multi-log');
        if (l) {
            const out = typeof msg === 'string' ? msg : JSON.stringify(msg);
            l.innerHTML += out + (rest.length ? ' ' + rest.map(x=>JSON.stringify(x)).join(' ') : '') + '<br>';
            l.scrollTop = l.scrollHeight;
        }
    }

    // ==== FAB ====
    function addFloatingBtn() {
        if (document.getElementById('vibe-multi-fab')) return;
        const btn = document.createElement('button');
        btn.id = 'vibe-multi-fab';
        btn.innerHTML = '<span style="font-size:1.1em;">%</span>';
        btn.title = "Массовая смена комиссии";
        btn.onclick = () => {
            btn.style.display = 'none';
            showModal();
        };
        document.body.appendChild(btn);
    }

    // ==== Модалка ====
    function showModal() {
        if (document.getElementById('vibe-multi-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'vibe-multi-modal';

        // Восстановление позиции
        const savedPos = JSON.parse(localStorage.getItem('vibeMultiPos') || 'null');
        if (savedPos && Number.isFinite(savedPos.top) && Number.isFinite(savedPos.left)) {
            modal.style.top = savedPos.top + 'px';
            modal.style.left = savedPos.left + 'px';
        }

        // Состояние развёрнутости отчёта
        const savedLogOpen = localStorage.getItem('vibeMultiLogOpen') === '1';

        modal.innerHTML = `
            <button class="vibe-close" tabindex="-1" title="Закрыть">✕</button>

            <div class="vibe-multi-head">
                <div class="vibe-multi-title">Массовая смена комиссии</div>
                <button class="vibe-report-toggle" id="vibe-report-toggle" title="${savedLogOpen ? 'Скрыть отчёт' : 'Показать отчёт'}" aria-pressed="${savedLogOpen?'true':'false'}" aria-label="Переключить отчёт">
                    <!-- SVG «отчёт/документ» -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">
                        <path d="M3.5 1.5h6.2l2.8 2.8V14.5H3.5V1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                        <path d="M9.7 1.5V4.3h2.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M5.2 8h5.6M5.2 10h5.6M5.2 12h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>

            <label>Список ID (по одному на строку):</label>
            <textarea id="vibe-multi-ids" placeholder="12345\n67890\n..."></textarea>

            <label>Комиссия (%):</label>
            <input type="text" id="vibe-multi-comiss" autocomplete="off" placeholder="напр. 3.5">

            <button class="vibe-multi-btn" id="vibe-multi-start">Запустить</button>

            <div class="vibe-multi-prog" id="vibe-multi-prog"></div>
            <div id="vibe-multi-status" class="vibe-multi-status"></div>

            <div class="vibe-multi-log-wrap">
                <div class="vibe-multi-log" id="vibe-multi-log"></div>
                <button class="vibe-multi-btn vibe-multi-copybtn" id="vibe-multi-copy">Скопировать отчёт</button>
            </div>
        `;
        document.body.appendChild(modal);

        // Показ/скрытие отчёта согласно сохранённому состоянию
        const logBox   = modal.querySelector('#vibe-multi-log');
        const copyBtn  = modal.querySelector('#vibe-multi-copy');
        const toggleBtn= modal.querySelector('#vibe-report-toggle');

        function applyLogVisibility(open) {
            logBox.style.display = open ? 'block' : 'none';
            // Кнопка копирования появится после выполнения процессов, но тоже скрывать если отчёт скрыт
            if (!open) copyBtn.style.display = 'none';
            toggleBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
            toggleBtn.title = open ? 'Скрыть отчёт' : 'Показать отчёт';
            localStorage.setItem('vibeMultiLogOpen', open ? '1' : '0');
        }
        applyLogVisibility(savedLogOpen);

        // Переключатель отчёта
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // чтобы не тянуть окно при клике
            const open = logBox.style.display !== 'block';
            applyLogVisibility(open);
        });

        // === Клэмп при показе и при ресайзе ===
        clampToViewport(modal);
        window.addEventListener('resize', () => clampToViewport(modal), { passive: true });

        // ==== Перетаскивание по ЛКМ по верхней панели + клэмп ====
        let isDragging = false, offsetX = 0, offsetY = 0;
        const headBar = modal.querySelector('.vibe-multi-head');

        headBar.addEventListener('mousedown', e => {
            // Игнорируем клики по кнопке отчёта и по кресту
            if (e.button !== 0) return;
            if (e.target.closest('#vibe-report-toggle')) return;
            const rect = modal.getBoundingClientRect();
            isDragging = true;
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            modal.style.top = (e.clientY - offsetY) + 'px';
            modal.style.left = (e.clientX - offsetX) + 'px';
            clampToViewport(modal);
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.userSelect = '';
            const top = parseInt(modal.style.top) || modal.getBoundingClientRect().top;
            const left = parseInt(modal.style.left) || modal.getBoundingClientRect().left;
            localStorage.setItem('vibeMultiPos', JSON.stringify({ top, left }));
        });

        // Хелпер: держать окно в пределах вьюпорта
        function clampToViewport(el) {
            const rect = el.getBoundingClientRect();
            let top = parseInt(el.style.top || rect.top);
            let left = parseInt(el.style.left || rect.left);
            const maxTop = Math.max(0, window.innerHeight - rect.height);
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            if (!Number.isFinite(top)) top = 0;
            if (!Number.isFinite(left)) left = 0;
            top = Math.min(Math.max(0, top), maxTop);
            left = Math.min(Math.max(0, left), maxLeft);
            el.style.top = top + 'px';
            el.style.left = left + 'px';
        }

        // ==== Закрытие ====
        modal.querySelector('.vibe-close').onclick = () => {
            modal.remove();
            const fab = document.getElementById('vibe-multi-fab');
            if (fab) fab.style.display = 'flex';
        };

        // ==== Элементы управления ====
        const idsInput    = modal.querySelector('#vibe-multi-ids');
        const comissInput = modal.querySelector('#vibe-multi-comiss');
        const startBtn    = modal.querySelector('#vibe-multi-start');
        const statusBox   = modal.querySelector('#vibe-multi-status');
        const progBox     = modal.querySelector('#vibe-multi-prog');

        const allResults = [];

        function setStatus(msg, color) {
            statusBox.style.color = color || '#ffe37a';
            statusBox.innerHTML = msg;
        }
        function setProg(str) {
            progBox.innerHTML = str;
        }

        // ==== Основной процесс ====
        async function processIDs(ids, comiss) {
            allResults.length = 0;
            const total = ids.length;
            let ok = 0, fail = 0;

            for (let i = 0; i < ids.length; ++i) {
                const id = ids[i];
                setProg(`ID ${i+1} из ${total}: <b>${id}</b>`);
                setStatus("Загрузка данных…", "#ffe37a");
                log('---------------------------');
                log(`[${i+1}/${total}] Работаем с ID: ${id}`);

                // 1) Загружаем форму
                let html, url;
                try {
                    url = `${location.pathname}?idr=${id}&oper=edit&idprview=${id}#${id}`;
                    log('GET HTML:', url);
                    const resp = await fetch(url, { credentials: 'same-origin' });
                    html = await resp.text();
                    log('Длина HTML:', html.length);
                } catch (e) {
                    log('Ошибка загрузки формы:', e);
                    allResults.push({id, status: 'Ошибка загрузки'});
                    fail++;
                    continue;
                }

                // 2) Парсим HTML и собираем данные формы
                const doc = document.implementation.createHTMLDocument('');
                doc.documentElement.innerHTML = html;

                function getVal(name) {
                    const el = doc.querySelector(`[name="${name}"]`);
                    if (!el) return '';
                    if (el.type === 'checkbox') return el.checked ? 'yes' : '';
                    if (el.type === 'text' || el.type === 'number' || el.tagName === 'TEXTAREA') return el.value || '';
                    return el.value || '';
                }
                function getChecked(name) {
                    const el = doc.querySelector(`[name="${name}"]`);
                    return !!(el && el.checked);
                }

                const hiddenFields = {};
                doc.querySelectorAll('input[type="hidden"]').forEach(inp => hiddenFields[inp.name] = inp.value);

                const data = Object.assign({}, hiddenFields);
                ['Razdel','Razdel_eng','Comiss','Day_Lock','infoprice','infopriceeng'].forEach(n => data[n] = getVal(n));
                data.Comiss = comiss; // <-- новая комиссия

                ['SetDef','CheckAtt'].forEach(n => {
                    if (getChecked(n)) data[n] = 'yes';
                    else if (data[n]) delete data[n];
                });

                if (!data.Operation) data.Operation = getVal('Comiss') ? 'изменение раздела' : 'изменение категории';
                if (!data.ID_R && id) data.ID_R = id;
                if (!data.idprview && id) data.idprview = id;

                log('POST data:', data);

                // 3) POST
                setStatus("Сохраняем…", "#ffe37a");
                const params = Object.keys(data).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`).join('&');

                try {
                    const postRes = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: "POST",
                            url: `${location.pathname}?idr=${id}&oper=edit&idprview=${id}`,
                            headers: { "Content-Type": "application/x-www-form-urlencoded" },
                            data: params,
                            onload: resp => resolve(resp),
                            onerror: e => reject(e)
                        });
                    });

                    log('Ответ сервера:', postRes.status, (postRes.responseText || '').slice(0,700));

                    if (postRes.status >= 200 && postRes.status < 300) {
                        setStatus(`✔ ID ${id} — сохранено`, "#b0f99b");
                        log(`[OK] ID ${id} — комиссия изменена`);
                        allResults.push({id, status:'OK'});
                        ok++;
                    } else {
                        setStatus(`Ошибка при сохранении ID ${id} (HTTP ${postRes.status})`, "#ff7575");
                        log(`[ERR] ID ${id} — не удалось`, postRes.status);
                        allResults.push({id, status:'Ошибка сохранения', code: postRes.status});
                        fail++;
                    }
                } catch(e) {
                    setStatus(`Ошибка сети при ID ${id}`, "#ff7575");
                    log(`[ERR] ID ${id} — ошибка сети`, e);
                    allResults.push({id, status:'Ошибка сети'});
                    fail++;
                }

                // Небольшая пауза, чтобы не долбить сервер
                await new Promise(r => setTimeout(r, 700));
            }

            setProg('Готово!');
            setStatus(`Завершено: успешно ${ok}, ошибок ${fail}`, "#ffe37a");
            log('==== ВСЁ ====');

            // Показываем кнопку копирования отчёта и, если отчёт скрыт — предлагаем открыть
            copyBtn.style.display = 'block';
            if (logBox.style.display !== 'block') {
                // Мягкая подсказка: мигнём кнопкой
                toggleBtn.animate([{transform:'scale(1)'},{transform:'scale(1.07)'},{transform:'scale(1)'}], {duration:380, iterations:1, easing:'ease-out'});
            }

            copyBtn.onclick = () => {
                const rep = allResults.map(r => `${r.id}\t${r.status}${r.code?' ('+r.code+')':''}`).join('\n');
                GM_setClipboard(rep);
                copyBtn.innerText = 'Скопировано!';
                setTimeout(() => { copyBtn.innerText = 'Скопировать отчёт'; }, 1600);
            };
        }

        // ==== Запуск обработки ====
        startBtn.onclick = () => {
            let ids = idsInput.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            if (!ids.length) return setStatus("Нет ID!", "#ff7575");

            // Разрешаем любой «мусор» — забираем только числа
            ids = ids.flatMap(s => s.split(/[^\d]+/)).map(x => x.trim()).filter(Boolean);

            const comiss = comissInput.value.trim();
            if (!comiss || isNaN(comiss)) return setStatus("Укажи корректную комиссию!", "#ff7575");

            // Уникализируем
            ids = Array.from(new Set(ids));

            // Сброс интерфейса
            logBox.innerHTML = '';
            setProg('');
            setStatus('Стартуем…', '#ffe37a');
            // Кнопка копирования появится по завершении
            copyBtn.style.display = 'none';

            // По желанию — сразу открыть отчёт при старте
            if (logBox.style.display !== 'block') {
                // оставим скрытым, т.к. по ТЗ отчёт базово скрыт
            }

            processIDs(ids, comiss);
        };
    }

    // ==== Запуск FAB ====
    setTimeout(addFloatingBtn, 700);
})();
