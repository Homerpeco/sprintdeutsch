# builds modal_template.html = head of the Passive Voice template (CSS/markup, adapted) + modal_script.js
import os
h=os.path.expanduser('~/work/')
old=open(h+'passiv_template.html',encoding='utf-8').read()
head=old.split('<script>')[0]
def rep(a,b):
    global head
    assert a in head,a
    head=head.replace(a,b)
rep('<title>Passive Voice</title>','<title>Passive mit Modalverb</title>')
rep('<h1>Passive Voice Trainer</h1>','<h1>Passive mit Modalverb</h1>')
rep('<p>Active to passive in four tenses: Präsens, Präteritum, Perfekt, Plusquamperfekt. Every visit starts with a new random set; the app remembers your progress and mistakes.</p>',
    '<p>Turn “man kann …” into the passive with a modal verb (kann gelöst werden) and, for können, into the replacement form with sich lassen (lässt sich lösen), in Präsens and Präteritum. Every visit starts with a new random set; the app remembers your progress and mistakes.</p>')
rep('grid-template-columns:128px 1fr 44px','grid-template-columns:140px 1fr 44px')
rep('grid-template-columns:118px 1fr 40px','grid-template-columns:130px 1fr 38px')
js=open(h+'modal/modal_script.js',encoding='utf-8').read()
open(h+'modal/modal_template.html','w',encoding='utf-8').write(head+js)
print(len(head+js))
