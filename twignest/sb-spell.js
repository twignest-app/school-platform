/* Spelling Bee rules (copied from school-spellingbee.com/spell.js), wrapped so its names stay private. Used to sort words into spelling objectives. */
(function(){
/* Spelling Bee — shared spelling helpers: rules, word families, letter-by-letter
   comparison, error types and family challenges. Used by the practice page,
   the teacher page and the parent reports. Powered by ThinkNest. */
(function(){
"use strict";
const low=s=>String(s||'').toLowerCase().replace(/[’']/g,"'").trim();

/* ---------- spelling rules and patterns ----------
   id, name, tip (child-friendly), re (where the pattern sits in the word), ex (example words) */
const R=[
 {id:'dbl',name:'Double the last letter',tip:'After a short vowel sound and one consonant, double the last letter before adding -ing, -ed, -er, -est or -y: hop → hopping, big → bigger, sun → sunny.',re:/[aeiou](([bdfglmnprt])\2)(ing|ed|er|est|y)$/,ex:['hopping','running','bigger','sunny','stopped']},
 {id:'drope',name:'Drop the e',tip:'If a word ends in e, drop the e before adding -ing, -ed, -er or -able: hope → hoping, make → making, love → lovable.',ex:['hoping','making','smiling','baked','lovable']},
 {id:'yi',name:'Change y to i',tip:'If a word ends in a consonant + y, change the y to i before adding -ed, -er, -est, -ly, -ness or -ful: happy → happier, cry → cried, beauty → beautiful.',re:/[^aeiou](i)(ed|er|est|ly|ness|ful|es)$/,ex:['happier','cried','happily','beautiful','babies']},
 {id:'ful',name:'-ful has one l',tip:'When you add -ful to the end of a word, it only has one l: help → helpful, care → careful.',re:/.(ful)(ly|ness)?$/,ex:['helpful','careful','hopeful','playful','thankful']},
 {id:'ies',name:'Plurals with -ies',tip:'If a word ends in a consonant + y, change y to i and add -es: baby → babies, city → cities.',re:/[^aeiou](ies)$/,ex:['babies','cities','ponies','stories','families']},
 {id:'es',name:'Plurals with -es',tip:'Add -es (not just -s) after s, x, z, ch and sh: box → boxes, wish → wishes, church → churches.',re:/(s|x|z|ch|sh)(es)$/,ex:['boxes','wishes','buses','foxes','churches']},
 {id:'tion',name:'-tion says “shun”',tip:'The “shun” sound at the end of a word is usually spelt -tion: station, action, invention.',re:/(tion)s?$/,ex:['station','action','invention','fraction','mention']},
 {id:'sion',name:'-sion and -ssion',tip:'“shun” or “zhun” can be spelt -sion (television, decision) or -ssion after a short vowel (mission, discussion).',re:/(s?sion)s?$/,ex:['television','decision','mission','discussion','permission']},
 {id:'cian',name:'-cian for jobs',tip:'Jobs that come from words ending in -ic end in -cian: music → musician, magic → magician.',re:/(cian)s?$/,ex:['musician','magician','electrician','politician']},
 {id:'ture',name:'-ture',tip:'The “cher” sound at the end of a word is often spelt -ture: picture, adventure, nature.',re:/(ture)s?$/,ex:['picture','adventure','nature','creature','furniture']},
 {id:'sure',name:'-sure',tip:'The “zher” sound at the end of a word is spelt -sure: measure, treasure, pleasure.',re:/(sure)s?$/,ex:['measure','treasure','pleasure','enclosure']},
 {id:'ous',name:'-ous',tip:'The “us” sound at the end of a describing word is spelt -ous: famous, dangerous, nervous.',re:/(i?ous)(ly)?$/,ex:['famous','dangerous','nervous','various','curious']},
 {id:'able',name:'-able and -ible',tip:'Use -able when you can hear a whole word in front of it (enjoy → enjoyable). Use -ible when you can’t (terrible, possible).',re:/[a-z]{3}(able|ible)(ly)?$/,ex:['enjoyable','comfortable','terrible','possible','visible']},
 {id:'ance',name:'-ance and -ence',tip:'-ance and -ence sound the same. Learn which one each word uses: distance, importance, difference, silence.',re:/(ance|ence|ancy|ency|ant|ent)$/,ex:['distance','importance','difference','silence','confident']},
 {id:'cious',name:'-cious and -tious',tip:'“shus” is spelt -cious if the root word ends in -ce (grace → gracious) and -tious if it ends in -tion (caution → cautious).',re:/((?:c|t)ious)(ly)?$/,ex:['gracious','delicious','cautious','ambitious','precious']},
 {id:'cial',name:'-cial and -tial',tip:'“shul” is usually -cial after a vowel (special, official) and -tial after a consonant (partial, essential).',re:/((?:c|t)ial)(ly)?$/,ex:['special','official','partial','essential','social']},
 {id:'le',name:'-le at the end',tip:'The “ul” sound at the end of a word is most often spelt -le: table, apple, little, middle.',re:/[^aeiou](le)s?$/,ex:['table','apple','little','middle','bottle']},
 {id:'el',name:'-el, -al and -il',tip:'Some “ul” endings are -el (camel, tunnel), -al (metal, animal) or -il (pencil, fossil). Learn these words carefully.',re:/[a-z]{2}(el|al|il)s?$/,ex:['camel','tunnel','metal','animal','pencil']},
 {id:'tch',name:'-tch after a short vowel',tip:'After a short vowel, the “ch” sound is spelt -tch: catch, kitchen, witch, stretch.',re:/[aeiou](tch)/,ex:['catch','kitchen','witch','match','stretch']},
 {id:'dge',name:'-dge after a short vowel',tip:'After a short vowel, the “j” sound at the end is spelt -dge: badge, bridge, hedge, fudge.',re:/[aeiou](dge)/,ex:['badge','bridge','hedge','fudge','edge']},
 {id:'ge',name:'-ge after a long vowel or consonant',tip:'The “j” sound at the end of a word is spelt -ge after a long vowel or a consonant: age, huge, large, change.',re:/([aeiou][^aeiou]?e|[rn])(ge)s?$/,ex:['age','huge','large','change','orange']},
 {id:'ck',name:'-ck after a short vowel',tip:'After a short vowel, the “k” sound is spelt -ck: back, duck, sock, chicken.',re:/[aeiou](ck)/,ex:['back','duck','sock','chicken','pocket']},
 {id:'ve',name:'Words end in -ve',tip:'English words don’t end in v. Add an e: have, give, live, love.',re:/(ve)s?$/,ex:['have','give','live','love','five']},
 {id:'ph',name:'ph says “f”',tip:'In some words, the “f” sound is spelt ph: phone, dolphin, alphabet, elephant.',re:/(ph)/,ex:['phone','dolphin','alphabet','elephant','photo']},
 {id:'wh',name:'wh at the start',tip:'Some words start with wh even though we hear “w”: when, where, white, whale.',re:/^(wh)/,ex:['when','where','white','whale','wheel']},
 {id:'kn',name:'Silent letters',tip:'Some words have a silent letter you can’t hear: knee (k), write (w), lamb (b), gnome (g), island (s). Say it in a funny way to remember: “k-nee”!',re:/^(kn|wr|gn)|(mb)$|^i(s)l|(sc)i|(st)le$/,ex:['knee','write','lamb','gnome','island']},
 {id:'qu',name:'qu',tip:'The letter q is always followed by u: queen, quick, quiet, question.',re:/(qu)/,ex:['queen','quick','quiet','question','square']},
 {id:'igh',name:'igh says “ie”',tip:'igh makes the long “ie” sound: night, light, high, bright.',re:/(igh)/,ex:['night','light','high','bright','fight']},
 {id:'ie',name:'i before e',tip:'When the sound is “ee”, write ie (field, piece) — but after c write ei (receive, ceiling). Some words are rule-breakers: weird, seize.',re:/(ie|ei)/,ex:['field','piece','believe','receive','ceiling']},
 {id:'ai',name:'ai and ay',tip:'The long “ay” sound is spelt ai in the middle of a word (rain, train) and ay at the end (play, day).',re:/(ai|ay)/,ex:['rain','train','play','day','paint']},
 {id:'ee',name:'ee and ea',tip:'The long “ee” sound is often spelt ee (tree, sleep) or ea (sea, eat). Learn which words use which.',re:/(ee|ea)/,ex:['tree','sleep','sea','eat','teacher']},
 {id:'oa',name:'oa, ow and o-e',tip:'The long “oh” sound can be spelt oa (boat), ow (snow) or o-e (home). ow is common at the end of a word.',re:/(oa|ow$|o[^aeiou]e$)/,ex:['boat','coat','snow','grow','home']},
 {id:'ou',name:'ou and ow',tip:'The “ow” sound (like in “ouch!”) is spelt ou in the middle (house, cloud) and ow at the end or before n/l (cow, town, owl).',re:/(ou|ow)/,ex:['house','cloud','cow','town','flower']},
 {id:'oi',name:'oi and oy',tip:'The “oy” sound is spelt oi in the middle of a word (coin, point) and oy at the end (boy, toy).',re:/(oi|oy)/,ex:['coin','point','boy','toy','enjoy']},
 {id:'ar',name:'ar, or and er sounds',tip:'Bossy r changes the vowel: ar (car), or (fork), and the “er” sound can be er, ir or ur (her, bird, turn). Learn which one each word uses.',re:/(ar|or|er|ir|ur)/,ex:['car','fork','her','bird','turn']},
 {id:'oo',name:'oo, ew and ue',tip:'The long “oo” sound can be oo (moon), ew (grew) or ue (blue). ew and ue are common at the end of a word.',re:/(oo|ew|ue$)/,ex:['moon','spoon','grew','blue','glue']},
 {id:'au',name:'au and aw',tip:'The “or” sound can be spelt aw (saw, draw) or au (author, August).',re:/(aw|au)/,ex:['saw','draw','yawn','author','August']},
 {id:'air',name:'air, are and ear',tip:'The “air” sound can be air (chair), are (share) or ear (bear). Learn which words use which.',re:/(air|are|ear)/,ex:['chair','hair','share','care','bear']},
 {id:'softc',name:'Soft c',tip:'c says “s” when it comes before e, i or y: city, face, bicycle.',re:/(c)[eiy]/,ex:['city','face','bicycle','circle','race']},
 {id:'ly',name:'Adding -ly',tip:'Add -ly to make an adverb: sad → sadly, quick → quickly. If the word ends in -le, change it to -ly (gentle → gently). If it ends in -ic, add -ally (basic → basically).',re:/.(ly)$/,ex:['sadly','quickly','gently','happily','basically']},
 {id:'ment',name:'Suffixes -ment, -ness, -less',tip:'You can usually just add -ment, -ness or -less to the root word: enjoy → enjoyment, kind → kindness, care → careless.',re:/.(ment|ness|less)$/,ex:['enjoyment','kindness','careless','movement','sadness']},
 {id:'pre',name:'Prefixes',tip:'A prefix goes at the start and doesn’t change the root word’s spelling: un + happy = unhappy, dis + appear = disappear, mis + spell = misspell.',re:/^(un|dis|mis|re|pre|sub|super|anti|auto|inter|im|il|ir|in)(?=[a-z]{3})/,ex:['unhappy','disappear','misspell','replay','impossible']},
 {id:'ed',name:'-ed endings',tip:'-ed can sound like “d”, “t” or “id” (played, jumped, wanted), but it is always spelt -ed.',re:/[a-z]{2}(ed)$/,ex:['played','jumped','wanted','helped','asked']},
 {id:'ing',name:'Adding -ing',tip:'Add -ing to the root word: jump → jumping, play → playing. Watch out for the e-drop and doubling rules!',re:/[a-z]{2}(ing)$/,ex:['jumping','playing','reading','singing','walking']},
 {id:'homo',name:'Homophones',tip:'Homophones sound the same but have different spellings and meanings. Think about what the word means in your sentence.',ex:['there','their','they’re','where','wear']},
 {id:'tricky',name:'Tricky word',tip:'This is a tricky word — part of it doesn’t follow the usual rules. Find the tricky part, say it in a funny way, and practise it a few times.',ex:[]}];
const RULE={};R.forEach(r=>RULE[r.id]=r);
/* order to try when grouping words into families (most specific first) */
const FAMILY_ORDER=['dbl','yi','ies','es','ful','tion','sion','cian','ture','sure','cious','cial','ous','able','ance','tch','dge','ck','ve','le','el','ph','wh','kn','qu','igh','ie','ai','oa','oo','ou','oi','au','air','ee','ar','softc','ge','ly','ment','pre','ed','ing'];

/* ---------- tricky words: National Curriculum common exception words and statutory word lists ---------- */
const TRICKY=new Set(('the a do to today of said says are were was is his has i you your they be he me she we no go so by my here there where love come some one once ask friend school put push pull full house our '+
 'door floor poor because find kind mind behind child children wild climb most only both old cold gold hold told every everybody even great break steak pretty beautiful after fast last past father class grass pass plant path bath hour move prove improve sure sugar eye could should would who whole any many clothes busy people water again half money mr mrs parents christmas '+
 'accident accidentally actual actually address answer appear arrive believe bicycle breath breathe build business calendar caught centre century certain circle complete consider continue decide describe different difficult disappear early earth eight eighth enough exercise experience experiment extreme famous favourite february forward forwards fruit grammar group guard guide heard heart height history imagine increase important interest island knowledge learn length library material medicine mention minute natural naughty notice occasion occasionally often opposite ordinary particular peculiar perhaps popular position possess possession possible potatoes pressure probably promise purpose quarter question recent regular reign remember sentence separate special straight strange strength suppose surprise therefore though although thought through various weight woman women '+
 'accommodate accompany according achieve aggressive amateur ancient apparent appreciate attached available average awkward bargain bruise category cemetery committee communicate community competition conscience conscious controversy convenience correspond criticise curiosity definite desperate determined develop dictionary disastrous embarrass environment equip equipped equipment especially exaggerate excellent existence explanation familiar foreign forty frequently government guarantee harass hindrance identity immediate immediately individual interfere interrupt language leisure lightning marvellous mischievous muscle necessary neighbour nuisance occupy occur opportunity parliament persuade physical prejudice privilege profession programme pronunciation queue recognise recommend relevant restaurant rhyme rhythm sacrifice secretary shoulder signature sincere sincerely soldier stomach sufficient suggest symbol system temperature thorough twelfth variety vegetable vehicle yacht').split(/\s+/));

/* ---------- homophones ---------- */
const HOMO=[['there','their',"they're"],['to','too','two'],['where','wear','were'],['here','hear'],['see','sea'],['write','right'],['one','won'],['for','four'],['son','sun'],['by','buy','bye'],['knight','night'],['which','witch'],['whether','weather'],['peace','piece'],['plain','plane'],['main','mane'],['break','brake'],['grate','great'],['bare','bear'],['allowed','aloud'],['affect','effect'],['accept','except'],['knew','new'],['know','no'],['blue','blew'],['hole','whole'],['meet','meat'],['week','weak'],['road','rode'],['tail','tale'],['flour','flower'],['heard','herd'],['male','mail'],['missed','mist'],['scene','seen'],['berry','bury'],['ball','bawl'],['fair','fare'],['pair','pear'],['stair','stare'],['your',"you're"],['its',"it's"],['who\'s','whose'],['groan','grown'],['rain','reign','rein'],['medal','meddle'],['passed','past'],['principal','principle'],['stationary','stationery'],['quite','quiet']];
const HOMOMAP={};HOMO.forEach(g=>g.forEach(w=>HOMOMAP[w]=g));

/* ---------- letter-by-letter comparison ---------- */
function align(word,typed){const a=low(word),b=low(typed),n=a.length,m=b.length;const D=[];for(let i=0;i<=n;i++){D[i]=[i];for(let j=1;j<=m;j++)D[i][j]=i?0:j}
 for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){D[i][j]=Math.min(D[i-1][j]+1,D[i][j-1]+1,D[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])D[i][j]=Math.min(D[i][j],D[i-2][j-2]+1)}
 const ops=[];let i=n,j=m;
 while(i>0||j>0){
  if(i>0&&j>0&&a[i-1]===b[j-1]&&D[i][j]===D[i-1][j-1]){ops.unshift({t:'=',a:a[i-1],b:b[j-1],i:i-1});i--;j--;continue}
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]&&D[i][j]===D[i-2][j-2]+1){ops.unshift({t:'x',a:a[i-2]+a[i-1],b:b[j-2]+b[j-1],i:i-2});i-=2;j-=2;continue}
  if(i>0&&j>0&&D[i][j]===D[i-1][j-1]+1){ops.unshift({t:'s',a:a[i-1],b:b[j-1],i:i-1});i--;j--;continue}
  if(i>0&&D[i][j]===D[i-1][j]+1){ops.unshift({t:'-',a:a[i-1],b:'',i:i-1});i--;continue}
  ops.unshift({t:'+',a:'',b:b[j-1],i:i});j--}
 return {ops,dist:D[n][m]}}
/* which letters of the real word the child got wrong: [start,end) */
function span(word,typed){const {ops}=align(word,typed);let s=null,e=null;ops.forEach(o=>{if(o.t==='=')return;const st=o.i,en=o.t==='+'?o.i:o.i+o.a.length;if(s===null||st<s)s=st;if(e===null||Math.max(en,st+1)>e)e=Math.max(en,st+1)});return s===null?null:[s,Math.min(e,low(word).length)]}
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* HTML: the child's spelling with wrong letters marked, and the real word with the letters to fix marked */
function diffHTML(word,typed){const {ops}=align(word,typed);let you='',real='';
 ops.forEach(o=>{if(o.t==='='){you+=E(o.b);real+=E(o.a)}
  else if(o.t==='-'){you+='<span class="sx-miss">_</span>';real+=`<span class="sx-fix">${E(o.a)}</span>`}
  else if(o.t==='+'){you+=`<span class="sx-bad">${E(o.b)}</span>`}
  else{you+=`<span class="sx-bad">${E(o.b)}</span>`;real+=`<span class="sx-fix">${E(o.a)}</span>`}});
 return {you,real}}

/* ---------- sound key: two spellings with the same key sound the same ---------- */
function key(w){w=low(w).replace(/[^a-z]/g,'');if(!w)return '';
 w=w.replace(/tch/g,'ch').replace(/dge/g,'j').replace(/ch/g,'H').replace(/sh/g,'S').replace(/th/g,'T').replace(/ph/g,'f').replace(/igh/g,'i').replace(/ough$/,'of').replace(/augh/,'af').replace(/gh/g,'')
  .replace(/ck/g,'k').replace(/^kn/,'n').replace(/^wr/,'r').replace(/^gn/,'n').replace(/mb$/,'m').replace(/^wh/,'w').replace(/qu/g,'kw').replace(/x/g,'ks')
  .replace(/(s|t)ion$/,'San').replace(/ture$/,'Har').replace(/sure$/,'Sar').replace(/ci(?=[aou])/g,'S').replace(/ti(?=[aou])/g,'S')
  .replace(/c(?=[eiy])/g,'s').replace(/c/g,'k').replace(/q/g,'k').replace(/z/g,'s').replace(/ge$/,'j')
  .replace(/([^aeiou])le$/,'$1al').replace(/ed$/,'d').replace(/([pkfsHS])t$/,'$1d');
 if(/^.*[aeiouy].*[^aeiou]e$/.test(w))w=w.slice(0,-1);
 w=w.replace(/(.)y/g,'$1a').replace(/([aeiou])w/g,'$1');
 return w.replace(/(.)\1+/g,'$1').replace(/[aeiou]+/g,'V').replace(/(.)\1+/g,'$1')}
const vowelGroups=k=>(k.match(/V/g)||[]).length;

/* ---------- which rule explains a word (and a mistake, if there is one) ---------- */
function patternRules(word){const w=low(word),out=[];
 FAMILY_ORDER.forEach(id=>{const r=RULE[id];if(!r.re)return;const m=w.match(r.re);if(!m)return;
  let g=1;while(g<m.length&&m[g]===undefined)g++;const part=m[g]||m[0];const at=m.index+m[0].indexOf(part);out.push({id,at,len:part.length})});
 return out}
function errorRule(word,typed){const w=low(word),t=low(typed);if(!t||t===w)return null;
 const sfx=w.match(/(ing|ed|er|est|able|y)$/);
 if(sfx){const base=w.slice(0,-sfx[1].length);
  if(t===base+'e'+sfx[1])return 'drope';                                        // hopeing
  if(/([bdfglmnprt])\1$/.test(base)&&t===base.slice(0,-1)+sfx[1])return 'dbl';   // hoping for hopping
  if(/[aeiou][bdfglmnprt]$/.test(base)&&t===base+base.slice(-1)+sfx[1])return 'drope'; // hopping for hoping
 }
 if(/[^aeiou]i(ed|er|est|ly|ness|ful|es)$/.test(w)&&t===w.replace(/i(ed|er|est|ly|ness|ful|es)$/,'y$1'))return 'yi';
 if(/ies$/.test(w)&&(t===w.replace(/ies$/,'ys')||t===w.replace(/ies$/,'yes')))return 'ies';
 if(/ful(ly|ness)?$/.test(w)&&t===w.replace(/ful/,'full'))return 'ful';
 if(/(s|x|z|ch|sh)es$/.test(w)&&t===w.slice(0,-2)+'s')return 'es';
 if(HOMOMAP[w]&&HOMOMAP[w].includes(t))return 'homo';
 if(/(ie|ei)/.test(w)&&t===w.replace(/ie/,'ei')||/ei/.test(w)&&t===w.replace(/ei/,'ie'))return 'ie';
 if(/(tion|sion)$/.test(w)&&t.replace(/(shun|shon|shion|ssion|cion|sion|tion)$/,'')===w.replace(/s?(tion|sion)$/,''))return w.endsWith('tion')?'tion':'sion';
 if(/[^aeiou]le$/.test(w)&&(t===w.replace(/le$/,'el')||t===w.replace(/le$/,'al')||t===w.replace(/le$/,'ul')))return 'le';
 if(/[aeiou]ck/.test(w)&&(t===w.replace('ck','k')||t===w.replace('ck','c')))return 'ck';
 if(/tch/.test(w)&&t===w.replace('tch','ch'))return 'tch';
 if(/dge/.test(w)&&(t===w.replace('dge','ge')||t===w.replace('dge','j')))return 'dge';
 if(/ve$/.test(w)&&t===w.slice(0,-1))return 've';
 return null}
function ruleFor(word,typed){const w=low(word);
 const er=typed?errorRule(word,typed):null;if(er)return RULE[er];
 if(TRICKY.has(w))return RULE.tricky;
 const pats=patternRules(w);
 if(typed){const sp=span(word,typed);if(sp){const hit=pats.find(p=>p.at<sp[1]&&p.at+p.len>sp[0]);if(hit)return RULE[hit.id]}}
 if(TRICKY.has(w))return RULE.tricky;
 if(HOMOMAP[w])return RULE.homo;
 return pats.length?RULE[pats[0].id]:null}
/* error type for teachers: 'tricky' (exception words), 'rule' (sounds right, wrong pattern) or 'sound' (sounds missing or mixed up) */
function classify(word,typed){const w=low(word),t=low(typed);if(!t||t===w)return null;
 if(TRICKY.has(w))return 'tricky';
 if(errorRule(w,t))return 'rule';
 const kw=key(w),kt=key(t);if(kw===kt)return 'rule';
 if(vowelGroups(kt)<vowelGroups(kw))return 'sound';
 const {dist,ops}=align(w,t);
 if(dist===1){const o=ops.find(x=>x.t!=='=');if(o&&o.t!=='x'){const pats=patternRules(w);if(pats.some(p=>o.i>=p.at&&o.i<p.at+p.len))return 'rule'}}
 return 'sound'}
const TYPES={sound:{name:'Sounds',e:'👂',tip:'Sounds missing, added or in the wrong order. Practise segmenting: say the word slowly and write a letter for every sound.'},
 rule:{name:'Spelling rules and patterns',e:'💡',tip:'The spelling sounds right but uses the wrong pattern or rule. Teach the rule and practise a word family together.'},
 tricky:{name:'Tricky words',e:'⭐',tip:'Common exception and statutory words that don’t follow the usual rules. Practise little and often, and highlight the tricky part.'}};

/* words from a list that share this word's rule (a word family) */
function family(word,list,n){const r=ruleFor(word);if(!r||!r.re)return [];const w=low(word);return (list||[]).filter(x=>low(x)!==w&&r.re.test(low(x))).slice(0,n||4)}
/* group a word list into families: [{rule, words}] (each word goes in its first matching family) */
function families(list){const g={};(list||[]).forEach(x=>{const p=patternRules(x);let id=p.length?p[0].id:null;if(TRICKY.has(low(x)))id='tricky';if(!id)return;(g[id]=g[id]||[]).push(x)});
 return Object.keys(g).map(id=>({rule:RULE[id],words:g[id]})).filter(f=>f.words.length>=1).sort((a,b)=>b.words.length-a.words.length)}
/* the letters of a word with its pattern marked */
function markPattern(word,rule){const w=String(word);if(!rule||!rule.re)return E(w);const m=low(w).match(rule.re);if(!m)return E(w);
 let g=1;while(g<m.length&&m[g]===undefined)g++;const part=m[g]||m[0];const at=m.index+m[0].indexOf(part);
 return E(w.slice(0,at))+`<b class="sx-pat">${E(w.slice(at,at+part.length))}</b>`+E(w.slice(at+part.length))}

/* ---------- family challenges (a different one each week) ---------- */
const FAMILY=[
 {e:'🗣️',t:'Spell it out loud',steps:['Choose 5 of your words.','Say each word, then spell it out loud to a grown-up, letter by letter.','Did you get them all? Try the tricky ones again tomorrow.'],tip:'If a word is wrong, say “nearly!” and show the tricky part.'},
 {e:'🔍',t:'Word detective',steps:['Look at one of your spelling rules in the Spelling Bee.','Find 3 words that follow the same rule in a book, a sign or a packet at home.','Write them down and show a grown-up.'],tip:'Help to read the words and point out the pattern.'},
 {e:'📝',t:'Fridge words',steps:['Write 3 of your tricky words on sticky notes.','Stick them where you’ll see them every day, like the fridge or a mirror.','Read them every morning. On Friday, spell them without looking!'],tip:'Check the spellings are copied correctly.'},
 {e:'👩‍🏫',t:'You’re the teacher',steps:['Read 5 of your words to a grown-up.','The grown-up writes them down.','Mark their spelling! Did they make any mistakes?'],tip:'Make one deliberate mistake and see if your child spots it.'},
 {e:'🎵',t:'Rhyme time',steps:['Pick 3 of your words.','Find a word that rhymes with each one.','Do the rhyming words use the same spelling pattern? Write them in pairs.'],tip:'Some rhymes use different spellings (bear and hair). Talk about it!'},
 {e:'🤪',t:'Silly sentence',steps:['With a grown-up, make up one silly sentence that uses 3 of your words.','Write it down carefully.','Read it out loud and check every spelling.'],tip:'Remind your child about capital letters and full stops.'},
 {e:'✋',t:'Air writing',steps:['Write 5 of your words in the air with your finger.','Say each letter as you write it.','Then write them on paper. Which were easiest?'],tip:'You can also try writing on each other’s backs and guessing the word!'},
 {e:'🏠',t:'Spelling hunt',steps:['A grown-up writes 5 of your words on paper and hides them around the room.','Find each word and read it out loud.','Turn it over and spell it without looking!'],tip:'Choose the words your child finds tricky.'},
 {e:'👏',t:'Clap the syllables',steps:['Choose your 5 longest words.','Clap the syllables (beats) in each word.','Spell each word one syllable at a time.'],tip:'“Beau-ti-ful” has three claps. Spelling one chunk at a time makes long words easier.'},
 {e:'🏆',t:'Beat your score',steps:['Ask a grown-up to test you on 10 of your words.','Write down your score.','Practise the ones you missed, then try again later in the week. Did you beat your score?'],tip:'Celebrate the improvement, not just the score.'}];
function weekStart(d){const x=d?new Date(d+'T12:00:00Z'):new Date(Date.now()+4*3600e3);const dow=(x.getUTCDay()+6)%7;return new Date(x.getTime()-dow*864e5).toISOString().slice(0,10)}
function familyFor(week){const n=Math.round(Date.parse((week||weekStart())+'T12:00:00Z')/(7*864e5));return FAMILY[((n%FAMILY.length)+FAMILY.length)%FAMILY.length]}


/* ---------- spell-checking a sentence (British and American spellings both accepted) ---------- */
let DICT=null,DICTP=null;
function loadDict(){if(DICT)return Promise.resolve(DICT);if(DICTP)return DICTP;
 DICTP=fetch('words.txt',{cache:'force-cache'}).then(r=>{if(!r.ok)throw 0;return r.text()}).then(t=>{DICT=new Set(t.split('\n'));return DICT}).catch(()=>{DICTP=null;return null});return DICTP}
function known(w,extra){w=low(w);if(!w)return true;if(DICT&&DICT.has(w))return true;if(extra&&extra.has(w))return true;
 const b=w.replace(/'s$/,'').replace(/s'$/,'s');if(b!==w&&(DICT&&DICT.has(b)||extra&&extra.has(b)))return true;return false}
/* every word in the text with ok true/false; names (capital letter, not the first word) are skipped */
function checkText(text,extraList){const extra=new Set((extraList||[]).map(low));const out=[];const re=/[A-Za-z][A-Za-z'’]*/g;let m,first=true,prevEnd=0;
 while((m=re.exec(text))){const raw=m[0].replace(/[’]/g,"'").replace(/'+$/,'');const before=text.slice(prevEnd,m.index);const start=first||/[.!?]\s*$/.test(before);
  const name=(!start&&/^[A-Z]/.test(raw)&&raw!=='I')||(/^[A-Z]/.test(raw)&&/'s$/.test(raw));out.push({w:raw,at:m.index,end:m.index+m[0].length,ok:name||raw==='I'||known(raw,extra),name});first=false;prevEnd=m.index+m[0].length}
 return out}
function lev(a,b,max){if(Math.abs(a.length-b.length)>max)return max+1;let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const cur=[i];let best=i;for(let j=1;j<=b.length;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(cur[j]<best)best=cur[j]}if(best>max)return max+1;prev=cur}return prev[b.length]}
function suggest(word,extraList,n){if(!DICT)return [];const w=low(word),kw=key(w);const pri=new Set([...(extraList||[]).map(low),...TRICKY]);const res=new Map();
 const consider=d=>{if(res.has(d)||d===w)return;const k=lev(w,d,3);const same=key(d)===kw;if(k>2&&!(same&&k<=3))return;res.set(d,k+(d[0]===w[0]?0:.6)-(same?1.5:0)-(pri.has(d)?.8:0)+(d.length<3?.5:0))};
 pri.forEach(d=>{if(Math.abs(d.length-w.length)<=3)consider(d)});
 for(const d of DICT){if(Math.abs(d.length-w.length)>3)continue;if(d[0]!==w[0]&&Math.abs(d.length-w.length)>2)continue;consider(d)}
 return [...res.entries()].sort((a,b)=>a[1]-b[1]).slice(0,n||3).map(x=>x[0])}
window.SPELL={RULES:R,RULE,TRICKY,HOMO,TYPES,align,span,diffHTML,key,ruleFor,errorRule,patternRules,classify,family,families,markPattern,FAMILY,familyFor,weekStart,low,loadDict,checkText,suggest,known};
})();

})();
