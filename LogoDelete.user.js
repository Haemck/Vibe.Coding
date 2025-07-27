// ==UserScript==
// @name         Удаление логотипа Digiseller
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Удаляет шапку с логотипом Digiseller до прогрузки DOM
// @author       Вайбкодинг
// @match        https://my.digiseller.ru/*
// @run-at       document-start
// @grant        none
// @updateURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/LogoDelete.user.js
// @downloadURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/LogoDelete.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Целевая проверка: удаляем таблицу с логотипом
    const tryRemove = () => {
        const tables = document.getElementsByTagName('table');
        for (let table of tables) {
            if (table.innerHTML.includes('img/digi_logo.gif')) {
                table.remove();
                observer.disconnect();
                break;
            }
        }
    };

    // Запускаем удаление при мутации (ещё до полной загрузки DOM)
    const observer = new MutationObserver(tryRemove);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
