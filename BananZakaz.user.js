// ==UserScript==
// @name         Digiseller: BananZakaz
// @namespace    https://digiseller.ru/
// @version      3.2
// @description  Email, IP, ник, ID товара, номер заказа — жёлтые кнопки. GGsel ID — новая вкладка, Ctrl — копия. Описания и доп. инфа — свёрнуты. Мусор скрыт. Для Хозяина всё и сразу!
// @author       Маленькая обезьянка
// @match        https://my.digiseller.ru/asp/inv_of_buyer.asp*
// @grant        GM_setClipboard
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/BananZakaz.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/BananZakaz.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ---- СТИЛИ ----
    const style = `
    .dm-cb-link, .dm-seller-link, .dm-chat-btn, .dm-goodid-link, .dm-orderid-link {
        color: #222 !important;
        background: #fffbe6;
        border: 1.5px solid #ffe066;
        border-radius: 4px;
        cursor: pointer;
        text-decoration: none;
        transition:
            color 0.17s,
            background 0.17s,
            box-shadow 0.17s,
            border-color 0.17s;
        padding: 2px 6px 2px 6px;
        font-weight: 600;
        font-size: 100%;
        outline: none;
        box-shadow: 0 1px 7px 0 #ffe06622;
        display: inline-block;
        margin-right: 3px;
        user-select: none;
        vertical-align: middle;
    }
    .dm-seller-link { margin-right: 6px; }
    .dm-chat-btn {
        margin-left: 4px;
        margin-right: 0;
        font-weight: 600;
        letter-spacing: 0.02em;
        background: #fffde6;
        border-left: 1px solid #ffe066;
        border-right: 1px solid #ffe066;
    }
    .dm-goodid-link { margin-right: 10px; }
    .dm-orderid-link { margin-right: 10px; }
    .dm-cb-link:hover, .dm-cb-link:focus,
    .dm-seller-link:hover, .dm-seller-link:focus,
    .dm-chat-btn:hover, .dm-chat-btn:focus,
    .dm-goodid-link:hover, .dm-goodid-link:focus,
    .dm-orderid-link:hover, .dm-orderid-link:focus {
        color: #222 !important;
        background: #ffd600;
        border-color: #bfa300;
        text-decoration: none;
        box-shadow: 0 2px 12px 1px #ffe06688;
    }
    .dm-cb-link.dm-copied, .dm-seller-link.dm-copied, .dm-goodid-link.dm-copied, .dm-orderid-link.dm-copied {
        background: #ffe066;
        color: #222 !important;
        border-color: #bfa300;
        box-shadow: 0 0 6px 2px #ffe066aa;
        font-weight: bold;
    }
    .dm-chat-btn:active {
        background: #ffe066;
        color: #222 !important;
        border-color: #bfa300;
    }
    .dm-collapse-btn {
        color: #222 !important;
        background: #fffbe6;
        border: 1.5px solid #ffe066;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        font-size: 100%;
        box-shadow: 0 1px 7px 0 #ffe06622;
        display: inline-block;
        padding: 5px 18px 5px 10px;
        margin: 0 0 10px 0;
        user-select: none;
        transition: background 0.18s, color 0.18s, box-shadow 0.18s;
    }
    .dm-collapse-btn:hover, .dm-collapse-btn:focus {
        color: #222 !important;
        background: #ffd600;
        border-color: #bfa300;
        box-shadow: 0 2px 12px 1px #ffe06688;
        outline: none;
    }
    .dm-collapsed-block {
        display: none !important;
    }
    `;
    const s = document.createElement('style');
    s.textContent = style;
    document.head.appendChild(s);

    // ---- МУСОРНЫЕ ЭЛЕМЕНТЫ ----
    function hideUglyElements() {
        document.querySelectorAll('img[onclick^="copyToClipboard"]').forEach(img => img.style.display = 'none');
        document.querySelectorAll('font[color="#538CA1"]').forEach(font => {
            const link1 = font.querySelector('a[href*="goods_of_buyer.asp?Email="], a[href*="goods_of_buyer.asp?IP="]');
            const link2 = font.querySelector('a[href*="seller_info.asp?ID_S="]');
            if (link1) font.style.display = 'none';
            if (link2) font.closest('small')?.style.setProperty('display', 'none');
        });
    }

    // ---- УТИЛИТЫ ----
    function clearSelection() {
        if (window.getSelection) {
            const sel = window.getSelection();
            if (!sel.isCollapsed) sel.removeAllRanges();
        } else if (document.selection) {
            document.selection.empty();
        }
    }

    // ---- КЛИКАБЕЛЬНЫЙ EMAIL/IP ----
    function makeClickable({ selector, param, isIP = false }) {
        const el = document.querySelector(selector);
        if (!el) return;
        const value = el.textContent.trim();
        if (!value) return;
        if (isIP && el.previousSibling && el.previousSibling.nodeType === 3) {
            const txt = el.previousSibling.textContent;
            if (txt && txt.replace(/\s/g, '').toLowerCase().startsWith('ip:')) {
                el.previousSibling.textContent = '';
            }
        }
        const buttonText = isIP ? `IP: ${value}` : value;
        const a = document.createElement('span');
        a.className = 'dm-cb-link';
        a.textContent = buttonText;
        a.tabIndex = 0;
        a.title = `Открыть страницу покупателя по ${param}\n\nCtrl+клик — скопировать\nAlt+клик — открыть в новой вкладке`;
        let resetTimeout = null;
        function showCopied() {
            clearTimeout(resetTimeout);
            const origText = a.textContent;
            a.textContent = 'Скопировано!';
            a.classList.add('dm-copied');
            resetTimeout = setTimeout(() => {
                a.textContent = origText;
                a.classList.remove('dm-copied');
            }, 950);
        }
        a.addEventListener('click', function (e) {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                clearSelection();
                if (typeof GM_setClipboard === "function") {
                    GM_setClipboard(value);
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(value);
                }
                showCopied();
                return false;
            }
            const url = `https://my.digiseller.ru/asp/goods_of_buyer.asp?${param}=${encodeURIComponent(value)}`;
            if (e.altKey) {
                window.open(url, '_blank');
            } else {
                window.location.href = url;
            }
        }, true);
        a.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                if (e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearSelection();
                    if (typeof GM_setClipboard === "function") {
                        GM_setClipboard(value);
                    } else if (navigator.clipboard) {
                        navigator.clipboard.writeText(value);
                    }
                    showCopied();
                } else {
                    const url = `https://my.digiseller.ru/asp/goods_of_buyer.asp?${param}=${encodeURIComponent(value)}`;
                    window.location.href = url;
                }
            }
        }, true);
        el.parentNode.replaceChild(a, el);
    }

    // ---- ПРОДАВЕЦ (ник + чат) ----
    function enhanceSeller() {
        const tr = Array.from(document.querySelectorAll('tr')).find(tr =>
            tr.querySelector('.namerow') &&
            tr.querySelector('.namerow').textContent.replace(/\s/g, '').toLowerCase().includes('продавец') &&
            tr.querySelector('.inforow')
        );
        if (!tr) return;
        const inforow = tr.querySelector('.inforow');
        if (!inforow) return;
        let sellerNick = '';
        let sellerID = '';
        let nickNode = null;
        for (const node of inforow.childNodes) {
            if (node.nodeType === 3 && node.textContent.trim()) {
                sellerNick = node.textContent.trim();
                nickNode = node;
                break;
            }
        }
        const infoLink = inforow.querySelector('a[href*="seller_info.asp?ID_S="]');
        if (infoLink) {
            const m = infoLink.href.match(/ID_S=(\d+)/i);
            if (m) sellerID = m[1];
        }
        if (!sellerNick || !sellerID || !nickNode) return;
        const sellerSpan = document.createElement('span');
        sellerSpan.className = 'dm-seller-link';
        sellerSpan.textContent = sellerNick;
        sellerSpan.tabIndex = 0;
        sellerSpan.title = `Открыть профиль продавца\n\nCtrl+клик — скопировать ник\nAlt+клик — открыть в новой вкладке`;
        let resetSellerTimeout = null;
        function showSellerCopied() {
            clearTimeout(resetSellerTimeout);
            const origText = sellerSpan.textContent;
            sellerSpan.textContent = 'Скопировано!';
            sellerSpan.classList.add('dm-copied');
            resetSellerTimeout = setTimeout(() => {
                sellerSpan.textContent = origText;
                sellerSpan.classList.remove('dm-copied');
            }, 950);
        }
        sellerSpan.addEventListener('click', function (e) {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                clearSelection();
                if (typeof GM_setClipboard === "function") {
                    GM_setClipboard(sellerNick);
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(sellerNick);
                }
                showSellerCopied();
                return false;
            }
            const url = `https://my.digiseller.ru/asp/seller_info.asp?ID_S=${sellerID}`;
            if (e.altKey) {
                window.open(url, '_blank');
            } else {
                window.location.href = url;
            }
        }, true);
        sellerSpan.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                if (e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearSelection();
                    if (typeof GM_setClipboard === "function") {
                        GM_setClipboard(sellerNick);
                    } else if (navigator.clipboard) {
                        navigator.clipboard.writeText(sellerNick);
                    }
                    showSellerCopied();
                } else {
                    const url = `https://my.digiseller.ru/asp/seller_info.asp?ID_S=${sellerID}`;
                    window.location.href = url;
                }
            }
        }, true);

        const chatBtn = document.createElement('span');
        chatBtn.className = 'dm-chat-btn';
        chatBtn.textContent = 'Переписка';
        chatBtn.tabIndex = 0;
        chatBtn.title = 'Открыть переписку с продавцом\nAlt+клик — новая вкладка';
        chatBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const url = `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${sellerID}`;
            if (e.altKey) {
                window.open(url, '_blank');
            } else {
                window.location.href = url;
            }
        }, true);
        chatBtn.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                const url = `https://my.digiseller.ru/asp/seller_messages.asp?id_s=${sellerID}`;
                window.location.href = url;
            }
        }, true);

        inforow.replaceChild(sellerSpan, nickNode);
        sellerSpan.insertAdjacentElement('afterend', chatBtn);
    }

    // ---- GGSEL ID ----
    function enhanceGoodID() {
        const tr = Array.from(document.querySelectorAll('tr')).find(tr =>
            tr.querySelector('.namerow') &&
            tr.querySelector('.namerow').textContent.replace(/\s/g, '').toLowerCase().includes('товар') &&
            tr.querySelector('.inforow')
        );
        if (!tr) return;
        const inforow = tr.querySelector('.inforow');
        if (!inforow) return;
        let goodID = '';
        let goodNode = null;
        for (const node of inforow.childNodes) {
            if (node.nodeType === 3 && node.textContent.trim()) {
                const m = node.textContent.trim().match(/^(\d+):/);
                if (m) {
                    goodID = m[1];
                    goodNode = node;
                    break;
                }
            }
        }
        if (!goodID || !goodNode) return;
        const idBtn = document.createElement('span');
        idBtn.className = 'dm-goodid-link';
        idBtn.textContent = goodID;
        idBtn.tabIndex = 0;
        idBtn.title = `Открыть страницу товара на GGsel.net\n\nCtrl+клик — скопировать ID\nОбычный клик — открыть в новой вкладке`;
        let resetIDTimeout = null;
        function showIDCopied() {
            clearTimeout(resetIDTimeout);
            const origText = idBtn.textContent;
            idBtn.textContent = 'Скопировано!';
            idBtn.classList.add('dm-copied');
            resetIDTimeout = setTimeout(() => {
                idBtn.textContent = origText;
                idBtn.classList.remove('dm-copied');
            }, 950);
        }
        idBtn.addEventListener('click', function (e) {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                clearSelection();
                if (typeof GM_setClipboard === "function") {
                    GM_setClipboard(goodID);
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(goodID);
                }
                showIDCopied();
                return false;
            }
            const url = `https://ggsel.net/catalog/product/${goodID}`;
            window.open(url, '_blank');
        }, true);
        idBtn.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                if (e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearSelection();
                    if (typeof GM_setClipboard === "function") {
                        GM_setClipboard(goodID);
                    } else if (navigator.clipboard) {
                        navigator.clipboard.writeText(goodID);
                    }
                    showIDCopied();
                } else {
                    const url = `https://ggsel.net/catalog/product/${goodID}`;
                    window.open(url, '_blank');
                }
            }
        }, true);
        goodNode.textContent = goodNode.textContent.replace(goodID + ':', '');
        inforow.insertBefore(idBtn, inforow.firstChild);
    }

    // ---- НОМЕР ЗАКАЗА ----
    function enhanceOrderID() {
        const tr = Array.from(document.querySelectorAll('tr')).find(tr =>
            tr.querySelector('.namerow') &&
            tr.querySelector('.namerow').textContent.replace(/\s/g, '').toLowerCase().includes('заказ№') &&
            tr.querySelector('.inforow')
        );
        if (!tr) return;
        const inforow = tr.querySelector('.inforow');
        if (!inforow) return;
        const orderID = inforow.textContent.trim();
        if (!/^\d+$/.test(orderID)) return;
        const orderBtn = document.createElement('span');
        orderBtn.className = 'dm-orderid-link';
        orderBtn.textContent = orderID;
        orderBtn.tabIndex = 0;
        orderBtn.title = 'Скопировать номер заказа';
        let resetOrderTimeout = null;
        function showOrderCopied() {
            clearTimeout(resetOrderTimeout);
            const origText = orderBtn.textContent;
            orderBtn.textContent = 'Скопировано!';
            orderBtn.classList.add('dm-copied');
            resetOrderTimeout = setTimeout(() => {
                orderBtn.textContent = origText;
                orderBtn.classList.remove('dm-copied');
            }, 950);
        }
        function copyOrderID() {
            if (typeof GM_setClipboard === "function") {
                GM_setClipboard(orderID);
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(orderID);
            }
            showOrderCopied();
        }
        orderBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            copyOrderID();
            return false;
        }, true);
        orderBtn.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                copyOrderID();
            }
        }, true);
        inforow.textContent = '';
        inforow.appendChild(orderBtn);
    }

    // ---- СВОРАЧИВАНИЕ ОПИСАНИЙ, "ПОСЛЕ ПОКУПКИ" и ДОП.ИНФЫ ----
    function collapseLongBlocks() {
        // Массив паттернов, что надо сворачивать (ОПИСАНИЕ, ПОСЛЕ ПОКУПКИ, ДОП.ИНФОРМАЦИЯ)
        const collapsePatterns = [
            /ОПИСАНИЕТОВАРА/,
            /ПОСЛЕПОКУПКИ/,
            /ДОП(\.|ОЛНИТЕЛЬНАЯ)?\s*ИНФ(ОРМАЦИЯ)?/i, // Доп. информация, Доп.информация, Дополнительная информация
            /INFORMATION|INFO/i                       // info, information
        ];

        document.querySelectorAll('tr').forEach(tr => {
            const nameCell = tr.querySelector('.namerow');
            const infoCell = tr.querySelector('.inforow');
            if (!nameCell || !infoCell) return;

            const label = nameCell.textContent.replace(/\s/g, '').toUpperCase();

            // Проверяем по всем паттернам
            if (!collapsePatterns.some(re => re.test(label))) return;
            if (infoCell.dataset.dmCollapseApplied) return;
            infoCell.dataset.dmCollapseApplied = '1';

            // Оригинальный HTML блока
            const original = infoCell.innerHTML;
            const btn = document.createElement('span');
            btn.className = 'dm-collapse-btn';
            btn.textContent = '🛍️ Показать подробности...';
            btn.style.marginBottom = '8px';
            const block = document.createElement('div');
            block.className = 'dm-collapsed-block';
            block.innerHTML = original;
            btn.addEventListener('click', function () {
                if (block.classList.contains('dm-collapsed-block')) {
                    block.classList.remove('dm-collapsed-block');
                    btn.textContent = '🛍️ Скрыть подробности';
                } else {
                    block.classList.add('dm-collapsed-block');
                    btn.textContent = '🛍️ Показать подробности...';
                }
            });
            infoCell.innerHTML = '';
            infoCell.appendChild(btn);
            infoCell.appendChild(block);
        });
    }

    // --- Запуск всего ---
    makeClickable({ selector: '#order_info a[href^="mailto:"]' });
    makeClickable({ selector: '#email_id', param: 'Email' });
    makeClickable({ selector: '.inforow #email_id', param: 'Email' });
    makeClickable({ selector: '#ip_id', param: 'IP', isIP: true });
    makeClickable({ selector: '.inforow #ip_id', param: 'IP', isIP: true });
    enhanceSeller();
    enhanceGoodID();
    enhanceOrderID();
    collapseLongBlocks();
    hideUglyElements();
    setTimeout(() => {
        hideUglyElements();
        collapseLongBlocks();
    }, 500);
})();
