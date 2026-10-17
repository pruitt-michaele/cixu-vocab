(function(root){
'use strict';
const intervals=[1,2,4,7,15,30];
const day=(value=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function addDays(date,n){return new Date(Date.parse(date+'T12:00:00+08:00')+n*86400000).toISOString().slice(0,10)}
function defaults(){return {schemaVersion:1,contentVersion:'2026.10.17.1',createdAt:new Date().toISOString(),settings:{name:'Coral',newLimit:20,reviewLimit:40,rate:1,voice:'',sleep:0},progress:{},days:{},attempts:[],favorites:[],playback:{mode:'today',ids:[],index:0,chunk:0}}}
function archive(s,date){return s.days[date]||(s.days[date]={date,planned:[],completed:[],retry:[],attempts:[],listenedSeconds:0,heardUnits:[],createdAt:new Date().toISOString()})}
function shuffle(items,seed=Date.now()){let a=items.slice(),n=typeof seed==='number'?seed:[...String(seed)].reduce((x,c)=>(x*31+c.charCodeAt(0))>>>0,7);for(let i=a.length-1;i>0;i--){n=(n*1664525+1013904223)>>>0;let j=n%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function plan(s,cards,date=day()){
 const a=archive(s,date);if(a.planned.length)return a.planned.slice();
 const unique=[...new Map(cards.map(c=>[c.canonical||c.id,c])).values()];
 const due=unique.filter(c=>s.progress[c.canonical||c.id]?.due<=date).sort((a,b)=>s.progress[a.canonical||a.id].due.localeCompare(s.progress[b.canonical||b.id].due));
 const fresh=unique.filter(c=>!s.progress[c.canonical||c.id]);
 a.planned=[...due.slice(0,s.settings.reviewLimit),...fresh.slice(0,s.settings.newLimit)].map(c=>c.id);return a.planned.slice();
}
function answer(s,card,grade,{date=day(),auto=false,selected=null,now=Date.now()}={}){
 const a=archive(s,date),key=card.canonical||card.id,old=s.progress[key],p=old||{stage:0,due:date,seen:0,wrong:0,good:0,unit:card.unit};
 const firstOfDay=p.lastDay!==date;
 if(grade==='good'){
  if(!old)p.stage=0;else if(firstOfDay&&p.due<=date)p.stage=Math.min(5,p.stage+1);
  p.good++;p.due=firstOfDay||!old?addDays(date,intervals[p.stage]):p.due;
  a.retry=a.retry.filter(x=>x!==card.id);
 }else{p.stage=0;p.due=addDays(date,1);if(grade==='again'){p.wrong++;if(!a.retry.includes(card.id))a.retry.push(card.id)}}
 p.seen++;p.lastDay=date;p.lastAt=now;p.lastGrade=grade;p.unit=card.unit;s.progress[key]=p;
 const retry=a.attempts.some(e=>e.cardId===card.id);const e={id:typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(now)+'-'+Math.random(),cardId:card.id,canonical:key,unit:card.unit,date,at:now,grade,auto,selected,retry};
 s.attempts.push(e);a.attempts.push(e);if(!a.completed.includes(card.id))a.completed.push(card.id);return e;
}
function stats(s,date=day()){
 const a=archive(s,date),first=a.attempts.filter(x=>x.auto&&!x.retry),correct=first.filter(x=>x.grade==='good').length;
 const uniqueUnits=new Set(Object.values(s.progress).map(x=>x.unit));
 return {done:a.completed.length,goal:a.planned.length,accuracy:first.length?Math.round(correct/first.length*100):null,first:first.length,correct,wrong:a.retry.length,minutes:Math.floor(a.listenedSeconds/60),units:uniqueUnits.size,xp:s.attempts.filter(x=>x.grade==='good'&&!x.retry).length*10};
}
function validateImport(x,ids){
 if(!x||x.schemaVersion!==1||!x.settings||!x.progress||!x.days||!Array.isArray(x.attempts)||!Array.isArray(x.favorites))throw Error('这不是本工作台的有效备份');
 if(Object.keys(x.progress).length>10000||x.attempts.length>200000)throw Error('备份数据量异常');
 for(const [k,p]of Object.entries(x.progress)){if(!ids.has(k)||!p||!Number.isFinite(p.stage)||p.stage<0||p.stage>5||!/^\d{4}-\d{2}-\d{2}$/.test(p.due))throw Error('备份包含未知知识点或损坏的进度')}
 for(const [date,a]of Object.entries(x.days)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(a.planned)||!Array.isArray(a.completed)||!Array.isArray(a.retry)||!Array.isArray(a.attempts)||!Number.isFinite(a.listenedSeconds)||a.listenedSeconds<0)throw Error('每日归档格式不正确')}
 x.settings.newLimit=Math.max(1,Math.min(100,Number(x.settings.newLimit)||20));x.settings.reviewLimit=Math.max(1,Math.min(200,Number(x.settings.reviewLimit)||40));x.settings.rate=[.8,1,1.2,1.5].includes(Number(x.settings.rate))?Number(x.settings.rate):1;return x;
}
const api={day,addDays,defaults,archive,shuffle,plan,answer,stats,validateImport};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FarmCore=api;
})(typeof window!=='undefined'?window:globalThis);
