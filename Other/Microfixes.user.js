// ==UserScript==
// @name         Microfixes 
// @namespace    banana-go-operators.icu
// @version      1.0.0
// @description  Скрывает #app-container > header.header (дубликат) и поднимает .floating-progress-container поверх всего.
// @match        https://banana-go-operators.icu/*
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/Other/Microfixes.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/Other/Microfixes.user.js
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // Добавляем стили максимально рано
  GM_addStyle(`
    /* 1) Скрыть именно тот header, который прямой ребёнок #app-container.
       Основной шапке внутри #app-header-placeholder это НЕ повредит. */
    #app-container > header.header {
      display: none !important;
    }

    /* 2) Поднять плавающий прогресс-виджет поверх всего */
    .floating-progress-container {
      z-index: 9999 !important;
    }
  `);

  // Если хочется дополнительно страховаться на страницах с иной разметкой,
  // можно раскомментировать JS-фолбэк:
  /*
  const hideDup = () => {
    document.querySelectorAll('#app-container > header.header').forEach(h =>
      h.style.setProperty('display', 'none', 'important')
    );
  };
  if (document.readyState !== 'loading') hideDup();
  else document.addEventListener('DOMContentLoaded', hideDup, { once: true });
  */
})();
