// ==UserScript==
// @name         DigiSeller: MonkeChatting
// @namespace    http://tampermonkey.net/
// @version      3.9.26-no-search
// @description  Красивые плашки «товары/заказы», извлечение ID (оба формата ggsel + любые числа 5–8 для товаров, 9 для заказов), скрытие «возможно запрос по заказам…», без пустых и без дублей. Пузырьки, лайтбокс, верхние чипы статуса/холда/рейтинга/онлайна, мини-комментарий, надёжный скролл по hash, мягкое «удалить». Кнопка «Сохранить» прикреплена справа к чипам. Лейблы «заказы/товары» копируют все ID из сообщения. Парсинг ID товара: берём последний 5–8-значный блок в конце ссылки (после / или -). ФИКС: Любые «ремонты» и возвраты ведут строго на канонический URL вида seller_messages.asp?id_s=<sid> без служебных хвостов и без принудительного id=1; все DOM-мутации ограничены основной таблицей переписки. FROZEN: .vibe-msg-meta и верхние чипы рендерятся один раз и больше не обновляются таймером/мутациями. SCROLLFIX: при любых внутренних replace() хэш #vibe_msg сохраняется; дата в data-full-date нормализуется, чтобы селектор попадал точно.
// @author       vibe.coding
// @match        https://my.digiseller.ru/asp/seller_messages.asp*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @connect      my.digiseller.ru
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeChatting.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/MonkeChatting.user.js
// ==/UserScript==

