<script>
const ITEMS=__DATA__;
const TOTAL=__COUNT__;
const VERBS=__VERBS__;
const NOUNS=__NOUNS__;
const SET_SIZE=5;
const LS='de_passiv_modal_trainer_v1';
const DOMAIN={D:'Daily life',P:'Professional',W:'Work'};
const MODF={
  k:{inf:'können',s:['kann','konnte'],p:['können','konnten']},
  m:{inf:'müssen',s:['muss','musste'],p:['müssen','mussten']},
  s:{inf:'sollen',s:['soll','sollte'],p:['sollen','sollten']},
  d:{inf:'dürfen',s:['darf','durfte'],p:['dürfen','durften']}
};
const MODALS=new Set(['kann','können','konnte','konnten','muss','müssen','musste','mussten','soll','sollen','sollte','sollten','darf','dürfen','durfte','durften']);
const LASSEN={pres:{'3s':'lässt','3p':'lassen'},prat:{'3s':'ließ','3p':'ließen'}};
const LASSENSET=new Set(['lässt','lassen','ließ','ließen']);
const WERDENFIN=['wird','wurde','werde','wirst','wurden','wurdet','werdet'];
/* answer fields: key, label (long), label (short, for the stats page) */
const FIELDS=[
  ['pp','Passiv · Präsens','Passiv Präsens'],
  ['pt','Passiv · Präteritum','Passiv Präteritum'],
  ['lp','sich lassen · Präsens','sich lassen Präs.'],
  ['lt','sich lassen · Präteritum','sich lassen Prät.']
];
const MODNAMES=[['k','können'],['m','müssen'],['s','sollen'],['d','dürfen']];
const PRIO=[0,1.6,2.6,4.0,5.5,7.0];

/* ---------- memory (progress + mistakes), kept in this browser ---------- */
let memOK=true;
try{localStorage.setItem(LS+'_t','1');localStorage.removeItem(LS+'_t');}catch(e){memOK=false;}
function blank(){
  return {v:1,stats:{},tn:{pp:{t:0,c:0},pt:{t:0,c:0},lp:{t:0,c:0},lt:{t:0,c:0}},
    mn:{k:{t:0,c:0},m:{t:0,c:0},s:{t:0,c:0},d:{t:0,c:0}},
    err:{},ex:{},last:[],tot:{sets:0,checks:0}};
}
function load(){
  const b=blank();let j=null;
  try{j=JSON.parse(localStorage.getItem(LS));}catch(e){}
  if(j&&j.v===1){
    b.stats=j.stats||{};
    if(j.tn)for(const k in b.tn)if(j.tn[k])b.tn[k]=j.tn[k];
    if(j.mn)for(const k in b.mn)if(j.mn[k])b.mn[k]=j.mn[k];
    b.err=j.err||{};b.ex=j.ex||{};b.last=j.last||[];
    if(j.tot)b.tot=Object.assign(b.tot,j.tot);
  }
  return b;
}
function save(){try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){memOK=false;}}
let S=load();
let ses=null;            // current set: lives only in this page, so every visit starts fresh
let checked=false;
let view='practice';

/* ---------- smart set: random start; missed first, new next, mastered rarely ---------- */
function drawSet(weak){
  const lastSet=new Set(S.last||[]);
  const info=ITEMS.map(it=>{
    const st=S.stats[it.i],seen=!!(st&&st.s>0);
    return {id:it.i,seen:seen,missed:seen&&(st.b||0)===0&&st.f>0,f:seen?st.f:0,b:seen?(st.b||0):0};
  });
  let picked=[];
  if(weak){
    picked=info.filter(x=>x.f>0&&x.b<3).sort((a,b)=>(b.f-a.f)||(Math.random()-.5)).slice(0,SET_SIZE).map(x=>x.id);
  }
  // never the same list again: sentences of the previous set are left out, except ones you missed
  const pool=info.filter(x=>!picked.includes(x.id)&&(!lastSet.has(x.id)||x.missed)).map(x=>{
    const base=x.seen?PRIO[Math.min(5,x.b)]:1.0;
    return {id:x.id,missed:x.missed,k:base+Math.random()*1.8};
  }).sort((a,b)=>a.k-b.k);
  let missedN=picked.length;
  if(!weak){ // a sentence you missed always gets another chance in the very next set
    const m1=pool.find(c=>c.missed);
    if(m1){picked.push(m1.id);missedN++;}
  }
  for(const c of pool){
    if(picked.includes(c.id))continue;
    if(picked.length>=SET_SIZE)break;
    if(c.missed&&!weak){if(missedN>=2)continue;missedN++;}
    picked.push(c.id);
  }
  for(let i=picked.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[picked[i],picked[j]]=[picked[j],picked[i]];}
  return picked;
}
function newSet(weak){
  ses={ids:drawSet(weak===true),pos:0,res:Array(SET_SIZE).fill(null)};
  S.last=ses.ids.slice();S.tot.sets=(S.tot.sets||0)+1;
  checked=false;view='practice';save();render();
  window.scrollTo(0,0);try{parent.scrollTo(0,0);}catch(e){}
}

