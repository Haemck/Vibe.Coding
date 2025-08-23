// ==UserScript==
// @name         Digiseller: Кнопка Проблемы
// @namespace    https://digiseller.ru/
// @version      4.9
// @description  Ищет первую запись с пустым «Номер заказа» и обновляет её; если нет — создаёт новую. Поиск пустой строки — по ИМЕНИ (field_key=field_name) с фолбэком по field_id. Запись: по именам, при ошибке — по id. Поле «Продавец» — ТЕКСТ, ник берётся из <span class="dm-seller-link">…</span>.
// @author       vibe
// @match        https://my.digiseller.ru/asp/inv_of_buyer.asp*
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ProblemButton.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/ProblemButton.user.js
// @grant        GM_addStyle
// @connect      open.larksuite.com
// ==/UserScript==

(function () {
  'use strict';

  // =================== КОНФИГ Lark ===================
  const LARK_APP_ID     = 'cli_a81cb0e116b4102f';
  const LARK_APP_SECRET = 'PxOqztub8iur2iEXsynuCbjG8QqQKb48';
  const LARK_APP_TOKEN  = 'Md1BbzhFDawwyNsvRggl8ngqgle';
  const LARK_TABLE_ID   = 'tblDJRpsVKzzScRx';

  // Имена столбцов — как в базе
  const FIELD_NAMES = {
    order:    'Номер заказа',     // Число
    date:     'Дата',             // Дата (ms epoch)
    seller:   'Продавец',         // ТЕКСТ (ник)
    status:   'Статус проблемы',  // Одиночный (Single select)
    comment:  'Комментарий',      // Текст
    operator: 'ФИО',              // Текст
  };

  // Опциональный дефолт
  const SET_DEFAULT_STATUS  = true;
  const DEFAULT_STATUS_TEXT = 'Не решено';

  // =================== КЭШИ ===================
  const LS_KEY_LARK_TOKEN   = 'lark_token_cache';
  const LS_KEY_FIELDS_INFO  = `lark_fields_${LARK_APP_TOKEN}_${LARK_TABLE_ID}`;
  const LS_KEY_OPERATOR     = 'bananza_operator_name';

  // =================== Стили ===================
  GM_addStyle(`
    .dm-floating-export-wrap{position:absolute;z-index:9999;display:flex;align-items:center;top:0;left:0;pointer-events:none}
    .dm-floating-export-inner{pointer-events:auto;display:flex;align-items:center;min-width:0}
    .dm-cb-link.dm-export-btn-morph{background:#fff4f4;border:1.5px solid #ffb8b8;border-radius:7px;cursor:pointer;
      transition:background .16s,box-shadow .16s,border-color .16s,width .30s cubic-bezier(.57,1.69,.6,.93);
      font-weight:600;font-size:15px;color:#1a1a1a !important;outline:none;box-shadow:0 1px 7px 0 #ffb8b833;margin-left:6px;user-select:none;
      display:flex;align-items:center;padding:4px 7px 4px 10px;min-width:38px;width:auto;text-align:left;white-space:nowrap;gap:7px;overflow:visible}
    .dm-cb-link.dm-export-btn-morph.expanded{min-width:340px;width:390px;max-width:750px;background:#fff4f4;box-shadow:0 2px 12px 1px #ffb8b844}
    .dm-cb-link.dm-export-btn-morph.has-operator{width:570px !important;transition:width .36s cubic-bezier(.57,1.69,.6,.93)}
    .dm-export-comment-morph{font-size:15px;padding:2px 8px;border:1.5px solid #ffb8b8;border-radius:4px;outline:none;background:#fff8f8;color:#222;
      transition:box-shadow .14s,width .22s cubic-bezier(.61,1.69,.6,.93);min-width:80px;max-width:450px;width:110px;margin:0;box-sizing:border-box;line-height:1.4;display:block;flex:1 1 110px}
    .dm-export-send-btn-morph{background:#fff4f4;border:1.5px solid #ffb8b8;border-radius:4px;color:#222 !important;font-size:17px;font-weight:700;
      padding:2px 14px;cursor:pointer;margin:0;height:32px;transition:background .12s,border-color .12s;box-shadow:0 1px 7px 0 #ffb8b833;outline:none;display:flex;align-items:center;justify-content:center}
    .dm-export-send-btn-morph:disabled{opacity:.55;cursor:not-allowed}
    .dm-export-operator-btn{background:#fff4f4;border:1.5px solid #ffb8b8;border-radius:4px;color:#ba6fb0;font-size:18px;font-weight:600;
      padding:2px 6px;cursor:pointer;margin-left:7px;height:32px;min-width:27px;outline:none;display:flex;align-items:center;opacity:.34;transition:background .10s,border-color .10s,color .15s,opacity .15s}
    .dm-export-operator-field{font-size:15px;margin-left:7px;width:170px;padding:2px 12px;border:1.5px solid #ffb8b8;border-radius:4px;background:#fff8f8;color:#4a3841;outline:none;transition:box-shadow .13s;flex:none;display:block}
  `);

  // =================== Хелперы ===================
  const J = (t)=>{try{return JSON.parse(t)}catch{return null}};
  const getLS=(k,d=null)=>{const v=localStorage.getItem(k);return v==null?d:v;};
  const setLS=(k,v)=>localStorage.setItem(k, typeof v==='string'?v:JSON.stringify(v));
  const delLS=(k)=>localStorage.removeItem(k);
  const getOp=()=>getLS(LS_KEY_OPERATOR)||'';
  const setOp=v=>setLS(LS_KEY_OPERATOR,v||'');

  function yyyymmddToMs(s){const m=/^(\d{4})\/(\d{2})\/(\d{2})$/.exec(String(s||'').trim()); if(!m) return Date.now(); const [_,Y,M,D]=m; return new Date(`${Y}-${M}-${D}T00:00:00`).getTime();}
  function getTodayStr(){const d=new Date(),mm=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return `${d.getFullYear()}/${mm}/${dd}`;}
  function castInt(v){if(v==null) return undefined; const m=String(v).match(/-?\d+/); if(!m) return undefined; const n=Number(m[0]); return Number.isFinite(n)?n:undefined;}
  function norm(s){return String(s||'').toLowerCase().replace(/\s+/g,'').replace(/[«»"']/g,'').replace(/№/g,'no').trim();}
  const isFieldNameNotFound = (txt)=>/1254045|FieldNameNotFound/i.test(String(txt||''));

  // ===== продавец из span.dm-seller-link (ник) + заказ =====
  function getSellerNickname(){
    const el = document.querySelector('span.dm-seller-link[title*="Открыть профиль продавца"]');
    return el ? el.textContent.trim() : '';
  }
  function getSellerAndOrder(){
    let seller = getSellerNickname();
    let order = '';
    // Заказ из таблицы
    document.querySelectorAll('tr').forEach(tr=>{
      const label=tr.querySelector('.namerow');
      const val=tr.querySelector('.inforow');
      if(!label||!val) return;
      if(!seller && /ПРОДАВЕЦ/i.test(label.innerText)){
        // фолбэк, если вдруг нет span
        seller = val.textContent.replace(/\[\s*подробнее\s*\]/i,'').trim();
      }
      if(label.innerText.replace(/\s/g,'').includes('ЗАКАЗ№')){
        order = val.textContent.trim();
      }
    });
    return { seller, order };
  }

  // =================== HTTP ===================
  function gmRequest({method,url,headers={},data,timeout=30000}){
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({method,url,headers,data,timeout,
        onload:r=>resolve(r),
        onerror:e=>reject(e),
        ontimeout:()=>reject(new Error('Request timeout'))
      });
    });
  }
  const gmGet=(url,headers={})=>gmRequest({method:'GET',url,headers});
  const gmPostJSON=(url,json,headers={})=>gmRequest({
    method:'POST',
    url,
    headers:Object.assign({'Content-Type':'application/json; charset=utf-8'},headers),
    data:JSON.stringify(json||{})
  });

  // =================== Auth ===================
  async function getLarkTenantToken(){
    const c=J(getLS(LS_KEY_LARK_TOKEN));
    if(c && c.token && c.exp && Date.now()<c.exp-60_000) return c.token;
    const r=await gmPostJSON('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
      { app_id:LARK_APP_ID, app_secret:LARK_APP_SECRET });
    if(r.status!==200) throw new Error(`Auth HTTP ${r.status}: ${r.responseText}`);
    const d=J(r.responseText); if(!d || d.code!==0 || !d.tenant_access_token) throw new Error('Auth error: '+r.responseText);
    const token=d.tenant_access_token, expMs=Date.now()+((d.expire?d.expire:7200)*1000);
    setLS(LS_KEY_LARK_TOKEN,{token,exp:expMs});
    return token;
  }

  // =================== Схема таблицы ===================
  async function listFieldsAll(){
    const token=await getLarkTenantToken();
    let url=`https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(LARK_APP_TOKEN)}/tables/${encodeURIComponent(LARK_TABLE_ID)}/fields?page_size=200`;
    const headers={Authorization:`Bearer ${token}`};
    let items=[];
    while(true){
      const r=await gmGet(url,headers);
      if(r.status!==200) throw new Error(`Fields HTTP ${r.status}: ${r.responseText}`);
      const d=J(r.responseText); if(!d || d.code!==0) throw new Error('Fields error: '+r.responseText);
      items=items.concat((d.data&&d.data.items)||[]);
      if(d.data && d.data.has_more && d.data.page_token){
        url=`https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(LARK_APP_TOKEN)}/tables/${encodeURIComponent(LARK_TABLE_ID)}/fields?page_size=200&page_token=${encodeURIComponent(d.data.page_token)}`;
      } else break;
    }
    return items;
  }
  function pickByHumanName(items, humanName){
    let it = items.find(f=>f.field_name===humanName);
    if(!it){ const target=norm(humanName); it=items.find(f=>norm(f.field_name)===target); }
    return it ? { id: it.field_id, name: it.field_name } : null;
  }
  async function ensureFieldsInfo(forceRefresh=false){
    if(!forceRefresh){
      const cached=J(getLS(LS_KEY_FIELDS_INFO));
      if(cached && cached.order && cached.date) return cached;
    }
    const items=await listFieldsAll();
    const info={
      order:   pickByHumanName(items, FIELD_NAMES.order),
      date:    pickByHumanName(items, FIELD_NAMES.date),
      seller:  pickByHumanName(items, FIELD_NAMES.seller),
      status:  pickByHumanName(items, FIELD_NAMES.status),
      comment: pickByHumanName(items, FIELD_NAMES.comment),
      operator:pickByHumanName(items, FIELD_NAMES.operator),
    };
    const miss = Object.entries(info).filter(([,v])=>!v).map(([k])=>k);
    if(miss.length){ delLS(LS_KEY_FIELDS_INFO); throw new Error('Не найдены столбцы: '+miss.join(', ')); }
    setLS(LS_KEY_FIELDS_INFO, info);
    return info;
  }

  // =================== Сбор полей (по ИМЕНАМ / по ID) ===================
  function buildFieldsByName(values, info){
    const F={}, k=f=>f.name;
    if(info.order && values.order!=null){ const n=castInt(values.order); if(n!==undefined) F[k(info.order)]=n; }
    if(info.date && values.dateMs){ F[k(info.date)]=values.dateMs; }
    if(info.seller && values.seller){ const s=String(values.seller||'').trim(); if(s) F[k(info.seller)]=s; } // <-- ТЕКСТ
    if(info.operator && values.operator){ F[k(info.operator)]=String(values.operator); }
    if(info.comment && values.comment){ F[k(info.comment)]=String(values.comment); }
    if(SET_DEFAULT_STATUS && info.status){ F[k(info.status)]=DEFAULT_STATUS_TEXT; }
    return F;
  }
  function buildFieldsById(values, info){
    const F={}, k=f=>f.id;
    if(info.order && values.order!=null){ const n=castInt(values.order); if(n!==undefined) F[k(info.order)]=n; }
    if(info.date && values.dateMs){ F[k(info.date)]=values.dateMs; }
    if(info.seller && values.seller){ const s=String(values.seller||'').trim(); if(s) F[k(info.seller)]=s; } // <-- ТЕКСТ
    if(info.operator && values.operator){ F[k(info.operator)]=String(values.operator); }
    if(info.comment && values.comment){ F[k(info.comment)]=String(values.comment); }
    if(SET_DEFAULT_STATUS && info.status){ F[k(info.status)]=DEFAULT_STATUS_TEXT; }
    return F;
  }

  // =================== НАЙТИ ПЕРВУЮ ПУСТУЮ ===================
  async function findFirstEmptyOrderRecordId(info){
    const token=await getLarkTenantToken();
    const orderName = info.order && info.order.name;
    const orderId   = info.order && info.order.id;

    // 1) по ИМЕНИ
    if(orderName){
      let pageToken='';
      while(true){
        const base=`https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(LARK_APP_TOKEN)}/tables/${encodeURIComponent(LARK_TABLE_ID)}/records?page_size=200&field_key=field_name`;
        const url = pageToken ? `${base}&page_token=${encodeURIComponent(pageToken)}` : base;
        const r = await gmGet(url, { Authorization:`Bearer ${token}`, 'X-Field-Key':'field_name' });
        if(r.status!==200) throw new Error(`Query HTTP ${r.status}: ${r.responseText}`);
        const data=J(r.responseText);
        if(!data || data.code!==0){
          if(isFieldNameNotFound(r.responseText)) break; // к фолбэку по id
          else throw new Error('Query error: '+r.responseText);
        }
        const items=(data.data && data.data.items) || [];
        for(const rec of items){
          const fields = rec.fields || {};
          const v = fields[orderName];
          if(v === undefined || v === null || v === '') return rec.record_id;
        }
        if(data.data && data.data.has_more && data.data.page_token) { pageToken=data.data.page_token; continue; }
        break;
      }
    }

    // 2) фолбэк по ID
    if(orderId){
      let pageToken='';
      while(true){
        const base=`https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(LARK_APP_TOKEN)}/tables/${encodeURIComponent(LARK_TABLE_ID)}/records?page_size=200&field_key=field_id`;
        const url = pageToken ? `${base}&page_token=${encodeURIComponent(pageToken)}` : base;
        const r = await gmGet(url, { Authorization:`Bearer ${token}`, 'X-Field-Key':'field_id' });
        if(r.status!==200) throw new Error(`Query HTTP ${r.status}: ${r.responseText}`);
        const data=J(r.responseText); if(!data || data.code!==0) throw new Error('Query error: '+r.responseText);
        const items=(data.data && data.data.items) || [];
        for(const rec of items){
          const fields = rec.fields || {};
          const v = fields[orderId];
          if(v === undefined || v === null || v === '') return rec.record_id;
        }
        if(data.data && data.data.has_more && data.data.page_token) { pageToken=data.data.page_token; continue; }
        break;
      }
    }

    return null;
  }

  // =================== POST с ретраем ===================
  async function postWithRetry(url, headers, payload){
    let tries=4;
    while(tries-- > 0){
      const r=await gmPostJSON(url,payload,headers);
      const body=J(r.responseText);
      if(r.status===200 && body && body.code===0) return body;

      const txt=r.responseText||'';
      const m=txt.match(/fields\.([^'"]+)[\'\"]/i);
      const bad=m&&m[1];
      if(bad){
        const rec=payload.records && payload.records[0];
        if(rec && rec.fields && Object.prototype.hasOwnProperty.call(rec.fields,bad)){
          delete rec.fields[bad];
          continue;
        }
      }
      if(isFieldNameNotFound(txt)){ delLS(LS_KEY_FIELDS_INFO); }
      throw new Error(`Bitable error: ${txt || `HTTP ${r.status}`}`);
    }
    throw new Error('Bitable: too many retries');
  }

  // =================== UPDATE-или-CREATE ===================
  async function upsert(values){
    const token=await getLarkTenantToken();
    let info = await ensureFieldsInfo(false);

    const fieldsByName = buildFieldsByName(values, info);
    const fieldsById   = buildFieldsById(values, info);

    const base = `https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(LARK_APP_TOKEN)}/tables/${encodeURIComponent(LARK_TABLE_ID)}/records`;
    const hdrName = { Authorization:`Bearer ${token}`, 'Content-Type':'application/json; charset=utf-8', 'X-Field-Key':'field_name' };
    const hdrId   = { Authorization:`Bearer ${token}`, 'Content-Type':'application/json; charset=utf-8', 'X-Field-Key':'field_id' };

    const emptyId = await findFirstEmptyOrderRecordId(info);

    async function tryByNameUpdate(recId){
      const url = `${base}/batch_update?field_key=field_name`;
      return postWithRetry(url, hdrName, { records:[{ record_id: recId, fields: fieldsByName }] });
    }
    async function tryByIdUpdate(recId){
      const url = `${base}/batch_update?field_key=field_id`;
      return postWithRetry(url, hdrId, { records:[{ record_id: recId, fields: fieldsById }] });
    }
    async function tryByNameCreate(){
      const url = `${base}/batch_create?field_key=field_name`;
      return postWithRetry(url, hdrName, { records:[{ fields: fieldsByName }] });
    }
    async function tryByIdCreate(){
      const url = `${base}/batch_create?field_key=field_id`;
      return postWithRetry(url, hdrId, { records:[{ fields: fieldsById }] });
    }

    if(emptyId){
      try{
        return await tryByNameUpdate(emptyId);
      }catch(e1){
        const t=String(e1 && e1.message || '');
        if(isFieldNameNotFound(t)){
          delLS(LS_KEY_FIELDS_INFO);
          info = await ensureFieldsInfo(true);
          const retryByName = buildFieldsByName(values, info);
          try{
            const url = `${base}/batch_update?field_key=field_name`;
            return await postWithRetry(url, hdrName, { records:[{ record_id: emptyId, fields: retryByName }] });
          }catch(e2){
            return await tryByIdUpdate(emptyId);
          }
        }
        return await tryByIdUpdate(emptyId);
      }
    }

    // пустых нет — создаём
    try{
      return await tryByNameCreate();
    }catch(e1){
      const t=String(e1 && e1.message || '');
      if(isFieldNameNotFound(t)){
        delLS(LS_KEY_FIELDS_INFO);
        info = await ensureFieldsInfo(true);
        const retryByName = buildFieldsByName(values, info);
        try{
          const url = `${base}/batch_create?field_key=field_name`;
          return await postWithRetry(url, hdrName, { records:[{ fields: retryByName }] });
        }catch(e2){
          return await tryByIdCreate();
        }
      }
      return await tryByIdCreate();
    }
  }

  // =================== UI ===================
  let sending=false;

  function resetBtn(btn,text){ btn.innerHTML=text; btn.classList.remove('expanded','has-operator'); btn.disabled=false; btn.style.width=''; sending=false; }
  function autosizeInput(input,max){
    const s=document.createElement('span'); s.style.position='absolute'; s.style.left='-9999px'; s.style.visibility='hidden';
    const cs=getComputedStyle(input); s.style.font=cs.font; s.style.fontSize=cs.fontSize; s.style.fontWeight=cs.fontWeight; s.style.letterSpacing=cs.letterSpacing;
    document.body.appendChild(s);
    function resize(){ s.textContent=input.value||input.placeholder||''; input.style.width=Math.max(110, Math.min(s.offsetWidth+28,max))+'px'; }
    input.addEventListener('input',resize); input.addEventListener('focus',resize); input.addEventListener('blur',resize); setTimeout(resize,12);
    return ()=>document.body.removeChild(s);
  }
  function getToday(){ return getTodayStr(); }

  async function send(orderRaw, today, seller, comment, operator, btn){
    try{
      sending=true; btn.classList.remove('expanded','has-operator'); btn.style.width=''; btn.innerHTML='Отправляем...'; btn.disabled=true;
      const values = {
        order: orderRaw,               // → Номер заказа (Число)
        dateMs: yyyymmddToMs(today),   // → Дата (ms epoch)
        seller,                        // → Продавец (ТЕКСТ: ник)
        comment: comment || '',        // → Комментарий
        operator: operator || ''       // → ФИО (текст)
      };
      await upsert(values);
      resetBtn(btn,'Готово!');
    }catch(e){
      console.error('[ProblemButton:Lark]', e);
      resetBtn(btn,'Ошибка!');
    }finally{ setTimeout(()=>resetBtn(btn,'Проблема'),1400); }
  }

  function makeButton(){
    const btn=document.createElement('button');
    btn.className='dm-cb-link dm-export-btn-morph'; btn.type='button'; btn.innerHTML='Проблема'; btn.title='Заполнить/создать строку в Lark';
    let opened=false, opInput=null, cleanup=null;

    btn.addEventListener('click', ()=>{
      if(sending||opened) return;
      opened=true; btn.classList.add('expanded'); btn.style.width='390px'; btn.innerHTML='';

      const input=document.createElement('input'); input.type='text'; input.placeholder='Комментарий...'; input.className='dm-export-comment-morph'; input.maxLength=150;
      cleanup=autosizeInput(input,450);

      const sendBtn=document.createElement('button'); sendBtn.className='dm-export-send-btn-morph'; sendBtn.type='button'; sendBtn.textContent='▶';

      const opBtn=document.createElement('button'); opBtn.type='button'; opBtn.className='dm-export-operator-btn'; opBtn.innerHTML='👤'; opBtn.title='Оператор';
      function toggleOp(){
        if(opInput){ btn.classList.remove('has-operator'); btn.style.width='390px'; opInput.remove(); opInput=null; }
        else{ btn.classList.add('has-operator'); btn.style.width='570px';
          opInput=document.createElement('input'); opInput.type='text'; opInput.placeholder='Оператор...'; opInput.className='dm-export-operator-field'; opInput.maxLength=40; opInput.value=getOp();
          opInput.addEventListener('input',()=>setOp(opInput.value.trim()));
          opInput.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ setOp(opInput.value.trim()); e.preventDefault(); } if(e.key==='Escape'){ toggleOp(); }});
          opInput.addEventListener('blur',()=>setOp(opInput.value.trim()));
          btn.appendChild(opInput); opInput.focus();
        }
      }
      opBtn.addEventListener('click',(e)=>{e.stopPropagation();toggleOp();});

      function finish(){
        if(sending) return;
        opened=false; btn.blur(); if(cleanup) cleanup();
        const { seller, order } = getSellerAndOrder();
        const comment = input.value.trim();
        const operator = opInput ? opInput.value.trim() : getOp();
        const today = getToday();
        if(!order){ resetBtn(btn,'Не найдено!'); setTimeout(()=>resetBtn(btn,'Проблема'),1300); return; }
        setOp(operator||'');
        send(order, today, seller, comment, operator, btn);
      }

      input.addEventListener('keydown',(e)=>{ if(e.key==='Enter') finish(); if(e.key==='Escape'){ opened=false; if(cleanup) cleanup(); resetBtn(btn,'Проблема'); }});
      sendBtn.addEventListener('click', finish);
      input.addEventListener('blur', ()=>{ setTimeout(()=>{ if(document.activeElement!==sendBtn && document.activeElement!==opInput && document.activeElement!==opBtn && opened && !sending){ opened=false; if(cleanup) cleanup(); resetBtn(btn,'Проблема'); }},150); });

      setTimeout(()=>input.focus(),80);
      btn.appendChild(input); btn.appendChild(sendBtn); btn.appendChild(opBtn);
    });

    return btn;
  }

  function mount(){
    const back = Array.from(document.querySelectorAll('small font[color="#538CA1"]')).find(font=>{
      const a=font.querySelector('a.targettree'); return a && /назад/i.test(a.textContent);
    });
    if(!back || document.querySelector('.dm-floating-export-wrap')) return;
    const r=back.getBoundingClientRect();
    const wrap=document.createElement('div'); wrap.className='dm-floating-export-wrap';
    wrap.style.left=(window.scrollX+r.right+8)+'px'; wrap.style.top=(window.scrollY+r.top-3)+'px';
    const inner=document.createElement('div'); inner.className='dm-floating-export-inner'; inner.appendChild(makeButton());
    wrap.appendChild(inner); document.body.appendChild(wrap);
  }

  function boot(){ mount(); if(!document.querySelector('.dm-floating-export-wrap')) setTimeout(mount,1000); }
  window.addEventListener('DOMContentLoaded', boot); setTimeout(boot, 1200);
})();
