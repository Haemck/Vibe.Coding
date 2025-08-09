// ==UserScript==
// @name         DigiSeller: Массовое создание категорий/разделов (Paths Merge + Persist State + Icons Reset/Paste + Confirm Popover)
// @namespace    https://my.digiseller.ru/
// @version      4.4
// @description  Vibe: мультистрочный путь, автообъединение, скрытие поля по кнопке, без дублей + сохранение состояния + иконки + стильное всплывающее подтверждение очистки поверх кнопки
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/razdels.asp*
// @grant        GM_xmlhttpRequest
// @updateURL    https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesWayBuidler.user.js
// @downloadURL  https://github.com/Haemck/Vibe.Coding/raw/refs/heads/main/CATologies/CATologiesWayBuidler.user.js
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // ==== КОНСТАНТЫ ХРАНИЛКИ ====
    const LS_KEY = 'vibe-bulk-state-v42';

    // ==== АВТОЗАМЕНА ENG и КОМИССИИ ====
    const AUTO_ENG = {
        "Аккаунты": "Accounts", "Ключи": "Keys", "Аренда аккаунтов": "Account rental", "Оффлайн аккаунты": "Offline Accounts",
        "Услуги активации": "Activation Services", "Покупка на ваш аккаунт": "Purchase on your account", "DLC": "DLC",
        "Скины": "Skins", "Предметы": "Items", "Валюта": "Currency", "Боевой пропуск": "Battle pass", "Наборы": "Packs",
        "Гайды": "Guides", "Дизайн-проекты": "Design projects", "Пополнение баланса": "Balance top up",
        "Steam": "Steam", "Epic Games Store": "Epic Games Store", "EA app": "EA app", "Meta Quest": "Meta Quest", "GOG": "GOG",
        "PlayStation": "PlayStation", "Uplay": "Uplay", "Xbox / Microsoft Store": "Xbox / Microsoft Store"
    };
    const RUS_VARIANTS = Object.keys(AUTO_ENG);

    // Основные ID=>название и обратное соответствие
    const FIXED_PATHS = {
        "33627": "Игры",
        "117160": "Крипто-индустрия",
        "44264": "Новые ниши",
        "23835": "Программное обеспечение",
        "33749": "Сервисы и соцсети",
        "28685": "Цифровые товары"
    };
    const FIXED_NAMES_TO_ID = {};
    Object.entries(FIXED_PATHS).forEach(([id, name]) => { FIXED_NAMES_TO_ID[name.toLowerCase()] = id; });

    function autoEng(val) { return AUTO_ENG[val] || val; }
    function autoKomiss({ru, parentRu}) {
        ru = (ru||"").trim();
        parentRu = (parentRu||"").trim();
        if (/steam/i.test(ru) && !["Аккаунты", "Оффлайн аккаунты", "Аренда аккаунтов"].includes(parentRu)) return '2.5';
        if (["Аккаунты", "Оффлайн аккаунты", "Аренда аккаунтов"].includes(parentRu)) return '20';
        if (["Ключи", "Услуги активации", "DLC", "Скины", "Валюта", "Предметы", "Боевой пропуск", "Наборы"].includes(parentRu)) return '2';
        return '';
    }

    // ==== СТИЛИ ====
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css?family=JetBrains+Mono:400,700&display=swap');
        #vibe-bulk-modal { position:fixed;top:28px;left:24px;width:820px;max-width:98vw;background:#181920;color:#ffe37a;border:3.5px solid #ffe37a;border-radius:15px;box-shadow:0 9px 54px 0 #000d,0 0 0 6px #ffde5c33;z-index:999999;padding:28px 34px 24px 34px;font-family:'JetBrains Mono',monospace;min-height:90px;overflow:hidden;display:flex;flex-direction:column;animation:vibe-pop-in .30s cubic-bezier(.23,1.25,.32,1) both;}
        @keyframes vibe-pop-in {0%{opacity:0;transform:translateY(-22px) scale(0.98);}100%{opacity:1;transform:none;}
        }
        #vibe-bulk-modal label {font-size:16px;display:inline-block;color:#ffe37a;font-weight:700;margin-right:11px;}
        #vibe-bulk-modal input[type="text"],#vibe-bulk-modal input[type="number"],#vibe-bulk-modal select, #vibe-path-paste-input, #vibe-path-paste-input-multi{width: 100%;font-family:inherit;font-size:15px;background:#232324;color:#ffe37a;border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 10px;margin-right:7px;transition:border-color .18s;box-shadow:0 2px 0 #ffe37a20;}
        #vibe-bulk-modal input[type="text"]:focus,#vibe-bulk-modal input[type="number"]:focus,#vibe-bulk-modal select:focus,#vibe-path-paste-input:focus,#vibe-path-paste-input-multi:focus{border-color:#ffe37a;background:#181920;outline:none;}
        #vibe-bulk-modal .vibe-row{margin-bottom:18px;}
        #vibe-bulk-modal .vibe-compact-row{display:flex;align-items:center;gap:9px;margin-bottom:6px;flex-wrap:wrap;position:relative;}
        #vibe-bulk-modal .vibe-checkbox{margin:0 10px 0 0;vertical-align:middle;transform:scale(1.15);accent-color:#ffe37a;}
        #vibe-bulk-modal .vibe-btn,#vibe-bulk-modal .vibe-small-btn{font-family:inherit;background:linear-gradient(90deg,#ffe37a,#181920 160%);color:#181920;font-weight:900;border:none;border-radius:10px;box-shadow:0 3px 0 #ffe37a36,0 1px 8px #ffe37a17;cursor:pointer;transition:background .15s,color .15s,box-shadow .18s;letter-spacing:0.04em;}
        #vibe-bulk-modal .vibe-btn{padding:15px 0;width:100%;font-size:20px;margin-top:14px;margin-bottom:2px;}
        #vibe-bulk-modal .vibe-btn:hover{background:linear-gradient(90deg,#fffbe3,#ffe37a 130%);color:#181920;box-shadow:0 7px 28px #ffe37a25;}
        #vibe-bulk-modal .vibe-small-btn,#vibe-bulk-modal .vibe-small-btn-remove{font-size:19px;font-weight:900;background:#ffe37a33;color:#ffe37a;border:none;border-radius:8px;cursor:pointer;padding:4px 11px;margin-left:7px;min-width:30px;box-shadow:none;transition:background .18s,color .18s;}
        #vibe-bulk-modal .vibe-small-btn:hover,#vibe-bulk-modal .vibe-small-btn-remove:hover{background:#ffe37a;color:#181920;}
        #vibe-bulk-modal .vibe-section{border:1.6px solid #ffe37a66;background:#232324;border-radius:8px;margin-bottom:8px;padding:7px 10px 4px 8px;position:relative;box-shadow:0 1.5px 0 #ffe37a20;}
        #vibe-bulk-modal .vibe-section-children{margin-left:34px;margin-top:4px;}
        #vibe-bulk-modal .vibe-close{position:absolute;top:11px;right:24px;background:transparent;border:none;font-size:29px;color:#ffe37a;cursor:pointer;transition:color .19s;font-family:inherit;font-weight:900;}
        #vibe-bulk-modal .vibe-close:hover{color:#fffbe3;}
        #vibe-bulk-modal .vibe-status{margin-top:13px;font-size:17px;font-weight:600;color:#ffe37a;text-align:left;}
        .vibe-result-list-block {max-height:246px;overflow-y:auto;margin-top:12px;margin-bottom:0;background:#1d1f27;border-radius:8px;padding:7px 18px 7px 13px;font-size:16.2px;box-shadow:0 3px 24px #0004;}
        .vibe-result-list-block:focus {outline: 2px solid #ffe37a;}
        .vibe-copyall-btn-fixed {position:absolute;right:2px;top:0px;display:flex;gap:14px;z-index:2;}
        .vibe-copyall-btn {background:#ffe37a;color:#232324;border-radius:8px;border:none;font-weight:700;font-size:16px;font-family:inherit;padding:9px 30px 9px 24px;cursor:pointer;box-shadow:0 2px 0 #ffe37a44;transition:background .17s,color .17s;}
        .vibe-copyall-btn:hover{background:#fffbe3;color:#181920;}
        .vibe-result-id{color:#ffde5c;font-weight:700;cursor:pointer;padding:1px 8px 1px 3px;font-size:15.7px;background:none;border-radius:6px;transition:background .15s;}
        .vibe-result-id.vibe-copied{background:#ffe37a;color:#181920;}
        #vibe-bulk-fab{position:fixed;left:32px;bottom:32px;z-index:99999;width:78px;height:78px;border-radius:50%;background:linear-gradient(135deg,#ffe37a 70%,#181920 190%);box-shadow:0 7px 32px #000c,0 2px 0 #0000;font-size:46px;display:flex;align-items:center;justify-content:center;cursor:pointer;outline:none;border:none;transition:background .15s,box-shadow .17s;animation:vibe-pop-in .28s cubic-bezier(.26,1.2,.23,1) both;user-select:none;}
        #vibe-bulk-fab:hover{background:linear-gradient(135deg,#fffbe3 90%,#ffe37a 140%);color:#29291a;box-shadow:0 11px 52px #ffe37a77,0 2px 0 #ffe37a88;}
        .vibe-autocomplete-portal {position:fixed;z-index:9999999;min-width:180px;max-width:340px;background:#1d1f27;color:#ffe37a;border:2px solid #ffe37a77;border-radius:7px;box-shadow:0 8px 22px #000a;padding:5px 0;max-height:205px;overflow-y:auto;font-family:'JetBrains Mono',monospace;font-size:15.7px;}
        .vibe-autocomplete-item{padding:7px 15px;cursor:pointer;transition:background .13s;color:#ffe37a;}
        .vibe-autocomplete-item.active,.vibe-autocomplete-item:hover{background:linear-gradient(90deg,#ffe37a33 80%,#ffe37a11 140%);color:#181920;}
        #vibe-bulk-modal input[type=number].vibe-commission::-webkit-outer-spin-button,
        #vibe-bulk-modal input[type=number].vibe-commission::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0;}
        #vibe-bulk-modal input[type=number].vibe-commission { -moz-appearance:textfield; appearance:textfield;}

        /* ==== подтверждающий поповер ==== */
        .vibe-confirm-mask{position:fixed;inset:0;z-index:10000000;background:transparent;}
        .vibe-confirm-popover{
            position:fixed;z-index:10000001;
            background:#1d1f27;color:#ffe37a;
            border:2px solid #ffe37a88;border-radius:10px;
            box-shadow:0 8px 24px #000a,0 0 0 4px #ffde5c22;
            padding:10px 12px;max-width:300px;min-width:240px;
            font-family:'JetBrains Mono',monospace;font-size:14.8px;
        }
        .vibe-confirm-popover .vcp-title{font-weight:900;margin-bottom:6px;}
        .vibe-confirm-popover .vcp-desc{opacity:.9}
        .vibe-confirm-popover .vcp-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;}
        .vibe-confirm-popover .vcp-ok{background:#ffe37a;color:#181920;border-radius:8px;border:2px solid #101116;padding:6px 10px;font-weight:900;cursor:pointer;}
        .vibe-confirm-popover .vcp-cancel{background:#ffe37a33;color:#ffe37a;border-radius:8px;border:none;padding:6px 10px;font-weight:900;cursor:pointer;}
        .vibe-confirm-popover .vcp-ok:hover{filter:brightness(1.05);}
        .vibe-confirm-popover .vcp-cancel:hover{background:#ffe37a;}
    `);

    // ==== FAB кнопка ====
    function addFloatingBtn() {
        if (document.getElementById('vibe-bulk-fab')) return;
        let btn = document.createElement('button');
        btn.id = 'vibe-bulk-fab';
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-box-seam" viewBox="0 0 16 16">
             <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.404.961L10.404 2zm3.564 1.426L5.596 5 8 5.961 14.154 3.5zm3.25 1.7-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z"></path>
            </svg>
        `;
        btn.title = "Массовое создание категорий/разделов";
        btn.onclick = () => {
            btn.style.display = 'none';
            showModal();
        };
        document.body.appendChild(btn);
    }

    // ==== AUTOCOMPLETE PORTAL ====
    let globalAC = null;
    function closeGlobalAC() {
        if (globalAC && globalAC.parentNode) globalAC.parentNode.removeChild(globalAC);
        globalAC = null;
    }
    function showGlobalAC(input, variants, highlightIdx = -1) {
        closeGlobalAC();
        if (!variants.length) return;
        let rect = input.getBoundingClientRect();
        let modal = document.getElementById('vibe-bulk-modal');
        let mrect = modal.getBoundingClientRect();
        let ac = document.createElement('div');
        ac.className = 'vibe-autocomplete-portal';
        ac.style.top = (rect.bottom + window.scrollY) + 'px';
        ac.style.left = (rect.left + window.scrollX) + 'px';
        ac.style.maxWidth = Math.min(rect.width + 140, mrect.right - rect.left - 10) + 'px';
        ac.style.minWidth = Math.max(rect.width, 140) + 'px';

        variants.forEach((v, idx) => {
            let el = document.createElement('div');
            el.className = 'vibe-autocomplete-item' + (idx === highlightIdx ? ' active' : '');
            el.textContent = v;
            el.onmousedown = function(e) {
                if (e.button !== 0) return;
                input.value = v;
                input.dispatchEvent(new Event('input', {bubbles:true}));
                closeGlobalAC();
                input.blur(); input.focus();
                e.preventDefault();
            };
            ac.appendChild(el);
        });
        document.body.appendChild(ac);
        globalAC = ac;
    }
    document.addEventListener('mousedown', (e)=>{
        if(globalAC && !globalAC.contains(e.target)) closeGlobalAC();
    });
    document.addEventListener('keydown', (e)=>{
        if(globalAC && e.key === 'Escape') closeGlobalAC();
    });

    // ==== SAVE HOOK для секций ====
    let saveHook = () => {}; // назначим внутри showModal

    // ==== UI секция ====
    function createSection(data = {}, parentRu = '') {
        let section = document.createElement('div');
        section.className = 'vibe-section';
        section.innerHTML = `
            <div class="vibe-compact-row">
                <div style="position:relative;">
                    <input type="text" class="vibe-ru-name" maxlength="80" style="flex:2 1 120px" value="${data.ru||''}" placeholder="Название (рус)" required autocomplete="off" title="Русское название">
                </div>
                <input type="text" class="vibe-en-name" maxlength="80" style="flex:2 1 120px" value="${data.en||''}" placeholder="Eng" autocomplete="off" title="English (авто)">
                <select class="vibe-type" style="flex:1 0 94px;">
                    <option value="0" ${data.type=='0'?'selected':''}>Категория</option>
                    <option value="1" ${data.type=='1'?'selected':''}>Раздел</option>
                </select>
                <input type="number" min="0" max="100" class="vibe-commission" style="width:65px;display:${data.type=='1'?'':'none'};" placeholder="%" value="${data.comm||''}" title="Комиссия (%)" inputmode="decimal">
                <label style="margin:0;display:${data.type=='1'?'':'none'};">
                    <input type="checkbox" class="vibe-checkbox vibe-attest" ${data.att?'checked':''}> Аттестат
                </label>
                <button class="vibe-small-btn" type="button" title="Добавить дочерний">＋</button>
                <button class="vibe-small-btn-remove" title="Удалить элемент" tabindex="-1">✖</button>
            </div>
            <div class="vibe-section-children"></div>
        `;
        let ruInput = section.querySelector('.vibe-ru-name');
        let enInput = section.querySelector('.vibe-en-name');
        let typeSel = section.querySelector('.vibe-type');
        let commField = section.querySelector('.vibe-commission');
        let attestLabel = section.querySelector('label');
        let plusBtn = section.querySelector('.vibe-small-btn');
        let minusBtn = section.querySelector('.vibe-small-btn-remove');

        // --- ГЛОБАЛЬНОЕ АВТОДОПОЛНЕНИЕ ---
        let acIdx = -1;
        ruInput.addEventListener('input', function () {
            enInput.value = autoEng(this.value.trim());
            if (typeSel.value==='1') commField.value = autoKomiss({ru:this.value.trim(), parentRu});
            let val = this.value.trim().toLowerCase();
            if (!val) { closeGlobalAC(); saveHook(); return; }
            let filtered = RUS_VARIANTS.filter(v => v.toLowerCase().startsWith(val));
            if (filtered.length) { acIdx = -1; showGlobalAC(ruInput, filtered, acIdx); } else closeGlobalAC();
            saveHook();
        });
        ruInput.addEventListener('blur', function() {
            this.value = this.value.replace(/\s+$/g, '');
            setTimeout(closeGlobalAC, 120);
            saveHook();
        });
        ruInput.addEventListener('dblclick', function(){
            acIdx = -1; showGlobalAC(ruInput, RUS_VARIANTS, acIdx);
        });
        ruInput.addEventListener('keydown', function(e) {
            if (!globalAC) return;
            let items = globalAC.querySelectorAll('.vibe-autocomplete-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
                acIdx = (acIdx + 1) % items.length;
                showGlobalAC(ruInput, Array.from(items).map(x=>x.textContent), acIdx);
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                acIdx = (acIdx + items.length - 1) % items.length;
                showGlobalAC(ruInput, Array.from(items).map(x=>x.textContent), acIdx);
                e.preventDefault();
            } else if (e.key === 'Enter' && acIdx >= 0) {
                items[acIdx].dispatchEvent(new MouseEvent('mousedown', {bubbles:true, button:0}));
                e.preventDefault();
            } else if (e.key === 'Escape') {
                closeGlobalAC();
            }
        });
        enInput.addEventListener('input', saveHook);
        enInput.addEventListener('blur', function(){
            this.value = this.value.replace(/\s+$/g, '');
            saveHook();
        });

        commField.addEventListener('focus', function(){
            this.title = 'Обычно: 2% для ключей/валюты, 2.5% для Steam, 20% для аккаунтов';
        });
        commField.addEventListener('input', saveHook);
        commField.addEventListener('blur', function(){
            this.value = this.value.replace(/\s+$/g, '');
            saveHook();
        });

        function updateKomiss() {
            if (typeSel.value==='1') {
                commField.value = autoKomiss({ru:ruInput.value.trim(), parentRu});
            }
        }
        ruInput.addEventListener('blur', updateKomiss);
        typeSel.addEventListener('change', function(){
            if (this.value === '1') {
                commField.style.display = '';
                attestLabel.style.display = '';
                updateKomiss();
            } else {
                commField.style.display = 'none';
                attestLabel.style.display = 'none';
                commField.value = '';
            }
            saveHook();
        });
        attestLabel.querySelector('.vibe-attest').addEventListener('change', saveHook);

        plusBtn.onclick = function() {
            let children = section.querySelector('.vibe-section-children');
            children.appendChild(createSection({}, ruInput.value.trim()));
            setTimeout(saveHook, 0);
        };
        minusBtn.onclick = function(){
            section.remove();
            setTimeout(saveHook, 0);
        };
        return section;
    }

    // ==== Асинхронный поиск названия и типа по ID (с кэшем) ====
    let lastIdChecked = '', lastResult = null;
    async function findDigisellerCategoryOrSectionById(id) {
        if (!id || !/^\d+$/.test(id)) return null;
        if (id === lastIdChecked) return lastResult;
        const url = location.pathname + '?idprview=' + id + '#r' + id;
        try {
            const resp = await fetch(url, { credentials: 'same-origin' });
            const html = await resp.text();
            const doc = document.implementation.createHTMLDocument('');
            doc.documentElement.innerHTML = html;

            const anchor = doc.querySelector('a[id="r' + id + '"]');
            if (anchor) {
                lastIdChecked = id;
                lastResult = {id: String(id), title: anchor.textContent.trim(), type: 'Категория'};
                return lastResult;
            }
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
                lastIdChecked = id;
                lastResult = {id: String(id), title: title, type: 'Раздел'};
                return lastResult;
            }
        } catch(e){}
        lastIdChecked = id;
        lastResult = null;
        return null;
    }

    // ==== Сбор дерева из путей (MERGE ПО НАЗВАНИЮ + АПГРЕЙД ТИПА) ====
    function buildTreeFromPaths(lines) {
        let root = [];
        for (let line of lines) {
            let parts = line.trim().replace(/^\s*>\s*/,'').split(/\s*>\s*/).filter(Boolean);
            if (!parts.length) continue;
            let ptr = root, parentRu = '';
            for (let i = 0; i < parts.length; ++i) {
                let ru = parts[i].trim();
                let en = autoEng(ru);
                let isLast = (i === parts.length - 1);

                let exist = ptr.find(x => x.ru === ru);

                if (exist) {
                    if (!isLast) {
                        if (exist.type === '1') {
                            exist.type = '0';
                            exist.comm = '';
                            exist.att = false;
                            exist.children = exist.children || [];
                        }
                        ptr = exist.children || (exist.children = []);
                        parentRu = ru;
                        continue;
                    } else {
                        ptr = exist.children || (exist.children = []);
                        parentRu = ru;
                        continue;
                    }
                }

                let type = isLast ? '1' : '0';
                let comm = isLast ? autoKomiss({ru, parentRu}) : '';
                let att = false;
                let node = { ru, en, type, comm, att, children: [] };
                ptr.push(node);
                ptr = node.children;
                parentRu = ru;
            }
        }
        return root;
    }

    // ==== Утилиты сериализации ====
    function readSection(section) {
        if (!section) return null;
        let ru = section.querySelector('.vibe-ru-name').value.trim().replace(/\s+$/g, '');
        if (!ru) return null;
        let en = section.querySelector('.vibe-en-name').value;
        let type = section.querySelector('.vibe-type').value;
        let comm = section.querySelector('.vibe-commission').value.trim();
        let att = !!section.querySelector('.vibe-attest')?.checked;
        let children = [];
        let chBlock = section.querySelector('.vibe-section-children');
        if (chBlock) {
            for (let ch of chBlock.querySelectorAll(':scope > .vibe-section')) {
                let chData = readSection(ch);
                if (chData && chData.ru) children.push(chData);
            }
        }
        return {ru, en, type, comm, att, children};
    }
    function readAllSections(container) {
        return Array.from(container.querySelectorAll(':scope > .vibe-section'))
            .map(readSection)
            .filter(x=>!!x&&!!x.ru);
    }
    function clearMainSections(list) {
        Array.from(list.querySelectorAll(':scope > .vibe-section')).forEach(e=>e.remove());
    }
    function appendNodes(nodes, parent, parentRu) {
        nodes.forEach(node=>{
            let sec = createSection(node, parentRu || '');
            parent.appendChild(sec);
            if(node.children && node.children.length){
                appendNodes(node.children, sec.querySelector('.vibe-section-children'), node.ru);
            }
        });
    }

    // ==== Копипаста ====
    function copyTextToClipboard(text) {
        if (window.GM_setClipboard) GM_setClipboard(text);
        else if (navigator.clipboard) navigator.clipboard.writeText(text);
        else {
            let tmp = document.createElement("textarea");
            tmp.value = text;
            document.body.appendChild(tmp); tmp.select();
            document.execCommand("copy"); document.body.removeChild(tmp);
        }
    }

    // ==== вспомогательный поповер подтверждения ====
    let confirmMask = null, confirmPop = null;
    function closeConfirmPopover(){
        if (confirmMask) { confirmMask.remove(); confirmMask = null; }
        if (confirmPop)  { confirmPop.remove();  confirmPop  = null; }
        document.removeEventListener('keydown', onEscClose);
    }
    function onEscClose(e){ if(e.key==='Escape') closeConfirmPopover(); }

    function openConfirmPopover(anchorEl, {title, desc, onOk, onCancel}){
        closeConfirmPopover();

        // маска для клика вне
        confirmMask = document.createElement('div');
        confirmMask.className = 'vibe-confirm-mask';
        confirmMask.addEventListener('mousedown', closeConfirmPopover);
        document.body.appendChild(confirmMask);

        // сам поповер
        confirmPop = document.createElement('div');
        confirmPop.className = 'vibe-confirm-popover';
        confirmPop.innerHTML = `
            <div class="vcp-title">${title || 'Подтверждение'}</div>
            ${desc ? `<div class="vcp-desc">${desc}</div>` : ''}
            <div class="vcp-actions">
                <button type="button" class="vcp-cancel">Отмена</button>
                <button type="button" class="vcp-ok">Да</button>
            </div>
        `;
        document.body.appendChild(confirmPop);

        // позиционирование — стараемся показать над кнопкой; если не влазит, ниже
        const r = anchorEl.getBoundingClientRect();
        const pr = confirmPop.getBoundingClientRect();
        let top = r.top - pr.height - 8 + window.scrollY; // над кнопкой
        if (top < 6 + window.scrollY) top = r.bottom + 8 + window.scrollY; // не влазит — ниже
        let left = r.left + window.scrollX; // по левому краю кнопки
        const maxLeft = window.scrollX + document.documentElement.clientWidth - pr.width - 6;
        if (left > maxLeft) left = Math.max(6 + window.scrollX, maxLeft); // не выходить за правую границу
        if (left < 6 + window.scrollX) left = 6 + window.scrollX;        // и за левую

        confirmPop.style.top = top + 'px';
        confirmPop.style.left = left + 'px';

        const okBtn = confirmPop.querySelector('.vcp-ok');
        const cancelBtn = confirmPop.querySelector('.vcp-cancel');
        okBtn.addEventListener('click', () => {
            closeConfirmPopover();
            try { onOk && onOk(); } catch(e){}
        });
        cancelBtn.addEventListener('click', () => {
            closeConfirmPopover();
            try { onCancel && onCancel(); } catch(e){}
        });

        // ESC
        setTimeout(()=>document.addEventListener('keydown', onEscClose), 0);
    }

    // ==== Основная модалка + сохранение состояния ====
    function debounce(fn, wait){ let t; return function(){ clearTimeout(t); t=setTimeout(fn, wait);} }

    function showModal() {
        if(document.getElementById('vibe-bulk-modal')) return;
        let modal = document.createElement('div');
        modal.id = 'vibe-bulk-modal';
        modal.innerHTML = `
            <button class="vibe-close" tabindex="-1" title="Закрыть">✕</button>
            <div class="vibe-row" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <!-- Кнопка очистки состояния -->
                <button class="vibe-small-btn" type="button" id="vibe-reset-state-btn" title="Очистить состояние (поля, дерево, результаты)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16" style="vertical-align:middle;">
                        <path d="M6.5 1h3a.5.5 0 0 1 .5.5V2h3a.5.5 0 0 1 0 1h-1v9.5A2.5 2.5 0 0 1 9.5 15h-3A2.5 2.5 0 0 1 4 12.5V3H3a.5.5 0 0 1 0-1h3V1.5a.5.5 0 0 1 .5-.5zM5 3v9.5A1.5 1.5 0 0 0 6.5 14h3A1.5 1.5 0 0 0 11 12.5V3z"/>
                        <path d="M7 5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6A.5.5 0 0 1 7 5zm2 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6A.5.5 0 0 1 9 5z"/>
                    </svg>
                </button>
                <!-- Кнопка показать/скрыть вставку путей (иконка) -->
                <button class="vibe-small-btn" type="button" id="vibe-path-paste-btn" title="Показать/скрыть вставку путей" style="margin-left:0;margin-right:2px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-clipboard-plus" viewBox="0 0 16 16" style="vertical-align:middle;">
                        <path fill-rule="evenodd" d="M10.5 8a.5.5 0 0 1-.5.5H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 1 0v1.5H10a.5.5 0 0 1 .5.5"/>
                        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1з"/>
                        <path d="M9.5 1a.5.5 0 0 1 .5.5V2h-4v-.5a.5.5 0 0 1 .5-.5h3z"/>
                    </svg>
                </button>

                <input type="text" id="vibe-parent-path" maxlength="50" autocomplete="off" style="font-size:17px;width:180px;background:#232324;color:#ffe37a;border:1.8px solid #ffe37a88;border-radius:8px;padding:7px 10px;" placeholder="Путь (авто)" />
                <input type="text" id="vibe-parent-id" inputmode="numeric" maxlength="10" autocomplete="off" style="font-size:17px;width:120px;" placeholder="ID" />
                <span id="vibe-parent-title" style="color:#b7ffe7;font-size:18px;margin-left:0;min-width:70px;"></span>
            </div>
            <div id="vibe-path-paste-block" style="display:none;margin-bottom:6px;">
                <textarea id="vibe-path-paste-input-multi" rows="7" placeholder="Вставьте путь(и), например:&#10;Игры > Unreal Deal Pack&#10;Игры > Unreal Deal Pack > Аккаунты&#10;Игры > Unreal Deal Pack > Аккаунты > Steam"></textarea>
                <button class="vibe-small-btn" id="vibe-build-from-paths" style="margin-left:12px;">Построить макет</button>
            </div>
            <div style="overflow-y:auto;max-height:320px;padding-right:4px;" id="vibe-bulk-list"></div>
            <button class="vibe-btn" id="vibe-add-main">＋ Добавить элемент</button>
            <button class="vibe-btn" id="vibe-bulk-create">Создать всё</button>
            <div id="vibe-bulk-status" class="vibe-status"></div>
            <div id="vibe-bulk-result" style="position:relative;min-height:60px;"></div>
        `;
        document.body.appendChild(modal);

        // Закрытие
        modal.querySelector('.vibe-close').onclick = () => {
            modal.remove();
            closeGlobalAC();
            saveHook = () => {};
            closeConfirmPopover();
            let fab = document.getElementById('vibe-bulk-fab');
            if(fab) fab.style.display = 'flex';
        };

        modal.onwheel = e => { if (modal.matches(':hover')) { e.stopPropagation(); } };

        // refs
        const pathInput = modal.querySelector('#vibe-parent-path');
        const parentInput = modal.querySelector('#vibe-parent-id');
        const parentTitle = modal.querySelector('#vibe-parent-title');
        const pathPasteBtn = modal.querySelector('#vibe-path-paste-btn');
        const resetBtn = modal.querySelector('#vibe-reset-state-btn');
        const pathPasteBlock = modal.querySelector('#vibe-path-paste-block');
        const pathPasteInput = modal.querySelector('#vibe-path-paste-input-multi');
        const buildFromPathsBtn = modal.querySelector('#vibe-build-from-paths');
        const mainList = modal.querySelector('#vibe-bulk-list');
        const addMainBtn = modal.querySelector('#vibe-add-main');
        const createBtn = modal.querySelector('#vibe-bulk-create');

        // ===== Сохранение состояния =====
        let lastResultLines = null;

        const saveStateImmediate = () => {
            try {
                const state = {
                    parentId: parentInput.value.trim(),
                    parentPath: pathInput.value.trim(),
                    pathPasteVisible: pathPasteBlock.style.display !== 'none',
                    pathPasteInput: pathPasteInput.value,
                    sections: readAllSections(mainList),
                    results: lastResultLines ? { lines: lastResultLines } : null
                };
                localStorage.setItem(LS_KEY, JSON.stringify(state));
            } catch(e){}
        };
        const saveState = debounce(saveStateImmediate, 300);
        saveHook = saveState;

        // ===== Восстановление состояния =====
        (function restoreState(){
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) {
                mainList.appendChild(createSection({}, ''));
                return;
            }
            let st = null;
            try { st = JSON.parse(raw); } catch(e) { }
            if (!st) { mainList.appendChild(createSection({}, '')); return; }

            if (st.parentPath) pathInput.value = st.parentPath;
            if (st.parentId) parentInput.value = st.parentId.replace(/\D/g,'');
            if (st.pathPasteInput) pathPasteInput.value = st.pathPasteInput;
            pathPasteBlock.style.display = st.pathPasteVisible ? '' : 'none';

            clearMainSections(mainList);
            if (st.sections && st.sections.length) appendNodes(st.sections, mainList, '');
            else mainList.appendChild(createSection({}, ''));

            if (st.results && st.results.lines && st.results.lines.length) {
                renderResultsFromLines(st.results.lines);
                lastResultLines = st.results.lines.slice();
            }
            updateParentTitlePath();
        })();

        // Показ/скрытие блока по кнопке (иконка)
        pathPasteBtn.onclick = function() {
            pathPasteBlock.style.display = (pathPasteBlock.style.display === "none") ? "" : "none";
            saveState();
        };

        // Очистка состояния — теперь через красивый поповер
        resetBtn.onclick = function() {
            openConfirmPopover(resetBtn, {
                title: 'Очистить состояние?',
                desc: 'Будут удалены: путь, ID, дерево и результаты.',
                onOk: () => {
                    localStorage.removeItem(LS_KEY);
                    pathInput.value = '';
                    parentInput.value = '';
                    parentTitle.textContent = '';
                    pathPasteInput.value = '';
                    pathPasteBlock.style.display = 'none';
                    clearMainSections(mainList);
                    mainList.appendChild(createSection({}, ''));
                    const resultBlock = document.getElementById('vibe-bulk-result');
                    if (resultBlock) resultBlock.innerHTML = '';
                    setStatus('Состояние очищено', '#ffde5c');
                    lastResultLines = null;
                    saveStateImmediate();
                },
                onCancel: () => {} // ничего
            });
        };

        // --- Автозаполнение пути по ID
        async function updateParentTitlePath() {
            let id = parentInput.value.replace(/\D/g,'');
            parentInput.value = id;
            pathInput.value = FIXED_PATHS[id] || pathInput.value;
            parentTitle.textContent = '';
            if (id) {
                let res = await findDigisellerCategoryOrSectionById(id);
                parentTitle.textContent = res ? `${res.title} (${res.type})` : '–';
            }
            saveState();
        }
        parentInput.oninput = updateParentTitlePath;
        parentInput.onblur = updateParentTitlePath;

        pathInput.addEventListener('input', saveState);
        pathPasteInput.addEventListener('input', saveState);

        function setStatus(text, color) {
            let el = modal.querySelector('#vibe-bulk-status');
            el.style.color = color || '#ffe37a';
            el.textContent = text;
        }

        function addMainSection(data) {
            mainList.appendChild(createSection(data||{}));
            saveState();
        }
        addMainBtn.onclick = () => addMainSection();

        // Построение структуры по вставленным путям
        buildFromPathsBtn.onclick = function() {
            let val = pathPasteInput.value.trim();
            if (!val) return;
            let lines = val.split('\n').map(l=>l.trim()).filter(l=>l);
            if (!lines.length) return;

            // Автодетект родителя по первой строке
            let firstParts = lines[0].replace(/^\s*>\s*/,'').split(/\s*>\s*/).filter(Boolean);
            if (firstParts.length && FIXED_NAMES_TO_ID[firstParts[0].trim().toLowerCase()]) {
                let pid = FIXED_NAMES_TO_ID[firstParts[0].trim().toLowerCase()];
                parentInput.value = pid;
                pathInput.value = FIXED_PATHS[pid];
                updateParentTitlePath();
                lines = lines.map(line=>{
                    let arr = line.replace(/^\s*>\s*/,'').split(/\s*>\s*/).filter(Boolean);
                    if (arr.length && FIXED_NAMES_TO_ID[arr[0].trim().toLowerCase()]) arr.shift();
                    return arr.join(' > ');
                }).filter(Boolean);
            }

            clearMainSections(mainList);
            const tree = buildTreeFromPaths(lines);
            appendNodes(tree, mainList, '');
            setStatus(`Структура построена из ${lines.length} стр. пути(ей)`, "#b0f99b");
            saveState();
        };

        // --- создание всего дерева
        createBtn.onclick = async function () {
            let parentId = parentInput.value.trim();
            if (!parentId || isNaN(+parentId)) return setStatus("Укажите корректный ID родителя!", "#ff7575");
            let pathPrefix = (pathInput.value || '').trim();
            let items = readAllSections(mainList);
            if (!items.length) return setStatus("Добавьте хотя бы один элемент!", "#ff7575");
            setStatus("Создание...", "#ffe37a");
            createAll(items, parentId, setStatus, pathPrefix ? [pathPrefix] : [], () => {
                showResultInModal(items, pathPrefix ? [pathPrefix] : []);
                setStatus("Всё создано!", "#b0f99b");
                let fab = document.getElementById('vibe-bulk-fab');
                if(fab) fab.style.display='flex';
            });
        };

        // ==== Рендер результатов из LINES (для восстановления) ====
        function renderResultsFromLines(lines){
            const idArr = lines.map(l=>l.id);
            const pathArr = lines.map(l=>l.path);
            let resultHtml = `<div style="font-size:18px;margin-top:10px;margin-bottom:0;"><b>Результаты создания:</b></div>
            <div class="vibe-result-list-block" id="vibe-result-scroll" tabindex="0">` +
            (lines.length ? lines.map(line =>
                `<div style="display:flex;align-items:center;gap:16px;margin-bottom:1px;">
                    <span>${line.icon || '📄'}</span>
                    <span style="flex:1;"><b>${line.path}</b></span>
                    <span class="vibe-result-id" data-id="${line.id}" title="Клик — скопировать ID">${line.id}</span>
                </div>`
            ).join('') : `<div style="color:#ff9999;">Ничего не создано.</div>`) +
            `</div>
            <div class="vibe-copyall-btn-fixed">
                <button class="vibe-copyall-btn" id="vibe-copy-paths">Скопировать пути</button>
                <button class="vibe-copyall-btn" id="vibe-copy-all">Скопировать ID</button>
            </div>`;

            let resultBlock = document.getElementById('vibe-bulk-result');
            resultBlock.innerHTML = resultHtml;

            resultBlock.querySelectorAll('.vibe-result-id').forEach(span => {
                span.onclick = function() {
                    copyTextToClipboard(this.dataset.id);
                    this.classList.add('vibe-copied');
                    this.textContent = '✔ ' + this.dataset.id;
                    setTimeout(() => {
                        this.classList.remove('vibe-copied');
                        this.textContent = this.dataset.id;
                    }, 1100);
                };
            });

            document.getElementById('vibe-copy-all').onclick = function() {
                copyTextToClipboard(idArr.join('\n'));
                this.textContent = "Скопировано!";
                setTimeout(() => this.textContent = "Скопировать ID", 1300);
            };
            document.getElementById('vibe-copy-paths').onclick = function() {
                copyTextToClipboard(pathArr.join('\n'));
                this.textContent = "Скопировано!";
                setTimeout(() => this.textContent = "Скопировать пути", 1300);
            };

            let resultScroll = document.getElementById('vibe-result-scroll');
            resultScroll.addEventListener('wheel', function(e){
                let delta = e.deltaY;
                let atTop = this.scrollTop === 0;
                let atBottom = this.scrollHeight - this.scrollTop === this.clientHeight;
                if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                e.stopPropagation();
            }, { passive: false });
        }

        // ==== Основная логика массового создания ====
        function createAll(items, parentId, setStatus, path=[], cb) {
            let idx = 0;
            function next() {
                if (idx >= items.length) { cb && cb(); return; }
                let el = items[idx++];
                setStatus(`Создаём: ${[...path, el.ru].join(' > ')}...`, "#ffe37a");
                createSingle(el, parentId, (newId, err) => {
                    if (err) {
                        el.id = null; el.error = err; el.children = [];
                        next();
                    } else {
                        el.id = newId; el.error = null;
                        if (el.children && el.children.length) {
                            createAll(el.children, newId, setStatus, [...path, el.ru], next);
                        } else {
                            next();
                        }
                    }
                });
            }
            next();
        }

        // ==== Запрос создания ====
        function createSingle(data, parentId, cb) {
            let formData = [
                `Razdel=${encodeURIComponent(data.ru)}`,
                `Razdel_eng=${encodeURIComponent(data.en)}`,
                `Operation=${encodeURIComponent('добавление раздела')}`,
                `ID_PR=${parentId}`,
                `idprview=${parentId}`,
                `Type_R=${data.type}`
            ];
            if (data.type == '1') {
                formData.push(`Комiss=${encodeURIComponent(data.comm)}`.replace('Комiss','Comiss'));
                formData.push(`CheckAtt=${data.att ? 'yes' : ''}`);
                formData.push(`Description=`);
            }
            GM_xmlhttpRequest({
                method: "POST",
                url: `https://my.digiseller.ru/asp/razdels.asp?idr=${parentId}&idprview=${parentId}`,
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                data: formData.join('&'),
                onload: function (resp) {
                    if (resp.status === 200) {
                        let doc = new DOMParser().parseFromString(resp.responseText, "text/html");
                        let foundId = null;
                        let ruNameNorm = data.ru.replace(/^ |^&nbsp;| /g, '').trim();
                        let allTargets = Array.from(doc.querySelectorAll('a.target'));
                        for (let a of allTargets) {
                            let name = a.textContent.replace(/^ |^&nbsp;| /g, '').trim();
                            if (name === ruNameNorm) {
                                let td = a.closest('td');
                                if (td) {
                                    let smalls = td.querySelectorAll('small');
                                    for (let s of smalls) {
                                        let idText = s.textContent.trim();
                                        if (/^\d+$/.test(idText)) foundId = idText;
                                    }
                                }
                            }
                        }
                        if (!foundId) {
                            let allSmalls = Array.from(doc.querySelectorAll('small[style*="color:silver"]'));
                            for (let s of allSmalls) {
                                let parentTd = s.parentElement;
                                let tdHtml = parentTd.innerHTML;
                                let regexp = new RegExp('</small>(\\s|&nbsp;| )*' + data.ru.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                                if (regexp.test(tdHtml)) {
                                    let idText = s.textContent.trim();
                                    if (/^\d+$/.test(idText)) foundId = idText;
                                }
                            }
                        }
                        if (foundId) cb(foundId, null);
                        else cb(null, "Не найден ID созданного элемента ("+data.ru+").");
                    } else {
                        cb(null, "HTTP " + resp.status);
                    }
                },
                onerror: function () { cb(null, "Ошибка сети/запроса"); }
            });
        }

        // ==== Вывод результата в модалке + сохранение lines ====
        function showResultInModal(results, pathPrefix=[]) {
            let lines = [];
            function walk(items, parentPath=[]) {
                for (let item of items) {
                    if (!item || !item.ru) continue;
                    let icon = item.type === '1' ? '📄' : '📁';
                    let currPath = [...parentPath, item.ru];
                    if (!item.error && item.id) {
                        lines.push({ icon, path: currPath.join(' > '), id: item.id });
                    }
                    if (item.children && item.children.length) walk(item.children, currPath);
                }
            }
            walk(results, pathPrefix);

            renderResultsFromLines(lines);
            lastResultLines = lines.slice();
            saveStateImmediate();
        }
    }

    // ==== Запуск ====
    setTimeout(addFloatingBtn, 700);

})();
