// ==UserScript==
// @name         DigiSeller: MonkeBubbles
// @namespace    http://tampermonkey.net/
// @version      2.57
// @description  Красивый интерфейс: bubble, лайтбокс, две кнопки поверх [новое сообщение]/[отметить прочитанным] + кнопка-ник продавца (копировать ник или seller_id). Теперь с эффектом нажатия!
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/seller_messages.asp*
// @grant        GM_xmlhttpRequest
// @connect      my.digiseller.ru
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeBubbles
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeBubbles
// ==/UserScript==

(function() {
    'use strict';

    // === CSS для всех кнопок, bubble, никнейма и ЭФФЕКТА НАЖАТИЯ ===
    const vibeCSS = `
.vibe-btn-fake-row {
    display: flex;
    gap: 22px;
    flex-wrap: wrap;
    z-index: 3333;
    position: relative !important;
    top: 0 !important;
    left: 0 !important;
    width: max-content;
    max-width: calc(100vw - 60px);
    pointer-events: none;
    margin: -30px 0 10px 23px !important;
    padding: 0 !important;
}
.vibe-btn-fake {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 178px;
    padding: 10px 32px 10px 28px;
    font-size: 12px;
    font-family: 'Segoe UI', Consolas, Arial, sans-serif;
    border-radius: 9px;
    border: 1.6px solid #bde8bc;
    background: #e6f9ed;
    color: #259960;
    font-weight: 600;
    box-shadow: none;
    outline: none;
    cursor: pointer;
    text-decoration: none !important;
    margin: 0 6px 0 0;
    letter-spacing: .01em;
    user-select: none;
    position: relative;
    z-index: 2;
    pointer-events: auto;
    transition:
        background 0.14s cubic-bezier(.55,.15,.46,1.06),
        border-color 0.14s cubic-bezier(.55,.15,.46,1.06),
        color 0.14s cubic-bezier(.55,.15,.46,1.06),
        box-shadow 0.15s,
        transform 0.08s cubic-bezier(.32,.04,.62,1.48);
}
.vibe-btn-fake:hover, .vibe-btn-fake:focus {
    background: #d5f5e3 !important;
    border-color: #82d29d !important;
    color: #197b48 !important;
    box-shadow: 0 4px 16px #b0eac12a;
}
.vibe-btn-fake:active {
    background: #b6edd2 !important;
    border-color: #5ad48b !important;
    color: #15522f !important;
    transform: scale(0.98);
    box-shadow: 0 1px 7px #c2e5c120;
}

.vibe-btn-fake-black {
    color: #23272b !important;
    background: #eaeef2 !important;
    border: 1.8px solid #7b92a7 !important;
    font-weight: 700;
    box-shadow: 0 2px 7px #b6bbcb19;
    transition:
        background 0.14s cubic-bezier(.55,.15,.46,1.06),
        border-color 0.14s cubic-bezier(.55,.15,.46,1.06),
        color 0.14s cubic-bezier(.55,.15,.46,1.06),
        box-shadow 0.15s,
        transform 0.08s cubic-bezier(.32,.04,.62,1.48);
}
.vibe-btn-fake-black:hover, .vibe-btn-fake-black:focus {
    background: #d5dae3 !important;
    border-color: #657899 !important;
    color: #17191c !important;
    box-shadow: 0 4px 18px #9db2c32a;
}
.vibe-btn-fake-black:active {
    background: #b3bcc9 !important;
    border-color: #50608d !important;
    color: #101115 !important;
    transform: scale(0.98);
    box-shadow: 0 1px 7px #b8c0d520;
}
.vibe-btn-fake[disabled] { opacity:0.55; cursor:not-allowed;}

.vibe-btn-nick {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 116px;
    padding: 10px 18px 10px 18px;
    font-size: 13px;
    font-family: 'Segoe UI', Consolas, Arial, sans-serif;
    border-radius: 9px;
    border: 1.8px solid #ffd98a;
    background: #fff8e1;
    color: #996c15;
    font-weight: 600;
    box-shadow: 0 2px 8px #ffc03a1a;
    outline: none;
    cursor: pointer;
    text-decoration: none !important;
    margin: 0 0 0 3px;
    letter-spacing: .01em;
    user-select: none;
    position: relative;
    z-index: 2;
    pointer-events: auto;
    transition:
        background 0.15s cubic-bezier(.55,.15,.46,1.06),
        border-color 0.15s cubic-bezier(.55,.15,.46,1.06),
        color 0.13s cubic-bezier(.55,.15,.46,1.06),
        box-shadow 0.18s,
        transform 0.08s cubic-bezier(.32,.04,.62,1.48);
}
.vibe-btn-nick:hover, .vibe-btn-nick:focus {
    background: #fff0c7 !important;
    border-color: #fbbf24 !important;
    color: #bf8206 !important;
    box-shadow: 0 4px 18px #fbbf2425;
}
.vibe-btn-nick:active {
    background: #ffeaa7 !important;
    color: #378812 !important;
    border-color: #96e377 !important;
    font-weight: 700 !important;
    transform: scale(0.98);
    box-shadow: 0 1px 7px #e9e49f30;
}
.vibe-btn-nick.copied {
    background: #ffeaa7 !important;
    color: #378812 !important;
    border-color: #96e377 !important;
    font-weight: 700 !important;
    animation: nick-pop 0.32s cubic-bezier(.62,-0.07,.41,1.04);
}
@keyframes nick-pop {
    0% { transform: scale(1.1);}
    60%{ transform: scale(0.98);}
    100%{transform: scale(1);}
}

/* --- Остальные стили bubble/лайтбокс --- */
.vibe-msg-bubble {
    border-radius: 10px;
    box-shadow: none;
    padding: 5px 11px 5px 11px;
    max-width: 77%;
    min-width: 24px;
    word-break: break-word;
    font-size: 12px !important;
    font-family: Verdana, Arial, sans-serif !important;
    line-height: 1.16;
    position: relative;
    margin: 2px 0 2px 0;
    transition: background .17s, color .12s;
    overflow-wrap: break-word;
    border: 1px solid #e0e7ef;
    background: #f8fafd;
    color: #23272b;
}
.vibe-msg-out .vibe-msg-bubble {
    background: #e4fbe4 !important;
    color: #276638 !important;
    border: 1px solid #bde8bc !important;
}
.vibe-msg-in .vibe-msg-bubble {
    background: #f8fafd !important;
    color: #23272b !important;
    border: 1px solid #e0e7ef !important;
}
.vibe-msg-text-meta {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 6px;
    width: 100%;
    min-height: 18px;
}
.vibe-msg-text {
    display: block;
    font-size: 12px !important;
    font-family: Verdana, Arial, sans-serif !important;
    color: inherit;
    line-height: 1.16;
    word-break: break-word;
    margin-right: 0.5em;
    padding-right: 3px;
    flex: 1 1 auto;
}
.vibe-msg-meta {
    display: inline-block;
    background: #e4e8ee;
    color: #8294b6 !important;
    border: none !important;
    border-radius: 9px !important;
    font-size: 12px !important;
    font-family: Verdana, Arial, sans-serif !important;
    font-weight: normal !important;
    padding: 2px 10px 2px 10px !important;
    margin: 0 0 0 6px !important;
    letter-spacing: .02em;
    box-shadow: none !important;
    line-height: 1.16 !important;
    white-space: nowrap;
    opacity: 0.97;
    vertical-align: bottom;
    align-self: flex-end;
}
.vibe-msg-bubble a {
    color: #3697e3 !important;
    border-bottom: 1px dashed #7ecfff;
    text-decoration: none;
    transition: color .13s, border-color .13s;
    word-break: break-all;
}
.vibe-msg-bubble a:hover {
    color: #2258ad !important;
    border-bottom: 1px solid #3697e3;
    text-decoration: underline;
}
.vibe-img-hitbox {
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%,-50%);
    z-index: 2;
    pointer-events: auto;
    cursor: pointer;
    background: transparent;
    border-radius: 14px;
}
.vibe-img-hitbox:active { background: #e8fff560; }
.vibe-img-wrap {
    display: inline-block;
    position: relative;
    margin: 10px 0 6px 0;
    vertical-align: middle;
}
.vibe-msg-bubble img, .vibe-msg-bubble .link img {
    max-width: 468px !important;
    border-radius: 9px !important;
    border: 1px solid #d8e7f5 !important;
    box-shadow: 0 2px 12px #bccbe831;
    background: #f4f7fa;
    display: block;
    height: auto !important;
    width: auto !important;
    cursor: pointer;
    transition: box-shadow .13s, border-color .13s;
    z-index: 1;
}
.vibe-msg-bubble img:hover, .vibe-msg-bubble .link img:hover {
    box-shadow: 0 8px 28px #aac9e3c9;
    border-color: #b7e4ce !important;
}
.vibe-lightbox-overlay {
    position: fixed;
    z-index: 9999;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(32,38,55,0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
    animation: fadein .13s;
    overflow: hidden;
    user-select: none;
}
@keyframes fadein {
    from { opacity: 0; } to { opacity: 1; }
}
.vibe-lightbox-img {
    max-width: 94vw;
    max-height: 92vh;
    box-shadow: 0 6px 36px #222c  !important;
    border-radius: 15px;
    background: #f9fafb;
    border: 2px solid #c2d1e1;
    display: block;
    margin: auto;
    cursor: pointer;
    transition: box-shadow .18s;
    animation: popin .16s cubic-bezier(.42,0,.6,1.08);
    user-select: none;
    will-change: transform;
}
@keyframes popin {
    from { transform: scale(0.95);}
    to   { transform: scale(1);}
}
`;

    if (!document.getElementById('vibe-fakebtn-css')) {
        const style = document.createElement('style');
        style.id = 'vibe-fakebtn-css';
        style.textContent = vibeCSS;
        document.head.appendChild(style);
    }

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
    function getSellerIdFromUrl() {
        const m = window.location.search.match(/[?&]id_s=(\d+)/);
        return m ? m[1] : null;
    }

    function fetchSellerNickname(sellerId) {
        return new Promise((resolve, reject) => {
            if (!sellerId) return reject('seller_id пуст');
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://my.digiseller.ru/asp/seller_info.asp?id_s=${sellerId}`,
                onload: function(response) {
                    if (response.status !== 200) return reject('Ошибка сети');
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');
                    const rows = doc.querySelectorAll('tr');
                    for (let row of rows) {
                        const th = row.querySelector('td.namerow');
                        if (th && /псевдоним/i.test(th.textContent)) {
                            const td = row.querySelector('td.inforow');
                            if (td) {
                                let txt = td.childNodes[0]?.textContent?.trim();
                                if (!txt) txt = td.textContent.trim();
                                // Чистим хвосты, если есть
                                txt = txt.replace(/\u00A0/g, ' ').replace(/\s+$/, '');
                                return resolve(txt);
                            }
                        }
                    }
                    reject('Никнейм не найден');
                },
                onerror: function() {
                    reject('Ошибка запроса');
                }
            });
        });
    }

    function makeNickButton(nick, sellerId) {
        const btn = document.createElement('button');
        btn.className = 'vibe-btn-nick';
        btn.type = 'button';
        btn.textContent = nick;
        btn.title = `Клик: скопировать ник\nCtrl+клик: скопировать seller_id`;

        btn.addEventListener('click', function(e) {
            e.preventDefault();
            let value = e.ctrlKey ? sellerId : nick;
            navigator.clipboard.writeText(value).then(() => {
                const orig = btn.textContent;
                btn.textContent = 'Скопировано!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = orig;
                    btn.classList.remove('copied');
                }, 800);
            });
        });

        return btn;
    }

    // === ВСТАВКА РЯДОМ С КНОПКАМИ ===
    async function drawFakeButtonsRow() {
        const links = Array.from(document.querySelectorAll('a'))
            .filter(a =>
                /новое сообщение/i.test(a.textContent) ||
                /отметить прочитанным/i.test(a.textContent)
            );
        if (links.length < 2) return;

        let parent = links[0].closest('p');
        if (!parent || parent.querySelector('.vibe-btn-fake-row')) return;

        parent.style.position = 'relative';
        links.forEach(a => {
            a.style.opacity = '0';
            a.style.pointerEvents = 'none';
            if (a.parentElement && a.parentElement.tagName === 'FONT') {
                a.parentElement.style.opacity = '0';
                a.parentElement.style.pointerEvents = 'none';
            }
        });

        let row = document.createElement('div');
        row.className = 'vibe-btn-fake-row';
        row.style.position = 'absolute';
        row.style.top = '0';
        row.style.left = '0';
        row.style.width = '100%';
        row.style.pointerEvents = 'none';

        let btn1 = document.createElement('button');
        btn1.type = 'button';
        btn1.className = 'vibe-btn-fake';
        btn1.style.pointerEvents = 'auto';
        btn1.textContent = links.find(a=>/новое сообщение/i.test(a.textContent)).textContent.trim();
        btn1.onclick = (e) => {
            e.preventDefault();
            links.find(a=>/новое сообщение/i.test(a.textContent)).click();
        };

        let btn2 = document.createElement('button');
        btn2.type = 'button';
        btn2.className = 'vibe-btn-fake vibe-btn-fake-black';
        btn2.style.pointerEvents = 'auto';
        btn2.textContent = links.find(a=>/прочитан/i.test(a.textContent)).textContent.trim();
        btn2.onclick = (e) => {
            e.preventDefault();
            links.find(a=>/прочитан/i.test(a.textContent)).click();
        };

        row.appendChild(btn1);
        row.appendChild(btn2);

        // --- КНОПКА-НИКНЕЙМ ---
        const sellerId = getSellerIdFromUrl();
        if (sellerId) {
            const loadingBtn = document.createElement('button');
            loadingBtn.className = 'vibe-btn-nick';
            loadingBtn.textContent = 'Загрузка...';
            loadingBtn.disabled = true;
            row.appendChild(loadingBtn);

            fetchSellerNickname(sellerId).then(nick => {
                const nickBtn = makeNickButton(nick, sellerId);
                row.replaceChild(nickBtn, loadingBtn);
            }).catch(() => {
                loadingBtn.textContent = 'Ошибка ника';
                loadingBtn.disabled = true;
            });
        }

        parent.appendChild(row);
    }

    drawFakeButtonsRow();
    const observer = new MutationObserver(() => drawFakeButtonsRow());
    observer.observe(document.body, { childList: true, subtree: true });

    // --- Оформление сообщений (bubble, lightbox и т.п.) ---
    document.querySelectorAll('tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length !== 3) return;

        const dateTd = tds[0];
        const iconTd = tds[1];
        const msgTd  = tds[2];

        const img = iconTd.querySelector('img');
        if (!img || (!img.src.includes('mail_out') && !img.src.includes('mail_in'))) return;

        let isOut = img.src.includes('mail_out');
        let isIn  = img.src.includes('mail_in');
        const date = dateTd.textContent.replace(/[\n\r]+/g,'').trim();

        let html = msgTd.innerHTML;

        html = html
            .replace(/<div[^>]+class=["']?vibe-msg-bubble["']?[^>]*>[\s\S]*?<\/div>/gi, function(match){
                return match.replace(/<div[^>]+class=["']?vibe-msg-bubble["']?[^>]*>/i, '').replace(/<\/div>$/i, '');
            })
            .replace(/<span[^>]+class=["']?vibe-msg-meta["']?[^>]*>[\s\S]*?<\/span>/gi, '')
            .replace(/<font[^>]*color=['"]?b2b2b2['"]?[^>]*>/gi, '')
            .replace(/<\/font>/gi, '')
            .replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '')
            .replace(/<fieldset[^>]*>/gi, '')
            .replace(/<\/fieldset>/gi, '')
            .replace(/<legend[^>]*>.*?<\/legend>/gi, '')
            .replace(/<table[^>]*>/gi, '')
            .replace(/<\/table>/gi, '')
            .replace(/<tbody[^>]*>/gi, '')
            .replace(/<\/tbody>/gi, '')
            .replace(/<tr[^>]*>/gi, '')
            .replace(/<\/tr>/gi, '')
            .replace(/<td[^>]*>/gi, '')
            .replace(/<\/td>/gi, '')
            .replace(/<div[^>]*class=['"]?main_msg['"]?[^>]*>/gi, '')
            .replace(/<\/div>/gi, '');

        html = html.replace(/<br\s*\/?>/gi, '\n');
        html = html.replace(/<a /g, '<a target="_blank" rel="noopener" ');

        html = html.replace(/<img([^>]+)>/gi, function(_, attrs) {
            let wrap = `<span class="vibe-img-wrap" style="position:relative;display:inline-block;">`;
            let imgTag = `<img${attrs}>`;
            let widthMatch = attrs.match(/max-width\s*:\s*(\d+)px/i);
            let maxWidth = widthMatch ? Number(widthMatch[1]) : 468;
            let hitboxW = Math.round(maxWidth * 1.3);
            let hitbox = `<span class="vibe-img-hitbox" style="width:${hitboxW}px; height:auto; top:50%; left:50%; transform:translate(-50%,-50%);"></span>`;
            return `${wrap}${imgTag}${hitbox}</span>`;
        });

        html = html.replace(/<a ([^>]+)>(https?:\/\/[^<]+)<\/a>/gi, '<a $1 class="link">$2</a>');

        html = html.replace(/^[\n\r]+|[\n\r]+$/g, '');
        let lines = html.split('\n');
        while (lines.length && lines[0].trim() === '') lines.shift();
        while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
        html = lines.map(line => {
            if (line.trim() === '') return '<div style="height:7px"></div>';
            return `<div>${line.trim()}</div>`;
        }).join('');

        html = html.replace(/\[(\d{7,})\]/g, '$1');

        msgTd.innerHTML = `
            <div class="vibe-msg-bubble">
                <div class="vibe-msg-text-meta">
                    <span class="vibe-msg-text">${html}</span>
                    <span class="vibe-msg-meta">${date}</span>
                </div>
            </div>
        `;

        tr.classList.remove('vibe-msg-out','vibe-msg-in');
        if(isOut) tr.classList.add('vibe-msg-out');
        if(isIn)  tr.classList.add('vibe-msg-in');

        dateTd.remove();
        iconTd.remove();
    });

    // --- Лайтбокс ---
    function openLightbox(imgSrc) {
        let oldBox = document.getElementById('vibe-lightbox-overlay');
        if (oldBox) oldBox.remove();

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        let overlay = document.createElement('div');
        overlay.id = 'vibe-lightbox-overlay';
        overlay.className = 'vibe-lightbox-overlay';
        overlay.innerHTML = `<img class="vibe-lightbox-img" src="${imgSrc}" draggable="false">`;

        let img = overlay.querySelector('.vibe-lightbox-img');
        let scale = 1, minScale = 0.18, maxScale = 6;
        let offsetX = 0, offsetY = 0;

        function getImgCenter() {
            const rect = img.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }
        function applyTransform() {
            img.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        }

        overlay.addEventListener('wheel', function(e) {
            if (!img) return;
            const rect = img.getBoundingClientRect();
            const mouseX = e.clientX;
            const mouseY = e.clientY;
            if (
                mouseX < rect.left || mouseX > rect.right ||
                mouseY < rect.top  || mouseY > rect.bottom
            ) return;

            e.preventDefault();

            let prevScale = scale;
            let delta = e.deltaY < 0 ? 1.13 : 0.89;
            let nextScale = Math.max(minScale, Math.min(maxScale, scale * delta));

            if (nextScale > prevScale) {
                let center = getImgCenter();
                let imgX = (mouseX - center.x - offsetX) / scale;
                let imgY = (mouseY - center.y - offsetY) / scale;
                scale = nextScale;
                offsetX -= imgX * (scale - prevScale);
                offsetY -= imgY * (scale - prevScale);
                applyTransform();
            } else if (nextScale < prevScale) {
                if (nextScale <= 1.001) {
                    scale = 1;
                    offsetX = 0;
                    offsetY = 0;
                } else {
                    let center = getImgCenter();
                    let imgX = (center.x - window.innerWidth / 2 - offsetX) / scale;
                    let imgY = (center.y - window.innerHeight / 2 - offsetY) / scale;
                    scale = nextScale;
                    offsetX -= imgX * (scale - prevScale);
                    offsetY -= imgY * (scale - prevScale);
                }
                applyTransform();
            }
        }, {passive: false});

        let dragging = false, dragStartX = 0, dragStartY = 0, startOffsetX = 0, startOffsetY = 0;
        img.addEventListener('mousedown', function(e){
            dragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            startOffsetX = offsetX;
            startOffsetY = offsetY;
            img.style.cursor = 'grabbing';
            e.preventDefault();
        });
        window.addEventListener('mousemove', function(e){
            if (!dragging) return;
            offsetX = startOffsetX + (e.clientX - dragStartX);
            offsetY = startOffsetY + (e.clientY - dragStartY);
            applyTransform();
        });
        window.addEventListener('mouseup', function(){
            if (dragging) img.style.cursor = 'pointer';
            dragging = false;
        });

        img.addEventListener('dblclick', function(e){
            e.preventDefault();
            scale = 1;
            offsetX = 0;
            offsetY = 0;
            applyTransform();
        });

        img.setAttribute('tabindex', 0);
        setTimeout(()=>img.focus(),50);

        overlay.addEventListener('click', e => {
            if (e.target === overlay) {
                overlay.remove();
                document.body.style.overflow = prevOverflow;
            }
        });
        document.addEventListener('keydown', function escClose(evt) {
            if (evt.key === 'Escape') {
                if (overlay.parentNode) overlay.remove();
                document.body.style.overflow = prevOverflow;
                document.removeEventListener('keydown', escClose);
            }
        });

        overlay.addEventListener('wheel', function(e){
            const rect = img.getBoundingClientRect();
            if (
                e.clientX < rect.left || e.clientX > rect.right ||
                e.clientY < rect.top  || e.clientY > rect.bottom
            ) {
                return true;
            }
            e.preventDefault();
        }, {passive: false});
        overlay.addEventListener('touchmove', e => e.preventDefault(), {passive: false});

        document.body.appendChild(overlay);
    }

    // --- Клик по картинке и хитбоксу открывает лайтбокс ---
    function handleBubbleImages() {
        document.querySelectorAll('.vibe-msg-bubble .vibe-img-wrap').forEach(wrap => {
            let img = wrap.querySelector('img');
            let hitbox = wrap.querySelector('.vibe-img-hitbox');
            if (!img || !hitbox) return;
            let handler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                let a = img.closest('a');
                let href = a && a.href ? a.href : img.src;
                if (href.match(/\.(png|jpe?g|gif|webp)$/i) && !href.match(/img_deb\.ashx/i)) {
                    openLightbox(href);
                } else {
                    openLightbox(img.src);
                }
            };
            img.addEventListener('click', handler);
            hitbox.addEventListener('click', handler);
        });

        document.querySelectorAll('.vibe-msg-bubble a').forEach(a => {
            a.addEventListener('click', function(e) {
                if (e.target && (e.target.tagName === 'IMG' || e.target.classList.contains('vibe-img-hitbox'))) {
                    e.preventDefault();
                }
            });
        });

        document.querySelectorAll('.vibe-msg-bubble').forEach(bubble => {
            bubble.addEventListener('click', function(e) {
                if (
                    e.target.tagName === 'IMG' ||
                    e.target.classList.contains('vibe-img-hitbox')
                ) return;
                e.stopPropagation();
            });
        });
    }

    handleBubbleImages();

    const bubbleObserver = new MutationObserver(() => {
        drawFakeButtonsRow();
        handleBubbleImages();
    });
    bubbleObserver.observe(document.body, { childList: true, subtree: true });

})(); // Конец IIFE
