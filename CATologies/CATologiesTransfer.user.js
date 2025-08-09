// ==UserScript==
// @name         DigiSeller: CATologiesTransfer
// @namespace    https://my.digiseller.ru/
// @version      1.8
// @description  Перемещение категории/раздела: асинхронный поиск (без лишних запросов), вывод типа, vibe blackgold UI, FAB с иконкой ⇄, успех по коду ответа (200–299), перетаскивание окна (Alt+ЛКМ) и запоминание позиции окна в localStorage.
// @author       vibe.
// @match        https://my.digiseller.ru/asp/razdels.asp*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @updateURL    https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesTransfer.user.js
// @downloadURL  https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesTransfer.user.js
// ==/UserScript==

(function () {
    'use strict';

    // =========== СТИЛИ ===========
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css?family=JetBrains+Mono:400,700&display=swap');
        #vibe-move-modal {
            position:fixed;top:38px;left:28px;width:430px;max-width:98vw;
            background:#181920;color:#ffe37a;border:3.5px solid #ffe37a;
            border-radius:15px;box-shadow:0 9px 54px 0 #000d,0 0 0 6px #ffde5c33;
            z-index:999999;padding:30px 34px 22px 34px;
            font-family:'JetBrains Mono',monospace;min-height:100px;overflow:hidden;
            display:flex;flex-direction:column;animation:vibe-pop-in .30s cubic-bezier(.23,1.25,.32,1) both;
        }
        @keyframes vibe-pop-in {0%{opacity:0;transform:translateY(-22px) scale(0.98);}100%{opacity:1;transform:none;}}
        #vibe-move-modal .vibe-move-title{
            font-size:23px;font-weight:900;letter-spacing:0.04em;text-align:left;margin-bottom:18px;color:#ffe37a;
            cursor:move; /* Подсказка, что заголовок можно таскать (Alt+ЛКМ) */
        }
        #vibe-move-modal .vibe-fields-row{
            margin-bottom:2px;display:flex;align-items:center;gap:11px;justify-content:center;
        }
        #vibe-move-modal .vibe-arrow{
            font-size:23px;font-weight:900;color:#ffe37a;margin:0 5px 45px 5px;user-select:none;pointer-events:none;
            text-shadow:0 2px 10px #0007;
        }
        #vibe-move-modal .vibe-field-col{
            display:flex;flex-direction:column;align-items:center;min-width:0;
        }
        #vibe-move-modal input[type="text"]{
            font-family:inherit;font-size:17px;background:#232324;color:#ffe37a;
            border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 12px;margin-right:0;transition:border-color .18s;
            box-shadow:0 2px 0 #ffe37a20;width:150px;max-width:150px;text-align:center;
        }
        #vibe-move-modal input[type="text"]:focus{
            border-color:#ffe37a;background:#181920;outline:none;
        }
        #vibe-move-modal .vibe-id-title, #vibe-move-modal .vibe-id-type{
            display:block;text-align:center;
            font-size:17px;min-height:22px;height:22px;margin:6px 0 0 0;transition:opacity .15s;
            max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
            padding:0 4px;
        }
        #vibe-move-modal .vibe-id-title{ color:#b7ffe7;font-weight:700; }
        #vibe-move-modal .vibe-id-title.vibe-notfound{ color:#e45c6d;font-weight:700; }
        #vibe-move-modal .vibe-id-type{ color:#ffe37a;font-size:15px;min-height:19px;height:19px;margin:1px 0 0 0;font-weight:400;letter-spacing:0.02em; }
        #vibe-move-modal .vibe-id-type.vibe-notfound{ color:#e45c6d; }

        #vibe-move-modal .vibe-btn{
            font-family:inherit;background:linear-gradient(90deg,#ffe37a,#181920 160%);color:#181920;
            font-weight:900;border:none;border-radius:10px;box-shadow:0 3px 0 #ffe37a36,0 1px 8px #ffe37a17;
            cursor:pointer;transition:background .15s,color .15s,box-shadow .18s;letter-spacing:0.04em;
            padding:15px 0;width:100%;font-size:20px;margin-top:18px;
        }
        #vibe-move-modal .vibe-btn:hover{
            background:linear-gradient(90deg,#fffbe3,#ffe37a 130%);color:#181920;box-shadow:0 7px 28px #ffe37a25;
        }
        #vibe-move-modal .vibe-close{
            position:absolute;top:13px;right:24px;background:transparent;border:none;font-size:30px;
            color:#ffe37a;cursor:pointer;transition:color .19s;font-family:inherit;font-weight:900;
        }
        #vibe-move-modal .vibe-close:hover{color:#fffbe3;}
        #vibe-move-modal .vibe-status{
            margin-top:13px;font-size:17px;font-weight:600;color:#ffe37a;text-align:left;min-height:28px;
        }
        #vibe-move-modal .vibe-result-id{
            color:#ffde5c;font-weight:700;cursor:pointer;padding:1px 8px 1px 3px;font-size:16px;background:none;
            border-radius:6px;transition:background .15s;
        }
        #vibe-move-modal .vibe-result-id.vibe-copied{background:#ffe37a;color:#181920;}

        #vibe-move-fab{
            position:fixed;left:132px;bottom:32px;z-index:99999;width:78px;height:78px;border-radius:50%;
            background:linear-gradient(135deg,#ffe37a 70%,#181920 190%);
            box-shadow:0 7px 32px #000c,0 2px 0 #ffe37a66;border:4px solid #ffe37a;font-size:42px;
            font-family:'JetBrains Mono',monospace;color:#181920;font-weight:900;cursor:pointer;outline:none;
            border:none;display:flex;align-items:center;justify-content:center;transition:background .15s,box-shadow .17s;
            animation:vibe-pop-in .28s cubic-bezier(.26,1.2,.23,1) both;user-select:none; padding-bottom: 6px;
        }
        #vibe-move-fab:hover{background:linear-gradient(135deg,#fffbe3 90%,#ffe37a 140%);color:#29291a;box-shadow:0 11px 52px #ffe37a77,0 2px 0 #ffe37a88;}
    `);

    // =========== FAB КНОПКА ===========
    function addFloatingBtn() {
        if (document.getElementById('vibe-move-fab')) return;
        const btn = document.createElement('button');
        btn.id = 'vibe-move-fab';
        btn.innerHTML = '⇄';
        btn.title = "Открыть окно переноса категории";
        btn.onclick = () => {
            btn.style.display = 'none';
            showModal();
        };
        document.body.appendChild(btn);
    }

    // =========== Асинхронный поиск названия и типа ===========
    /**
     * Асинхронно получает название и тип элемента по ID (категория/раздел)
     * @param {string|number} id
     * @returns {Promise<{id:string,title:string,type:'Категория'|'Раздел'}|null>}
     */
    async function findDigisellerCategoryOrSectionById(id) {
        if (!id || !/^\d+$/.test(String(id))) return null;
        try {
            const url = location.pathname + '?idprview=' + id + '#r' + id;
            const resp = await fetch(url, { credentials: 'same-origin' });
            const html = await resp.text();
            const doc = document.implementation.createHTMLDocument('');
            doc.documentElement.innerHTML = html;

            // Категория — якорь <a id="r<ID>">
            const anchor = doc.querySelector('a[id="r' + id + '"]');
            if (anchor) {
                return { id: String(id), title: anchor.textContent.trim(), type: 'Категория' };
            }
            // Раздел — ищем <small> с самим ID и парсим текст
            const small = Array.from(doc.querySelectorAll('small')).find(s => s.textContent.trim() === String(id));
            if (small) {
                const td = small.parentElement;
                let allText = td.textContent.replace(/\s+/g, ' ').trim();
                allText = allText.replace(String(id), '').replace(/^\s+|\s+$/g, '');
                allText = allText.replace(/(изменить|переместить|удалить)[^%]*$/i, '');
                const match = allText.match(/(.+?)\s*([0-9]+[.,]?\d*)\s*%/);
                let title = '';
                if (match) title = match[1].trim();
                else {
                    const noBtns = allText.replace(/(изменить|переместить|удалить)/gi, '').trim();
                    title = noBtns || allText;
                }
                return { id: String(id), title, type: 'Раздел' };
            }
        } catch (e) {}
        return null;
    }

    // =========== МОДАЛКА ===========
    function showModal() {
        if (document.getElementById('vibe-move-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'vibe-move-modal';
        modal.innerHTML = `
            <button class="vibe-close" tabindex="-1" title="Закрыть">✕</button>
            <div class="vibe-move-title">Перемещение</div>
            <div class="vibe-fields-row">
                <div class="vibe-field-col">
                    <input type="text" id="vibe-move-from" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="Кого" />
                    <div id="vibe-move-from-title" class="vibe-id-title"></div>
                    <div id="vibe-move-from-type" class="vibe-id-type"></div>
                </div>
                <span class="vibe-arrow">&gt;</span>
                <div class="vibe-field-col">
                    <input type="text" id="vibe-move-to" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="Куда" />
                    <div id="vibe-move-to-title" class="vibe-id-title"></div>
                    <div id="vibe-move-to-type" class="vibe-id-type"></div>
                </div>
            </div>
            <button class="vibe-btn" id="vibe-move-btn">Переместить</button>
            <div id="vibe-move-status" class="vibe-status"></div>
            <div id="vibe-move-result"></div>
        `;
        document.body.appendChild(modal);

        // ===== Восстановление сохранённой позиции и клэмп в вьюпорт =====
        const savedPos = JSON.parse(localStorage.getItem('vibeMovePos') || 'null');
        if (savedPos && Number.isFinite(savedPos.top) && Number.isFinite(savedPos.left)) {
            modal.style.top = savedPos.top + 'px';
            modal.style.left = savedPos.left + 'px';
            clampToViewport(modal);
        }
        window.addEventListener('resize', () => clampToViewport(modal), { passive: true });

        // ===== Перетаскивание: Alt + ЛКМ по заголовку =====
        let isDragging = false, offsetX = 0, offsetY = 0;
        const titleBar = modal.querySelector('.vibe-move-title');

        titleBar.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // только ЛКМ
            const rect = modal.getBoundingClientRect();
            isDragging = true;
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            modal.style.top = (e.clientY - offsetY) + 'px';
            modal.style.left = (e.clientX - offsetX) + 'px';
            clampToViewport(modal); // держим окно в пределах экрана при перетаскивании
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.userSelect = '';
            // сохраняем позицию
            const top = parseInt(modal.style.top) || modal.getBoundingClientRect().top;
            const left = parseInt(modal.style.left) || modal.getBoundingClientRect().left;
            localStorage.setItem('vibeMovePos', JSON.stringify({ top, left }));
        });

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

        // ===== Закрытие =====
        modal.querySelector('.vibe-close').onclick = () => {
            modal.remove();
            const fab = document.getElementById('vibe-move-fab');
            if (fab) fab.style.display = 'flex';
        };

        // ===== Названия и типы под полями (и предотвращение лишних запросов) =====
        const fromInput = modal.querySelector('#vibe-move-from');
        const toInput   = modal.querySelector('#vibe-move-to');
        const fromTitle = modal.querySelector('#vibe-move-from-title');
        const fromType  = modal.querySelector('#vibe-move-from-type');
        const toTitle   = modal.querySelector('#vibe-move-to-title');
        const toType    = modal.querySelector('#vibe-move-to-type');

        let lastFromId = '';
        let lastToId   = '';

        async function updateFrom(force) {
            const id = fromInput.value.replace(/\D/g,'');
            fromInput.value = id;
            if (!force && id === lastFromId) return; // не делать повторный поиск, если ID не менялся
            lastFromId = id;
            fromTitle.textContent = id ? '…' : '';
            fromTitle.className = "vibe-id-title";
            fromType.textContent = '';
            fromType.className = "vibe-id-type";
            if (id) {
                const cat = await findDigisellerCategoryOrSectionById(id);
                if (cat) {
                    fromTitle.textContent = cat.title;
                    fromType.textContent  = cat.type;
                } else {
                    fromTitle.textContent = 'Не найдено';
                    fromTitle.classList.add('vibe-notfound');
                    fromType.textContent = '';
                    fromType.classList.add('vibe-notfound');
                }
            } else {
                fromTitle.textContent = '';
                fromType.textContent  = '';
            }
        }
        async function updateTo(force) {
            const id = toInput.value.replace(/\D/g,'');
            toInput.value = id;
            if (!force && id === lastToId) return;
            lastToId = id;
            toTitle.textContent = id ? '…' : '';
            toTitle.className = "vibe-id-title";
            toType.textContent = '';
            toType.className = "vibe-id-type";
            if (id) {
                const cat = await findDigisellerCategoryOrSectionById(id);
                if (cat) {
                    toTitle.textContent = cat.title;
                    toType.textContent  = cat.type;
                } else {
                    toTitle.textContent = 'Не найдено';
                    toTitle.classList.add('vibe-notfound');
                    toType.textContent = '';
                    toType.classList.add('vibe-notfound');
                }
            } else {
                toTitle.textContent = '';
                toType.textContent  = '';
            }
        }
        fromInput.oninput = () => updateFrom(false);
        fromInput.onblur  = () => updateFrom(false);
        toInput.oninput   = () => updateTo(false);
        toInput.onblur    = () => updateTo(false);

        // ===== Кнопка "Переместить" =====
        modal.querySelector('#vibe-move-btn').onclick = function () {
            const fromId = fromInput.value.trim();
            const toId   = toInput.value.trim();
            if (!fromId || isNaN(+fromId)) return setStatus("Укажите корректный ID!", "#ff7575");
            if (!toId   || isNaN(+toId))   return setStatus("Укажите корректный ID!", "#ff7575");
            setStatus("Перемещаем...", "#ffe37a");
            doMove(fromId, toId);
        };

        function setStatus(text, color) {
            const el = modal.querySelector('#vibe-move-status');
            el.style.color = color || '#ffe37a';
            el.innerHTML = text;
        }

        // ===== Перенос (HTTP 2xx = успех) =====
        function doMove(fromId, toId) {
            const params = [
                `Operation=${encodeURIComponent('перемещение раздела')}`,
                `ID_PR=${toId}`,
                `ID_R=${fromId}`,
                `idprview=${fromId}`
            ].join('&');

            GM_xmlhttpRequest({
                method: "POST",
                url: `https://my.digiseller.ru/asp/razdels.asp?idr=${fromId}&oper=move&idprview=${fromId}`,
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                data: params,
                onload: function (resp) {
                    // Важно: считаем успехом любой код 2xx, не анализируем текст ответа
                    if (resp.status >= 200 && resp.status < 300) {
                        const msg = `✔ <span class="vibe-result-id" data-id="${fromId}" title="Клик — скопировать ID">${fromId}</span> → <span class="vibe-result-id" data-id="${toId}" title="Клик — скопировать ID">${toId}</span>`;
                        setStatus(msg, "#b0f99b");
                        attachCopyHandlers();
                    } else {
                        setStatus("Ошибка HTTP " + resp.status, "#ff7575");
                    }
                },
                onerror: function () { setStatus("Ошибка сети/запроса", "#ff7575"); }
            });
        }

        // ===== Копирование ID по клику =====
        function attachCopyHandlers() {
            modal.querySelectorAll('.vibe-result-id').forEach(span => {
                span.onclick = function() {
                    copyTextToClipboard(this.dataset.id);
                    this.classList.add('vibe-copied');
                    this.textContent = '✔ ' + this.dataset.id;
                    setTimeout(() => {
                        this.classList.remove('vibe-copied');
                        this.textContent = this.dataset.id;
                    }, 950);
                };
            });
        }
    }

    // Буфер обмена
    function copyTextToClipboard(text) {
        if (window.GM_setClipboard) GM_setClipboard(text);
        else if (navigator.clipboard) navigator.clipboard.writeText(text);
        else {
            const tmp = document.createElement("textarea");
            tmp.value = text;
            document.body.appendChild(tmp); tmp.select();
            document.execCommand("copy"); document.body.removeChild(tmp);
        }
    }

    // =========== ЗАПУСК ===========
    setTimeout(addFloatingBtn, 700);

})();