/* ---------- answer checking ---------- */
function norm(t,keepCase){
  t=String(t).replace(/[‘’“”„‚"'`´]/g,'').replace(/[()]/g,'')
    .replace(/[.,;:!?]/g,' ').replace(/\s+/g,' ').trim();
  if(!keepCase)t=t.toLowerCase();
  t=t.replace(/(\d) (?=\d)/g,'$1');
  t=t.replace(/(^| )von dem( |$)/gi,'$1vom$2').replace(/(^| )bei dem( |$)/gi,'$1beim$2')
     .replace(/(^| )in dem( |$)/gi,'$1im$2').replace(/(^| )an dem( |$)/gi,'$1am$2')
     .replace(/(^| )zu dem( |$)/gi,'$1zum$2').replace(/(^| )zu der( |$)/gi,'$1zur$2');
  return t.replace(/\s+/g,' ');
}
function isFinite(w){return MODALS.has(w)||LASSENSET.has(w);}
function isLassenField(key){return key==='lp'||key==='lt';}
function judge(user,model,key){
  const u=norm(user),m=norm(model);
  if(!u)return {r:'empty'};
  if(u===m){return {r:norm(user,true)===norm(model,true)?'ok':'case'};}
  const ut=u.split(' '),mt=m.split(' ');
  // same words, finite verb still in position II after one block of the model sentence
  if(ut.length===mt.length && [...ut].sort().join(' ')===[...mt].sort().join(' ')){
    const tailLen=isLassenField(key)?1:2;
    if(ut.slice(-tailLen).join(' ')===mt.slice(-tailLen).join(' ')){
      const auxI=ut.findIndex((w,i)=>i<ut.length-tailLen && mt.includes(w) && isFinite(w));
      if(auxI>0 && (!isLassenField(key)||ut[auxI+1]==='sich')){
        const first=ut.slice(0,auxI).join(' ');
        if((' '+m+' ').includes(' '+first+' ') && !first.split(' ').some(isFinite))return {r:'alt'};
      }
    }
  }
  return {r:'bad'};
}

/* what exactly went wrong? -> {c: error type, tip: English hint} */
function diagnose(user,model,key,it){
  const u=norm(user),m=norm(model);
  if(!u)return {c:'empty',tip:''};
  const ut=u.split(' '),mt=m.split(' '),M=MODF[it.m],pl=it.p==='3p';
  const sameBag=[...ut].sort().join(' ')===[...mt].sort().join(' ');
  if(isLassenField(key)){
    const tense=key==='lp'?'pres':'prat',exp=LASSEN[tense][it.p],inf=mt[mt.length-1];
    if(ut.includes('werden')||ut.includes('worden')||ut.includes('geworden'))
      return {c:'swap',tip:'This field wants the replacement form with sich lassen (no werden). The passive with a modal goes in the other field.'};
    if(!ut.includes('sich'))return {c:'nosich',tip:'sich is missing: '+exp+' sich + Infinitiv.'};
    if(!ut.includes(exp)){
      const other=ut.find(w=>LASSENSET.has(w));
      if(other){
        const otherTense=(other==='lässt'||other==='lassen')?'pres':'prat';
        return otherTense!==tense
          ?{c:'ltense',tip:'Wrong tense of lassen: Präsens '+LASSEN.pres[it.p]+' · Präteritum '+LASSEN.prat[it.p]+'. Here you need “'+exp+'”.'}
          :{c:'lagree',tip:'lassen must agree with the subject: this subject needs “'+exp+'”.'};
      }
      if(ut.some(w=>MODALS.has(w)))return {c:'swap',tip:'A modal verb belongs to the passive form. Here use “'+exp+' sich … Infinitiv”.'};
      return {c:'nolassen',tip:'The finite verb is “'+exp+'” (lassen), followed by sich.'};
    }
    if(!ut.includes(inf))return {c:'infinitive',tip:'After sich lassen comes the infinitive of the main verb: “'+inf+'”.'};
    if(sameBag)return {c:'lorder',tip:'Same words, wrong order: lassen in position II, sich right after it (or after the subject), the infinitive at the end.'};
    return {c:'other',tip:'Check word order and endings.'};
  }
  // passive with modal
  const tense=key==='pp'?'pres':'prat',ti=tense==='pres'?0:1;
  const exp=pl?M.p[ti]:M.s[ti];
  if(ut.some(w=>LASSENSET.has(w))&&ut.includes('sich'))
    return {c:'swap',tip:'This field wants the passive with a modal (… werden). The sich-lassen form goes in the other field.'};
  if(ut.includes('worden')||ut.includes('geworden'))
    return {c:'worden',tip:'With a modal verb the passive infinitive ends in werden (Partizip II + werden). worden belongs to the Perfekt.'};
  if(ut.some(w=>WERDENFIN.includes(w))&&!ut.includes('werden'))
    return {c:'finitewerden',tip:'After a modal verb, werden stays in the infinitive: Partizip II + werden. The modal is the finite verb.'};
  if(!ut.includes('werden'))return {c:'nowerden',tip:'The passive infinitive is missing: Partizip II + werden at the end.'};
  if(!ut.includes(exp)){
    const other=ut.find(w=>MODALS.has(w));
    if(!other)return {c:'nomodal',tip:'The modal verb “'+exp+'” is missing.'};
    if(!(M.s.includes(other)||M.p.includes(other)))
      return {c:'modal',tip:'Keep the modal verb of the task sentence: “'+exp+'” (man '+(M.s[0])+' → … '+exp+' … werden).'};
    const otherTense=(other===M.s[0]||other===M.p[0])?'pres':'prat';
    return otherTense!==tense
      ?{c:'mtense',tip:'Wrong tense of the modal verb: '+(tense==='pres'?'Präsens':'Präteritum')+' needs “'+exp+'”.'}
      :{c:'magree',tip:'The modal verb must agree with the subject: this subject needs “'+exp+'”.'};
  }
  const ptc=mt[mt.length-2];
  if(!ut.includes(ptc))return {c:'participle',tip:'Check the Partizip II: “'+ptc+'”.'};
  if(!ut.some(w=>w==='von'||w==='vom'||w==='durch')&&/(^| )(von|vom|durch)( |$)/.test(m))
    return {c:'agent',tip:'The agent (von / durch …) is part of the sentence.'};
  if(sameBag)return {c:'order',tip:'Same words, wrong order: the modal verb stands in position II, Partizip II + werden at the end.'};
  return {c:'other',tip:'Check word order and endings.'};
}
const ERR={
  nomodal:['modal verb missing','The modal verb stays in the passive sentence: man kann … lösen → … kann … gelöst werden.'],
  modal:['different modal verb','Use the same modal verb as in the task sentence (können, müssen, sollen, dürfen).'],
  mtense:['wrong tense of the modal verb','Präsens kann · muss · soll · darf. Präteritum konnte · musste · sollte · durfte.'],
  magree:['modal verb does not match the subject','Singular subject: kann / muss / soll / darf. Plural subject: können / müssen / sollen / dürfen (Präteritum: konnten …).'],
  nowerden:['werden missing at the end','Passive with a modal verb: modal (finite) + Partizip II + werden (infinitive) at the end.'],
  finitewerden:['finite werden (wird / wurde) after a modal','Only the modal is conjugated. werden stays in the infinitive: kann gelöst werden, not kann gelöst wird.'],
  worden:['worden instead of werden','worden is for the Perfekt. With a modal verb the passive ends in the infinitive werden.'],
  swap:['form in the wrong field','Passiv mit Modalverb: kann … gelöst werden. Ersatzform: lässt sich … lösen. Keep the two forms apart.'],
  participle:['wrong Partizip II','Learn the Partizip II together with the infinitive (strong verbs: gebrochen, genommen …; separable verbs: ab-ge-holt).'],
  agent:['agent (von / durch) missing','The doer of the action stays in the sentence as von + Dativ (or durch for means / causes).'],
  order:['word order (passive)','Modal verb in position II; Partizip II + werden at the end of the clause.'],
  nosich:['sich missing','sich lassen is reflexive: lässt sich, lassen sich, ließ sich, ließen sich.'],
  nolassen:['lassen missing','The replacement form is lassen + sich + infinitive: Das Problem lässt sich lösen.'],
  ltense:['wrong tense of lassen','Präsens lässt / lassen sich · Präteritum ließ / ließen sich.'],
  lagree:['lassen does not match the subject','Singular: lässt sich / ließ sich. Plural: lassen sich / ließen sich.'],
  infinitive:['infinitive missing after sich lassen','sich lassen is followed by the plain infinitive (lösen), not by a Partizip II and not by werden.'],
  lorder:['word order (sich lassen)','lassen in position II, sich directly after it (or after the subject), infinitive at the end.'],
  empty:['left blank','Try every form, even when unsure: the model answer will show the pattern.'],
  other:['other differences','Compare your sentence word by word with the model answer.'],
  case:['capital letters (minor)','German nouns and the first word of a sentence start with a capital letter.']
};

/* ---------- word families ---------- */
const $=s=>document.querySelector(s);
function esc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function pills(str){
  if(!str)return '';
  return '<span class="pills">'+str.split(';').map(x=>x.trim()).filter(Boolean).map(x=>'<span class="fi">'+esc(x)+'</span>').join('')+'</span>';
}
function rows(list){
  return list.filter(r=>r[1]).map(r=>'<div class="fam-r"><span class="fam-k">'+r[0]+'</span>'+pills(r[1])+'</div>').join('');
}
function famHTML(it){
  let h='';
  const v=VERBS[it.vi];
  if(v){
    h+='<div class="fam-sec"><div class="fam-title">Main verb</div>'+
      '<div class="fam-head"><b>'+esc(v[0])+'</b><span class="fam-en">'+esc(v[4])+'</span></div>'+
      '<div class="fam-forms">'+esc(v[0])+' · '+esc(v[1])+' · '+esc(v[2])+' · '+esc(v[3])+'</div>'+
      rows([['Nouns',v[5]],['Adjectives &amp; participles',v[6]],['Related verbs',v[7]]])+'</div>';
  }
  const ni=it.ni||[];
  h+='<div class="fam-sec"><div class="fam-title">Nouns in this sentence'+(ni.length?' ('+ni.length+')':'')+'</div>';
  if(!ni.length)h+='<div class="fam-en">This sentence has no noun to expand.</div>';
  ni.forEach(k=>{
    const n=NOUNS[k];
    h+='<div class="fam-noun"><div class="fam-head"><b>'+esc(n[0])+'</b>'+(n[1]&&n[1]!=='–'?'<span class="fam-pl">pl. '+esc(n[1])+'</span>':'<span class="fam-pl">no plural</span>')+
      '<span class="fam-en">'+esc(n[2])+'</span></div>'+rows([['Word family',n[3]]])+'</div>';
  });
  return '<details class="fam" open><summary>Word families <span>main verb and nouns</span></summary>'+h+'</details>';
}

/* ---------- render ---------- */
function hintFor(key,it){
  const M=MODF[it.m],pl=it.p==='3p';
  if(key==='pp')return (pl?M.p[0]:M.s[0])+' + Partizip II + werden';
  if(key==='pt')return (pl?M.p[1]:M.s[1])+' + Partizip II + werden';
  if(key==='lp')return LASSEN.pres[it.p]+' sich + Infinitiv';
  return LASSEN.prat[it.p]+' sich + Infinitiv';
}
function fieldsOf(it){return FIELDS.slice(0,it.r.length);}
function renderProg(){
  if(!ses||view!=='practice'){$('#prog').innerHTML='';$('#prog').hidden=true;return;}
  $('#prog').hidden=false;
  const cur=ses.pos>=SET_SIZE?SET_SIZE:ses.pos+1;
  $('#prog').innerHTML='<div class="prog-row"><span>Progress</span><b>'+cur+' / '+SET_SIZE+'</b></div>'+
    '<div class="bar"><i style="width:'+(ses.pos>=SET_SIZE?100:(cur/SET_SIZE*100))+'%"></i></div>'+
    (memOK?'':'<div class="warn">Your browser blocks saving (private mode?). Progress and mistakes will be lost when you close this page.</div>');
}
function render(){
  if(view==='stats'){renderStats();return;}
  if(!ses){newSet();return;}
  renderProg();
  if(ses.pos>=SET_SIZE){renderResults();return;}
  const it=ITEMS[ses.ids[ses.pos]];
  const f=fieldsOf(it).map(([key,name])=>
    '<div class="field" data-k="'+key+'"><div class="field-top"><label for="f_'+key+'">'+name+'</label>'+
    '<span class="hint">'+hintFor(key,it)+'</span></div>'+
    '<textarea id="f_'+key+'" rows="1" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" enterkeyhint="next" placeholder="'+(isLassenField(key)?'Ersatzform with sich lassen...':'Passive with '+MODF[it.m].inf+'...')+'"></textarea>'+
    '<div class="fb" hidden></div></div>').join('');
  $('#app').innerHTML=
   '<div class="card task"><div class="task-head"><div class="lbl">Active voice task</div>'+
   '<p class="sentence">'+esc(it.a)+'</p>'+
   '<div class="meta"><span class="chip">'+DOMAIN[it.d]+'</span><span class="chip">'+MODF[it.m].inf+'</span><span class="chip">'+it.r.length+' forms</span><span>'+esc(it.s)+'</span></div></div>'+
   '<div class="fields">'+f+'</div><div id="note"></div>'+
   '<div class="foot"><span class="score" id="score" role="status"></span><button class="btn-main" id="btnCheck" type="button">Check Answers</button></div>'+
   '<div id="fam"></div></div>';
  checked=false;
  const inputs=[...document.querySelectorAll('.field textarea')];
  inputs.forEach((inp,i)=>{inp.addEventListener('input',()=>grow(inp));inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();
      if(checked){next();}
      else if(i<inputs.length-1){inputs[i+1].focus();}
      else{check();}}
  });});
  $('#btnCheck').addEventListener('click',()=>checked?next():check());
}
function grow(t){t.style.height='auto';t.style.height=(t.scrollHeight+4)+'px';}

