(function(){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const key=p=>'coral.western-history.v1.'+p;
const initial={},blocked=new Set(),lastText={},lastSnapshot={},queues={};let db=null;
function status(p,s){const e=document.getElementById('saveStatus');if(e&&window.MusicApp?.getProfile()===p)e.textContent=p+' · '+s;}
function request(r){return new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
function transactionDone(t){return new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error);t.onabort=()=>no(t.error||Error('事务已取消'));});}
function open(){return new Promise((ok,no)=>{if(!window.indexedDB)return no(Error('此浏览器没有本机数据库'));const r=indexedDB.open('western-history-durable-v2',1);r.onupgradeneeded=()=>{r.result.createObjectStore('profiles',{keyPath:'profile'});r.result.createObjectStore('snapshots',{keyPath:'id'});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('请关闭旧的工作台标签页'));});}
async function load(p){let local=null,localBroken=false;try{const raw=localStorage.getItem(key(p));if(raw)local=JSON.parse(raw);}catch{localBroken=true;}
let row=null;if(db)row=await request(db.transaction('profiles').objectStore('profiles').get(p));
if(row){initial[p]=row.state;lastText[p]=JSON.stringify(row.state);return;}
if(local){initial[p]=local;lastText[p]=JSON.stringify(local);return;}
if(localBroken)blocked.add(p);
}
const ready=(async()=>{try{db=await open();}catch(e){console.warn('本机数据库未就绪',e.message);}for(const p of ['Coral','K']){try{await load(p);}catch{blocked.add(p);}}})();
async function writeNow(p,state){if(blocked.has(p))throw Error('旧数据读取异常，已暂停覆盖，请先导出备份');const text=JSON.stringify(state);if(text===lastText[p]){status(p,'本机已保存');return;}
let mirrored=false;try{const previous=localStorage.getItem(key(p));if(previous)localStorage.setItem(key(p)+'.previous',previous);localStorage.setItem(key(p),text);mirrored=true;}catch{}
if(db){const t=db.transaction(['profiles','snapshots'],'readwrite');const done=transactionDone(t);t.objectStore('profiles').put({profile:p,state:clone(state),updatedAt:Date.now()});if(Date.now()-(lastSnapshot[p]||0)>60000){const stamp=Date.now();t.objectStore('snapshots').put({id:p+':'+stamp,profile:p,state:clone(state),updatedAt:stamp});lastSnapshot[p]=stamp;}await done;
const rt=db.transaction('snapshots'),rows=await request(rt.objectStore('snapshots').getAll());const old=rows.filter(x=>x.profile===p).sort((a,b)=>b.updatedAt-a.updatedAt).slice(20);if(old.length){const ct=db.transaction('snapshots','readwrite');const cd=transactionDone(ct);for(const r of old)ct.objectStore('snapshots').delete(r.id);await cd;}
}else if(!mirrored)throw Error('浏览器未允许保存，请立即导出 JSON');
initial[p]=clone(state);lastText[p]=text;status(p,'本机已保存');
}
function write(p,state){const snapshot=clone(state);status(p,'正在保存');queues[p]=(queues[p]||Promise.resolve()).catch(()=>{}).then(()=>writeNow(p,snapshot)).catch(e=>{status(p,'保存失败，请导出');window.dispatchEvent(new CustomEvent('western-save-error',{detail:e.message}));throw e;});queues[p].catch(()=>{});return queues[p];}
async function snapshots(p){if(!db)return [];return (await request(db.transaction('snapshots').objectStore('snapshots').getAll())).filter(x=>x.profile===p).sort((a,b)=>b.updatedAt-a.updatedAt);}
window.WesternStore={ready,initial,blocked,write,snapshots,flush:()=>Promise.all(Object.values(queues).map(p=>p.catch(()=>{}))),storageAvailable:()=>!!db};
})();
