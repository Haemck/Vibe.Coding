// ==UserScript==
// @name         DigiSeller: MonkeChatting
// @namespace    http://tampermonkey.net/
// @version      3.6.9
// @description  Bubbles, лайтбокс (зум), верхние кнопки, ник (копировать ник/Ctrl+seller_id), мягкое «удалить», поиск. Справа — панель: статус (только значение), по центру холд (пустой=7), под ним онлайн; слева снизу — рейтинг. Надёжный ОДНОКРАТНЫЙ скролл к сообщению из поиска. SPA/ajax-совместимо.
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/seller_messages.asp*
// @grant        GM_xmlhttpRequest
// @connect      my.digiseller.ru
// @run-at       document-end
// @updateURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeChatting.user.js
// @downloadURL https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeChatting.user.js
// ==/UserScript==

(function(){
  'use strict';

  const ROW_ID='vibe-btn-fake-row';
  const COMMENT_ID='vibe-comment-panel';
  const ONLINE_ID='vibe-online-pill'; // старый бейдж (убираем)

  // Глобальное состояние
  const ST={
    initedOnce:false,
    lastUrl:location.href,
    lastMutationRun:0,
    infoCache:{},
    hashScrolledRaw:null // <- чтобы скроллить по hash ровно один раз
  };

  // ---------- CSS ----------
  const css=`
/* строка фейк-кнопок */
#${ROW_ID}{
  display:flex; gap:22px; flex-wrap:wrap; z-index:4999; position:relative!important;
  width:max-content; max-width:calc(100vw - 60px); pointer-events:none;
  margin:-30px 0 10px 23px!important;
}
.vibe-btn-fake{ display:inline-flex; align-items:center; justify-content:center; min-width:178px; padding:10px 28px;
  font-size:12px; font-family:'Segoe UI',Consolas,Arial,sans-serif; border-radius:9px; border:1.6px solid #bde8bc; background:#e6f9ed; color:#259960; font-weight:600;
  cursor:pointer; margin:0 6px 0 0; user-select:none; pointer-events:auto; transition:background .14s, border-color .14s, color .14s, transform .08s; }
.vibe-btn-fake:hover{ background:#d5f5e3!important; border-color:#82d29d!important; color:#197b48!important; }
.vibe-btn-fake:active{ transform:scale(.98); background:#b6edd2!important; border-color:#5ad48b!important; }
.vibe-btn-fake-black{ color:#23272b!important; background:#eaeef2!important; border:1.8px solid #7b92a7!important; font-weight:700; }
.vibe-btn-fake-black:hover{ background:#d5dae3!important; border-color:#657899!important; }

/* ник продавца (копирование) */
.vibe-btn-nick{ display:inline-flex; align-items:center; justify-content:center; min-width:116px; padding:10px 18px; font-size:13px;
  font-family:'Segoe UI',Consolas,Arial,sans-serif; border-radius:9px; border:1.8px solid #ffd98a; background:#fff8e1; color:#996c15; font-weight:600;
  margin:0 0 0 3px; user-select:none; pointer-events:auto; transition:background .15s,border-color .15s,color .13s,transform .08s; }
.vibe-btn-nick:hover{ background:#fff0c7!important; border-color:#fbbf24!important; color:#bf8206!important; }
.vibe-btn-nick.copied{ background:#ffeaa7!important; border-color:#96e377!important; color:#378812!important; }

/* поиск */
#vibe-searchbox-wrap{ display:inline-flex; align-items:center; pointer-events:auto; position:relative; }
#vibe-search-input{ height:36px; padding:0 14px; min-width:230px;
  border:1.6px solid #bde8bc; border-radius:9px; background:#e6f9ed; color:#259960; font-weight:600; outline:none; font-size:13px; font-family:'Segoe UI',Consolas,Arial,sans-serif; }
#vibe-search-input::placeholder{ color:#55b285; font-weight:600; opacity:.9; }
#vibe-search-results{ display:none; position:absolute; top:42px; left:0; width:420px; max-width:96vw; max-height:360px; overflow:auto;
  background:#fff; border:1px solid #c3c3c3; border-radius:10px; box-shadow:0 2px 14px rgba(80,90,140,.14); z-index:4999; }

/* bubbles */
.vibe-msg-bubble{ border-radius:10px; padding:5px 11px; max-width:65vw; min-width:65vw; border:1px solid #e0e7ef; background:#f8fafd; color:#23272b; font:12px/1.16 Verdana,Arial,sans-serif!important; margin:2px 0; }
.vibe-msg-out .vibe-msg-bubble{ background:#e4fbe4!important; border-color:#bde8bc!important; }
.vibe-msg-text-meta{ display:flex; justify-content:space-between; align-items:flex-end; gap:6px; width:100%; min-height:18px; }
.vibe-msg-meta{ display:inline-block; background:#e4e8ee; color:#8294b6!important; border:none!important; border-radius:9px!important; font:12px/1.16 Verdana,Arial,sans-serif!important; padding:2px 10px; margin:0 0 0 6px!important; white-space:nowrap; opacity:.97; }

/* мягкая «удалить» */
.vibe-remove-btn-soft{ display:inline-block; margin-right:12px; padding:2px 8px; background:#f6caca; color:#993333!important; font:12px Verdana,Arial,sans-serif;
  border-radius:8px; cursor:pointer; user-select:none; opacity:.85; transition:.2s; box-shadow:inset 0 0 0 1px #e6b3b3; }

/* группы дат */
.vibe-date-group{ border-right:2px solid #7ebde9; border-radius:4px; padding-right:8px; margin:16px 6px; }
.vibe-date-label{ background:linear-gradient(90deg,#e8ecf3 70%,#e3edff 100%); color:#3d5887; font:700 12px 'Segoe UI',Arial; padding:5px 14px; border-radius:16px; display:inline-block; box-shadow:0 1px 6px #b5d2fa14, inset 0 0 0 1px #cfd9ec; letter-spacing:.5px; user-select:text!important; }

/* ПАНЕЛЬ КОММЕНТАРИЯ — ширина 30vw */
#${COMMENT_ID}{ position:absolute; right:18px; top:54px; width:clamp(280px, 30vw, 520px); pointer-events:auto; z-index:4998; }
.vibe-comment-card{ border:1.8px solid #7b92a7; background:#f6f7fa; border-radius:12px; padding:10px 12px; box-shadow:0 2px 10px rgba(100,120,160,.12); height:77%; display:flex; flex-direction:column; }

/* grid-шапка: [статус | холд | save] / [рейтинг | онлайн | save] */
.vibe-comment-head{
  display:grid;
  grid-template-columns: 1fr 1fr auto;
  grid-template-rows: auto auto;
  column-gap:10px; row-gap:2px;
  align-items:center;
  margin:2px 0 6px 2px;
  font:600 12px 'Segoe UI',Arial;
  color:#2a3140;
}
.vibe-head-status{ grid-area: 1 / 1 / 2 / 2; font-weight:700; text-align:left; font-size:13px; }
.vibe-head-hold{   grid-area: 1 / 2 / 2 / 3; font-weight:700; text-align:center; font-size:13px; }
.vibe-head-save{   grid-area: 1 / 3 / 3 / 4; justify-self:end; height:28px; padding:0 12px; background:#eaeef2; border:1.4px solid #7b92a7; border-radius:8px; cursor:pointer; }
.vibe-head-rating{ grid-area: 2 / 1 / 3 / 2; text-align:left; color:#2a3140; font-size:13px; }
.vibe-head-online{ grid-area: 2 / 2 / 3 / 3; text-align:center; color:#55627a; font-size:13px; }

.vibe-comment-text{ flex:1 1 auto; min-height:60px; resize:vertical; border:1.6px solid #cbd7e6; border-radius:9px; padding:8px 10px; background:#fff; font:13px/1.25 'Segoe UI',Arial; color:#1e2329; box-sizing:border-box; overflow:auto; }
.vibe-comment-actions{ margin-top:6px; display:flex; gap:8px; align-items:center; }
.vibe-comment-note{ font:12px 'Segoe UI',Arial; color:#637089; }

@media (max-width:1200px){ #${COMMENT_ID}{ display:none; } }

/* скрыть оригинальную ссылку [удалить] */
a.target[href*="del="]{ display:none!important; }

/* ЛАЙТБООКС */
.vibe-lightbox-overlay{ position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(32,38,55,.95); cursor:zoom-out; animation:fadein .13s; overflow:hidden; user-select:none; }
@keyframes fadein{from{opacity:0}to{opacity:1}}
.vibe-lightbox-img{ max-width:94vw; max-height:92vh; border-radius:15px; border:2px solid #c2d1e1; background:#f9fafb; box-shadow:0 6px 36px #00000033; display:block; margin:auto; cursor:pointer; will-change:transform; transition:box-shadow .18s; animation:popin .16s cubic-bezier(.42,0,.6,1.08); user-select:none; }
@keyframes popin{from{transform:scale(.95)}to{transform:scale(1)}}
`;
  if(!document.getElementById('vibe-merged-css')){
    const st=document.createElement('style'); st.id='vibe-merged-css'; st.textContent=css; document.head.appendChild(st);
  }

  // ---------- Утилиты ----------
  const selInside = (el)=>{
    const sel = window.getSelection?.(); if(!sel || sel.rangeCount===0) return false;
    const node = sel.getRangeAt(0).commonAncestorContainer;
    const n = node.nodeType===1 ? node : node.parentNode;
    return el && el.contains && n && el.contains(n);
  };

  function getSellerIdFromUrl(){ const m=location.search.match(/[?&]id_s=(\d+)/); return m?m[1]:null; }

  // блокировка/возврат прокрутки для модалки
  function lockPageScroll(){
    const html=document.documentElement, body=document.body;
    if(body.dataset.vibeScrollLocked==='1') return;
    body.dataset.vibePrevOverflowBody = body.style.overflow || '';
    body.dataset.vibePrevOverflowHtml = html.style.overflow || '';
    body.dataset.vibeScrollLocked='1';
    body.style.overflow='hidden'; html.style.overflow='hidden';
  }
  function unlockPageScroll(){
    const html=document.documentElement, body=document.body;
    body.style.overflow = body.dataset.vibePrevOverflowBody || '';
    html.style.overflow = body.dataset.vibePrevOverflowHtml || '';
    delete body.dataset.vibePrevOverflowBody; delete body.dataset.vibePrevOverflowHtml; delete body.dataset.vibeScrollLocked;
  }

  // ---------- Данные продавца ----------
  function fetchSellerInfo(sellerId){
    if(!sellerId) return Promise.reject('seller_id пуст');
    if(ST.infoCache[sellerId]) return Promise.resolve(ST.infoCache[sellerId]);
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method:'GET', url:`https://my.digiseller.ru/asp/seller_info.asp?id_s=${sellerId}`,
        onload:r=>{
          if(r.status!==200) return reject('network');
          try{
            const doc=new DOMParser().parseFromString(r.responseText,'text/html');
            const rows=doc.querySelectorAll('tr');
            const byLabel=re=>{
              for(const row of rows){
                const th=row.querySelector('td.namerow');
                if(th && re.test(th.textContent)){
                  const td=row.querySelector('td.inforow');
                  if(td) return (td.textContent||'').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim();
                }
              }
              return '';
            };
            let nickname='';
            for(const row of rows){
              const th=row.querySelector('td.namerow');
              if(th && /псевдоним/i.test(th.textContent)){
                const td=row.querySelector('td.inforow');
                nickname=(td?.childNodes[0]?.textContent || td?.textContent || '').trim().replace(/\u00A0/g,' ');
                break;
              }
            }
            const checked = doc.querySelector('input[name="Condition"]:checked');
            let status='';
            if(checked){
              const lab = doc.querySelector(`label[for="${checked.id}"]`);
              status = (lab?.textContent || '').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim();
            }
            const holdEl = doc.querySelector('#Day_Lock');
            let holdDays=null;
            if(holdEl){
              let v = holdEl.getAttribute('value');
              if(v==null) v = holdEl.value;
              v = (v||'').trim();
              holdDays = v==='' ? null : v;
            }
            const rating = byLabel(/рейтинг/i) || '';
            const online = byLabel(/онлайн/i) || '';
            const info={
              nickname,
              comment:(doc.querySelector('textarea[name="txt_Comments"]')?.value||'').trim(),
              lastVisit:byLabel(/дата последнего посещения/i),
              status, holdDays, rating, online
            };
            ST.infoCache[sellerId]=info; resolve(info);
          }catch{ reject('parse'); }
        },
        onerror:()=>reject('network')
      });
    });
  }

  function postSellerComment(sellerId,text){
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method:'POST',
        url:`https://my.digiseller.ru/asp/seller_info.asp?id_s=${sellerId}`,
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        data:`id_action=save&txt_Comments=${encodeURIComponent(text)}`,
        onload:r=>r.status===200?resolve():reject('server'),
        onerror:()=>reject('network')
      });
    });
  }

  // ---------- Верхняя строка и кнопки ----------
  function findActionLinks(){
    const all=[...document.querySelectorAll('a')];
    const newMsg=all.find(a=>/новое сообщение/i.test(a.textContent));
    const markRead=all.find(a=>/отметить прочитанным/i.test(a.textContent));
    if(!newMsg||!markRead) return null;
    const host=newMsg.closest('p')||markRead.closest('p')||newMsg.parentElement; if(!host) return null;
    host.style.position='relative';
    [newMsg,markRead].forEach(a=>{
      if(!a.dataset.vibeHidden){
        a.style.opacity='0'; a.style.pointerEvents='none';
        if(a.parentElement && a.parentElement.tagName==='FONT'){ a.parentElement.style.opacity='0'; a.parentElement.style.pointerEvents='none'; }
        a.dataset.vibeHidden='1';
      }
    });
    return {host,newMsg,markRead};
  }

  function removeOldOnlinePill(){ const p=document.getElementById(ONLINE_ID); if(p) p.remove(); }

  async function drawFakeButtonsRow(){
    const found=findActionLinks(); if(!found) return;
    const {host,newMsg,markRead}=found;

    document.querySelectorAll('.vibe-btn-fake-row').forEach(el=>{ if(el.id!==ROW_ID) el.remove(); });

    let row=document.getElementById(ROW_ID);
    if(!row){
      row=document.createElement('div'); row.id=ROW_ID; row.className='vibe-btn-fake-row';
      row.style.position='absolute'; row.style.top='0'; row.style.left='0'; row.style.pointerEvents='none';
      const b1=document.createElement('button'); b1.className='vibe-btn-fake'; b1.dataset.role='new'; b1.style.pointerEvents='auto';
      const b2=document.createElement('button'); b2.className='vibe-btn-fake vibe-btn-fake-black'; b2.dataset.role='read'; b2.style.pointerEvents='auto';
      row.appendChild(b1); row.appendChild(b2); host.appendChild(row);
    }
    if(row.parentNode!==host) host.appendChild(row);

    const btnNew=row.querySelector('button[data-role="new"]');
    const btnRead=row.querySelector('button[data-role="read"]');
    if(btnNew){ btnNew.textContent=(newMsg.textContent||'новое сообщение').trim(); btnNew.onclick=e=>{ e.preventDefault(); newMsg.click(); }; }
    if(btnRead){ btnRead.textContent=(markRead.textContent||'отметить прочитанным').trim(); btnRead.onclick=e=>{ e.preventDefault(); markRead.click(); }; }

    // --- Кнопка-ник: клик — ник, Ctrl+клик — seller_id ---
    const sellerId=getSellerIdFromUrl();
    if(sellerId && !row.querySelector('.vibe-btn-nick')){
      const tmp=document.createElement('button'); tmp.className='vibe-btn-nick'; tmp.textContent='Загрузка...'; tmp.disabled=true; row.appendChild(tmp);
      fetchSellerInfo(sellerId).then(info=>{
        const btn=document.createElement('button'); btn.className='vibe-btn-nick';
        btn.textContent=info.nickname||'без ника';
        btn.title='Клик: скопировать ник\\nCtrl+клик: скопировать seller_id';
        btn.addEventListener('click',e=>{
          const val=e.ctrlKey?sellerId:(info.nickname||'');
          navigator.clipboard.writeText(val).then(()=>{
            const o=btn.textContent; btn.textContent='Скопировано!'; btn.classList.add('copied');
            setTimeout(()=>{ btn.textContent=o; btn.classList.remove('copied'); },800);
          });
        });
        row.replaceChild(btn,tmp);
      }).catch(()=>{ tmp.textContent='Ошибка ника'; });
    }

    ensureSearch(row);
    removeOldOnlinePill();
    ensureFixedCommentPanel();
    updateCommentPanelBounds();
  }

  // ---------- Поиск ----------
  function ensureSearch(row){
    if(!row.querySelector('#vibe-searchbox-wrap')){
      const box=document.createElement('div'); box.id='vibe-searchbox-wrap';
      box.innerHTML=`<input id="vibe-search-input" type="text" tabindex="1" autocomplete="off" placeholder="🔍 Поиск по сообщениям..."><div id="vibe-search-results"></div>`;
      row.appendChild(box);
    }
    const input=row.querySelector('#vibe-search-input');
    const results=row.querySelector('#vibe-search-results');
    if(input && !input.dataset.vibeInit){ setupSearchUI(input,results); input.dataset.vibeInit='1'; }
  }

  function getLastPagesLinks(){
    const links=[...document.querySelectorAll('a[href*="seller_messages.asp"][class*="target"]')];
    const unique=new Set([location.href]); links.forEach(l=> unique.add(new URL(l.href, location.origin).href));
    return [...unique].map(url=>({url, id:parseInt(url.match(/id=(\d+)/)?.[1]||'0',30)})).sort((a,b)=>a.id-b.id).slice(0,30).map(o=>o.url);
  }
  function parseMessagesFromHTML(html,pageUrl){
    const doc=new DOMParser().parseFromString(html,'text/html'); const rows=doc.querySelectorAll('td.td_title'); const out=[];
    rows.forEach(td=>{
      const tr=td.parentElement; const datetime=(td.textContent||'').trim(); let msgTd=tr.children[2]; let msg='';
      if(msgTd){ msg=msgTd.innerText.replace(/\s+/g,' ').trim();
        const only=(msgTd.querySelectorAll('a').length>0 && msg.replace(/https?:\/\/\S+/g,'').trim().length===0) ||
                    (msgTd.querySelectorAll('img').length>0 && msg.replace(/[\u200B-\u200D\uFEFF]/g,'').trim().length===0);
        if(only || msg.length<2) msg=''; }
      if(!msg){ for(let i=1;i<tr.children.length;i++){ if(i===2) continue; const t=tr.children[i].innerText.replace(/\s+/g,' ').trim(); if(t.length>msg.length) msg=t; } }
      msg=msg.replace(/(?:\s*\n)?возможно\s+запрос\s+по\s+заказам[:：]?\s*\[?\d*\]?\s*/gi,'').replace(/^\s*\[\d+\]\s*$/gm,'').replace(/(\n\s*){2,}/g,'\n').trim();
      const m=datetime.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/); let ts=0;
      if(m){ const pad=s=>s.padStart(2,'0'); const iso=`${m[3]}-${m[2]}-${m[1]}T${pad(m[4])}:${pad(m[5])}:${pad(m[6])}`; ts=new Date(iso).getTime()||0; }
      if(msg && datetime) out.push({ datetime, text:msg, pageUrl, ts });
    });
    return out;
  }
  async function fetchMessagesFromPages(urls){
    let cache=[]; await Promise.all(urls.map(url=> new Promise(res=>{
      GM_xmlhttpRequest({ method:'GET', url, onload:r=>{ if(r.status===200) cache=cache.concat(parseMessagesFromHTML(r.responseText,url)); res(); }, onerror:res });
    })));
    return cache;
  }

  function setupSearchUI(input,results){
    // инерция прокрутки результатов
    let raf=null, vel=0; const F=0.88, STEP=0.25, MIN=0.5;
    function step(){ const max=results.scrollHeight-results.clientHeight; if(max<=0){ vel=0; raf=null; return; }
      results.scrollTop += vel*STEP; if((results.scrollTop<=0&&vel<0)||(results.scrollTop>=max&&vel>0)) vel=0; else vel*=F;
      if(Math.abs(vel)<MIN){ vel=0; raf=null; return; } raf=requestAnimationFrame(step);
    }
    results.addEventListener('wheel', e=>{ e.preventDefault(); const scale=e.deltaMode===1?16:e.deltaMode===2?results.clientHeight:1; vel+=e.deltaY*scale*0.6; if(!raf) raf=requestAnimationFrame(step); }, {passive:false});

    let cache=null, loading=false, last='';
    input.addEventListener('input', async ()=>{
      const q=input.value.trim().toLowerCase(); last=q;
      if(!q){ results.style.display='none'; results.innerHTML=''; return; }
      if(!cache && !loading){
        loading=true; input.style.background='#bff3d3'; results.style.display='block';
        results.innerHTML='<div style="padding:12px;font-size:14px;color:#999;">Загрузка последних 30 страниц...</div>';
        cache=await fetchMessagesFromPages(getLastPagesLinks());
        loading=false; input.style.background='';
      }
      if(cache){
        let found=cache.filter(m=> m.text.toLowerCase().includes(q) || m.datetime.toLowerCase().includes(q))
                       .sort((a,b)=>b.ts-a.ts).slice(0,30);
        if(last!==q) return;
        const hi=(t,q)=> t.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'), m=>`<mark style="background:#ffeab5;">${m}</mark>`);
        results.innerHTML = found.length
          ? found.map(m=>`
              <div class="vibe-search-res" style="padding:9px 12px;border-bottom:1px solid #f1f1f1;cursor:pointer;"
                   data-page="${encodeURIComponent(m.pageUrl)}" data-datetime="${encodeURIComponent(m.datetime)}"
                   title="Двойной клик — открыть страницу и прокрутить к сообщению">
                <div style="font-size:13px;color:#6a7a8e;font-weight:600">${m.datetime}</div>
                <div style="font-size:13px;color:#23273a">${hi(m.text,q)}</div>
              </div>`).join('')
          : '<div style="padding:12px;font-size:14px;color:#999;">Ничего не найдено</div>';
        results.style.display='block';
      }
    });

    // переход по dblclick — кодируем дату ОДИН раз
    results.addEventListener('dblclick', e=>{
      const r=e.target.closest('.vibe-search-res'); if(!r) return;
      const pageUrl=decodeURIComponent(r.getAttribute('data-page'));
      const dtRaw = decodeURIComponent(r.getAttribute('data-datetime'));
      location.href = pageUrl.split('#')[0] + '#vibe_msg=' + encodeURIComponent(dtRaw);
      results.style.display='none';
    });

    document.addEventListener('click', e=>{ if(!results.contains(e.target) && e.target!==input) results.style.display='none'; });
    input.addEventListener('keydown', e=> e.stopPropagation());
  }

  // ---------- Панель комментария ----------
  function ensureFixedCommentPanel(){
    if(document.getElementById(COMMENT_ID)) return;
    const panel=document.createElement('div');
    panel.id=COMMENT_ID;
    panel.innerHTML=`
      <div class="vibe-comment-card">
        <div class="vibe-comment-head">
          <span id="vibe-title-status" class="vibe-head-status">…</span>
          <span id="vibe-title-hold"   class="vibe-head-hold">Холд: …</span>
          <button type="button" class="vibe-head-save" id="vibe-comment-save">сохранить</button>
          <span id="vibe-sub-rating" class="vibe-head-rating">Рейтинг: …</span>
          <span id="vibe-sub-online" class="vibe-head-online">Онлайн: …</span>
        </div>
        <textarea class="vibe-comment-text" id="vibe-comment-textarea" placeholder="Добавьте заметку..."></textarea>
        <div class="vibe-comment-actions"><span class="vibe-comment-note" id="vibe-comment-note"></span></div>
      </div>`;
    document.body.appendChild(panel);

    const save=panel.querySelector('#vibe-comment-save');
    const ta=panel.querySelector('#vibe-comment-textarea');
    const note=panel.querySelector('#vibe-comment-note');

    updateCommentPanelData();

    save.addEventListener('click', async ()=>{
      const sellerId=getSellerIdFromUrl(); if(!sellerId) return;
      note.textContent='сохранение...'; save.disabled=true;
      try{
        await postSellerComment(sellerId, ta.value||'');
        if(ST.infoCache[sellerId]) ST.infoCache[sellerId].comment=ta.value||'';
        note.textContent='сохранено ✓'; setTimeout(()=> note.textContent='',1500);
      }catch{ note.textContent='ошибка сохранения'; }
      finally{ save.disabled=false; }
    });
  }

  async function updateCommentPanelData(){
    const panel=document.getElementById(COMMENT_ID); if(!panel) return;
    const sellerId=getSellerIdFromUrl(); if(!sellerId) return;

    const elStatus=panel.querySelector('#vibe-title-status');
    const elHold=panel.querySelector('#vibe-title-hold');
    const elRating=panel.querySelector('#vibe-sub-rating');
    const elOnline=panel.querySelector('#vibe-sub-online');
    const ta=panel.querySelector('#vibe-comment-textarea');
    const note=panel.querySelector('#vibe-comment-note');

    try{
      const info=await fetchSellerInfo(sellerId);
      if(ta) ta.value = info.comment || '';

      const status = info.status || '—';
      const holdDisplay = (info.holdDays==null || String(info.holdDays).trim()==='') ? '7' : String(info.holdDays).trim();
      const rating = (info.rating||'—').trim();
      const online = (info.online || info.lastVisit || '—').trim();

      if(elStatus && elStatus.textContent !== status) elStatus.textContent = status;
      if(elHold && !selInside(elHold)){ const t=`Холд: ${holdDisplay} дн`; if(elHold.textContent!==t) elHold.textContent=t; }
      if(elRating && !selInside(elRating)){ const t=`Рейтинг: ${rating}`; if(elRating.textContent!==t) elRating.textContent=t; }
      if(elOnline && !selInside(elOnline)){ const t=`Онлайн: ${online}`; if(elOnline.textContent!==t) elOnline.textContent=t; }

      if(note) note.textContent='';
    }catch{
      if(elStatus && elStatus.textContent!=='—') elStatus.textContent='—';
      if(elHold   && !selInside(elHold)   && elHold.textContent!=='Холд: 7 дн')   elHold.textContent='Холд: 7 дн';
      if(elRating && !selInside(elRating) && elRating.textContent!=='Рейтинг: —') elRating.textContent='Рейтинг: —';
      if(elOnline && !selInside(elOnline) && elOnline.textContent!=='Онлайн: —')   elOnline.textContent='Онлайн: —';
      if(note) note.textContent='не удалось загрузить данные';
    }
  }

  // Ограничение высоты панели
  function updateCommentPanelBounds(){
    const panel=document.getElementById(COMMENT_ID); if(!panel) return;
    panel.style.top='54px';
    const tbl=document.querySelector('table[width="100%"][cellpadding="2"]');
    let maxH=Math.floor(window.innerHeight*0.35);
    if(tbl){
      const tableDocTop = tbl.getBoundingClientRect().top + window.scrollY;
      const panelDocTop = 54;
      const space = tableDocTop - panelDocTop - 12;
      if (space > 60) maxH = Math.floor(space / 2); else maxH = Math.max(140, space - 12);
    }
    maxH = Math.max(140, maxH);
    panel.style.height = maxH + 'px';
    panel.style.maxHeight = maxH + 'px';
  }

  // ---------- Сообщения → bubbles ----------
  function transformAllMessages(){
    document.querySelectorAll('tr').forEach(tr=>{
      if(tr.dataset.vibeDone==='1') return;
      const tds=tr.querySelectorAll('td'); if(tds.length!==3) return;
      const dateTd=tds[0], iconTd=tds[1], msgTd=tds[2];
      const img=iconTd.querySelector('img'); if(!img||(!img.src.includes('mail_out')&&!img.src.includes('mail_in'))) return;
      const dateRaw=(dateTd.textContent||'').replace(/[\n\r]+/g,'').trim(); if(!dateRaw) return;

      let html=msgTd.innerHTML
        .replace(/<div[^>]+class=["']?vibe-msg-bubble["']?[^>]*>[\s\S]*?<\/div>/gi, m=>m.replace(/<div[^>]+class=["']?vibe-msg-bubble["']?[^>]*>/i,'').replace(/<\/div>$/i,''))
        .replace(/<span[^>]+class=["']?vibe-msg-meta["']?[^>]*>[\s\S]*?<\/span>/gi,'')
        .replace(/<font[^>]*color=['"]?b2b2b2['"]?[^>]*>/gi,'').replace(/<\/font>/gi,'')
        .replace(/<p[^>]*>/gi,'').replace(/<\/p>/gi,'')
        .replace(/<fieldset[^>]*>/gi,'').replace(/<\/fieldset>/gi,'')
        .replace(/<legend[^>]*>.*?<\/legend>/gi,'')
        .replace(/<table[^>]*>/gi,'').replace(/<\/table>/gi,'')
        .replace(/<tbody[^>]*>/gi,'').replace(/<\/tbody>/gi,'')
        .replace(/<tr[^>]*>/gi,'').replace(/<\/tr>/gi,'')
        .replace(/<td[^>]*>/gi,'').replace(/<\/td>/gi,'')
        .replace(/<div[^>]*class=['"]?main_msg['"]?[^>]*>/gi,'')
        .replace(/<\/div>/gi,'');

      html=html.replace(/<br\s*\/?>/gi,'\n');
      html=html.replace(/<a /g,'<a target="_blank" rel="noopener" ');
      html=html.replace(/<img([^>]+)>/gi,(_,attrs)=>{
        const w=(attrs.match(/max-width\s*:\s*(\d+)px/i)?.[1]||468)|0;
        const hitW=Math.round(w*1.3);
        return `<span class="vibe-img-wrap" style="position:relative;display:inline-block;"><img${attrs}><span class="vibe-img-hitbox" style="width:${hitW}px;height:auto;top:50%;left:50%;transform:translate(-50%,-50%);"></span></span>`;
      });
      html=html.replace(/<a ([^>]+)>(https?:\/\/[^<]+)<\/a>/gi,'<a $1 class="link">$2</a>');
      html=html.replace(/^[\n\r]+|[\n\r]+$/g,'');
      const lines=html.split('\n');
      while(lines.length && lines[0].trim()==='') lines.shift();
      while(lines.length && lines[lines.length-1].trim()==='') lines.pop();
      html=lines.map(l=>l.trim()===''?'<div style="height:7px"></div>':`<div>${l.trim()}</div>`).join('');
      html=html.replace(/\[\s*|\s*\]/g,'');

      msgTd.innerHTML=`
        <div class="vibe-msg-bubble">
          <div class="vibe-msg-text-meta">
            <span class="vibe-msg-text">${html}</span>
            <span class="vibe-msg-meta" data-full-date="${dateRaw}">${dateRaw}</span>
          </div>
        </div>`;
      tr.classList.remove('vibe-msg-out','vibe-msg-in');
      if(img.src.includes('mail_out')) tr.classList.add('vibe-msg-out');
      if(img.src.includes('mail_in'))  tr.classList.add('vibe-msg-in');
      dateTd.remove(); iconTd.remove(); tr.dataset.vibeDone='1';
    });
  }

  function groupMessagesByDate(){
    const tbl=document.querySelector('table[width="100%"][cellpadding="2"]'); if(!tbl) return;
    if(!window.vibeMsgGroups) window.vibeMsgGroups={};
    document.querySelectorAll('tr.vibe-msg-out, tr.vibe-msg-in').forEach(tr=>{
      if(tr.dataset.vibeGrouped==='1') return;
      const meta=tr.querySelector('.vibe-msg-meta'); if(!meta) return;
      const full=meta.getAttribute('data-full-date')||meta.textContent.trim();
      const onlyDate=(full||'').split(' ')[0]; if(!onlyDate) return;
      let wrap=window.vibeMsgGroups[onlyDate];
      if(!wrap){
        wrap=document.createElement('tbody'); wrap.className='vibe-date-group'; wrap.dataset.vibedate=onlyDate;
        const r=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=3;
        const label=document.createElement('div'); label.className='vibe-date-label'; label.textContent=onlyDate;
        td.appendChild(label); r.appendChild(td); wrap.appendChild(r); tbl.appendChild(wrap);
        window.vibeMsgGroups[onlyDate]=wrap;
      }
      wrap.appendChild(tr); tr.dataset.vibeGrouped='1';
    });
  }

  // ---------- Лайтбокс (зум, drag) ----------
  function openLightbox(src){
    const old=document.getElementById('vibe-lightbox-overlay'); if(old) old.remove();
    lockPageScroll();

    const o=document.createElement('div'); o.id='vibe-lightbox-overlay'; o.className='vibe-lightbox-overlay';
    o.innerHTML=`<img class="vibe-lightbox-img" src="${src}" draggable="false">`;
    const img=o.querySelector('.vibe-lightbox-img');

    let scale=1, minScale=0.18, maxScale=6;
    let ox=0, oy=0;
    const apply=()=> img.style.transform=`translate(${ox}px,${oy}px) scale(${scale})`;
    const center=()=>{ const r=img.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; };

    o.addEventListener('wheel',(e)=>{
      const r=img.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) return;
      e.preventDefault();
      const prev=scale, next=Math.max(minScale, Math.min(maxScale, scale*(e.deltaY<0?1.13:0.89)));
      if(next>prev){
        const c=center(); const ix=(e.clientX-c.x-ox)/scale, iy=(e.clientY-c.y-oy)/scale;
        scale=next; ox-=ix*(scale-prev); oy-=iy*(scale-prev);
      }else if(next<prev){
        if(next<=1.001){ scale=1; ox=0; oy=0; }
        else{ const c=center(); const ix=(c.x-window.innerWidth/2-ox)/scale, iy=(c.y-window.innerHeight/2-oy)/scale; scale=next; ox-=ix*(scale-prev); oy-=iy*(scale-prev); }
      }
      apply();
    },{passive:false});

    let drag=false,sx=0,sy=0,sox=0,soy=0;
    img.addEventListener('mousedown',(e)=>{ drag=true; sx=e.clientX; sy=e.clientY; sox=ox; soy=oy; img.style.cursor='grabbing'; e.preventDefault(); });
    window.addEventListener('mousemove',(e)=>{ if(!drag) return; ox=sox+(e.clientX-sx); oy=soy+(e.clientY-sy); apply(); });
    window.addEventListener('mouseup',()=>{ if(drag) img.style.cursor='pointer'; drag=false; });
    img.addEventListener('dblclick',(e)=>{ e.preventDefault(); scale=1; ox=0; oy=0; apply(); });

    const close=()=>{ o.remove(); unlockPageScroll(); document.removeEventListener('keydown', onKey); };
    const onKey=(ev)=>{ if(ev.key==='Escape') close(); };
    document.addEventListener('keydown', onKey);
    o.addEventListener('click', e=>{ if(e.target===o) close(); });
    o.addEventListener('touchmove', e=> e.preventDefault(), {passive:false});

    document.body.appendChild(o);
    img.setAttribute('tabindex','0'); setTimeout(()=>img.focus(),50);
  }

  function handleBubbleImages(){
    document.querySelectorAll('.vibe-msg-bubble .vibe-img-wrap').forEach(wrap=>{
      const img=wrap.querySelector('img'); const hb=wrap.querySelector('.vibe-img-hitbox'); if(!img||!hb) return;
      const handler=e=>{
        e.preventDefault(); e.stopPropagation();
        const a=img.closest('a'); const href=a&&a.href?a.href:img.src;
        if(/\.(png|jpe?g|gif|webp)$/i.test(href)&&!/img_deb\.ashx/i.test(href)) openLightbox(href); else openLightbox(img.src);
      };
      img.addEventListener('click',handler); hb.addEventListener('click',handler);
    });
  }

  // мягкая «удалить»
  function initRemoveButtonFix(){
    document.querySelectorAll('a.target[href*="id_s="][href*="del="]').forEach(link=>{
      const url=location.origin+location.pathname+link.getAttribute('href');
      const bubble=link.closest('.vibe-msg-out')||link.closest('td')||link.parentElement; if(!bubble) return;
      const meta=bubble.querySelector('.vibe-msg-meta')||bubble;
      if(meta.querySelector('.vibe-remove-btn-soft')){ link.remove(); return; }
      const btn=document.createElement('span'); btn.className='vibe-remove-btn-soft'; btn.textContent='удалить';
      btn.addEventListener('click',e=>{
        e.preventDefault(); btn.textContent='...'; btn.style.opacity='.6';
        GM_xmlhttpRequest({ method:'GET', url, onload:r=>{ if(r.status===200) location.reload(); else{ btn.textContent='ошибка'; btn.style.backgroundColor='#ff9900'; } },
          onerror:()=>{ btn.textContent='ошибка сети'; btn.style.backgroundColor='#ff9900'; }});
      });
      link.remove(); meta.prepend(btn);
    });
  }

  // ---------- Скролл к сообщению из hash (ОДИН РАЗ) ----------
  function scrollToMessageFromHash(){
    if(!location.hash.startsWith('#vibe_msg=')){ ST.hashScrolledRaw=null; return; }
    const raw = decodeURIComponent(location.hash.replace(/^#vibe_msg=/,'')).replace(/\s+/g,' ').trim();

    // уже проскроллили к этому значению — больше не трогаем
    if (ST.hashScrolledRaw === raw) return;

    const tryScrollOnce = ()=>{
      if (ST.hashScrolledRaw === raw) return true; // кто-то уже сделал

      // 1) ищем наш таймштамп в bubble
      let target = document.querySelector(
        `.vibe-msg-meta[data-full-date="${CSS?.escape ? CSS.escape(raw) : raw.replace(/"/g,'\\"')}"]`
      );

      // 2) по началу строки
      if(!target){
        const metas=[...document.querySelectorAll('.vibe-msg-meta')];
        target = metas.find(m=>{
          const full=(m.getAttribute('data-full-date')||m.textContent||'').replace(/\s+/g,' ').trim();
          return full===raw || (raw.length>3 && full.startsWith(raw.slice(0,-3)));
        });
      }

      // 3) самый грубый fallback
      if(!target){
        const tds=[...document.querySelectorAll('td.td_title')];
        target = tds.find(td => (td.textContent||'').replace(/\s+/g,' ').trim()===raw );
      }

      if(!target) return false;

      // помечаем как обработанный ДО скролла — чтобы не «возвращало»
      ST.hashScrolledRaw = raw;

      const bubble = target.closest('.vibe-msg-bubble') || target;
      bubble.scrollIntoView({behavior:'smooth', block:'center'});
      const old = bubble.style.boxShadow;
      bubble.style.boxShadow = '0 0 0 3px #ffe38a, 0 0 14px #ffe38a';
      setTimeout(()=> bubble.style.boxShadow = old, 2600);
      return true;
    };

    (function attempt(left){
      if(tryScrollOnce()) return;
      if(left>0) setTimeout(()=>attempt(left-1),300);
    })(24); // ~7.2с на ожидание ajax/рендеринга
  }

  function enforceTimeInMeta(){
    document.querySelectorAll('.vibe-msg-meta').forEach(el=>{
      const btn=el.querySelector('.vibe-remove-btn-soft');
      const src=el.getAttribute('data-full-date')||(el.textContent||'').trim();
      const m=src.match(/\b(\d{1,2}:\d{2}:\d{2})\b/); el.textContent=m?m[1]:'';
      if(btn) el.prepend(btn);
    });
  }

  // ---------- Инициализация ----------
  function mainInit(force){
    if(force || !ST.initedOnce || ST.lastUrl!==location.href){
      ST.initedOnce=true;
      if(ST.lastUrl!==location.href) window.vibeMsgGroups={};
      ST.lastUrl=location.href;

      transformAllMessages();
      groupMessagesByDate();
      drawFakeButtonsRow();
      initRemoveButtonFix();
      handleBubbleImages();
      enforceTimeInMeta();
      scrollToMessageFromHash();
    }
  }

  const obs=new MutationObserver(()=>{
    const now=Date.now();
    if(now-ST.lastMutationRun>300){
      ST.lastMutationRun=now;
      mainInit(true);
      updateCommentPanelBounds();
      updateCommentPanelData();
    }
  });
  obs.observe(document.body,{childList:true,subtree:true});

  window.addEventListener('load',()=>{ mainInit(true); updateCommentPanelBounds(); setInterval(enforceTimeInMeta,1500); });
  window.addEventListener('resize',()=> updateCommentPanelBounds());
  window.addEventListener('popstate',()=>{ mainInit(true); updateCommentPanelBounds(); });

  // при смене hash — сбрасываем флаг и пытаемся прокрутиться один раз
  window.addEventListener('hashchange',()=>{
    ST.hashScrolledRaw = null;
    mainInit(true);
    updateCommentPanelBounds();
  });
})();
