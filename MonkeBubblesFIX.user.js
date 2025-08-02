// ==UserScript==
// @name         MonkeBubblesFIX
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Фикс кнопки "удалить"
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/seller_messages.asp*
// @grant        GM_xmlhttpRequest
// @connect      my.digiseller.ru
// @run-at       document-idle
// @updateURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeBubblesFIX.user.js
// @downloadURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeBubblesFIX.user.js
// ==/UserScript==

(function () {
    'use strict';

    function init() {
        const links = document.querySelectorAll('a.target[href*="id_s="][href*="del="]');
        if (links.length === 0) return setTimeout(init, 500);

        links.forEach(link => {
            const href = link.getAttribute('href');
            const fullUrl = location.origin + location.pathname + href;

            const metaBlock = link.closest('.vibe-msg-out')?.querySelector('.vibe-msg-meta');
            if (!metaBlock) return;

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

            link.remove();
            metaBlock.prepend(spanBtn);
        });
    }

    const style = document.createElement('style');
    style.textContent = `
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
    `;
    document.head.appendChild(style);

    window.addEventListener('load', init);
})();
