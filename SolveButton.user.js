// ==UserScript==
// @name         Digiseller → Lark: кнопка «Решено» (рядом с «Проблема»)
// @namespace    https://digiseller.ru/
// @version      1.1
// @description  Добавляет кнопку «Решено» СПРАВА от кнопки «Проблема». По клику: Статус → «Решено», Alt+клик → «Продавец заблокирован». Ищет запись по «Номер заказа».
// @match        https://my.digiseller.ru/asp/inv_of_buyer.asp*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/SolveButton.user.js
// @downloadURL  https://raw.githubusercontent.com/Haemck/Vibe.Coding/refs/heads/main/SolveButton.user.js
// @connect      open.larksuite.com
// ==/UserScript==

(function(){
  'use strict';

  // ======== Lark config ========
  const LARK_APP_ID     = 'cli_a81cb0e116b4102f';
  const LARK_APP_SECRET = 'PxOqztub8iur2iEXsynuCbjG8QqQKb48';
  const LARK_APP_TOKEN  = 'Md1BbzhFDawwyNsvRggl8ngqgle';
  const LARK_TABLE_ID   = 'tblDJRpsVKzzScRx';

  const FIELD_NAMES = {
    order:  'Номер заказа',     // number
    status: 'Статус проблемы',  // single select
  };

  const STATUS_SOLVED     = 'Решено';
  const STATUS_SELLER_BAN = 'Продавец заблокирован';

  // ======== Styles ========
  GM_addStyle(`
    .dm-resolved-btn{
      background:#f4fff6;border:1.5px solid #8ad19a;border-radius:7px;
      color:#1a1a1a !important;font-weight:700;font-size:15px;
      padding:4px 10px;height:32px;cursor:pointer;user-select:none;
      box-shadow:0 1px 7px 0 #8ad19a33;outline:none;display:flex;align-items:center;gap:6px;
      transition:background .15s,border-color .15s,transform .05s;margin-left:6px;
    }
    .dm-resolved-btn:hover{ background:#edfff1; border-color:#6fc786; }
    .dm-resolved-btn:active{ transform:translateY(1px); }
    .dm-resolved-btn[disabled]{ opacity:.55; cursor:not-allowed; }
    /* временный контейнер — свой класс, чтобы не мешать «Проблеме» */
    .dm-resolve-fallback{position:absolute;z-index:9998;pointer-events:none}
    .dm-resolve-fallback > div{pointer-events:auto;display:flex;align-items:center}
  `);

  // ======== Helpers ========
  const J = (t)=>{ try { return JSON.parse(t); } catch { return null; } };
  const gmRequest = ({method,url,headers={},data,timeout=30000}) =>
    new Promise((res,rej)=>GM_xmlhttpRequest({method,url,headers,data,timeout,onload:res,onerror:rej,ontimeout:()=>rej(new Error('timeout'))}));
  const gmGet  = (url,headers={}) => gmRequest({method:'GET', url, headers});
  const gmPost = (url,json,headers={}) => gmRequest({
    method:'POST', url,
    headers:Object.assign({'Content-Type':'application/json; charset=utf-8'}, headers),
    data: JSON.stringify(json||{})
  });

  const isFieldNameNotFound = (txt)=>/1254045|FieldNameNotFound/i.test(String(txt||''));

  // ======== Order number from page ========
  function getOrderNumberFromPage(){
    let order = '';
    document.querySelectorAll('tr').forEach(tr=>{
      const label=tr.querySelector('.namerow');
      const val=tr.querySelector('.inforow');
      if(!label||!val) return;
      if(label.innerText.replace(/\s/g,'').includes('ЗАКАЗ№')){
        order = (val.textContent||'').trim();
      }
    });
    return order;
  }

  // ======== Auth ========
  const LS_KEY_LARK_TOKEN = 'lark_token_cache_resolve_v11';
  const getLS=(k)=>localStorage.getItem(k);
  const setLS=(k,v)=>localStorage.setItem(k, typeof v==='string'?v:JSON.stringify(v));

  async function getLarkTenantToken(){
    const c = J(getLS(LS_KEY_LARK_TOKEN));
    if(c && c.token && c.exp && Date.now()<c.exp-60_000) return c.token;
    const r = await gmPost('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
      app_id:LARK_APP_ID, app_secret:LARK_APP_SECRET
    });
    if(r.status!==200) throw new Error(`Auth HTTP ${r.status}: ${r.responseText}`);
    const d = J(r.responseText);
    if(!d || d.code!==0 || !d.tenant_access_token) throw new Error('Auth error: '+r.responseText);
    const token = d.tenant_access_token, expMs = Date.now()+((d.expire?d.expire:7200)*1000);
    setLS(LS_KEY_LARK_TOKEN,{token,exp:expMs});
    return token;
  }

  // ======== Fields map ========
  const LS_KEY_FIELDS_INFO = `lark_fields_${LARK_APP_TOKEN}_${LARK_TABLE_ID}_resolve_v11`;
  function norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,'').replace(/[«»"']/g,'').replace(/№/g,'no').trim(); }
  function pickByHumanName(items, humanName){
    let it = items.find(f=>f.field_name===humanName);
    if(!it){ const t=norm(humanName); it = items.find(f=>norm(f.field_name)===t); }
    return it ? { id: it.field_id, name: it.field_name } : null;
  }
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
  async function ensureFieldsInfo(force=false){
    if(!force){
      const c=J(getLS(LS_KEY_FIELDS_INFO));
      if(c && c.order && c.status) return c;
    }
    const items=await listFieldsAll();
    const info={
      order:  pickByHumanName(items, FIELD_NAMES.order),
      status: pickByHumanName(items, FIELD_NAMES.status),
    };
    const miss = Object.entries(info).filter(([,v])=>!v).map(([k])=>k);
    if(miss.length) throw new Error('Не найдены столбцы: '+miss.join(', '));
    setLS(LS_KEY_FIELDS_INFO, info);
    return info;
  }

  // ======== Find record by order ========
  async function findRecordIdByOrder(orderNumber, info){
    const token=await getLarkTenantToken();
    const orderName = info.order && info.order.name;
    const orderId   = info.order && info.order.id;

    // by field_name
    if(orderName){
      let pageToken='';
      while(true){
        const base=`https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(LARK_APP_TOKEN)}/tables/${encodeURIComponent(LARK_TABLE_ID)}/records?page_size=200&field_key=field_name`;
        const url = pageToken ? `${base}&page_token=${encodeURIComponent(pageToken)}` : base;
        const r   = await gmGet(url, { Authorization:`Bearer ${token}`, 'X-Field-Key':'field_name' });
        if(r.status!==200) throw new Error(`Query HTTP ${r.status}: ${r.responseText}`);
        const d=J(r.responseText);
        if(!d || d.code!==0){
          if(isFieldNameNotFound(r.responseText)) break;
          else throw new Error('Query error: '+r.responseText);
        }
        const items=(d.data&&d.data.items)||[];
        for(const rec of items){
          const v = (rec.fields||{})[orderName];
          if(v===undefined || v===null || v==='') continue;
          const a = Number(String(v).match(/-?\d+/)?.[0] ?? NaN);
          const b = Number(String(orderNumber).match(/-?\d+/)?.[0] ?? NaN);
          if(Number.isFinite(a) && Number.isFinite(b) ? a===b : String(v).trim()===String(orderNumber).trim()){
            return rec.record_id;
          }
        }
        if(d.data && d.data.has_more && d.data.page_token){ pageToken=d.data.page_token; continue; }
        break;
      }
    }
    // fallback by field_id
    if(orderId){
      let pageToken='';
      while(true){
        const base=`https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(LARK_APP_TOKEN)}/tables/${encodeURIComponent(LARK_TABLE_ID)}/records?page_size=200&field_key=field_id`;
        const url = pageToken ? `${base}&page_token=${encodeURIComponent(pageToken)}` : base;
        const r   = await gmGet(url, { Authorization:`Bearer ${token}`, 'X-Field-Key':'field_id' });
        if(r.status!==200) throw new Error(`Query HTTP ${r.status}: ${r.responseText}`);
        const d=J(r.responseText); if(!d || d.code!==0) throw new Error('Query error: '+r.responseText);
        const items=(d.data&&d.data.items)||[];
        for(const rec of items){
          const v = (rec.fields||{})[orderId];
          if(v===undefined || v===null || v==='') continue;
          const a = Number(String(v).match(/-?\d+/)?.[0] ?? NaN);
          const b = Number(String(orderNumber).match(/-?\d+/)?.[0] ?? NaN);
          if(Number.isFinite(a) && Number.isFinite(b) ? a===b : String(v).trim()===String(orderNumber).trim()){
            return rec.record_id;
          }
        }
        if(d.data && d.data.has_more && d.data.page_token){ pageToken=d.data.page_token; continue; }
        break;
      }
    }
    return null;
  }

  // ======== Update status ========
  async function updateStatus(recordId, statusText, info){
    const token = await getLarkTenantToken();
    const base  = `https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(LARK_APP_TOKEN)}/tables/${encodeURIComponent(LARK_TABLE_ID)}/records`;
    const fieldsByName = { [info.status.name]: statusText };
    const fieldsById   = { [info.status.id]:   statusText };

    try{
      const r = await gmPost(`${base}/batch_update?field_key=field_name`,
        { records:[{ record_id: recordId, fields: fieldsByName }] },
        { Authorization:`Bearer ${token}`, 'X-Field-Key':'field_name' }
      );
      const d=J(r.responseText);
      if(r.status===200 && d && d.code===0) return true;
      if(isFieldNameNotFound(r.responseText)) throw new Error('fname');
      throw new Error('update by name failed: '+r.responseText);
    }catch(_){
      const r = await gmPost(`${base}/batch_update?field_key=field_id`,
        { records:[{ record_id: recordId, fields: fieldsById }] },
        { Authorization:`Bearer ${token}`, 'X-Field-Key':'field_id' }
      );
      const d=J(r.responseText);
      if(r.status===200 && d && d.code===0) return true;
      throw new Error('update by id failed: '+r.responseText);
    }
  }

  // ======== UI: make button ========
  function makeSolveButton(){
    const btn=document.createElement('button');
    btn.className='dm-resolved-btn';
    btn.type='button';
    btn.title='Клик: «Решено» • Alt+Клик: «Продавец заблокирован»';
    btn.textContent='Решено';
    let busy=false;
    btn.addEventListener('click', async (e)=>{
      if(busy) return;
      busy=true;
      const prev = btn.textContent;
      try{
        btn.textContent='Ищу...';
        const order = getOrderNumberFromPage();
        if(!order){ btn.textContent='Не найдено'; setTimeout(()=>btn.textContent=prev,1100); busy=false; return; }
        let info = await ensureFieldsInfo(false);
        let recId = await findRecordIdByOrder(order, info);
        if(!recId){
          info = await ensureFieldsInfo(true); // на случай переименований
          recId = await findRecordIdByOrder(order, info);
          if(!recId){ btn.textContent='Не найдено'; setTimeout(()=>btn.textContent=prev,1100); busy=false; return; }
        }
        btn.textContent='Обновляю...';
        await updateStatus(recId, e.altKey?STATUS_SELLER_BAN:STATUS_SOLVED, info);
        btn.textContent='Готово!';
      }catch(err){
        console.error('[ResolveButton:Lark]', err);
        btn.textContent='Ошибка';
      }finally{
        setTimeout(()=>btn.textContent='Решено',1400);
        busy=false;
      }
    });
    return btn;
  }

  // ======== Mount logic: strictly to the RIGHT of «Проблема» ========
  function mountNextToProblem(){
    if(document.querySelector('.dm-resolved-btn')) return true;
    const problemBtn = document.querySelector('button.dm-cb-link.dm-export-btn-morph');
    if(!problemBtn) return false;
    const parent = problemBtn.parentElement || problemBtn.closest('.dm-floating-export-inner') || problemBtn.parentNode;
    const btn = makeSolveButton();
    parent.insertBefore(btn, problemBtn.nextSibling); // строго справа
    return true;
  }

  // Fallback container (own class, won’t block original mount)
  function mountFallback(){
    if(document.querySelector('.dm-resolved-btn')) return;
    const back = Array.from(document.querySelectorAll('small font[color="#538CA1"]'))
      .find(font=>{ const a=font.querySelector('a.targettree'); return a && /назад/i.test(a.textContent); });
    if(!back) return;
    const r=back.getBoundingClientRect();
    const outer=document.createElement('div');
    outer.className='dm-resolve-fallback';
    outer.style.left=(window.scrollX+r.right+8)+'px';
    outer.style.top =(window.scrollY+r.top-3)+'px';
    const inner=document.createElement('div');
    inner.appendChild(makeSolveButton());
    outer.appendChild(inner);
    document.body.appendChild(outer);
  }

  function boot(){
    // 1) попытка сразу рядом с «Проблема»
    if(mountNextToProblem()) return;

    // 2) наблюдаем появление «Проблема» и монтируемся справа
    const mo = new MutationObserver(()=>{
      if(mountNextToProblem()){ mo.disconnect(); }
    });
    mo.observe(document.documentElement, {subtree:true, childList:true});

    // 3) временная кнопка, если пока нет «Проблема»
    setTimeout(()=>{ if(!document.querySelector('.dm-resolved-btn')) mountFallback(); }, 600);

    // 4) если «Проблема» появится позже — переедем к ней (observer активен)
  }

  window.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 600);
})();
