
(function (root) {
  'use strict';
  const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const localDay = (now = new Date()) => {
    const p = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const get = t => p.find(x=>x.type===t).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const shiftDay = (day, count) => {
    const d = new Date(day+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+count); return d.toISOString().slice(0,10);
  };
  function freshState(){return {version:1,plans:{},days:{},notes:{},highlights:{},oralAnswers:{},settings:{rate:0.9,voice:'',font:19,pronounce:true},lastEntry:'t001'};}
  function validDay(x){return VALID_DATE.test(x) && !Number.isNaN(Date.parse(x+'T12:00:00Z')) && new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;}
  function sanitize(input, ids) {
    if (!input || input.version!==1 || typeof input.plans!=='object' || !input.plans || typeof input.days!=='object' || !input.days) throw Error('这不是有效的工作台备份。');
    const out=freshState(), allowed=new Set(ids);
    for(const [day,list] of Object.entries(input.plans)) if(validDay(day) && Array.isArray(list)) out.plans[day]=[...new Set(list.filter(x=>allowed.has(x)))];
    for(const [day,d] of Object.entries(input.days)) {
      if(!validDay(day) || !d || typeof d!=='object') continue;
      const log={seconds:Math.min(86400,Math.max(0,Number(d.seconds)||0)),entries:{}};
      for(const [id,v] of Object.entries(d.entries||{})) if(allowed.has(id) && v && [1,2,3].includes(v.level)) log.entries[id]={level:v.level,attempts:Math.min(99999,Math.max(1,Math.floor(Number(v.attempts)||1))),at:typeof v.at==='string'?v.at.slice(0,40):''};
      out.days[day]=log;
    }
    for(const [id,note] of Object.entries(input.notes||{})) if(allowed.has(id) && typeof note==='string') out.notes[id]=note.slice(0,10000);
    for(const [id,list] of Object.entries(input.highlights||{})) {
      if(!allowed.has(id)||!Array.isArray(list))continue;
      out.highlights[id]=list.filter(m=>m&&typeof m.id==='string'&&m.id.length<=100&&Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=0&&m.end>m.start&&m.end<=1000000&&['yellow','pink','green','blue'].includes(m.color)).slice(0,5000).map(m=>({id:m.id,start:m.start,end:m.end,color:m.color,at:typeof m.at==='string'?m.at.slice(0,40):'',deleted:m.deleted===true}));
    }
    for(const [id,answer] of Object.entries(input.oralAnswers||{}))if(allowed.has(id)&&answer&&typeof answer.text==='string')out.oralAnswers[id]={text:answer.text.slice(0,50000),at:typeof answer.at==='string'?answer.at.slice(0,40):''};
    const s=input.settings||{};
    out.settings={rate:Math.min(1.4,Math.max(.6,Number(s.rate)||.9)),voice:typeof s.voice==='string'?s.voice.slice(0,300):'',font:Math.min(25,Math.max(16,Number(s.font)||19)),pronounce:s.pronounce!==false};
    if(allowed.has(input.lastEntry))out.lastEntry=input.lastEntry;
    return out;
  }
  function plan(state,day){return state.plans[day]||[];}
  function setPlan(state,day,ids){state.plans[day]=[...new Set(ids)];}
  function grade(state,day,id,level,now=new Date()) {
    if(![1,2,3].includes(level))throw Error('无效的熟练度');
    const d=state.days[day]||(state.days[day]={seconds:0,entries:{}}),old=d.entries[id];
    d.entries[id]={level,attempts:(old?.attempts||0)+1,at:now.toISOString()};
  }
  function summary(state) {
    const status={},counts={};
    for(const day of Object.keys(state.days).sort()) for(const [id,v] of Object.entries(state.days[day].entries||{})) {status[id]={...v,day};counts[id]=(counts[id]||0)+v.attempts;}
    return {status,counts,learned:Object.keys(status).length,mastered:Object.values(status).filter(v=>v.level===3).length,seconds:Object.values(state.days).reduce((s,d)=>s+(d.seconds||0),0)};
  }
  function daySummary(state,day){const ids=plan(state,day),logs=state.days[day]?.entries||{};return {total:ids.length,done:ids.filter(id=>logs[id]).length,mastered:ids.filter(id=>logs[id]?.level===3).length,reviewed:Object.keys(logs).length,seconds:state.days[day]?.seconds||0};}
  function streak(state,today=localDay()){let day=today,n=0;if(!Object.keys(state.days[day]?.entries||{}).length)day=shiftDay(day,-1);while(Object.keys(state.days[day]?.entries||{}).length){n++;day=shiftDay(day,-1);}return n;}
  function paragraphs(text){return text.split(/\n+/).map(x=>x.trim()).filter(Boolean);}
  function speechText(entry,pronounce=true){
    let s=entry.title+'。'+entry.text.replace(/〔[^〕]*〕/g,'').replace(/【([^】]+)】/g,'。$1。').replace(/[《》“”‘’]/g,'').replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g,x=>'。'+('①②③④⑤⑥⑦⑧⑨⑩'.indexOf(x)+1)+'，');
    if(pronounce){const dict={'冼星海':'显星海','曾志忞':'曾志民','朱载堉':'朱载玉','陈旸':'陈阳','姜夔':'姜葵','郭沔':'郭勉','嵇康':'稽康','八佾':'八义','六佾':'六义','乐府':'岳府','乐记':'岳记','礼乐':'礼岳','乐律':'岳律','乐舞':'岳舞','大司乐':'大司岳','清商乐':'清商岳','鼓吹乐':'鼓吹岳','燕乐':'宴岳','乐书':'岳书','声无哀乐论':'声无哀岳论'};for(const [a,b]of Object.entries(dict))s=s.split(a).join(b);}
    return s.replace(/\s+/g,' ').replace(/。+/g,'。');
  }
  function splitSpeech(s,max=150){
    const units=s.match(/[^。！？；\n]+[。！？；\n]?/g)||[s],out=[];let buf='';
    for(let unit of units){while(unit.length>max){if(buf){out.push(buf);buf='';}out.push(unit.slice(0,max));unit=unit.slice(max);}if(buf.length+unit.length>max){out.push(buf);buf='';}buf+=unit;}
    if(buf)out.push(buf);return out.filter(Boolean);
  }
  class Reader {
    constructor({synth,Utterance,onChange=()=>{},onError=()=>{},clock=()=>Date.now(),schedule=setTimeout,unschedule=clearTimeout}){Object.assign(this,{synth,Utterance,onChange,onError,clock,schedule,unschedule});this.state='idle';this.queue=[];this.index=0;this.chunk=0;this.token=0;this.timer=null;this.gap=5000;}
    notify(){this.onChange(this);}
    start(queue,options={},index=0){
      this.stop(false);if(!queue.length)return;
      if(!this.synth||!this.Utterance){this.onError('当前浏览器不支持范读，请在 Safari 或 Chrome 中打开。');return;}
      this.queue=queue;this.options=options;this.index=Math.min(index,queue.length-1);this.chunk=0;this.speakEntry();
    }
    speakEntry(){this.chunks=splitSpeech(speechText(this.queue[this.index],this.options.pronounce!==false));this.chunk=0;this.speakChunk();}
    speakChunk(){
      const token=this.token,u=new this.Utterance(this.chunks[this.chunk]);this.utterance=u;
      u.lang='zh-CN';u.rate=this.options.rate||.9;u.pitch=1;u.volume=1;if(this.options.voice)u.voice=this.options.voice;
      u.onend=()=>{if(token!==this.token)return;if(++this.chunk<this.chunks.length)this.speakChunk();else if(this.index+1<this.queue.length)this.startGap(5000);else{this.state='idle';this.notify();}};
      u.onerror=e=>{if(token!==this.token||['canceled','interrupted'].includes(e.error))return;this.stop();this.onError('语音播放中断，请重新点范读，并确认设备有可用的中文语音。');};
      this.state='speaking';this.notify();this.synth.speak(u);
    }
    startGap(ms){this.state='gap';this.remaining=ms;this.deadline=this.clock()+ms;this.timer=this.schedule(()=>{this.timer=null;this.index++;this.speakEntry();},ms);this.notify();}
    pause(){if(this.state==='gap'){this.remaining=Math.max(0,this.deadline-this.clock());this.unschedule(this.timer);this.timer=null;this.beforePause='gap';}else if(this.state==='speaking'){this.synth.pause();this.beforePause='speaking';}else return;this.state='paused';this.notify();}
    resume(){if(this.state!=='paused')return;if(this.beforePause==='gap')this.startGap(this.remaining);else{this.state='speaking';this.synth.resume();this.notify();}}
    stop(emit=true){this.token++;if(this.timer!==null)this.unschedule(this.timer);this.timer=null;if(this.synth)this.synth.cancel();this.state='idle';if(emit)this.notify();}
    skip(step){if(!this.queue.length)return;const next=Math.max(0,Math.min(this.queue.length-1,this.index+step));const q=this.queue,o=this.options;this.start(q,o,next);}
    milliseconds(){return this.state==='gap'?Math.max(0,this.deadline-this.clock()):this.remaining||0;}
  }
  const api={localDay,shiftDay,freshState,sanitize,validDay,plan,setPlan,grade,summary,daySummary,streak,paragraphs,speechText,splitSpeech,Reader};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MusicCore=api;
})(typeof window!=='undefined'?window:globalThis);

