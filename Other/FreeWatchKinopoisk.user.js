// ==UserScript==
// @name         Kinopoisk: Смотреть бесплатно (sspoisk, anti-flicker)
// @namespace    https://kinopoisk.ru/
// @version      1.5
// @description  Кнопка "Смотреть бесплатно": sspoisk.ru + идеальный градиент без миганий
// @author       vibe
// @match        https://www.kinopoisk.ru/*
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/Other/FreeWatchKinopoisk.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/Other/FreeWatchKinopoisk.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Цвета
    const kpOrange = "#ff6600";
    const kpOrange2 = "#ffb300";
    const kpWhite = "#fff";
    const kpShadow = "0 2px 16px 0 rgba(255,102,0,0.24)";

    // Чистый transition + ::before-градиент overlay (решает flicker)
    GM_addStyle(`
    #sspoisk-btn {
        position: fixed;
        right: 32px;
        bottom: 32px;
        z-index: 99999;
        background: ${kpOrange};
        color: ${kpWhite};
        border: none;
        border-radius: 14px;
        font-size: 18px;
        font-weight: 600;
        padding: 18px 36px;
        box-shadow: ${kpShadow};
        cursor: pointer;
        outline: none;
        user-select: none;
        overflow: hidden;
        transition:
            box-shadow 0.35s cubic-bezier(.4,0,.2,1);
        /* НЕ используем transition для background! */
        /* Слой-оверлей всё делает плавно */
    }
    #sspoisk-btn::before {
        content: '';
        position: absolute;
        left: 0; top: 0; right: 0; bottom: 0;
        border-radius: 14px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.36s cubic-bezier(.4,0,.2,1);
        background: linear-gradient(90deg, ${kpOrange} 0%, ${kpOrange2} 100%);
        z-index: 1;
    }
    #sspoisk-btn:hover::before, #sspoisk-btn:focus-visible::before {
        opacity: 1;
    }
    #sspoisk-btn span {
        position: relative;
        z-index: 2;
        pointer-events: none;
    }
    #sspoisk-btn:hover, #sspoisk-btn:focus-visible {
        box-shadow: 0 4px 28px 0 rgba(255,102,0,0.44);
    }
    `);

    if (!document.getElementById('sspoisk-btn')) {
        const btn = document.createElement('button');
        btn.id = "sspoisk-btn";
        btn.type = "button";
        btn.innerHTML = `<span>Смотреть бесплатно</span>`;

        btn.addEventListener('click', function() {
            let oldUrl = window.location.href;
            let newUrl = oldUrl.replace('kinopoisk.ru', 'sspoisk.ru');
            window.location.href = newUrl;
        });

        document.body.appendChild(btn);
    }
})();
