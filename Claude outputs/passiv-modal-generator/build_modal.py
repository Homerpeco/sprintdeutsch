import json, re, sys, glob, collections
MOD={'k':('kann','können','konnte','konnten','können'),'m':('muss','müssen','musste','mussten','müssen'),
     's':('soll','sollen','sollte','sollten','sollen'),'d':('darf','dürfen','durfte','durften','dürfen')}
def modal(m,tense,p):
    s,pl,ps,ppl,_=MOD[m]
    if p=='3s': return s if tense=='pres' else ps
    return pl if tense=='pres' else ppl
LASSEN={('pres','3s'):'lässt sich',('pres','3p'):'lassen sich',('prat','3s'):'ließ sich',('prat','3p'):'ließen sich'}
DOM={'D':'Daily life','P':'Professional','W':'Work'}
MODNAME={'k':'können','m':'müssen','s':'sollen','d':'dürfen'}
def join(*parts):
    s=' '.join(x for x in parts if x)
    return re.sub(r'\s+',' ',s).strip()+'.'
def src_label(code):
    k,rest=code.split(':',1)
    if k=='A': return 'Aspekte Beruf B2 · '+rest
    if k=='C': return 'C-Grammatik · '+rest
    raise ValueError(code)
base=sys.argv[1]
STOP=set('''Euro März Juni Ihrer Muskel- Nacken- Alfred Das Der Die Ein Eine Es Man Wir Sie Ich Er Nur Auch Alle Alles Viele Manche Nicht Sämtliche Diese Dieser Dieses Solche Jedes Dank Zur Durch Mit Unter Dort Für Im In Von An Auf Bis Über KW Eine Dem Den Diesen Beteiligte Interne Neue Rechtliche Besondere Menschen
Mitarbeitende Mitarbeiter Mitarbeiterinnen Franz Götz Schon'''.split())
# lexicons: old (passiv trainer) + new
VERBS={};NOUNS=[];FORMS={}
def load_lex(d):
    for fn in sorted(glob.glob(d+'/verbs_*.txt')):
        for line in open(fn,encoding='utf-8').read().split('\n'):
            if not line.strip(): continue
            f=[x.strip() for x in line.split('|')]
            assert len(f)==8,(fn,line)
            VERBS[f[0]]=[f[1],f[2],f[3],'hat '+f[0],f[4],f[5],f[6],f[7]]
    for fn in sorted(glob.glob(d+'/nouns_*.txt')):
        for line in open(fn,encoding='utf-8').read().split('\n'):
            if not line.strip(): continue
            f=[x.strip() for x in line.split('|')]
            assert len(f)==5,(fn,line)
            forms,lem,pl,en,fam=f
            idx=next((i for i,n in enumerate(NOUNS) if n[0]==lem),None)
            if idx is None: NOUNS.append([lem,pl,en,fam,0]); idx=len(NOUNS)-1
            for fo in forms.split(','): FORMS[fo.strip()]=idx
    fx=d+'/fixnouns.txt'
    try:
        for line in open(fx,encoding='utf-8').read().split('\n'):
            if not line.strip(): continue
            lem,fam=[x.strip() for x in line.split('|',1)]
            for n in NOUNS:
                if n[0]==lem: n[3]=fam
    except FileNotFoundError: pass
load_lex(base+'/lex')            # words already written for the Passive Voice trainer
load_lex(base+'/modal/lex')      # new words for this trainer (override if repeated)
items=[];problems=[];seen=set();unmatched=collections.Counter();missing_verbs=set()
VERB_LIST=[];VERB_IDX={}
for fn in sorted(glob.glob(base+'/modal/modal_items_*.txt')):
    for ln,line in enumerate(open(fn,encoding='utf-8').read().split('\n'),1):
        if not line.strip(): continue
        f=line.split('|')
        if len(f)!=10: problems.append(f'{fn}:{ln}: {len(f)} fields'); continue
        src,dom,mod,act,blk,p,mid,ptc,inf,note=[x.strip() for x in f]
        if mod not in MOD: problems.append(f'{fn}:{ln}: modal {mod}'); continue
        if p not in ('3s','3p'): problems.append(f'{fn}:{ln}: person {p}'); continue
        if dom not in DOM: problems.append(f'{fn}:{ln}: domain'); continue
        if not act.endswith('.'): problems.append(f'{fn}:{ln}: no full stop')
        if act in seen: problems.append(f'{fn}:{ln}: duplicate')
        seen.add(act)
        r=[join(blk,modal(mod,'pres',p),mid,ptc,'werden'),join(blk,modal(mod,'prat',p),mid,ptc,'werden')]
        has_l=(mod=='k' and bool(inf))
        if has_l:
            r.append(join(blk,LASSEN[('pres',p)],mid,inf))
            r.append(join(blk,LASSEN[('prat',p)],mid,inf))
        n=note
        if mod!='k': n=(n+' ' if n else '')+'sich lassen only expresses possibility (können), so müssen / sollen / dürfen have no sich-lassen form.'
        elif not has_l and 'sich lassen' not in n: n=(n+' ' if n else '')+'sich lassen is not used here.'
        it={'i':len(items),'a':act,'s':src_label(src),'d':dom,'m':mod,'p':p,'r':r}
        if n: it['n']=n.strip()
        # word families
        if ptc not in VERBS: missing_verbs.add(ptc)
        else:
            if ptc not in VERB_IDX: VERB_IDX[ptc]=len(VERB_LIST); VERB_LIST.append(VERBS[ptc])
            it['vi']=VERB_IDX[ptc]
        ni=[]
        for tok in re.findall(r"[A-ZÄÖÜ][\wäöüßÄÖÜ-]*",act):
            if tok in FORMS:
                if FORMS[tok] not in ni: ni.append(FORMS[tok])
            elif tok not in STOP: unmatched[tok]+=1
        for k in ni: NOUNS[k][4]+=1
        it['ni']=ni
        items.append(it)
if problems: print('\n'.join(problems)); sys.exit(1)
print('items:',len(items),' with sich lassen:',sum(1 for x in items if len(x['r'])==4))
print('by modal:',collections.Counter(MODNAME[x['m']] for x in items))
print('by domain:',collections.Counter(DOM[x['d']] for x in items))
print('by book:',collections.Counter(x['s'].split(' ·')[0] for x in items))
print('MISSING VERBS:',sorted(missing_verbs))
print('UNMATCHED TOKENS:',dict(unmatched))
if missing_verbs or unmatched:
    if len(sys.argv)<4 or sys.argv[3]!='--force': sys.exit(2)
used=[k for k,n in enumerate(NOUNS) if n[4]>0]
remap={k:j for j,k in enumerate(used)}
for it in items: it['ni']=[remap[k] for k in it['ni']]
NOUN_LIST=[NOUNS[k][:4] for k in used]
print('verbs embedded:',len(VERB_LIST),'nouns embedded:',len(NOUN_LIST),'no-noun sentences:',[x['a'] for x in items if not x['ni']])
tpl=open(base+'/modal/modal_template.html',encoding='utf-8').read()
html=(tpl.replace('__DATA__',json.dumps(items,ensure_ascii=False,separators=(',',':')))
        .replace('__COUNT__',str(len(items)))
        .replace('__VERBS__',json.dumps(VERB_LIST,ensure_ascii=False,separators=(',',':')))
        .replace('__NOUNS__',json.dumps(NOUN_LIST,ensure_ascii=False,separators=(',',':'))))
open(sys.argv[2],'w',encoding='utf-8').write(html)
print('written',sys.argv[2],len(html))
