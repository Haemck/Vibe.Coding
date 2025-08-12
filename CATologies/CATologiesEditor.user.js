// ==UserScript==
// @name         DigiSeller: CATologiesEditor
// @namespace    https://my.digiseller.ru/
// @version      1.7
// @description  Редактирование категории/раздела: парсит по имени, логирует всё, отправляет всё. Окно перетаскивается, запоминает позицию, не выходит за экран даже при расширении содержимого. Успех по HTTP 2xx.
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/razdels.asp*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @updateURL    https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesEditor.user.js
// @downloadURL  https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesEditor.user.js
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css?family=JetBrains+Mono:400,700&display=swap');
        #vibe-edit-modal { position:fixed;top:38px;left:28px;width:590px;max-width:99vw;
            background:#181920;color:#ffe37a;border:3.5px solid #ffe37a;border-radius:15px;
            box-shadow:0 9px 54px 0 #000d,0 0 0 6px #ffde5c33;z-index:999999;
            padding:34px 36px 20px 36px;font-family:'JetBrains Mono',monospace;
            min-height:100px;max-height:calc(100vh - 20px);overflow:hidden;
            display:flex;flex-direction:column;animation:vibe-pop-in .32s cubic-bezier(.23,1.25,.32,1) both;}
        @keyframes vibe-pop-in {0%{opacity:0;transform:translateY(-24px) scale(0.97);}100%{opacity:1;transform:none;}}
        #vibe-edit-modal .vibe-edit-title{
            font-size:23px;font-weight:900;letter-spacing:0.04em;text-align:left;margin-bottom:15px;color:#ffe37a;
            cursor:move; user-select:none; }
        #vibe-edit-modal .vibe-edit-id-row{margin-bottom:16px;display:flex;align-items:center;gap:13px;justify-content:left;}
        #vibe-edit-modal .vibe-edit-id-field{display:flex;flex-direction:column;align-items:flex-start;min-width:0;}
        #vibe-edit-modal input[type="text"], #vibe-edit-modal input[type="number"]{
            font-family:inherit;font-size:17px;background:#232324;color:#ffe37a;
            border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 12px;transition:border-color .18s;
            box-shadow:0 2px 0 #ffe37a20;max-width:220px;text-align:left;margin-bottom:4px;}
        #vibe-edit-modal input[type="text"]:focus, #vibe-edit-modal input[type="number"]:focus, #vibe-edit-modal textarea:focus{
            border-color:#ffe37a;background:#181920;outline:none;}
        #vibe-edit-modal label{font-size:15px;margin:4px 0 1px 2px;color:#ffe37a;opacity:0.8;font-weight:400;}
        #vibe-edit-modal textarea{
            font-family:inherit;font-size:15px;background:#232324;color:#ffe37a;
            border:1.8px solid #ffe37a55;border-radius:8px;padding:8px 10px;margin-bottom:5px;
            min-width:220px;width:100%;min-height:60px;resize:vertical;}
        #vibe-edit-modal .vibe-edit-btn{
            font-family:inherit;background:linear-gradient(90deg,#ffe37a,#181920 160%);color:#181920;
            font-weight:900;border:none;border-radius:10px;box-shadow:0 3px 0 #ffe37a36,0 1px 8px #ffe37a17;
            cursor:pointer;transition:background .15s,color .15s,box-shadow .18s;letter-spacing:0.04em;
            padding:15px 0;width:100%;font-size:20px;margin-top:17px;}
        #vibe-edit-modal .vibe-edit-btn:hover{
            background:linear-gradient(90deg,#fffbe3,#ffe37a 130%);color:#181920;box-shadow:0 7px 28px #ffe37a25;}
        #vibe-edit-modal .vibe-close{
            position:absolute;top:13px;right:24px;background:transparent;border:none;font-size:30px;
            color:#ffe37a;cursor:pointer;transition:color .19s;font-family:inherit;font-weight:900;}
        #vibe-edit-modal .vibe-close:hover{color:#fffbe3;}
        #vibe-edit-modal .vibe-edit-status{margin-top:13px;font-size:17px;font-weight:600;color:#ffe37a;text-align:left;min-height:28px;}
        #vibe-edit-fab{position:fixed;left:232px;bottom:32px;z-index:99999;width:78px;height:78px;border-radius:50%;
            background:linear-gradient(135deg,#ffe37a 70%,#181920 190%);box-shadow:0 7px 32px #000c,0 2px 0 #ffe37a66;
            border:4px solid #ffe37a;font-size:42px;font-family:'JetBrains Mono',monospace;color:#181920;font-weight:900;
            cursor:pointer;outline:none;border:none;display:flex;align-items:center;justify-content:center;
            transition:background .15s,box-shadow .17s;animation:vibe-pop-in .28s cubic-bezier(.26,1.2,.23,1) both;user-select:none;}
        #vibe-edit-fab:hover{background:linear-gradient(135deg,#fffbe3 90%,#ffe37a 140%);color:#29291a;box-shadow:0 11px 52px #ffe37a77,0 2px 0 #ffe37a88;}
        #vibe-edit-modal .vibe-flex-row{display:flex;gap:22px;margin-bottom:8px;}
        #vibe-edit-modal .vibe-checkbox{margin-right:7px;transform:scale(1.18);}
        #vibe-edit-modal .vibe-edit-limblock{margin:10px 0 0 0;border:1.2px solid #ffe37a40;padding:6px 11px 11px 11px;border-radius:10px;background:#232324;}
        #vibe-edit-modal .vibe-edit-limblock legend{font-size:14px;color:#ffe37a;font-weight:700;opacity:0.7;}
        #vibe-edit-modal .vibe-id-title{
            color:#b7ffe7;font-weight:700;font-size:17px;padding-left:3px;max-width:100%;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:24px;margin-top:0;margin-bottom:1px;}
        #vibe-edit-modal .vibe-id-type{color:#ffe37a;font-size:15px;min-height:19px;height:19px;margin:0 0 7px 3px;font-weight:400;}
        #vibe-edit-modal .vibe-id-title.vibe-notfound{color:#e45c6d;}
        #vibe-edit-modal .vibe-id-type.vibe-notfound{color:#e45c6d;}
        /* Скроллим только блок с формой, чтобы окно не росло бесконечно */
        #vibe-edit-modal #vibe-edit-formfields{
            overflow:auto; max-height: calc(100vh - 280px);
        }
    `);

    function log(...args) { console.log('[VibeEdit]', ...args); }

    // FAB КНОПКА
    function addFloatingBtn() {
        if (document.getElementById('vibe-edit-fab')) return;
        const btn = document.createElement('button');
        btn.id = 'vibe-edit-fab';
        btn.innerHTML = '<span style="font-size:1.1em;">✎</span>';
        btn.title = "Открыть окно редактирования категории/раздела";
        btn.onclick = () => { btn.style.display = 'none'; showModal(); };
        document.body.appendChild(btn);
    }

    // ПОИСК названия и типа
    async function findDigisellerCategoryOrSectionById(id) {
        if (!id || !/^\d+$/.test(id)) return null;
        try {
            const url = location.pathname + '?idprview=' + id + '#r' + id;
            log('Запрашиваем для поиска названия:', url);
            const resp = await fetch(url, { credentials: 'same-origin' });
            const html = await resp.text();
            const doc = document.implementation.createHTMLDocument('');
            doc.documentElement.innerHTML = html;

            // Категория
            const anchor = doc.querySelector('a[id="r' + id + '"]');
            if (anchor) {
                const title = anchor.textContent.trim();
                log('Категория найдена', {id, title});
                return { id: String(id), title, type: 'Категория' };
            }
            // Раздел
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
                log('Раздел найден', {id, title});
                return { id: String(id), title, type: 'Раздел' };
            }
        } catch (e) {
            log('Ошибка в findDigisellerCategoryOrSectionById:', e);
        }
        log('ID не найден (ни категория, ни раздел):', id);
        return null;
    }

    // МОДАЛКА
    function showModal() {
        if (document.getElementById('vibe-edit-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'vibe-edit-modal';
        modal.innerHTML = `
            <button class="vibe-close" tabindex="-1" title="Закрыть">✕</button>
            <div class="vibe-edit-title">Редактирование категории / раздела</div>
            <div class="vibe-edit-id-row">
                <input type="text" id="vibe-edit-id" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="ID категории/раздела" style="width:140px;font-size:19px;">
                <button class="vibe-edit-btn" style="max-width:140px;width:130px;padding:9px 0;font-size:15px;margin:0 8px;" id="vibe-edit-load">Загрузить</button>
            </div>
            <div class="vibe-id-title" id="vibe-edit-title"></div>
            <div class="vibe-id-type" id="vibe-edit-type"></div>
            <div id="vibe-edit-formfields"></div>
            <div id="vibe-edit-status" class="vibe-edit-status"></div>
        `;
        document.body.appendChild(modal);

        // --- Восстановить позицию и заклэмпить ---
        const savedPos = JSON.parse(localStorage.getItem('vibeEditPos') || 'null');
        if (savedPos && Number.isFinite(savedPos.top) && Number.isFinite(savedPos.left)) {
            modal.style.top = savedPos.top + 'px';
            modal.style.left = savedPos.left + 'px';
            clampToViewport(modal);
        } else {
            clampToViewport(modal);
        }

        // Переклэмп при ресайзе окна
        const onResize = () => { clampToViewport(modal); adjustFormMaxHeight(); };
        window.addEventListener('resize', onResize, { passive: true });

        // Следим за изменением размеров модалки (расширение содержимого) — и клэмпим
        const ro = new ResizeObserver(() => {
            clampToViewport(modal);
            adjustFormMaxHeight();
        });
        ro.observe(modal);

        // Перетаскивание по заголовку
        let isDragging = false, offsetX = 0, offsetY = 0;
        const titleBar = modal.querySelector('.vibe-edit-title');

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
            clampToViewport(modal);
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.userSelect = '';
            const top = parseInt(modal.style.top) || modal.getBoundingClientRect().top;
            const left = parseInt(modal.style.left) || modal.getBoundingClientRect().left;
            localStorage.setItem('vibeEditPos', JSON.stringify({ top, left }));
        });

        function clampToViewport(el) {
            const rect = el.getBoundingClientRect();
            let top = parseInt(el.style.top || rect.top);
            let left = parseInt(el.style.left || rect.left);
            // пределы по размеру окна
            const maxTop = Math.max(0, window.innerHeight - rect.height);
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            if (!Number.isFinite(top)) top = 0;
            if (!Number.isFinite(left)) left = 0;
            top = Math.min(Math.max(0, top), maxTop);
            left = Math.min(Math.max(0, left), maxLeft);
            el.style.top = top + 'px';
            el.style.left = left + 'px';
        }

        // Подгоняем максимальную высоту блока полей так, чтобы окно не выходило за экран
        const formfields = modal.querySelector('#vibe-edit-formfields');
        function adjustFormMaxHeight() {
            const rect = modal.getBoundingClientRect();
            const modalStyle = getComputedStyle(modal);
            const padB = parseInt(modalStyle.paddingBottom) || 0;
            const formTop = formfields.getBoundingClientRect().top - rect.top; // положение блока внутри модалки
            const avail = Math.max(100, (window.innerHeight - 20) - formTop - padB);
            formfields.style.maxHeight = avail + 'px';
        }
        // первичная настройка
        adjustFormMaxHeight();

        // Закрытие
        modal.querySelector('.vibe-close').onclick = () => {
            ro.disconnect();
            window.removeEventListener('resize', onResize);
            modal.remove();
            const fab = document.getElementById('vibe-edit-fab');
            if (fab) fab.style.display = 'flex';
        };

        // Логика загрузки формы
        const idInput  = modal.querySelector('#vibe-edit-id');
        const loadBtn  = modal.querySelector('#vibe-edit-load');
        const statusEl = modal.querySelector('#vibe-edit-status');
        const titleBox = modal.querySelector('#vibe-edit-title');
        const typeBox  = modal.querySelector('#vibe-edit-type');

        function setStatus(text, color) {
            statusEl.style.color = color || '#ffe37a';
            statusEl.innerHTML = text;
        }

        async function loadAndFillForm(id) {
            log('Старт загрузки для ID:', id);
            titleBox.textContent = "…";
            typeBox.textContent = "";
            titleBox.className = "vibe-id-title";
            typeBox.className = "vibe-id-type";
            formfields.innerHTML = '';
            setStatus("Поиск…", "#ffe37a");

            const info = await findDigisellerCategoryOrSectionById(id);
            if (!info) {
                titleBox.textContent = "Не найдено";
                typeBox.textContent = "";
                titleBox.classList.add('vibe-notfound');
                typeBox.classList.add('vibe-notfound');
                setStatus("ID не найден!", "#ff7575");
                return;
            }
            titleBox.textContent = info.title;
            typeBox.textContent = info.type;

            setStatus("Загружаем форму…", "#ffe37a");

            // Загружаем HTML формы
            let html, url;
            try {
                url = `${location.pathname}?idr=${id}&oper=edit&idprview=${id}#${id}`;
                log('Запрос HTML формы:', url);
                const resp = await fetch(url, { credentials: 'same-origin' });
                html = await resp.text();
                log('HTML формы получен, длина:', html.length);
            } catch (e) {
                log('Ошибка загрузки формы:', e);
                setStatus('Ошибка загрузки формы!', '#ff7575');
                return;
            }

            // Парсим HTML
            const doc = document.implementation.createHTMLDocument('');
            doc.documentElement.innerHTML = html;

            // Доставалка значений по name
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

            // Скрытые поля
            const hiddenFields = {};
            doc.querySelectorAll('input[type="hidden"]').forEach(inp => { hiddenFields[inp.name] = inp.value; });

            // Какие поля нас интересуют
            const allNames = ['Razdel','Razdel_eng','Comiss','Day_Lock','SetDef','CheckAtt','infoprice','infopriceeng'];
            const foundData = {};
            allNames.forEach(n => { foundData[n] = getVal(n); log(`Поле ${n}:`, foundData[n]); });
            log('Скрытые поля:', hiddenFields);

            // UI полей
            const fieldsHTML = [];
            fieldsHTML.push('<div class="vibe-flex-row">'
                + `<div style="flex:1"><label>Название (рус):</label><input type="text" id="vibe-edit-field-Razdel" name="Razdel" value=""></div>`
                + `<div style="flex:1"><label>Название (eng):</label><input type="text" id="vibe-edit-field-Razdel_eng" name="Razdel_eng" value=""></div>`
                + '</div>');
            fieldsHTML.push('<div class="vibe-flex-row">'
                + `<div><label>Комиссия (%)</label><input type="number" id="vibe-edit-field-Comiss" name="Comiss" value="" style="width:90px"></div>`
                + `<div><label>Холд (дней)</label><input type="number" id="vibe-edit-field-Day_Lock" name="Day_Lock" value="" style="width:90px"></div>`
                + '</div>');
            fieldsHTML.push('<div class="vibe-flex-row">'
                + `<label><input type="checkbox" class="vibe-checkbox" id="vibe-edit-field-SetDef" name="SetDef"> Показывать по умолчанию</label>`
                + `<label><input type="checkbox" class="vibe-checkbox" id="vibe-edit-field-CheckAtt" name="CheckAtt"> Требовать перс. аттестат</label>`
                + '</div>');
            fieldsHTML.push(`
                <fieldset class="vibe-edit-limblock"><legend>Текст ограничений по разделу (лимиты, пороги, требования)</legend>
                    <label>Рус:</label>
                    <textarea id="vibe-edit-field-infoprice" name="infoprice"></textarea>
                    <label>Eng:</label>
                    <textarea id="vibe-edit-field-infopriceeng" name="infopriceeng"></textarea>
                </fieldset>
            `);
            fieldsHTML.push(`<button class="vibe-edit-btn" id="vibe-edit-savebtn">Сохранить</button>`);
            formfields.innerHTML = fieldsHTML.join('');

            // Заполнение значениями
            function fill(sel, val) {
                const el = modal.querySelector(sel);
                if (el) el.value = val;
                log('Вставлено в', sel, ':', val);
            }
            fill('#vibe-edit-field-Razdel',         foundData.Razdel);
            fill('#vibe-edit-field-Razdel_eng',     foundData.Razdel_eng);
            fill('#vibe-edit-field-Comiss',         foundData.Comiss);
            fill('#vibe-edit-field-Day_Lock',       foundData.Day_Lock);
            const chSetDef = modal.querySelector('#vibe-edit-field-SetDef');
            if (chSetDef) chSetDef.checked = !!foundData.SetDef;
            const chAtt   = modal.querySelector('#vibe-edit-field-CheckAtt');
            if (chAtt) chAtt.checked = !!foundData.CheckAtt;
            fill('#vibe-edit-field-infoprice',      foundData.infoprice);
            fill('#vibe-edit-field-infopriceeng',   foundData.infopriceeng);

            // после отрисовки/заполнения — подгоняем высоту и клэмпим
            adjustFormMaxHeight();
            clampToViewport(modal);

            // Сохранение
            formfields.querySelector('#vibe-edit-savebtn').onclick = function () {
                const data = Object.assign({}, hiddenFields);
                formfields.querySelectorAll('input[type="text"],input[type="number"]').forEach(inp => {
                    if (inp.name) data[inp.name] = inp.value;
                });
                formfields.querySelectorAll('textarea').forEach(inp => {
                    if (inp.name) data[inp.name] = inp.value;
                });
                formfields.querySelectorAll('input[type="checkbox"]').forEach(inp => {
                    if (inp.name) {
                        if (inp.checked) data[inp.name] = 'yes';
                        else if (data[inp.name]) delete data[inp.name];
                    }
                });

                if (!data.Operation) data.Operation = foundData.Comiss ? 'изменение раздела' : 'изменение категории';
                if (!data.ID_R && id) data.ID_R = id;
                if (!data.idprview && id) data.idprview = id;

                // Детальное логирование + отправка
                log('Данные для отправки (POST):', data);
                const params = Object.keys(data).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`).join('&');
                setStatus("Сохраняем...", "#ffe37a");
                log('POST string:', params);

                GM_xmlhttpRequest({
                    method: "POST",
                    url: `${location.pathname}?idr=${id}&oper=edit&idprview=${id}`,
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    data: params,
                    onload: function (resp) {
                        log('Ответ после сохранения:', resp.status, (resp.responseText || '').slice(0,900));
                        if (resp.status >= 200 && resp.status < 300) {
                            const msg = `✔ Изменения сохранены для <span style="font-weight:900">${id}</span> (${info.type})`;
                            setStatus(msg, "#b0f99b");
                        } else {
                            setStatus("Ошибка HTTP " + resp.status, "#ff7575");
                        }
                    },
                    onerror: function () { setStatus("Ошибка сети/запроса", "#ff7575"); }
                });
            };

            setStatus('Данные загружены.', '#b7ffe7');
            log('Форма готова, ожидание заполнения пользователем/сохранения');
        }

        loadBtn.onclick = () => {
            let id = idInput.value.trim().replace(/\D/g,'');
            if (!id) return setStatus("Укажите корректный ID!", "#ff7575");
            idInput.value = id;
            loadAndFillForm(id);
        };
    }

    setTimeout(addFloatingBtn, 700);
})();