(function vbcIIFE(){
  'use strict';

  // ==== УНИКАЛЬНЫЕ ID (чтоб не конфликтовать с другими скриптами) ====
  const vbcUID = 'vbc' + Math.random().toString(36).slice(2,9);
  const vbcIDs = {
    style: `vbc-style-${vbcUID}`,
    row: `vbc-row-${vbcUID}`,
    commentWrap: `vbc-comment-wrap-${vbcUID}`,
    commentText: `vbc-comment-text-${vbcUID}`,
    commentSave: `vbc-comment-save-${vbcUID}`,
    commentNote: `vbc-comment-note-${vbcUID}`,
    saveTopHost: `vbc-save-top-host-${vbcUID}`,
    chips: `vbc-chips-${vbcUID}`,
    chipStatus: `vbc-chip-status-${vbcUID}`,
    chipHold: `vbc-chip-hold-${vbcUID}`,
    chipRating: `vbc-chip-rating-${vbcUID}`,
    chipOnline: `vbc-chip-online-${vbcUID}`,
  };
  const vbcDS_HIDDEN = `vbcHidden${vbcUID}`;

  // ==== Ключи sessionStorage для «возврата» и анти-зацикливания ====
  const SS_LAST_URL_PREFIX      = 'vbc:lastMsgUrl:';      // vbc:lastMsgUrl:<sellerId>
  const SS_MISMATCH_FLAG_PREFIX = 'vbc:mismatchOnce:';    // vbc:mismatchOnce:<sellerId>

  // ==== СОСТОЯНИЕ ====
  const vbcST = {
    initedOnce:false,
    lastUrl:location.href,
    lastMutationRun:0,
    infoCache:{},
    hashScrolledRaw:null,
    commentDirty:false,
    commentFocused:false,
    commentSellerId:null,
    commentOriginal:'',
    docClickBound:false,

    // «заморозки»
    metaFrozenOnce:false,       // .vibe-msg-meta зафиксирована один раз
    topInfoFrozenForSid:null,   // чипы зафиксированы для этого sellerId
  };

  // ==== CSS ====
  const vbcCss = `
/* скрыть родные ссылки «новое сообщение» */
a[href*="new_message.asp"]{ display:none!important; }
p small:has(a[href*="new_message.asp"]){ display:none!important; }

/* строка кнопок/коммента */
#${vbcIDs.row}{
  display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start;
  z-index:4999; position:relative!important;
  width:100%; max-width:100%; pointer-events:none;
  margin:-30px 0 10px 23px!important;
}

/* Кнопки */
.vibe-btn-fake{
  display:inline-flex; align-items:center; justify-content:center;
  min-width:178px; height:40px; padding:0 28px;
  font-size:12px; font-family:'Segoe UI',Consolas,Arial,sans-serif; border-radius:9px;
  border:1.6px solid #bde8bc; background:#e6f9ed; color:#259960; font-weight:600;
  cursor:pointer; margin:0 6px 0 0; user-select:none; pointer-events:auto;
  transition:background .14s, border-color .14s, color .14s, transform .08s;
}
.vibe-btn-fake:hover{ background:#d5f5e3!important; border-color:#82d29d!important; color:#197b48!important; }
.vibe-btn-fake:active{ transform:scale(.98); background:#b6edd2!important; border-color:#5ad48b!important; }

.vibe-btn-fake-black{
  height:40px; padding:0 28px;
  color:#23272b!important; background:#eaeef2!important; border:1.8px solid #7b92a7!important; font-weight:700;
}
.vibe-btn-fake-black:hover{ background:#d5dae3!important; border-color:#657899!important; }

/* ник продавца */
.vibe-btn-nick{
  display:inline-flex; align-items:center; justify-content:center;
  min-width:116px; height:40px; padding:0 18px; font-size:13px;
  font-family:'Segoe UI',Consolas,Arial,sans-serif; border-radius:9px; border:1.8px solid #ffd98a;
  background:#fff8e1; color:#996c15; font-weight:600;
  margin:0 0 0 3px; user-select:none; pointer-events:auto; transition:background .15s,border-color .15s,color .13s,transform .08s;
}
.vibe-btn-nick:hover{ background:#fff0c7!important; border-color:#fbbf24!important; color:#bf8206!important; }
.vibe-btn-nick.copied{ background:#ffeaa7!important; border-color:#96e377!important; color:#378812!important; }

/* верхние чипы + хост для "Сохранить"*/
#${vbcIDs.chips}{
  position:relative;
  display:inline-flex; gap:8px; align-items:center; vertical-align:middle; margin-left:16px; white-space:nowrap; overflow:visible;
}
.vibe-top-chip{ background:#eef2f7; border:1px solid #c9d4e3; border-radius:10px; padding:2px 10px; font:600 12px 'Segoe UI',Arial; color:#2a3140; }
.vibe-top-chip.status.block{ color:#ff0000; border-color:#ffb3b3; background:#ffeaea; }
.vibe-top-chip.rating.bad{ color:#ff0000; border-color:#ffb3b3; background:#ffeaea; }

#${vbcIDs.saveTopHost}{ display:inline-flex; align-items:center; margin-left:8px; pointer-events:auto; }

/* мини-коммент */
#${vbcIDs.commentWrap}{ pointer-events:auto; flex:0 0 585px; width:585px; max-width:585px; min-width:585px; }
.vibe-mini2-row{ display:flex; align-items:stretch; gap:10px; height:40px; }
.vibe-mini2{ position:relative; flex:1 1 auto; }
#${vbcIDs.commentText}{
  width:100%; height:80px; min-height:40px; max-height:80px; resize:vertical;
  border:1.6px solid #bde8bc; border-radius:9px; background:#e6f9ed;
  color:#111; font-weight:600; outline:none; font-size:13px; font-family:'Segoe UI',Consolas,Arial,sans-serif;
  padding:2px 6px; box-sizing:border-box;
}
#${vbcIDs.commentText}::placeholder{ color:#55b285; font-weight:600; opacity:.9; }
#${vbcIDs.commentSave}{
  position:relative; align-self:stretch; height:40px; padding:0 14px;
  border-radius:9px; background:#d5f5e3; border:1.6px solid #82d29d; color:#197b48;
  font:600 12px 'Segoe UI',Arial; cursor:pointer; user-select:none; white-space:nowrap;
}
#${vbcIDs.commentSave}:hover{ background:#c8f0d9; border-color:#6ec591; color:#126c39; }
#${vbcIDs.commentSave}:disabled{ opacity:.6; cursor:not-allowed; }
#${vbcIDs.commentSave}.saving::after{ content:""; position:absolute; right:10px; top:50%; width:14px; height:14px; margin-top:-7px;
  border-radius:50%; border:2px solid #6ec591; border-top-color:transparent; animation:vbc-spin .8s linear infinite; }
#${vbcIDs.commentNote}{ align-self:center; font:12px 'Segoe UI',Arial; color:#637089; }
@keyframes vbc-spin{to{transform:rotate(360deg)}}

/* bubbles */
.vibe-msg-bubble{ border-radius:10px; padding:5px 11px; max-width:65vw; min-width:65vw; border:1px solid #e0e7ef; background:#f8fafd; color:#23272b; font:12px/1.16 Verdana,Arial,sans-serif!important; margin:2px 0; }
.vibe-msg-out .vibe-msg-bubble{ background:#e4fbe4!important; border-color:#bde8bc!important; }
.vibe-msg-text-meta{ display:flex; justify-content:space-between; align-items:flex-end; gap:6px; width:100%; min-height:18px; }
.vibe-msg-meta{ display:inline-block; background:#e4e8ee; color:#8294b6!important; border:none!important; border-radius:9px!important; font:12px/1.16 Verdana,Arial,sans-serif!important; padding:2px 10px; margin:0 0 0 6px!important; white-space:nowrap; opacity:.97; }

/* мягкая «удалить» */
a.target[href*="del="]{ display:none!important; }
.vibe-remove-btn-soft{
  display:inline-block; margin-right:12px; padding:2px 8px;
  background:#f6caca; color:#993333!important; font:12px Verdana,Arial,sans-serif;
  border-radius:8px; cursor:pointer; user-select:none; opacity:.85; transition:.2s; box-shadow:inset 0 0 0 1px #e6b3b3;
}

/* лайтбокс */
.vibe-lightbox-overlay{ position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(32,38,55,.95); cursor:zoom-out; animation:fadein .13s; overflow:hidden; user-select:none; }
.vibe-lightbox-img{ max-width:94vw; max-height:92vh; border-radius:15px; border:2px solid #c2d1e1; background:#f9fafb; box-shadow:0 6px 36px #00000033; display:block; margin:auto; cursor:pointer; will-change:transform; transition:box-shadow .18s; animation:popin .16s cubic-bezier(.42,0,.6,1.08); }

/* подсветка скролла */
.vibe-highlight{ box-shadow:0 0 0 3px #ffe38a, 0 0 14px #ffe38a; border-radius:10px; animation:vibe-hglow 1.2s ease-in-out 2; }
@keyframes vibe-hglow{ 0%{box-shadow:0 0 0 0 rgba(255,227,138,0)} 35%{box-shadow:0 0 0 3px #ffe38a,0 0 14px #ffe38a} 100%{box-shadow:0 0 0 3px #ffe38a,0 0 6px rgba(255,227,138,.4)} }

/* ГРУППЫ ДАТ */
.vibe-date-group{ border-right:2px solid #7ebde9; border-radius:4px; padding-right:8px; margin:16px 6px; }
.vibe-date-label{
  background:linear-gradient(90deg,#e8ecf3 70%,#e3edff 100%);
  color:#3d5887; font:700 12px 'Segoe UI',Arial;
  padding:5px 14px; border-radius:16px; display:inline-block;
  box-shadow:0 1px 6px #b5d2fa14, inset 0 0 0 1px #cfd9ec;
  letter-spacing:.5px; user-select:text!important;
}

/* ПЛАШКИ «товары/заказы» */
.vbc-prodbar{ margin-top:6px; }
.vibe-prod-label{
  display:inline-flex; align-items:center;
  margin-left:0; padding:1px 10px;
  background:#eef7ff; border:1px solid #b9d6ff; border-radius:10px;
  font:600 12px 'Segoe UI',Arial; color:#2b5ea4;
  cursor:pointer; user-select:none; transition:background .15s, border-color .15s, transform .08s;
}
.vibe-prod-label:hover{ background:#e4f1ff; border-color:#8fc0ff; }
.vibe-prod-label:active{ transform:scale(.98); }
.vibe-prod-label.copied{ background:#e6f9ed; border-color:#82d29d; color:#197b48; }

.vibe-prod-chip{
  display:inline-block; margin-left:6px; padding:1px 8px;
  background:#eef7ff; border:1px solid #b9d6ff; border-radius:10px;
  font:600 12px 'Segoe UI',Arial; color:#2b5ea4; cursor:pointer; user-select:none;
}
.vibe-prod-chip:hover{ background:#e4f1ff; border-color:#8fc0ff; }
.vibe-prod-chip.copied{ background:#e6f9ed; border-color:#82d29d; color:#197b48; }

/* --- скрываем «возможно запрос по заказам…» --- */
.vibe-msg-text span[style*="#799679"],
.vibe-msg-text a[style*="#799679"]{ display:none!important; }
`;
  if(!document.getElementById(vbcIDs.style)){
    const st=document.createElement('style'); st.id=vbcIDs.style; st.textContent=vbcCss; document.head.appendChild(st);
  }

  // ==== УТИЛИТЫ ====
  const vbcGetSellerIdFromUrl=()=>{ const m=location.search.match(/[?&]id_s=(\d+)/i); return m?m[1]:null; };
  const vbcEscapeHtml=s=>(s||'').replace(/[&<>"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const vbcCanonMsgUrl=(sid, page)=> `${location.origin}/asp/seller_messages.asp?id_s=${sid}${page?`&id=${page}`:''}`;

  /** SCROLLFIX: replace с сохранением #vibe_msg, чтобы не терять цель скролла */
  const vbcReplacePreserveHash = (url)=>{
    try{
      const h = location.hash || '';
      const keep = h.startsWith('#vibe_msg=') ? h : '';
      location.replace(url + keep);
    }catch(_){
      location.href = url + (location.hash?.startsWith('#vibe_msg=') ? location.hash : '');
    }
  };

  const vbcSanitizeMsgUrl=(url)=>{
    try{
      const u = new URL(url, location.origin);
      const sid = u.searchParams.get('id_s'); if(!sid) return null;
      const id = u.searchParams.get('id');
      return vbcCanonMsgUrl(sid, id? parseInt(id,10) : undefined);
    }catch(_){ return null; }
  };
  const vbcRememberThisMessagesUrl=()=>{
    const sid=vbcGetSellerIdFromUrl(); if(!sid) return;
    try{ sessionStorage.setItem(SS_LAST_URL_PREFIX+sid, vbcCanonMsgUrl(sid)); }catch(_){}
  };
  const vbcOpenInTab=(url, active=true)=>{
    try{ GM_openInTab(url, {active, insert:true, setParent:true}); }
    catch(_){ const w=window.open(url,'_blank','noopener'); if(w && active===false){ /* оставить фоном */ } }
  };

  // ==== Детектор «перепутанного продавца» на странице ====
  const vbcExtractIdS=(href)=>{ const m=(href||'').match(/[?&]id_s=(\d+)/i); return m?m[1]:null; };
  const vbcDetectDomSellerMajority=()=>{
    const counts=Object.create(null);
    const bump=(sid,weight=1)=>{ if(!sid) return; counts[sid]=(counts[sid]||0)+weight; };
    document.querySelectorAll('a[href*="seller_messages.asp"]').forEach(a=> bump(vbcExtractIdS(a.getAttribute('href')||a.href), 1));
    const infoLink=document.querySelector('a.target[href*="seller_info.asp"]');
    if(infoLink) bump(vbcExtractIdS(infoLink.getAttribute('href')||infoLink.href), 5);
    const newMsg = [...document.querySelectorAll('a')].find(a=>/новое сообщение/i.test(a.textContent));
    if(newMsg) bump(vbcExtractIdS(newMsg.getAttribute('href')||newMsg.href), 3);
    const markRead = [...document.querySelectorAll('a')].find(a=>/отметить прочитанным/i.test(a.textContent));
    if(markRead) bump(vbcExtractIdS(markRead.getAttribute('href')||markRead.href), 2);

    let best=null, bestCnt=-1;
    for(const sid in counts){ if(counts[sid]>bestCnt){ best=sid; bestCnt=counts[sid]; } }
    return best; // может быть null
  };

  // === КРИТИЧЕСКИЙ ФИКС: никакого id=1 и служебных хвостов (С СОХРАНЕНИЕМ ХЭША) ===
  const vbcEnsureSellerConsistency=()=>{
    const urlSid=vbcGetSellerIdFromUrl(); if(!urlSid) return false;
    const domSid=vbcDetectDomSellerMajority(); if(!domSid) return false;

    if(domSid!==urlSid){
      let tried='0';
      try{ tried = sessionStorage.getItem(SS_MISMATCH_FLAG_PREFIX+urlSid)||'0'; }catch(_){}
      if(tried==='1') return false;

      try{ sessionStorage.setItem(SS_MISMATCH_FLAG_PREFIX+urlSid,'1'); }catch(_){}
      vbcRememberThisMessagesUrl();
      // SCROLLFIX: не теряем #vibe_msg при коррекции URL
      vbcReplacePreserveHash(vbcCanonMsgUrl(urlSid));
      return true;
    }else{
      try{ sessionStorage.removeItem(SS_MISMATCH_FLAG_PREFIX+urlSid); }catch(_){}
    }
    return false;
  };

  // ==== ДАННЫЕ ПРОДАВЦА ====
  const vbcFetchSellerInfo=(sellerId)=>{
    if(!sellerId) return Promise.reject('seller_id пуст');
    if(vbcST.infoCache[sellerId]) return Promise.resolve(vbcST.infoCache[sellerId]);
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method:'GET',
        url:`https://my.digiseller.ru/asp/seller_info.asp?id_s=${sellerId}`,
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
              } return '';
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
            const checked=doc.querySelector('input[name="Condition"]:checked');
            let status='';
            if(checked){
              const lab=doc.querySelector(`label[for="${checked.id}"]`);
              status=(lab?.textContent||'').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim();
            }
            const holdEl=doc.querySelector('#Day_Lock');
            let holdDays=null;
            if(holdEl){ let v=holdEl.getAttribute('value'); if(v==null) v=holdEl.value; v=(v||'').trim(); holdDays=v===''?null:v; }
            const rating=byLabel(/рейтинг/i)||'';
            const online=byLabel(/онлайн/i)||'';
            const info={
              nickname,
              comment:(doc.querySelector('textarea[name="txt_Comments"]')?.value||'').trim(),
              lastVisit:byLabel(/дата последнего посещения/i),
              status, holdDays, rating, online
            };
            vbcST.infoCache[sellerId]=info; resolve(info);
          }catch{ reject('parse'); }
        },
        onerror:()=>reject('network')
      });
    });
  };
  const vbcPostSellerComment=(sellerId,text)=>{
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
  };

  // ==== Фикс «пустой страницы» — ВСЕГДА канонический URL (С СОХРАНЕНИЕМ ХЭША) ====
  function tryRecoverIfBlank(){
    const sid=vbcGetSellerIdFromUrl(); if(!sid) return;
    const tbl=document.querySelector('table[width="100%"][cellpadding="2"]');

    // PAGEFIX: страница НЕ пуста, если есть либо исходные иконки писем, либо уже преобразованные «пузырьки».
    const hasMsgs = !!(tbl && (tbl.querySelector('img[src*="mail_"]') || tbl.querySelector('.vibe-msg-bubble')));

    if (hasMsgs){
      try{ sessionStorage.setItem(SS_LAST_URL_PREFIX+sid, vbcCanonMsgUrl(sid)); }catch(_){}
      return;
    }
    let last=null;
    try{ last = sessionStorage.getItem(SS_LAST_URL_PREFIX+sid) || null; }catch(_){}
    const target = last || vbcCanonMsgUrl(sid);
    if (location.href.split('#')[0] !== target){
      // SCROLLFIX: при восстановлении тоже сохраняем #vibe_msg
      vbcReplacePreserveHash(target);
    }
  }

  // ==== ВЕРХНЯЯ ЛИНИЯ (кнопки/коммент) ====
  const vbcFindActionLinks=()=>{
    const all=[...document.querySelectorAll('a')];
    const newMsg=all.find(a=>/новое сообщение/i.test(a.textContent));
    const markRead=all.find(a=>/отметить прочитанным/i.test(a.textContent));
    if(!newMsg && !markRead){
      const tbl=document.querySelector('table[width="100%"][cellpadding="2"]');
      if(!tbl) return null;
      let host=document.getElementById(`vbc-actions-host-${vbcUID}`);
      if(!host){ host=document.createElement('div'); host.id=`vbc-actions-host-${vbcUID}`; host.style.position='relative'; tbl.parentNode.insertBefore(host, tbl); }
      return {host,newMsg:null,markRead:null};
    }
    const host=(newMsg||markRead).closest('p')||(newMsg||markRead).parentElement; if(!host) return null;
    host.style.position='relative';
    [newMsg,markRead].forEach(a=>{
      if(a && !a.dataset[vbcDS_HIDDEN]){
        a.style.opacity='0'; a.style.pointerEvents='none';
        if(a.parentElement && a.parentElement.tagName==='FONT'){ a.parentElement.style.opacity='0'; a.parentElement.style.pointerEvents='none'; }
        a.dataset[vbcDS_HIDDEN]='1';
      }
    });
    return {host,newMsg,markRead};
  };

  const vbcEnsureNickButton=(row)=>{
    if(row.querySelector('.vibe-btn-nick')) return;
    const sellerId=vbcGetSellerIdFromUrl(); if(!sellerId) return;
    const tmp=document.createElement('button'); tmp.className='vibe-btn-nick'; tmp.textContent='Загрузка...'; tmp.disabled=true; row.appendChild(tmp);
    vbcFetchSellerInfo(sellerId).then(info=>{
      const btn=document.createElement('button'); btn.className='vibe-btn-nick';
      btn.textContent=info.nickname||'без ника';
      btn.title='Клик: скопировать ник\nCtrl+клик: скопировать seller_id\nAlt+клик: открыть продавца на ggsel.net';
      btn.addEventListener('click',e=>{
        if(e.altKey){
          e.preventDefault(); e.stopPropagation();
          const url=`https://ggsel.net/sellers/${sellerId}`;
          vbcOpenInTab(url, true);
          return;
        }
        const val=e.ctrlKey?sellerId:(info.nickname||'');
        navigator.clipboard.writeText(val).then(()=>{
          const o=btn.textContent; btn.textContent='Скопировано!'; btn.classList.add('copied');
          setTimeout(()=>{ btn.textContent=o; btn.classList.remove('copied'); },800);
        });
      });
      row.replaceChild(btn,tmp);
    }).catch(()=>{ tmp.textContent='Ошибка никa'; });
  };

  // ==== МИНИ-КОММЕНТ ====
  const vbcEnsureCommentMini=(row)=>{
    let box=document.getElementById(vbcIDs.commentWrap);
    if(!box){
      box=document.createElement('div');
      box.id=vbcIDs.commentWrap;
      box.innerHTML=`
        <div class="vibe-mini2-row">
          <div class="vibe-mini2">
            <textarea id="${vbcIDs.commentText}" placeholder="Комментарий… (Ctrl+Enter — сохранить)"></textarea>
          </div>
          <button type="button" id="${vbcIDs.commentSave}" title="сохранить">Сохранить</button>
          <div id="${vbcIDs.commentNote}"></div>
        </div>`;
      row.appendChild(box);

      const ta=box.querySelector('#'+vbcIDs.commentText);
      const save=box.querySelector('#'+vbcIDs.commentSave);
      const note=box.querySelector('#'+vbcIDs.commentNote);

      const doSave=async ()=>{
        const sellerId=vbcGetSellerIdFromUrl(); if(!sellerId) return;
        save.disabled=true; save.classList.add('saving'); note.textContent='сохранение...';
        try{
          await vbcPostSellerComment(sellerId, ta.value||'');
          if(vbcST.infoCache[sellerId]) vbcST.infoCache[sellerId].comment=ta.value||'';
          vbcST.commentDirty=false; vbcST.commentOriginal=ta.value||'';
          note.textContent='сохранено ✓';
        }catch{
          note.textContent='ошибка сохранения';
        }finally{
          save.classList.remove('saving'); save.disabled=false;
          setTimeout(()=>{ note.textContent=''; }, 1000);
        }
      };

      ta.addEventListener('input', ()=>{ vbcST.commentDirty=true; });
      ta.addEventListener('focus', ()=>{ vbcST.commentFocused=true; });
      ta.addEventListener('blur',  ()=>{ vbcST.commentFocused=false; });
      ta.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && (e.ctrlKey||e.metaKey)) doSave(); });
      save.addEventListener('click', doSave);
    }
    return box;
  };

  // ==== ЧИПЫ ВВЕРХУ ====
  const vbcEnsureTopInfoBox=()=>{
    const infoLink=document.querySelector('a.target[href*="seller_info.asp"]');
    const tr=infoLink && infoLink.closest('tr'); if(!tr) return null;
    const tds=[...tr.querySelectorAll('td')];
    const lastTd=tds[tds.length-1]; if(!lastTd) return null;
    let box=lastTd.querySelector('#'+vbcIDs.chips);
    if(!box){ box=document.createElement('span'); box.id=vbcIDs.chips; lastTd.appendChild(box); }
    lastTd.style.whiteSpace='nowrap';

    if(!box.querySelector('#'+vbcIDs.saveTopHost)){
      const host=document.createElement('span');
      host.id=vbcIDs.saveTopHost;
      box.appendChild(host);
    }
    return box;
  };

  // one-shot фиксация времени в метках
  function vbcEnforceTimeInMetaOnce(){
    if (vbcST.metaFrozenOnce) return;
    vbcEnforceTimeInMeta();
    vbcST.metaFrozenOnce = true;
  }

  const vbcRenderTopInfo=(info)=>{
    const box=vbcEnsureTopInfoBox(); if(!box) return;

    if (box.dataset.frozen === '1') {
      const host=box.querySelector('#'+vbcIDs.saveTopHost);
      const save=document.getElementById(vbcIDs.commentSave);
      if(host && save && save.parentNode!==host) host.appendChild(save);
      return;
    }

    const ensureChip=(id)=> {
      let el=document.getElementById(id);
      if(!el){
        el=document.createElement('span');
        el.id=id; el.className='vibe-top-chip';
        const host=box.querySelector('#'+vbcIDs.saveTopHost);
        box.insertBefore(el, host || null);
      }
      return el;
    };

    const status=(info.status||'—').trim();
    const hold=(info.holdDays==null || String(info.holdDays).trim()==='') ? '7' : String(info.holdDays).trim();
    const ratingRaw=(info.rating||'—').trim();
    const online=(info.online || info.lastVisit || '—').trim();
    const blocked=/блокирован/i.test(status);
    const isRatingNegative=((rt)=>{
      const raw=rt.replace(/\s/g,'');
      if(raw.startsWith('-')) return true;
      const m=raw.match(/-?\d+(?:[.,]\d+)?/);
      if(!m) return false;
      const n=parseFloat(m[0].replace(',','.'));
      return !Number.isNaN(n) && n<0;
    })(ratingRaw);

    const statusEl=ensureChip(vbcIDs.chipStatus);
    statusEl.textContent=vbcEscapeHtml(status);
    statusEl.className='vibe-top-chip status'+(blocked?' block':'');

    const holdEl=ensureChip(vbcIDs.chipHold);
    holdEl.textContent=`Холд: ${hold} дн`;
    holdEl.className='vibe-top-chip';

    const ratingEl=ensureChip(vbcIDs.chipRating);
    ratingEl.textContent=`Рейтинг: ${vbcEscapeHtml(ratingRaw)}`;
    ratingEl.className='vibe-top-chip rating'+(isRatingNegative?' bad':'');

    const onlineEl=ensureChip(vbcIDs.chipOnline);
    onlineEl.textContent=`Онлайн: ${vbcEscapeHtml(online)}`;
    onlineEl.className='vibe-top-chip';

    const host=box.querySelector('#'+vbcIDs.saveTopHost);
    const save=document.getElementById(vbcIDs.commentSave);
    if(host && save && save.parentNode!==host) host.appendChild(save);

    box.dataset.frozen = '1';
    vbcST.topInfoFrozenForSid = vbcGetSellerIdFromUrl();
  };

  // ==== СООБЩЕНИЯ → BUBBLES (ТОЛЬКО в основной таблице) ====
  const vbcTransformAllMessages=()=>{
    const tbl=document.querySelector('table[width="100%"][cellpadding="2"]'); if(!tbl) return;
    tbl.querySelectorAll('tr').forEach(tr=>{
      if(tr.dataset.vbcDone==='1') return;
      const tds=tr.querySelectorAll('td'); if(tds.length!==3) return;
      const dateTd=tds[0], iconTd=tds[1], msgTd=tds[2];
      const img=iconTd.querySelector('img'); if(!img||(!img.src.includes('mail_out')&&!img.src.includes('mail_in'))) return;

      // SCROLLFIX: нормализуем дату
      const dateRaw=(dateTd.textContent||'')
        .replace(/[\n\r]+/g,'')
        .replace(/\u00A0/g,' ')
        .replace(/\s+/g,' ')
        .trim();
      if(!dateRaw) return;

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
        return `<span class="vibe-img-wrap" style="position:relative;display:inline-block;"><img${attrs}><span class="vibe-img-hitbox" style="width:${hitW}px;height:auto;top:50%;left:50%;transform:translate(-50%,-50%)"></span></span>`;
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
      dateTd.remove(); iconTd.remove(); tr.dataset.vbcDone='1';
    });
  };

  const vbcGroupMessagesByDate=()=>{
    const tbl=document.querySelector('table[width="100%"][cellpadding="2"]'); if(!tbl) return;
    const key=`__vbcMsgGroups_${vbcUID}`;
    if(!window[key]) window[key]={};
    tbl.querySelectorAll('tr.vibe-msg-out, tr.vibe-msg-in').forEach(tr=>{
      if(tr.dataset.vbcGrouped==='1') return;
      const meta=tr.querySelector('.vibe-msg-meta'); if(!meta) return;
      const full=meta.getAttribute('data-full-date')||meta.textContent.trim();
      const onlyDate=(full||'').split(' ')[0]; if(!onlyDate) return;
      let wrap=window[key][onlyDate];
      if(!wrap){
        wrap=document.createElement('tbody'); wrap.className='vibe-date-group'; wrap.dataset.vibedate=onlyDate;
        const r=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=3;
        const label=document.createElement('div'); label.className='vibe-date-label'; label.textContent=onlyDate;
        td.appendChild(label); r.appendChild(td); wrap.appendChild(r); tbl.appendChild(wrap);
        window[key][onlyDate]=wrap;
      }
      wrap.appendChild(tr); tr.dataset.vbcGrouped='1';
    });
  };

  // ==== ЛАЙТБООКС ====
  const vbcOpenLightbox=(src)=>{
    const old=document.getElementById('vibe-lightbox-overlay'); if(old) old.remove();
    const o=document.createElement('div'); o.id='vibe-lightbox-overlay'; o.className='vibe-lightbox-overlay';
    o.innerHTML=`<img class="vibe-lightbox-img" src="${src}" draggable="false">`;
    const img=o.querySelector('.vibe-lightbox-img');

    let scale=1, minScale=0.18, maxScale=6, ox=0, oy=0;
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
        if(next<=1.001){ scale=1; ox=0; oy=0; apply(); }
        else{ const c=center(); const ix=(c.x-window.innerWidth/2-ox)/scale, iy=(c.y-window.innerHeight/2-oy)/scale; scale=next; ox-=ix*(scale-prev); oy-=iy*(scale-prev); }
      }
      apply();
    },{passive:false});

    let drag=false,sx=0,sy=0,sox=0,soy=0;
    img.addEventListener('mousedown',(e)=>{ drag=true; sx=e.clientX; sy=e.clientY; sox=ox; soy=oy; img.style.cursor='grabbing'; e.preventDefault(); });
    window.addEventListener('mousemove',(e)=>{ if(!drag) return; ox=sox+(e.clientX-sx); oy=soy+(e.clientY-sy); apply(); });
    window.addEventListener('mouseup',()=>{ if(drag) img.style.cursor='pointer'; drag=false; });
    img.addEventListener('dblclick',(e)=>{ e.preventDefault(); scale=1; ox=0; oy=0; apply(); });

    const close=()=>{ o.remove(); };
    const onKey=(ev)=>{ if(ev.key==='Escape') close(); };
    document.addEventListener('keydown', onKey, {once:true});
    o.addEventListener('click', e=>{ if(e.target===o) close(); });
    o.addEventListener('touchmove', e=> e.preventDefault(), {passive:false});

    document.body.appendChild(o);
    img.setAttribute('tabindex','0'); setTimeout(()=>img.focus(),50);
  };
  const vbcHandleBubbleImages=()=>{
    document.querySelectorAll('.vibe-msg-bubble .vibe-img-wrap').forEach(wrap=>{
      const img=wrap.querySelector('img'); const hb=wrap.querySelector('.vibe-img-hitbox'); if(!img||!hb) return;
      const handler=e=>{
        e.preventDefault(); e.stopPropagation();
        const a=img.closest('a'); const href=a&&a.href?a.href:img.src;
        if(/\.(png|jpe?g|gif|webp)$/i.test(href)&&!/img_deb\.ashx/i.test(href)) vbcOpenLightbox(href); else vbcOpenLightbox(img.src);
      };
      img.addEventListener('click',handler); hb.addEventListener('click',handler);
    });
  };

  // ==== мягкая «удалить» ====
  const vbcInitRemoveButtonFix=()=>{
    const tbl=document.querySelector('table[width="100%"][cellpadding="2"]'); if(!tbl) return;
    tbl.querySelectorAll('a.target[href*="id_s="][href*="del="]').forEach(link=>{
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
  };

  // ==== ИЗВЛЕЧЕНИЕ ID ====
  const vbcExtractProductIds = (root) =>{
    const set = new Set();
    root.querySelectorAll('a[href*="catalog/product"]').forEach(a=>{
      let href = a.getAttribute('href') || '';
      try{ href = decodeURIComponent(href); }catch(_){}
      href = href.split('#')[0];
      let last=null, m;
      const rx=/[\/-](\d{5,8})(?=$|[\/?])/g;
      while((m = rx.exec(href))) last = m[1];
      if(last) set.add(last);
    });
    const txt = (root.innerText || root.textContent || '').replace(/\s+/g,' ');
    let mm; const rx=/\b(\d{5,8})\b/g;
    while((mm = rx.exec(txt))) set.add(mm[1]);
    return [...set];
  };
  const vbcExtractOrderIds = (root) =>{
    const set = new Set();
    root.querySelectorAll('a[href*="inv_of_buyer.asp?id_i="]').forEach(a=>{
      const href=a.getAttribute('href')||'';
      const m=href.match(/id_i=(\d{5,12})/i);
      if(m) set.add(m[1]);
    });
    const txt=(root.innerText || root.textContent || '').replace(/\s+/g,' ');
    let mm; const rx=/\b(\d{9})\b/g;
    while((mm = rx.exec(txt))) set.add(mm[1]);
    return [...set];
  };

  // ==== «ЗАКАЗЫ» + «ТОВАРЫ» — чипы (СТАТИЧНЫЕ) ====
  const vbcEnhanceOrdersAndProducts = () => {
    document.querySelectorAll('.vibe-msg-bubble').forEach((bubble) => {
      const textEl = bubble.querySelector('.vibe-msg-text');
      if (!textEl) return;

      if (!textEl.dataset.vbcCleaned) {
        textEl.querySelectorAll('span[style*="#799679"]').forEach(span=>{
          const toRemove = [span];
          let n = span.nextSibling;
          while(n){
            if (n.nodeType===1 && n.tagName==='A' && /inv_of_buyer\.asp/i.test(n.getAttribute('href')||'')) { toRemove.push(n); n = n.nextSibling; continue; }
            if (n.nodeType===3 && /^\s*$/.test(n.nodeValue||'')) { toRemove.push(n); n = n.nextSibling; continue; }
            break;
          }
          toRemove.forEach(el=> el && el.remove());
        });
        textEl.dataset.vbcCleaned = '1';
      }

      if (textEl.querySelector('.vbc-prodbar')) return;

      const prodIds = vbcExtractProductIds(textEl);
      const orderIds = vbcExtractOrderIds(textEl);
      if (prodIds.length===0 && orderIds.length===0) return;

      const host = document.createElement('div');
      host.className = 'vbc-prodbar';
      textEl.appendChild(host);

      const copyList = (ids, labelEl) => {
        if (!ids.length) return;
        const str = [...new Set(ids)].join(', ');
        navigator.clipboard.writeText(str).then(()=>{
          labelEl.classList.add('copied');
          const orig = labelEl.textContent;
          labelEl.textContent = orig.replace(/\s*:?$/, '') + ' — скопировано!';
          setTimeout(()=>{ labelEl.classList.remove('copied'); labelEl.textContent = orig; }, 900);
        });
      };

      if (orderIds.length){
        const unique = [...new Set(orderIds)];
        const lab = document.createElement('span');
        lab.className = 'vibe-prod-label';
        lab.textContent = 'заказы:';
        lab.title = 'Клик — скопировать все ID заказов через запятую';
        lab.addEventListener('click', ()=> copyList(unique, lab));
        host.appendChild(lab);

        unique.forEach(id=>{
          const chip = document.createElement('span');
          chip.className = 'vibe-prod-chip';
          chip.textContent = id;
          chip.title = 'Клик — открыть заказ; Ctrl — копировать ID; Alt — открыть фоном';
          chip.addEventListener('click', (e)=>{
            e.preventDefault();
            if(e.ctrlKey){
              navigator.clipboard.writeText(id).then(()=>{
                chip.classList.add('copied'); const prev=chip.textContent; chip.textContent='✓';
                setTimeout(()=>{ chip.textContent=prev; chip.classList.remove('copied'); }, 650);
              });
              return;
            }
            vbcRememberThisMessagesUrl();
            const href = location.origin + '/asp/inv_of_buyer.asp?id_i=' + id;
            vbcOpenInTab(href, !e.altKey);
          });
          host.appendChild(chip);
        });
      }

      if (prodIds.length){
        const unique = [...new Set(prodIds)];
        const lab2 = document.createElement('span');
        lab2.className = 'vibe-prod-label';
        lab2.textContent = (orderIds.length ? ' ' : '') + 'товары:';
        lab2.title = 'Клик — скопировать все ID товаров через запятую';
        lab2.addEventListener('click', ()=> copyList(unique, lab2));
        host.appendChild(lab2);

        unique.forEach(id=>{
          const chip = document.createElement('span');
          chip.className = 'vibe-prod-chip';
          chip.textContent = id;
          chip.title = 'Клик — открыть товар; Ctrl — копировать ID; Alt — открыть фоном';
          chip.addEventListener('click', (e)=>{
            e.preventDefault();
            if(e.ctrlKey){
              navigator.clipboard.writeText(id).then(()=>{
                chip.classList.add('copied'); const prev=chip.textContent; chip.textContent='✓';
                setTimeout(()=>{ chip.textContent=prev; chip.classList.remove('copied'); }, 650);
              });
              return;
            }
            const href = 'https://ggsel.net/catalog/product/' + id;
            vbcOpenInTab(href, !e.altKey);
          });
          host.appendChild(chip);
        });
      }
    });
  };

  // ==== ХЭШ-СКРОЛЛ и мета-время ====
  const vbcScrollToMessageFromHash=()=>{
    if(!location.hash.startsWith('#vibe_msg=')){ vbcST.hashScrolledRaw=null; return; }
    const raw=decodeURIComponent(location.hash.replace(/^#vibe_msg=/,'')).replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim();
    if(vbcST.hashScrolledRaw===raw) return;

    const tryScrollOnce=()=>{
      if(vbcST.hashScrolledRaw===raw) return true;

      // 1) точное совпадение по атрибуту data-full-date
      let target=document.querySelector(`.vibe-msg-meta[data-full-date="${CSS?.escape ? CSS.escape(raw) : raw.replace(/"/g,'\\"')}"]`);

      // 2) fallback: нормализованное сравнение всех .vibe-msg-meta
      if(!target){
        const metas=[...document.querySelectorAll('.vibe-msg-meta')];
        target=metas.find(m=>{
          const full=(m.getAttribute('data-full-date')||m.textContent||'').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim();
          return full===raw || (raw.length>3 && full.startsWith(raw.slice(0,-3)));
        });
      }

      // 3) самый грубый fallback по исходным td.td_title
      if(!target){
        const tds=[...document.querySelectorAll('td.td_title')];
        target=tds.find(td => ((td.textContent||'').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim())===raw );
      }

      if(!target) return false;

      vbcST.hashScrolledRaw=raw;
      const bubble=target.closest('.vibe-msg-bubble')||target;
      bubble.scrollIntoView({behavior:'smooth', block:'center'});
      bubble.classList.add('vibe-highlight');
      setTimeout(()=> bubble.classList.remove('vibe-highlight'), 2600);
      return true;
    };

    (function attempt(left){
      if(tryScrollOnce()) return;
      if(left>0) setTimeout(()=>attempt(left-1),300);
    })(24);
  };

  const vbcEnforceTimeInMeta=()=>{
    document.querySelectorAll('.vibe-msg-meta').forEach(el=>{
      const btn=el.querySelector('.vibe-remove-btn-soft');
      const src=el.getAttribute('data-full-date')||(el.textContent||'').trim();
      const m=src.match(/\b(\d{1,2}:\d{2}:\d{2})\b/); el.textContent=m?m[1]:'';
      if(btn) el.prepend(btn);
    });
  };

  // ==== INIT ====
  const vbcUpdateInlineCommentAndChips=()=>{
    const sellerId=vbcGetSellerIdFromUrl(); if(!sellerId) return;
    const taEl=document.querySelector('#'+vbcIDs.commentText);
    const chipsBox = document.querySelector('#'+vbcIDs.chips);
    const chipsFrozen = chipsBox && chipsBox.dataset.frozen === '1';

    if (vbcST.commentSellerId !== sellerId){
      vbcST.commentSellerId = sellerId;
      vbcST.commentDirty = false;
      vbcST.commentFocused = false;
      vbcST.commentOriginal = '';
    }
    vbcFetchSellerInfo(sellerId).then(info=>{
      if (!chipsFrozen) {
        vbcRenderTopInfo(info);
      } else {
        const host=document.querySelector('#'+vbcIDs.chips+' #'+vbcIDs.saveTopHost);
        const save=document.getElementById(vbcIDs.commentSave);
        if(host && save && save.parentNode!==host) host.appendChild(save);
      }
      if(taEl && !vbcST.commentDirty && !vbcST.commentFocused){
        taEl.value = info.comment || '';
        vbcST.commentOriginal = taEl.value;
      }
    }).catch(()=>{
      if (!chipsFrozen) {
        vbcRenderTopInfo({status:'—', holdDays:null, rating:'—', online:'—', lastVisit:''});
      } else {
        const host=document.querySelector('#'+vbcIDs.chips+' #'+vbcIDs.saveTopHost);
        const save=document.getElementById(vbcIDs.commentSave);
        if(host && save && save.parentNode!==host) host.appendChild(save);
      }
    });
  };

  const vbcDrawRow=async()=>{
    const found=vbcFindActionLinks(); if(!found) return;
    const {host,markRead}=found;
    const old=document.getElementById(vbcIDs.row); if(old && old.parentNode!==host) old.remove();

    let row=document.getElementById(vbcIDs.row);
    if(!row){
      row=document.createElement('div'); row.id=vbcIDs.row; row.className='vibe-btn-fake-row';
      row.style.position='absolute'; row.style.top='0'; row.style.left='0'; row.style.pointerEvents='none';
      if(markRead){
        const b2=document.createElement('button'); b2.className='vibe-btn-fake vibe-btn-fake-black'; b2.dataset.role='read'; b2.style.pointerEvents='auto';
        row.appendChild(b2);
      }
      host.appendChild(row);
    }
    if(row.parentNode!==host) host.appendChild(row);

    const btnRead=row.querySelector('button[data-role="read"]');
    if(btnRead && markRead){ btnRead.textContent=(markRead.textContent||'отметить прочитанным').trim(); btnRead.onclick=e=>{ e.preventDefault(); markRead.click(); }; }

    vbcEnsureNickButton(row);
    vbcEnsureCommentMini(row);
  };

  const vbcMainInit=(force)=>{
    if(force || !vbcST.initedOnce || vbcST.lastUrl!==location.href){
      // SCROLLFIX-доп: если мы на новой странице/якоре — сброс одноразового флага фиксации времени
      if (vbcST.lastUrl !== location.href) {
        vbcST.metaFrozenOnce = false;
        vbcST.hashScrolledRaw = null;
      }

      vbcST.initedOnce=true;
      vbcST.lastUrl=location.href;

      // 0) Консистентность — если делаем replace, сохраняем хэш
      if(vbcEnsureSellerConsistency()) return;

      // 1) Пустая страница — восстановление каноники (с хэшем)
      tryRecoverIfBlank();

      // 2) остальная инициализация
      vbcTransformAllMessages();
      vbcGroupMessagesByDate();
      vbcDrawRow();
      vbcInitRemoveButtonFix();
      vbcHandleBubbleImages();
      vbcEnforceTimeInMetaOnce();   // фиксируем время в метах один раз на этой странице
      vbcEnsureTopInfoBox();
      vbcUpdateInlineCommentAndChips();
      vbcEnhanceOrdersAndProducts();
      vbcScrollToMessageFromHash();

      // глобально — если клик по нативной ссылке заказа, запомним канонику переписки
      if(!vbcST.docClickBound){
        document.addEventListener('click', (e)=>{
          const a=e.target && e.target.closest && e.target.closest('a[href*="inv_of_buyer.asp"]');
          if(!a) return;
          vbcRememberThisMessagesUrl();
        }, {capture:true, passive:true});
        vbcST.docClickBound=true;
      }
    }
  };

  const vbcObs=new MutationObserver(()=>{
    const now=Date.now();
    if(now-vbcST.lastMutationRun>300){
      vbcST.lastMutationRun=now;
      if(vbcEnsureSellerConsistency()) return;
      vbcMainInit(true);
      vbcUpdateInlineCommentAndChips();
      vbcEnhanceOrdersAndProducts();
      vbcEnforceTimeInMetaOnce();
      const host=document.querySelector('#'+vbcIDs.chips+' #'+vbcIDs.saveTopHost);
      const save=document.getElementById(vbcIDs.commentSave);
      if(host && save && save.parentNode!==host) host.appendChild(save);
    }
  });
  vbcObs.observe(document.body,{childList:true,subtree:true});

  window.addEventListener('load',()=>{ vbcMainInit(true); vbcEnforceTimeInMetaOnce(); });
  window.addEventListener('resize',()=>{/* no-op */});
  window.addEventListener('popstate',()=>{ vbcMainInit(true); });
  window.addEventListener('hashchange',()=>{ vbcST.hashScrolledRaw = null; vbcMainInit(true); });
})();