function check(){
  const it=ITEMS[ses.ids[ses.pos]];
  const fl=fieldsOf(it),need=fl.length;
  const vals=fl.map(([k])=>$('#f_'+k).value);
  if(vals.every(v=>!v.trim())){$('#f_pp').focus();return;}
  let good=0;const ok=[];
  fl.forEach(([key,name],idx)=>{
    const model=it.r[idx],j=judge(vals[idx],model,key);
    const field=document.querySelector('.field[data-k="'+key+'"]'),fb=field.querySelector('.fb');
    field.querySelector('textarea').disabled=true;
    const right=(j.r==='ok'||j.r==='case'||j.r==='alt');
    if(right)good++;ok.push(right);
    field.classList.add(right?'ok':'bad');
    S.tn[key].t++;if(right)S.tn[key].c++;
    S.mn[it.m].t++;if(right)S.mn[it.m].c++;
    let h='',code=null;
    if(j.r==='ok')h='<span class="v">Correct</span>';
    else if(j.r==='case'){code='case';h='<span class="v">Correct</span> — watch the capital letters: <span class="model">'+esc(model)+'</span>';}
    else if(j.r==='alt')h='<span class="v">Correct</span> — another valid word order. Model: <span class="model">'+esc(model)+'</span>';
    else{
      const d=diagnose(vals[idx],model,key,it);code=d.c;
      h='<span class="v">'+(j.r==='empty'?'Not answered':'Not quite')+'</span><span class="model">'+esc(model)+'</span>';
      if(d.tip)h+='<span class="tip">'+esc(d.tip)+'</span>';
    }
    if(code){ // remember the mistake type
      S.err[code]=(S.err[code]||0)+1;
      const ex=S.ex[code]||(S.ex[code]=[]);
      ex.unshift({i:it.i,t:key,u:vals[idx].trim().slice(0,160),m:model});
      if(ex.length>3)ex.length=3;
    }
    fb.innerHTML=h;fb.hidden=false;grow(field.querySelector('textarea'));
  });
  const st=S.stats[it.i]||{s:0,c:0,f:0,b:0};
  st.s++;if(good===need){st.c++;st.b=Math.min(5,(st.b||0)+1);}else{st.f++;st.b=0;}
  S.stats[it.i]=st;S.tot.checks=(S.tot.checks||0)+1;
  ses.res[ses.pos]={g:good,n:need,ok:ok};
  save();
  checked=true;
  $('#score').textContent=good+' / '+need+' correct';
  if(it.n)$('#note').innerHTML='<div class="note"><b>Note.</b> '+esc(it.n)+'</div>';
  $('#fam').innerHTML=famHTML(it);
  const b=$('#btnCheck');b.textContent=(ses.pos>=SET_SIZE-1)?'See results':'Next sentence';
  b.focus({preventScroll:true});
}
function next(){
  ses.pos++;checked=false;render();
  window.scrollTo(0,0);try{parent.scrollTo(0,0);}catch(e){}
}

