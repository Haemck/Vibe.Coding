// ==UserScript==
// @name         Digiseller: Кнопка Проблемы
// @namespace    https://digiseller.ru/
// @version      2.8
// @description  Кнопка "Проблема" c защитой, надпись "Отправляем...", возвращение к компактной кнопке при отправке и после, красный стиль.
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/inv_of_buyer.asp*
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ProblemButton.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ProblemButton.user.js
// ==/UserScript==

(function() {
    'use strict';

    const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycby9faXrrhwzFRxGO3TdL-v6KCNI8pfZjCPZ8tl5r9jh0d4NqHbJmXXj6saUnqydz01j/exec';
    const LS_KEY = 'bananza_operator_name';

    // --- Стили ---
    const style = `
    .dm-floating-export-wrap {
        position: absolute;
        z-index: 9999;
        display: flex;
        align-items: center;
        top: 0;
        left: 0;
        pointer-events: none;
    }
    .dm-floating-export-inner {
        pointer-events: auto;
        display: flex;
        align-items: center;
        min-width: 0;
    }
    .dm-cb-link.dm-export-btn-morph {
        background: #fff4f4;
        border: 1.5px solid #ffb8b8;
        border-radius: 7px;
        cursor: pointer;
        transition:
            background 0.16s,
            box-shadow 0.16s,
            border-color 0.16s,
            width 0.30s cubic-bezier(.57,1.69,.6,.93);
        font-weight: 600;
        font-size: 15px;
        color: #1a1a1a !important;
        outline: none;
        box-shadow: 0 1px 7px 0 #ffb8b833;
        margin-left: 6px;
        user-select: none;
        display: flex;
        align-items: center;
        padding: 4px 7px 4px 10px;
        min-width: 38px;
        width: auto;
        text-align: left;
        white-space: nowrap;
        gap: 7px;
        border-radius: 7px;
        overflow: visible;
    }
    .dm-cb-link.dm-export-btn-morph.expanded {
        min-width: 340px;
        width: 390px;
        max-width: 750px;
        background: #fff4f4;
        box-shadow: 0 2px 12px 1px #ffb8b844;
    }
    .dm-cb-link.dm-export-btn-morph.has-operator {
        width: 570px !important;
        transition: width 0.36s cubic-bezier(.57,1.69,.6,.93);
    }
    .dm-cb-link.dm-export-btn-morph.dm-copied {
        background: #ffb8b8;
        color: #1a1a1a !important;
        border-color: #a85a5a;
        box-shadow: 0 0 6px 2px #ffb8b888;
        font-weight: bold;
    }
    .dm-export-comment-morph {
        font-size: 15px;
        padding: 2px 8px;
        border: 1.5px solid #ffb8b8;
        border-radius: 4px;
        outline: none;
        background: #fff8f8;
        color: #222;
        font-family: inherit;
        transition: box-shadow 0.14s, width 0.22s cubic-bezier(.61,1.69,.6,.93);
        min-width: 80px;
        max-width: 450px;
        width: 110px;
        resize: none;
        margin: 0;
        box-sizing: border-box;
        line-height: 1.4;
        display: block;
        flex: 1 1 110px;
    }
    .dm-export-comment-morph:focus {
        box-shadow: 0 1px 7px 0 #ffb8b866;
    }
    .dm-export-send-btn-morph {
        background: #fff4f4;
        border: 1.5px solid #ffb8b8;
        border-radius: 4px;
        color: #222 !important;
        font-size: 17px;
        font-weight: 700;
        padding: 2px 14px;
        cursor: pointer;
        margin: 0;
        height: 32px;
        transition: background 0.12s, border-color 0.12s;
        box-shadow: 0 1px 7px 0 #ffb8b833;
        outline: none;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .dm-export-send-btn-morph:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
    .dm-export-send-btn-morph:hover, .dm-export-send-btn-morph:focus {
        background: #ffb8b8;
        border-color: #a85a5a;
        color: #222 !important;
    }
    .dm-export-operator-btn {
        background: #fff4f4;
        border: 1.5px solid #ffb8b8;
        border-radius: 4px;
        color: #ba6fb0;
        font-size: 18px;
        font-weight: 600;
        padding: 2px 6px 2px 6px;
        cursor: pointer;
        margin-left: 7px;
        margin-right: 0;
        height: 32px;
        min-width: 27px;
        box-shadow: none;
        outline: none;
        display: flex;
        align-items: center;
        opacity: 0.34;
        transition: background 0.10s, border-color 0.10s, color 0.15s, opacity 0.15s;
    }
    .dm-export-operator-btn.selected,
    .dm-export-operator-btn:focus,
    .dm-export-operator-btn:hover {
        background: #fff4f4;
        border-color: #a85a5a;
        color: #ce83b8;
        opacity: 1;
    }
    .dm-export-operator-field {
        font-size: 15px;
        margin-left: 7px;
        width: 170px;
        padding: 2px 12px;
        border: 1.5px solid #ffb8b8;
        border-radius: 4px;
        background: #fff8f8;
        color: #4a3841;
        outline: none;
        transition: box-shadow 0.13s;
        flex: none;
        display: block;
    }
    .dm-export-operator-field:focus {
        box-shadow: 0 1px 7px 0 #ffb8b888;
    }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), {textContent: style}));

    function getToday() {
        const d = new Date();
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        return `${d.getFullYear()}/${mm}/${dd}`;
    }

    function getSellerAndOrder() {
        let rows = document.querySelectorAll('tr');
        let seller = '', order = '';
        rows.forEach(tr => {
            let label = tr.querySelector('.namerow');
            let value = tr.querySelector('.inforow');
            if (!label || !value) return;
            if (label.innerText.includes('ПРОДАВЕЦ')) {
                let span = value.querySelector('.dm-seller-link');
                if (span) seller = span.textContent.trim();
                else seller = value.textContent.replace(/\[\s*подробнее\s*\]/i, '').trim();
            }
            if (label.innerText.replace(/\s/g,'').includes('ЗАКАЗ№')) {
                order = value.textContent.trim();
            }
        });
        return { seller, order };
    }

    function getOperator() {
        return localStorage.getItem(LS_KEY) || '';
    }
    function setOperator(val) {
        localStorage.setItem(LS_KEY, val);
    }

    let sending = false;

    function resetToButton(morphBtn, text) {
        morphBtn.innerHTML = text;
        morphBtn.classList.remove('dm-copied', 'expanded', 'has-operator');
        morphBtn.disabled = false;
        morphBtn.style.width = '';
        sending = false;
    }

    function sendToSheet(order, today, seller, comment, operator, morphBtn) {
        sending = true;
        morphBtn.classList.remove('expanded', 'has-operator', 'dm-copied');
        morphBtn.style.width = '';
        morphBtn.innerHTML = 'Отправляем...';
        morphBtn.disabled = true;
        GM_xmlhttpRequest({
            method: "POST",
            url: WEBHOOK_URL,
            headers: {"Content-Type": "application/json"},
            data: JSON.stringify({
                row: [order, today, seller, '', comment, operator]
            }),
            onload: function(response) {
                morphBtn.disabled = false;
                if (response.status === 200 && response.responseText.includes('OK')) {
                    resetToButton(morphBtn, 'Готово!');
                } else {
                    resetToButton(morphBtn, 'Ошибка!');
                }
                setTimeout(() => {
                    resetToButton(morphBtn, 'Проблема');
                }, 1100);
            },
            onerror: function() {
                morphBtn.disabled = false;
                resetToButton(morphBtn, 'Ошибка!');
                setTimeout(() => {
                    resetToButton(morphBtn, 'Проблема');
                }, 1100);
            }
        });
    }

    function autosizeInput(input, max) {
        const testSpan = document.createElement('span');
        testSpan.style.position = 'absolute';
        testSpan.style.left = '-9999px';
        testSpan.style.visibility = 'hidden';
        testSpan.style.font = getComputedStyle(input).font;
        testSpan.style.fontSize = getComputedStyle(input).fontSize;
        testSpan.style.fontWeight = getComputedStyle(input).fontWeight;
        testSpan.style.letterSpacing = getComputedStyle(input).letterSpacing;
        document.body.appendChild(testSpan);

        function resize() {
            testSpan.textContent = input.value || input.placeholder || '';
            let newWidth = Math.min(testSpan.offsetWidth + 28, max);
            input.style.width = Math.max(110, newWidth) + 'px';
        }
        input.addEventListener('input', resize);
        input.addEventListener('focus', resize);
        input.addEventListener('blur', resize);
        setTimeout(resize, 12);
        return () => document.body.removeChild(testSpan);
    }

    function createMorphButton() {
        const morphBtn = document.createElement('button');
        morphBtn.className = 'dm-cb-link dm-export-btn-morph';
        morphBtn.type = 'button';
        morphBtn.innerHTML = 'Проблема';
        morphBtn.tabIndex = 0;
        morphBtn.title = 'Сообщить о проблеме (отправит данные в таблицу)';

        let expanded = false;
        let operatorFieldVisible = false;
        let opInput = null;
        let cleanupAutosize = null;

        morphBtn.addEventListener('click', function(e) {
            if (sending) return;
            if (expanded) return;
            expanded = true;
            morphBtn.classList.add('expanded');
            morphBtn.style.width = '390px';
            morphBtn.innerHTML = '';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Комментарий...';
            input.className = 'dm-export-comment-morph';
            input.maxLength = 150;

            cleanupAutosize = autosizeInput(input, 450);

            const sendBtn = document.createElement('button');
            sendBtn.type = 'button';
            sendBtn.className = 'dm-export-send-btn-morph';
            sendBtn.textContent = '▶';

            const operatorBtn = document.createElement('button');
            operatorBtn.type = 'button';
            operatorBtn.className = 'dm-export-operator-btn';
            operatorBtn.innerHTML = '👤';
            operatorBtn.tabIndex = 0;
            operatorBtn.title = 'Показать/скрыть поле "Оператор"';

            let operatorVal = getOperator();

            function toggleOperatorField() {
                if (!operatorFieldVisible) {
                    morphBtn.classList.add('has-operator');
                    morphBtn.style.width = '570px';
                    operatorBtn.classList.add('selected');
                    if (!opInput) {
                        opInput = document.createElement('input');
                        opInput.type = 'text';
                        opInput.placeholder = 'Оператор...';
                        opInput.className = 'dm-export-operator-field';
                        opInput.maxLength = 40;
                        opInput.value = operatorVal;
                        opInput.addEventListener('input', function() {
                            setOperator(opInput.value.trim());
                        });
                        opInput.addEventListener('keydown', function(e) {
                            if (e.key === 'Enter') {
                                setOperator(opInput.value.trim());
                                e.preventDefault();
                                opInput.classList.add('dm-copied');
                                setTimeout(()=>opInput.classList.remove('dm-copied'),450);
                            }
                            if (e.key === 'Escape') {
                                operatorFieldVisible = false;
                                morphBtn.classList.remove('has-operator');
                                morphBtn.style.width = '390px';
                                operatorBtn.classList.remove('selected');
                                if (opInput) opInput.remove();
                                opInput = null;
                            }
                        });
                        opInput.addEventListener('blur', function() {
                            setOperator(opInput.value.trim());
                        });
                    }
                    morphBtn.appendChild(opInput);
                    opInput.focus();
                    operatorFieldVisible = true;
                } else {
                    morphBtn.classList.remove('has-operator');
                    morphBtn.style.width = '390px';
                    operatorBtn.classList.remove('selected');
                    if (opInput) opInput.remove();
                    opInput = null;
                    operatorFieldVisible = false;
                }
            }

            operatorBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleOperatorField();
            });

            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    if (sending) return;
                    expanded = false;
                    morphBtn.blur();
                    if (cleanupAutosize) cleanupAutosize();
                    const { seller, order } = getSellerAndOrder();
                    const comment = input.value.trim();
                    let operator = opInput ? opInput.value.trim() : getOperator();
                    const today = getToday();
                    if (!seller || !order) {
                        resetToButton(morphBtn, 'Не найдено!');
                        setTimeout(() => {
                            resetToButton(morphBtn, 'Проблема');
                        }, 1300);
                        return;
                    }
                    setOperator(operator || '');
                    sendToSheet(order, today, seller, comment, operator, morphBtn);
                }
                if (e.key === 'Escape') {
                    expanded = false;
                    if (cleanupAutosize) cleanupAutosize();
                    resetToButton(morphBtn, 'Проблема');
                }
            });

            sendBtn.addEventListener('click', function(e) {
                if (sending) return;
                expanded = false;
                morphBtn.blur();
                if (cleanupAutosize) cleanupAutosize();
                const { seller, order } = getSellerAndOrder();
                const comment = input.value.trim();
                let operator = opInput ? opInput.value.trim() : getOperator();
                const today = getToday();
                if (!seller || !order) {
                    resetToButton(morphBtn, 'Не найдено!');
                    setTimeout(() => {
                        resetToButton(morphBtn, 'Проблема');
                    }, 1300);
                    return;
                }
                setOperator(operator || '');
                sendToSheet(order, today, seller, comment, operator, morphBtn);
            });

            input.addEventListener('blur', function() {
                setTimeout(() => {
                    if (
                        document.activeElement !== sendBtn &&
                        (!opInput || document.activeElement !== opInput) &&
                        document.activeElement !== operatorBtn
                        && expanded && !sending
                    ) {
                        expanded = false;
                        if (cleanupAutosize) cleanupAutosize();
                        resetToButton(morphBtn, 'Проблема');
                    }
                }, 150);
            });

            document.addEventListener('mousedown', function docListener(evt) {
                if (!morphBtn.contains(evt.target) && expanded && !sending) {
                    expanded = false;
                    if (cleanupAutosize) cleanupAutosize();
                    resetToButton(morphBtn, 'Проблема');
                    document.removeEventListener('mousedown', docListener);
                }
            });

            setTimeout(() => input.focus(), 80);

            morphBtn.appendChild(input);
            morphBtn.appendChild(sendBtn);
            morphBtn.appendChild(operatorBtn);
        });

        return morphBtn;
    }

    function insertFloatingButton() {
        const backSmall = Array.from(document.querySelectorAll('small font[color="#538CA1"]')).find(font => {
            const a = font.querySelector('a.targettree');
            return a && /назад/i.test(a.textContent);
        });
        if (!backSmall || document.querySelector('.dm-floating-export-wrap')) return;

        const rect = backSmall.getBoundingClientRect();
        const wrap = document.createElement('div');
        wrap.className = 'dm-floating-export-wrap';
        wrap.style.left = (window.scrollX + rect.right + 8) + 'px';
        wrap.style.top = (window.scrollY + rect.top - 3) + 'px';
        wrap.style.height = (rect.height + 2) + 'px';

        const inner = document.createElement('div');
        inner.className = 'dm-floating-export-inner';
        inner.appendChild(createMorphButton());
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        function updatePosition() {
            const rect = backSmall.getBoundingClientRect();
            wrap.style.left = (window.scrollX + rect.right + 8) + 'px';
            wrap.style.top = (window.scrollY + rect.top - 3) + 'px';
        }
        window.addEventListener('scroll', updatePosition);
        window.addEventListener('resize', updatePosition);
    }

    function tryInsert() {
        insertFloatingButton();
        if (!document.querySelector('.dm-floating-export-wrap')) setTimeout(insertFloatingButton, 1000);
    }
    window.addEventListener('DOMContentLoaded', tryInsert);
    setTimeout(tryInsert, 1200);
})();
