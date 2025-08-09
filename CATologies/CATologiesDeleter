// ==UserScript==
// @name         DigiSeller: Удаление категории/раздела (bi-trash SVG, vibe-blackgold, успех по HTTP 2xx, перетаскивание+запоминание)
// @namespace    https://my.digiseller.ru/
// @version      1.5
// @description  Удаляет категорию/раздел по ID с подтверждением в окошке. Успех по коду ответа (200–299). SVG bi-trash, стиль vibe-blackgold, FAB-кнопка, копирование ID результата. Перетаскивание окна (Alt+ЛКМ по заголовку) и запоминание позиции.
// @author       vibe.
// @match        https://my.digiseller.ru/asp/razdels.asp*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @updateURL    https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesDeleter.user.js
// @downloadURL  https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesDeleter.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ==== Стили ====
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css?family=JetBrains+Mono:400,700&display=swap');
        #vibe-del-modal {
            position:fixed;top:38px;left:28px;width:430px;max-width:98vw;
            background:#181920;color:#ffe37a;border:3.5px solid #ffe37a;
            border-radius:15px;box-shadow:0 9px 54px 0 #000d,0 0 0 6px #ffde5c33;
            z-index:999999;padding:30px 34px 22px 34px;
            font-family:'JetBrains Mono',monospace;min-height:100px;overflow:hidden;
            display:flex;flex-direction:column;animation:vibe-pop-in .30s cubic-bezier(.23,1.25,.32,1) both;
        }
        @keyframes vibe-pop-in {0%{opacity:0;transform:translateY(-22px) scale(0.98);}100%{opacity:1;transform:none;}}
        #vibe-del-modal .vibe-del-title{
            font-size:23px;font-weight:900;letter-spacing:0.04em;text-align:left;margin-bottom:18px;color:#ffe37a;
            cursor:move; /* подсказка, что можно таскать */
        }
        #vibe-del-modal .vibe-fields-row{
            margin-bottom:2px;display:flex;align-items:center;gap:11px;justify-content:center;
        }
        #vibe-del-modal .vibe-field-col{
            display:flex;flex-direction:column;align-items:center;min-width:0;
        }
        #vibe-del-modal input[type="text"]{
            font-family:inherit;font-size:17px;background:#232324;color:#ffe37a;
            border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 12px;margin-right:0;transition:border-color .18s;
            box-shadow:0 2px 0 #ffe37a20;width:140px;max-width:170px;text-align:center;
        }
        #vibe-del-modal input[type="text"]:focus{
            border-color:#ffe37a;background:#181920;outline:none;
        }
        #vibe-del-modal .vibe-id-title, #vibe-del-modal .vibe-id-type{
            display:block;text-align:center;
            font-size:17px;min-height:22px;height:22px;margin:6px 0 0 0;transition:opacity .15s;
            max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
            padding:0 4px;
        }
        #vibe-del-modal .vibe-id-title{ color:#b7ffe7;font-weight:700; }
        #vibe-del-modal .vibe-id-title.vibe-notfound{ color:#e45c6d;font-weight:700; }
        #vibe-del-modal .vibe-id-type{ color:#ffe37a;font-size:15px;min-height:19px;height:19px;margin:1px 0 0 0;font-weight:400;letter-spacing:0.02em; }
        #vibe-del-modal .vibe-id-type.vibe-notfound{ color:#e45c6d; }

        #vibe-del-modal .vibe-btn{
            font-family:inherit;background:linear-gradient(90deg,#ffe37a,#181920 160%);color:#181920;
            font-weight:900;border:none;border-radius:10px;box-shadow:0 3px 0 #ffe37a36,0 1px 8px #ffe37a17;
            cursor:pointer;transition:background .15s,color .15s,box-shadow .18s;letter-spacing:0.04em;
            padding:15px 0;width:100%;font-size:20px;margin-top:18px;
        }
        #vibe-del-modal .vibe-btn:hover{ background:linear-gradient(90deg,#fffbe3,#ffe37a 130%);color:#181920;box-shadow:0 7px 28px #ffe37a25; }

        #vibe-del-modal .vibe-confirm{
            background:rgba(255,227,122,0.07);border:2px solid #ffe37a;border-radius:10px;
            color:#ffe37a;padding:13px 16px;font-size:17px;font-weight:700;
            margin:22px 0 8px 0;text-align:center;display:flex;flex-direction:column;gap:13px;align-items:center;
        }
        #vibe-del-modal .vibe-confirm-btns{ display:flex;gap:22px;justify-content:center;margin-top:7px; }
        #vibe-del-modal .vibe-btn-small{
            font-size:18px;font-weight:900;background:#ffe37a33;color:#181920;border:none;border-radius:8px;
            cursor:pointer;padding:7px 24px;min-width:58px;box-shadow:none;transition:background .18s,color .18s;
        }
        #vibe-del-modal .vibe-btn-small:hover{ background:#ffe37a;color:#181920; }

        #vibe-del-modal .vibe-close{
            position:absolute;top:13px;right:24px;background:transparent;border:none;font-size:30px;
            color:#ffe37a;cursor:pointer;transition:color .19s;font-family:inherit;font-weight:900;
        }
        #vibe-del-modal .vibe-close:hover{ color:#fffbe3; }
        #vibe-del-modal .vibe-status{ margin-top:13px;font-size:17px;font-weight:600;color:#ffe37a;text-align:left;min-height:28px; }
        #vibe-del-modal .vibe-result-id{
            color:#ffde5c;font-weight:700;cursor:pointer;padding:1px 8px 1px 3px;font-size:16px;background:none;
            border-radius:6px;transition:background .15s;
        }
        #vibe-del-modal .vibe-result-id.vibe-copied{ background:#ffe37a;color:#181920; }

        #vibe-del-fab{
            position:fixed;left:432px;bottom:32px;z-index:99999;width:78px;height:78px;border-radius:50%;
            background:linear-gradient(135deg,#ffe37a 70%,#181920 190%);
            box-shadow:0 7px 32px #000c,0 2px 0 #ffe37a66;border:4px solid #ffe37a;font-size:40px;
            font-family:'JetBrains Mono',monospace;color:#181920;font-weight:900;cursor:pointer;outline:none;
            border:none;display:flex;align-items:center;justify-content:center;transition:background .15s,box-shadow .17s;
            animation:vibe-pop-in .28s cubic-bezier(.26,1.2,.23,1) both;user-select:none;
        }
        #vibe-del-fab svg{ width:38px;height:38px;display:block; }
        #vibe-del-fab:hover{ background:linear-gradient(135deg,#fffbe3 90%,#ffe37a 140%);color:#29291a;box-shadow:0 11px 52px #ffe37a77,0 2px 0 #ffe37a88; }
    `);

    // ==== FAB-кнопка ====
    function addFloatingBtn() {
        if (document.getElementById('vibe-del-fab')) return;
        const btn = document.createElement('button');
        btn.id = 'vibe-del-fab';
        btn.title = "Открыть окно удаления раздела/категории";
        // SVG корзины (bootstrap icons bi-trash)
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"></path>
              <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"></path>
            </svg>
        `;
        btn.onclick = () => {
            btn.style.display = 'none';
            showModal();
        };
        document.body.appendChild(btn);
    }

    // ==== Асинхронный поиск названия и типа по ID ====
    async function findDigisellerCategoryOrSectionById(id) {
        if (!id || !/^\d+$/.test(id)) return null;
        try {
            const url = location.pathname + '?idprview=' + id + '#r' + id;
            const resp = await fetch(url, { credentials: 'same-origin' });
            const html = await resp.text();
            const doc = document.implementation.createHTMLDocument('');
            doc.documentElement.innerHTML = html;

            // Пробуем как "категория" (якорь с id="r<ID>")
            const anchor = doc.querySelector('a[id="r' + id + '"]');
            if (anchor) {
                return { id: String(id), title: anchor.textContent.trim(), type: 'Категория' };
            }
            // Иначе ищем как "раздел" по серому small с ID
            const small = Array.from(doc.querySelectorAll('small')).find(s => s.textContent.trim() === String(id));
            if (small) {
                const td = small.parentElement;
                let allText = td.textContent.replace(/\s+/g, ' ').trim();
                allText = allText.replace(id, '').replace(/^\s+|\s+$/g, '');
                allText = allText.replace(/(изменить|переместить|удалить)[^%]*$/i, '');
                let match = allText.match(/(.+?)\s*([0-9]+[.,]?\d*)\s*%/);
                let title = '';
                if (match) title = match[1].trim();
                else {
                    let noBtns = allText.replace(/(изменить|переместить|удалить)/gi, '').trim();
                    title = noBtns || allText;
                }
                return { id: String(id), title, type: 'Раздел' };
            }
        } catch (e) {}
        return null;
    }

    // ==== Модалка ====
    function showModal() {
        if (document.getElementById('vibe-del-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'vibe-del-modal';
        modal.innerHTML = `
            <button class="vibe-close" tabindex="-1" title="Закрыть">✕</button>
            <div class="vibe-del-title">Удаление</div>
            <div class="vibe-fields-row">
                <div class="vibe-field-col">
                    <input type="text" id="vibe-del-id" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="ID" />
                    <div id="vibe-del-title" class="vibe-id-title"></div>
                    <div id="vibe-del-type" class="vibe-id-type"></div>
                </div>
            </div>
            <button class="vibe-btn" id="vibe-del-btn">Удалить</button>
            <div id="vibe-del-status" class="vibe-status"></div>
        `;
        document.body.appendChild(modal);

        // === Восстановление сохранённой позиции и клэмп в вьюпорт ===
        const savedPos = JSON.parse(localStorage.getItem('vibeDelPos') || 'null');
        if (savedPos && Number.isFinite(savedPos.top) && Number.isFinite(savedPos.left)) {
            modal.style.top = savedPos.top + 'px';
            modal.style.left = savedPos.left + 'px';
            clampToViewport(modal);
        }
        window.addEventListener('resize', () => clampToViewport(modal), { passive: true });

        // === Перетаскивание по Alt + ЛКМ по заголовку ===
        let isDragging = false, offsetX = 0, offsetY = 0;
        const titleBar = modal.querySelector('.vibe-del-title');

        titleBar.addEventListener('mousedown', e => {
            if (e.button !== 0) return; // только ЛКМ
            const rect = modal.getBoundingClientRect();
            isDragging = true;
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.body.style.userSelect = 'none'; // чтобы не выделялся текст при перетаскивании
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            modal.style.top = (e.clientY - offsetY) + 'px';
            modal.style.left = (e.clientX - offsetX) + 'px';
            clampToViewport(modal); // опционально поджимать в реальном времени
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.userSelect = '';
            // Сохраняем позицию
            const top = parseInt(modal.style.top) || modal.getBoundingClientRect().top;
            const left = parseInt(modal.style.left) || modal.getBoundingClientRect().left;
            localStorage.setItem('vibeDelPos', JSON.stringify({ top, left }));
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

        // ===== Закрытие =====
        modal.querySelector('.vibe-close').onclick = () => {
            modal.remove();
            const fab = document.getElementById('vibe-del-fab');
            if (fab) fab.style.display = 'flex';
        };

        // ===== Поиск по ID, без лишних запросов =====
        const idInput = modal.querySelector('#vibe-del-id');
        const titleDiv = modal.querySelector('#vibe-del-title');
        const typeDiv = modal.querySelector('#vibe-del-type');
        let lastId = '';
        let isConfirming = false;

        async function updateInfo(force) {
            let id = idInput.value.replace(/\D/g,'');
            idInput.value = id;
            if (!force && id === lastId) return; // не дергаем повторно
            lastId = id;
            titleDiv.textContent = id ? '…' : '';
            titleDiv.className = "vibe-id-title";
            typeDiv.textContent = '';
            typeDiv.className = "vibe-id-type";
            if (id) {
                const cat = await findDigisellerCategoryOrSectionById(id);
                if (cat) {
                    titleDiv.textContent = cat.title;
                    typeDiv.textContent = cat.type;
                } else {
                    titleDiv.textContent = 'Не найдено';
                    titleDiv.classList.add('vibe-notfound');
                    typeDiv.textContent = '';
                    typeDiv.classList.add('vibe-notfound');
                }
            } else {
                titleDiv.textContent = '';
                typeDiv.textContent = '';
            }
        }
        idInput.oninput = () => updateInfo(false);
        idInput.onblur  = () => updateInfo(false);

        // ===== Кнопка "Удалить" =====
        modal.querySelector('#vibe-del-btn').onclick = function () {
            const id = idInput.value.trim();
            if (!id || isNaN(+id)) return setStatus("Укажите корректный ID!", "#e45c6d");
            if (isConfirming) return;
            showConfirm(id);
        };

        // ===== Кастомное подтверждение =====
        function showConfirm(id) {
            if (modal.querySelector('.vibe-confirm')) return;
            isConfirming = true;
            setStatus('');
            const confirmDiv = document.createElement('div');
            confirmDiv.className = "vibe-confirm";
            confirmDiv.innerHTML = `
                <span>⚠️ <b>Вы УВЕРЕНЫ, что хотите удалить?</b></span>
                <div class="vibe-confirm-btns">
                    <button class="vibe-btn-small" id="vibe-confirm-yes">Удалить</button>
                    <button class="vibe-btn-small" id="vibe-confirm-no">Отмена</button>
                </div>
            `;
            modal.appendChild(confirmDiv);

            confirmDiv.querySelector('#vibe-confirm-no').onclick = function(){
                confirmDiv.remove();
                isConfirming = false;
            };
            confirmDiv.querySelector('#vibe-confirm-yes').onclick = function(){
                confirmDiv.remove();
                isConfirming = false;
                setStatus("Удаляем...", "#ffe37a");
                doDelete(id);
            };
        }

        function setStatus(text, color) {
            const el = modal.querySelector('#vibe-del-status');
            el.style.color = color || '#ffe37a';
            el.innerHTML = text;
        }

        // ===== POST-запрос на удаление (HTTP 2xx = успех) =====
        function doDelete(id) {
            const params = [
                `Operation=${encodeURIComponent('удаление раздела')}`,
                `ID_R=${id}`,
                `idprview=${id}`
            ].join('&');

            GM_xmlhttpRequest({
                method: "POST",
                url: `https://my.digiseller.ru/asp/razdels.asp?idr=${id}&oper=delete&idprview=${id}`,
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                data: params,
                onload: function (resp) {
                    if (resp.status >= 200 && resp.status < 300) {
                        const msg = `✔ <span class="vibe-result-id" data-id="${id}" title="Клик — скопировать ID">${id}</span> успешно удалён`;
                        setStatus(msg, "#b0f99b");
                        showResult();
                    } else {
                        setStatus("Ошибка HTTP " + resp.status, "#e45c6d");
                    }
                },
                onerror: function () { setStatus("Ошибка сети/запроса", "#e45c6d"); }
            });
        }

        // ===== Копирование ID в результатах =====
        function showResult() {
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

    // ==== Клипборд ====
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

    // ==== Запуск FAB ====
    setTimeout(addFloatingBtn, 800);
})();