function renderResults(){
  const full=ses.res.filter(r=>r&&r.g===r.n).length;
  const forms=ses.res.reduce((a,r)=>a+(r?r.g:0),0);
  const formsAll=ses.ids.reduce((a,id)=>a+ITEMS[id].r.length,0);
  const mastered=Object.values(S.stats).filter(x=>(x.b||0)>=3).length;
  const rowsH=ses.ids.map((id,i)=>{
    const it=ITEMS[id],r=ses.res[i]||{g:0,n:it.r.length};
    const good=r.g===r.n;
    return '<li><span class="mk '+(good?'ok':'bad')+'">'+(good?'✓':'!')+'</span><div>'+esc(it.a)+
      '<small>'+r.g+' / '+r.n+' forms correct</small></div></li>';
  }).join('');
  $('#app').innerHTML='<div class="card res"><h2>Set complete</h2><div class="big">'+full+' / '+SET_SIZE+'</div>'+
    '<div class="hint">sentences with every form right · '+forms+' / '+formsAll+' forms</div>'+
    '<ul>'+rowsH+'</ul>'+
    '<div class="hint" style="margin-bottom:14px">Missed sentences come back in later sets, mixed with new ones. Mastered so far: '+mastered+' / '+TOTAL+'.</div>'+
    '<div class="btn-row"><button class="btn-main" id="btnAgain" type="button">New Smart Set</button>'+
    '<button class="btn-alt" id="btnSt" type="button">My progress &amp; mistakes</button></div></div>';
  $('#btnAgain').addEventListener('click',()=>newSet());
  $('#btnSt').addEventListener('click',showStats);
}

/* ---------- my progress & mistakes ---------- */
let confirmReset=false;
function showStats(){view='stats';confirmReset=false;render();window.scrollTo(0,0);try{parent.scrollTo(0,0);}catch(e){}}
function back(){view='practice';render();window.scrollTo(0,0);try{parent.scrollTo(0,0);}catch(e){}}
function pct(c,t){return t?Math.round(c/t*100):0;}
function renderStats(){
  $('#prog').hidden=true;$('#prog').innerHTML='';
  const sts=Object.entries(S.stats);
  const practised=sts.filter(([k,x])=>x.s>0).length;
  const mastered=sts.filter(([k,x])=>(x.b||0)>=3).length;
  const weakN=sts.filter(([k,x])=>x.f>0&&(x.b||0)<3).length;
  const tt=Object.values(S.tn).reduce((a,x)=>a+x.t,0),tc=Object.values(S.tn).reduce((a,x)=>a+x.c,0);
  let h='<div class="card st"><h2>My progress</h2>'+
    '<div class="kpis"><div><b>'+practised+'</b><span>of '+TOTAL+' sentences practised</span></div>'+
    '<div><b>'+mastered+'</b><span>mastered</span></div>'+
    '<div><b>'+(tt?pct(tc,tt)+'%':'–')+'</b><span>forms correct</span></div>'+
    '<div><b>'+(S.tot.sets||0)+'</b><span>sets started</span></div></div>';
  if(!tt){
    h+='<p class="hint">Nothing recorded yet. Check a few sentences and your progress and typical mistakes will appear here.</p></div>';
  }else{
    h+='<h3>Accuracy by form</h3>'+FIELDS.map(([k,n,short])=>{
      const x=S.tn[k],p=pct(x.c,x.t);
      return '<div class="st-row"><span>'+short+'</span><div class="bar"><i style="width:'+p+'%"></i></div><b>'+(x.t?p+'%':'–')+'</b></div>';
    }).join('');
    h+='<h3>Accuracy by modal verb</h3>'+MODNAMES.map(([k,n])=>{
      const x=S.mn[k],p=pct(x.c,x.t);
      return '<div class="st-row"><span>'+n+'</span><div class="bar"><i style="width:'+p+'%"></i></div><b>'+(x.t?p+'%':'–')+'</b></div>';
    }).join('');
    const errs=Object.entries(S.err).filter(([c])=>c!=='case').sort((a,b)=>b[1]-a[1]);
    const minor=S.err.case||0;
    h+='<h3>My most common mistakes</h3>';
    if(!errs.length)h+='<p class="hint">No mistakes recorded so far.</p>';
    const mx=errs.length?errs[0][1]:1;
    errs.slice(0,8).forEach(([c,n])=>{
      const e=ERR[c]||[c,''],ex=(S.ex[c]||[])[0];
      h+='<div class="er"><div class="er-top"><b>'+esc(e[0])+'</b><span>'+n+'×</span></div>'+
        '<div class="bar bar-bad"><i style="width:'+Math.max(6,Math.round(n/mx*100))+'%"></i></div>'+
        '<div class="er-rule">'+esc(e[1])+'</div>'+
        (ex?'<div class="er-ex"><span>You wrote</span> '+(ex.u?esc(ex.u):'(blank)')+'<br><span>Model</span> '+esc(ex.m)+'</div>':'')+'</div>';
    });
    if(minor)h+='<p class="hint">Minor: capital letters slipped '+minor+' time'+(minor>1?'s':'')+' (answers still counted as correct).</p>';
    const miss=sts.filter(([k,x])=>x.f>0).sort((a,b)=>(b[1].f-a[1].f)||(a[1].b-b[1].b)).slice(0,6);
    h+='<h3>Most-missed sentences</h3>';
    if(!miss.length)h+='<p class="hint">None yet.</p>';
    else h+='<ul class="ml">'+miss.map(([k,x])=>'<li><span class="cnt">'+x.f+'×</span><div>'+esc(ITEMS[k].a)+'<small>'+x.c+' of '+x.s+' attempts fully correct</small></div></li>').join('')+'</ul>';
    h+='</div>';
  }
  h+='<div class="btn-stack">'+
    (weakN?'<button class="btn-main" id="btnWeak" type="button">Practise my weak spots ('+Math.min(weakN,SET_SIZE)+' now)</button>':'')+
    '<button class="btn-alt" id="btnBack" type="button">Back to practice</button>'+
    (tt?'<button class="btn-link" id="btnReset" type="button">'+(confirmReset?'Tap again to erase all progress and mistakes':'Reset memory')+'</button>':'')+
    '</div>';
  $('#app').innerHTML=h;
  if($('#btnWeak'))$('#btnWeak').addEventListener('click',()=>newSet(true));
  $('#btnBack').addEventListener('click',back);
  if($('#btnReset'))$('#btnReset').addEventListener('click',()=>{
    if(!confirmReset){confirmReset=true;renderStats();return;}
    S=blank();save();confirmReset=false;renderStats();
  });
}

$('#btnNew').addEventListener('click',()=>newSet());
$('#btnStats').addEventListener('click',showStats);
newSet();      // every visit starts with a fresh random set
</script>
</body>
</html>
