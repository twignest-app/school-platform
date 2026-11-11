// GrowNest · SEF evidence: builds self-evaluation evidence from observations and learning walks
const FW = [
 {n:1, title:"Students’ achievement", ind:[
  {code:"1.1", title:"Attainment", subj:true, els:[["1.1.1","Attainment as measured against authorised and licensed curriculum standards"],["1.1.2","Attainment as measured against national and appropriate international standards"],["1.1.3","Knowledge, skills and understanding, especially in the key subjects"],["1.1.4","Trends in attainment over time"]]},
  {code:"1.2", title:"Progress", subj:true, els:[["1.2.1","Progress of students, including those with special educational needs, against their starting points and over time"],["1.2.2","Progress in lessons"],["1.2.3","Progress of different groups of students"]]},
  {code:"1.3", title:"Learning skills", els:[["1.3.1","Students’ engagement in and responsibility for their own learning"],["1.3.2","Students’ interactions, collaboration and communication skills"],["1.3.3","Application of learning to the real world and making connections between areas of learning"],["1.3.4","Innovation, enterprise, enquiry, research, critical thinking, problem solving and use of learning technologies"]]}]},
 {n:2, title:"Students’ personal and social development, and their innovation skills", ind:[
  {code:"2.1", title:"Personal development", els:[["2.1.1","Attitudes"],["2.1.2","Behaviour"],["2.1.3","Relationships"],["2.1.4","Adoption of safe and healthy lifestyles"],["2.1.5","Attendance and punctuality"]]},
  {code:"2.2", title:"Understanding of Islamic values and awareness of Emirati and world cultures", els:[["2.2.1","Students’ appreciation of the role and values of Islam in UAE society"],["2.2.2","Respect for the heritage and culture of the UAE"],["2.2.3","Understanding and appreciation of their own and other world cultures"]]},
  {code:"2.3", title:"Social responsibility and innovation skills", els:[["2.3.1","Community involvement, volunteering and social contribution"],["2.3.2","Work ethic, innovation, enterprise and entrepreneurship"],["2.3.3","Environmental awareness and action"]]}]},
 {n:3, title:"Teaching and assessment", ind:[
  {code:"3.1", title:"Teaching for effective learning", els:[["3.1.1","Teachers’ knowledge of their subjects and how students learn them"],["3.1.2","Lesson planning, the learning environment and the use of time and resources"],["3.1.3","Teacher–student interactions including the use of questioning and dialogue"],["3.1.4","Teaching strategies to meet the needs of individuals and groups of students"],["3.1.5","Teaching to develop critical thinking, problem-solving, innovation and independent learning skills"]]},
  {code:"3.2", title:"Assessment", els:[["3.2.1","Internal assessment processes"],["3.2.2","External, national and international benchmarking"],["3.2.3","Analysis of assessment data to monitor students’ progress"],["3.2.4","Use of assessment information to influence teaching, the curriculum and students’ progress"],["3.2.5","Teachers’ knowledge of and support for students’ learning"]]}]},
 {n:4, title:"Curriculum", ind:[
  {code:"4.1", title:"Curriculum design and implementation", els:[["4.1.1","Rationale, balance and compliance"],["4.1.2","Continuity and progression"],["4.1.3","Curricular choices"],["4.1.4","Cross-curricular links"],["4.1.5","Review and development"]]},
  {code:"4.2", title:"Curriculum adaptation", els:[["4.2.1","Modification of curriculum to meet the needs of all groups of students"],["4.2.2","Enhancement, enterprise and innovation"],["4.2.3","Links with Emirati culture and UAE society"]]}]},
 {n:5, title:"The protection, care, guidance and support of students", ind:[
  {code:"5.1", title:"Health and safety, including arrangements for child protection and safeguarding", els:[["5.1.1","Care, welfare and safeguarding of students, including child protection"],["5.1.2","Arrangements to ensure health, safety and security"],["5.1.3","Quality of maintenance and record keeping"],["5.1.4","Suitability of premises and facilities for all students, including those with special educational needs"],["5.1.5","Provision for and promotion of safe and healthy lifestyles"]]},
  {code:"5.2", title:"Care and support", els:[["5.2.1","Staff–student relationships and behaviour management"],["5.2.2","Promotion and management of attendance and punctuality"],["5.2.3","Identification of students with special educational needs, and those who are gifted and/or talented"],["5.2.4","Support for students with special educational needs, and those who are gifted and/or talented"],["5.2.5","Guidance and support for all students"]]}]},
 {n:6, title:"Leadership and management", whole:true, ind:[
  {code:"6.1", title:"The effectiveness of leadership", els:[["6.1.1","Vision and direction"],["6.1.2","Educational leadership"],["6.1.3","Relationships and communication"],["6.1.4","Capacity to innovate and improve"],["6.1.5","Impact on and accountability for school performance and standards"]]},
  {code:"6.2", title:"Self-evaluation and improvement planning", els:[["6.2.1","Processes for school self-evaluation"],["6.2.2","Monitoring and evaluation of teaching and learning in relation to students’ achievements"],["6.2.3","The processes and impact of school improvement planning"],["6.2.4","Improvement over time"]]},
  {code:"6.3", title:"Partnerships with parents and the community", els:[["6.3.1","Parental involvement"],["6.3.2","Communication"],["6.3.3","Reporting"],["6.3.4","Community, national and relevant international partnerships"]]},
  {code:"6.4", title:"Governance", els:[["6.4.1","Involvement of parents and other stakeholders and impact on decision making"],["6.4.2","Ensuring accountability for the school’s actions and outcomes"],["6.4.3","Influence on and responsibility for the school’s performance"]]},
  {code:"6.5", title:"Management, staffing, facilities and resources", els:[["6.5.1","Management of the day-to-day life of the school"],["6.5.2","Sufficiency, deployment and development of suitably qualified staff to optimise student achievements"],["6.5.3","Appropriateness of the premises and learning environment to promote student achievements"],["6.5.4","The relevance and range of resources for effective teaching and learning"]]}]}
];
// Which lesson judgement feeds which SEF element
const FROM_JUDGEMENT = {"1.2.2":"1.2","1.3.1":"1.3.1","1.3.2":"1.3.2","1.3.3":"1.3.3","1.3.4":"1.3.4","2.1.1":"2.1","2.1.2":"2.1","3.1.1":"3.1.1","3.1.2":"3.1.2","3.1.3":"3.1.3","3.1.4":"3.1.4","3.1.5":"3.1.5","3.2.4":"3.2","3.2.5":"3.2"};
const KEY_SUBJECTS = ["Islamic education","Arabic as a first language","Arabic as an additional language","English","Mathematics","Science","UAE social studies"];
function keySubject(s){ const t = String(s || "").toLowerCase();
  if (/islam/.test(t)) return "Islamic education";
  if (/arabic/.test(t)) return /additional|\bb\b|non/.test(t) ? "Arabic as an additional language" : "Arabic as a first language";
  if (/english|literacy|phonics|read write/.test(t)) return "English";
  if (/math/.test(t)) return "Mathematics";
  if (/science/.test(t)) return "Science";
  if (/social|moral|uae/.test(t)) return "UAE social studies";
  return null; }
const LEVEL = n => ({6:"Outstanding",5:"Very good",4:"Good",3:"Acceptable",2:"Weak",1:"Very weak"})[n];
function quant(p, noun = "lessons observed"){ if (p <= 0) return "none of the " + noun; const w = p >= 100 ? "all" : p >= 90 ? "almost all" : p >= 75 ? "most" : p >= 50 ? "the majority of" : p >= 30 ? "a large minority of" : p >= 15 ? "a minority of" : "a few"; return w + " " + noun; }
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const lc = s => s ? s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, "") : "";
const words = s => (String(s || "").trim().match(/\S+/g) || []).length;

let ctx = null, phases = [], obsAll = [], judg = {}, stmts = {}, entries = {}, evCount = {}, teachersActive = 0, prevObs = [], prevJudg = {};
let curStd = 3, curPhase = {};

function periodRange(year, period){ const y = parseInt(year, 10);
  if (period === "Term 1") return [`${y}-08-01`, `${y}-12-31`];
  if (period === "Term 2") return [`${y + 1}-01-01`, `${y + 1}-03-31`];
  if (period === "Term 3") return [`${y + 1}-04-01`, `${y + 1}-07-31`];
  return [`${y}-08-01`, `${y + 1}-07-31`]; }
function previousPeriod(year, period){ const y = parseInt(year, 10);
  if (period === "Term 2") return [year, "Term 1"]; if (period === "Term 3") return [year, "Term 2"];
  if (period === "Term 1") return [`${y - 1}–${y}`, "Term 3"]; return [`${y - 1}–${y}`, "Whole year"]; }

async function init(){
  ctx = await requireStaff(); if (!ctx) return;
  headerButtons([["app.html","Dashboard"],["settings.html","School settings"]]);
  if (!["school_admin","leader"].includes(ctx.staff.role)) { document.querySelector("main").innerHTML = '<div class="card narrow"><h2>Leaders only</h2><p>SEF evidence is available to school leaders and admins, because it draws on observations across the whole school.</p></div>'; return; }
  const cur = academicYear(), y = parseInt(cur, 10);
  $("year").innerHTML = [`${y - 1}–${y}`, cur].map(v => `<option ${v === cur ? "selected" : ""}>${v}</option>`).join("");
  const m = new Date().getMonth(); $("period").value = m >= 7 ? "Term 1" : m <= 2 ? "Term 2" : "Term 3";
  $("year").onchange = $("period").onchange = load;
  const ph = await sb.from("school_phases").select("*").eq("school_id", ctx.school.id).order("sort");
  phases = ph.data || [];
  if (!phases.length) showMsg($("msg"), "Tip: set up your school’s phases in School settings so evidence is grouped by phase, as in the SEF. Until then, evidence is shown for the whole school.", "info");
  const t = await sb.from("teachers").select("id", {count: "exact", head: true}).eq("school_id", ctx.school.id).eq("status", "active");
  teachersActive = t.count || 0;
  renderTabs(); await load();
}
async function fetchPeriod(year, period){
  const [from, to] = periodRange(year, period);
  const o = await sb.from("observations").select("id,type,observed_on,grade_class,subject,overall_level,status,teacher_response,meeting_done,also_seen,teacher_id,targets").eq("school_id", ctx.school.id).gte("observed_on", from).lte("observed_on", to);
  const list = o.data || []; const ids = list.map(x => x.id); const J = {}, S = {}, E = {};
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const [j, st, ev] = await Promise.all([
      sb.from("observation_judgements").select("observation_id,indicator_code,level,walk_status").in("observation_id", chunk),
      sb.from("observation_statements").select("observation_id, statements(text,kind,indicator_code)").in("observation_id", chunk),
      sb.from("evidence").select("observation_id,indicator_code").in("observation_id", chunk)]);
    (j.data || []).forEach(r => (J[r.observation_id] = J[r.observation_id] || []).push(r));
    (st.data || []).filter(r => r.statements).forEach(r => (S[r.observation_id] = S[r.observation_id] || []).push(r.statements));
    (ev.data || []).forEach(r => { const k = r.indicator_code || "none"; E[k] = (E[k] || 0) + 1; });
  }
  return {list, J, S, E};
}
async function load(){
  $("status").textContent = "Gathering evidence…";
  const year = $("year").value, period = $("period").value;
  const [now, prev, en] = await Promise.all([fetchPeriod(year, period), fetchPeriod(...previousPeriod(year, period)),
    sb.from("sef_entries").select("*").eq("school_id", ctx.school.id).eq("academic_year", year).eq("period", period)]);
  obsAll = now.list; judg = now.J; stmts = now.S; evCount = now.E; prevObs = prev.list; prevJudg = prev.J;
  entries = {}; (en.data || []).forEach(r => entries[r.indicator_code + "|" + r.phase_key] = r);
  const fo = obsAll.filter(o => o.type === "formal_observation").length, lw = obsAll.filter(o => o.type === "learning_walk").length;
  $("status").textContent = `${fo} formal observation${fo === 1 ? "" : "s"} and ${lw} learning walk visit${lw === 1 ? "" : "s"} in ${period === "Whole year" ? year : period + " " + year}.`;
  renderStd();
}
function renderTabs(){
  $("tabs").innerHTML = FW.map(s => `<button type="button" data-std="${s.n}" aria-selected="${s.n === curStd}"><b>${s.n}</b><span>${esc(s.title)}</span></button>`).join("");
}
$("tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; curStd = +b.dataset.std; renderTabs(); renderStd(); });
const phaseList = std => std.whole || !phases.length ? [{id: "school", name: "Whole school", label: ""}] : phases.map(p => ({id: p.id, name: p.name, label: p.label}));

// ---------- evidence calculations ----------
function inPhase(list, pid){ return pid === "school" ? list : list.filter(o => phaseOf(o.grade_class, phases) === pid); }
function judgementStats(list, J, code){
  const lv = []; list.filter(o => o.type === "formal_observation").forEach(o => (J[o.id] || []).forEach(r => { if (r.indicator_code === code && r.level) lv.push(r.level); }));
  const n = lv.length; return {n, good: pct(lv.filter(x => x >= 4).length, n), vg: pct(lv.filter(x => x >= 5).length, n), dist: [6,5,4,3,2,1].map(k => lv.filter(x => x === k).length)};
}
function walkStats(list, J, code){
  const c = {seen: 0, partly_seen: 0, not_seen: 0}; list.filter(o => o.type === "learning_walk").forEach(o => (J[o.id] || []).forEach(r => { if (r.indicator_code === code && r.walk_status) c[r.walk_status]++; }));
  c.total = c.seen + c.partly_seen + c.not_seen; return c;
}
function topStatements(list, code, kind){
  const c = {}; list.forEach(o => (stmts[o.id] || []).forEach(s => { if (s.indicator_code === code && s.kind === kind) c[s.text] = (c[s.text] || 0) + 1; }));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function alsoCount(list, el){ const codes = ALSO_SEEN.filter(a => a.els.includes(el)).map(a => a.code); const lessons = list.filter(o => o.type !== "appraisal");
  return {n: lessons.filter(o => (o.also_seen || []).some(c => codes.includes(c))).length, of: lessons.length, labels: ALSO_SEEN.filter(a => a.els.includes(el)).map(a => a.label)}; }

function draftFor(ind, pid){
  const list = inPhase(obsAll, pid), prev = inPhase(prevObs, pid), out = [], gaps = [];
  for (const [code, name] of ind.els) {
    const src = FROM_JUDGEMENT[code]; let line = "";
    if (src) {
      const s = judgementStats(list, judg, src), p = judgementStats(prev, prevJudg, src), w = walkStats(list, judg, src);
      if (s.n) {
        line = `${code} ${name}: judged good or better in ${quant(s.good)} (${s.good}% of ${s.n}), with ${s.vg}% very good or better${s.n < 5 ? " (a small sample, so interpret with care)" : ""}.`;
        if (p.n) line += s.good > p.good ? ` This is an improvement from ${p.good}% in the previous period.` : s.good < p.good ? ` This is lower than ${p.good}% in the previous period.` : ` This is consistent with the previous period.`;
      }
      if (w.total) line += (line ? " " : `${code} ${name}: `) + `Learning walks found this seen in ${w.seen} of ${w.total} visits${w.partly_seen ? " and partly seen in " + w.partly_seen : ""}.`;
      if (line) { const st = topStatements(list, src, "strength")[0], dv = topStatements(list, src, "development")[0];
        if (st) line += ` A recurring strength is that ${lc(st[0])}.`; if (dv) line += ` A common next step is to ${lc(dv[0])}.`; }
      if (code === "1.2.2" && ind.subj && s.n) {
        const by = KEY_SUBJECTS.map(k => { const sub = list.filter(o => keySubject(o.subject) === k); const ss = judgementStats(sub, judg, "1.2"); return [k, ss]; }).filter(x => x[1].n);
        if (by.length) line += " By key subject, progress in lessons was good or better in " + by.map(([k, ss]) => `${quant(ss.good, k + " lessons")} (${ss.good}%, ${ss.n})`).join("; ") + ".";
      }
    }
    const a = alsoCount(list, code);
    if (a.n) line += (line ? " " : `${code} ${name}: `) + `${a.labels.join(" / ")} was noted in ${a.n} of ${a.of} lessons and visits observed (${pct(a.n, a.of)}%).`;
    if (ind.code === "6.2" && code === "6.2.2") line = monitoringLine(code, name);
    if (ind.code === "6.2" && code === "6.2.4") { const g = overallGood(obsAll), p = overallGood(prevObs); if (g.n && p.n) line = `${code} ${name}: across formal observations, lessons judged good or better overall ` + (g.pct === p.pct ? `remained at ${g.pct}%, the same as in the previous period.` : `${g.pct > p.pct ? "rose" : "fell"} from ${p.pct}% in the previous period to ${g.pct}% in this period.`); }
    if (ind.code === "6.5" && code === "6.5.2") { const ap = obsAll.filter(o => o.type === "appraisal"); if (ap.length) line = `${code} ${name}: ${ap.length} teacher appraisal${ap.length === 1 ? " was" : "s were"} completed in this period, ${ap.filter(o => (o.targets || "").trim()).length} with agreed professional targets informed by observation evidence.`; }
    if (line) out.push(line); else gaps.push(code);
  }
  return {text: out.join("\n\n"), gaps};
}
function overallGood(list){ const f = list.filter(o => o.type === "formal_observation" && o.overall_level); return {n: f.length, pct: pct(f.filter(o => o.overall_level >= 4).length, f.length)}; }
function monitoringLine(code, name){
  const fo = obsAll.filter(o => o.type === "formal_observation"), lw = obsAll.filter(o => o.type === "learning_walk");
  if (!fo.length && !lw.length) return "";
  const seen = new Set(obsAll.filter(o => o.type !== "appraisal").map(o => o.teacher_id)).size;
  const sent = obsAll.filter(o => o.type !== "appraisal" && o.status === "sent").length, all = fo.length + lw.length;
  const mr = obsAll.filter(o => o.teacher_response === "meeting_requested"), md = mr.filter(o => o.meeting_done).length;
  return `${code} ${name}: leaders monitor teaching and learning systematically through ${fo.length} formal observation${fo.length === 1 ? "" : "s"} and ${lw.length} learning walk visit${lw.length === 1 ? "" : "s"} in this period, covering ${seen}${teachersActive ? " of " + teachersActive : ""} teachers${teachersActive ? " (" + pct(seen, teachersActive) + "%)" : ""}. Written feedback aligned to the UAE School Inspection Framework was shared with teachers after ${pct(sent, all)}% of these visits${mr.length ? `, and ${md} of ${mr.length} requested follow-up meetings have taken place` : ""}.`;
}

// ---------- rendering ----------
function renderStd(){
  const std = FW.find(s => s.n === curStd), pl = phaseList(std);
  $("stdTitle").textContent = `Performance Standard ${std.n}: ${std.title}`;
  $("stdNote").textContent = std.whole ? "Standard 6 is evaluated for the whole school. Word guide: about 140 words per indicator." : `Evaluated by phase${phases.length ? "" : " (set up phases in School settings)"}. Word guide: about 300 words per phase.`;
  $("judgeTable").innerHTML = `<tr><th>Indicator</th>${pl.map(p => `<th>${esc(p.name)}</th>`).join("")}</tr>` + std.ind.map(ind => `<tr><td>${ind.code} ${esc(ind.title)}</td>${pl.map(p => { const e = entries[ind.code + "|" + p.id]; return `<td><select data-judge="${ind.code}|${p.id}"><option value="">–</option>${[6,5,4,3,2,1].map(n => `<option value="${n}" ${e && e.judgement === n ? "selected" : ""}>${LEVEL(n)}</option>`).join("")}</select></td>`; }).join("")}</tr>`).join("");
  $("inds").innerHTML = std.ind.map(ind => {
    const pid = curPhase[ind.code] || pl[0].id;
    return `<article class="indc" id="ind-${ind.code}"><div class="indh"><h3>${ind.code} ${esc(ind.title)}</h3><button class="btn ghost small" data-pack="${ind.code}">Evidence pack (Word)</button></div>
      <p class="muted els">${ind.els.map(e => `<span>${e[0]} ${esc(e[1])}</span>`).join("")}</p>
      ${pl.length > 1 ? `<div class="ptabs">${pl.map(p => `<button type="button" data-ind="${ind.code}" data-ph="${p.id}" aria-selected="${p.id === pid}">${esc(p.name)}${p.label ? " · " + esc(p.label) : ""}</button>`).join("")}</div>` : ""}
      <div id="body-${ind.code}">${indBody(std, ind, pid)}</div></article>`;
  }).join("");
}
function statsTable(ind, pid){
  const list = inPhase(obsAll, pid), rows = [];
  for (const [code] of ind.els) { const src = FROM_JUDGEMENT[code]; if (!src || rows.some(r => r.src === src)) continue;
    const s = judgementStats(list, judg, src), w = walkStats(list, judg, src); if (!s.n && !w.total) continue; rows.push({src, code, s, w}); }
  if (!rows.length) return "";
  const bar = s => s.n ? `<div class="dist">${s.dist.map((c, i) => c ? `<span style="flex:${c};background:${LEVELS[i].bg}" title="${c} ${LEVELS[i].name}"></span>` : "").join("")}</div>` : "";
  return `<table class="st"><tr><th>Evidence from lessons</th><th>Formal observations</th><th>Good or better</th><th>Very good or better</th><th>Learning walks (seen / partly / not yet)</th></tr>${rows.map(r => `<tr><td>${r.code}${r.src !== r.code ? " (lesson indicator " + r.src + ")" : ""}</td><td>${r.s.n || "–"}${bar(r.s)}</td><td>${r.s.n ? r.s.good + "%" : "–"}</td><td>${r.s.n ? r.s.vg + "%" : "–"}</td><td>${r.w.total ? `${r.w.seen} / ${r.w.partly_seen} / ${r.w.not_seen}` : "–"}</td></tr>`).join("")}</table>`;
}
function indBody(std, ind, pid){
  const key = ind.code + "|" + pid, e = entries[key], d = draftFor(ind, pid), text = e && e.body != null ? e.body : d.text, limit = std.whole ? 140 : 300;
  const photos = Object.entries(evCount).filter(([k]) => k.startsWith(ind.code) || (FROM_JUDGEMENT && Object.entries(FROM_JUDGEMENT).some(([el, src]) => el.startsWith(ind.code) && src === k))).reduce((a, [, v]) => a + v, 0);
  return `${statsTable(ind, pid)}
   <label class="f" style="margin-top:12px">Evaluative bullet points <span class="wc" id="wc-${ind.code}">${words(text)} / ${limit} words</span>
    <textarea class="sefta" data-key="${key}" data-limit="${limit}" data-ind="${ind.code}" rows="9" placeholder="No GrowNest evidence for this indicator in this period yet. Write your evaluation here.">${esc(text)}</textarea></label>
   <div class="row2"><button class="btn ghost small" data-redraft="${key}">Rebuild draft from GrowNest data</button><button class="btn ghost small" data-copy="${ind.code}">Copy</button><span class="muted" style="font-size:.82rem" id="sv-${ind.code}"></span></div>
   ${d.gaps.length ? `<p class="gap"><b>No GrowNest evidence yet for:</b> ${d.gaps.join(", ")}${/^1\.1|^1\.2\.1|^1\.2\.3|^3\.2\.[123]/.test(d.gaps.join(" ")) ? " (for example assessment data, work scrutiny and benchmark results)" : ""}.</p>` : ""}
   ${photos ? `<p class="muted" style="font-size:.85rem">📷 ${photos} photo${photos === 1 ? "" : "s"} linked to this indicator in observations.</p>` : ""}`;
}
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.ph) { curPhase[b.dataset.ind] = b.dataset.ph; const std = FW.find(s => s.n === curStd), ind = std.ind.find(i => i.code === b.dataset.ind);
    b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b)); $("body-" + ind.code).innerHTML = indBody(std, ind, b.dataset.ph); }
  if (b.dataset.redraft) { const [code, pid] = b.dataset.redraft.split("|"); const std = FW.find(s => s.n === curStd), ind = std.ind.find(i => i.code === code);
    if (entries[b.dataset.redraft] && entries[b.dataset.redraft].body && !confirm("Replace your edited text with a fresh draft from GrowNest data?")) return;
    const ta = document.querySelector(`textarea[data-key="${b.dataset.redraft}"]`); ta.value = draftFor(ind, pid).text; ta.dispatchEvent(new Event("input", {bubbles: true})); }
  if (b.dataset.copy) { const ta = document.querySelector(`textarea[data-ind="${b.dataset.copy}"]`); ta.select(); try { await navigator.clipboard.writeText(ta.value); } catch { document.execCommand("copy"); } b.textContent = "Copied ✓"; setTimeout(() => b.textContent = "Copy", 1200); }
  if (b.dataset.pack) exportDoc([b.dataset.pack]);
});
const timers = {};
function saveEntry(key, patch){ const [code, pid] = key.split("|"); clearTimeout(timers[key]);
  timers[key] = setTimeout(async () => { const row = {school_id: ctx.school.id, academic_year: $("year").value, period: $("period").value, indicator_code: code, phase_key: pid, updated_by: ctx.user.id, updated_at: new Date().toISOString(), ...patch};
    const prev = entries[key] || {}; const full = {judgement: prev.judgement ?? null, body: prev.body ?? null, ...row};
    const {data, error} = await sb.from("sef_entries").upsert(full, {onConflict: "school_id,academic_year,period,indicator_code,phase_key"}).select().single();
    const sv = $("sv-" + code); if (error) { if (sv) sv.textContent = "Not saved – check your connection"; console.error(error); return; }
    entries[key] = data; if (sv) { sv.textContent = "Saved"; setTimeout(() => sv.textContent = "", 1500); } }, 700); }
document.addEventListener("input", e => { const ta = e.target; if (!ta.classList.contains("sefta")) return;
  const w = words(ta.value), lim = +ta.dataset.limit, wc = $("wc-" + ta.dataset.ind); wc.textContent = `${w} / ${lim} words`; wc.classList.toggle("over", w > lim);
  saveEntry(ta.dataset.key, {body: ta.value}); });
document.addEventListener("change", e => { const s = e.target; if (!s.dataset.judge) return; saveEntry(s.dataset.judge, {judgement: +s.value || null}); });
$("exportAll").onclick = () => exportDoc(FW.flatMap(s => s.ind.map(i => i.code)));

// ---------- Word export ----------
async function exportDoc(codes){
  if (!window.JSZip) return showMsg($("msg"), "The Word maker didn’t load. Check your connection and refresh.", "err");
  const x = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const run = (t, o = {}) => `<w:r><w:rPr>${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}<w:color w:val="${o.c || "222222"}"/><w:sz w:val="${o.sz || 20}"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  const p = (r, o = {}) => `<w:p><w:pPr>${o.pb ? "<w:pageBreakBefore/>" : ""}<w:spacing w:before="${o.bf || 0}" w:after="${o.af == null ? 80 : o.af}"/></w:pPr>${r}</w:p>`;
  const c = (w, t, f, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${f ? `<w:shd w:val="clear" w:color="auto" w:fill="${f}"/>` : ""}<w:tcMar><w:top w:w="50" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>${p(run(t, o), {af: 0})}</w:tc>`;
  const tbl = (ws, rows) => `<w:tbl><w:tblPr><w:tblW w:w="${ws.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblBorders>${["top","left","bottom","right","insideH","insideV"].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BFB3CC"/>`).join("")}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${ws.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.map(r => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r}</w:tr>`).join("")}</w:tbl>`;
  const W = 10466, period = $("period").value, year = $("year").value, single = codes.length === 1;
  let body = "";
  if (single) { const ind = FW.flatMap(s => s.ind).find(i => i.code === codes[0]);
    body += p(run(`SEF Evidence: ${ind.code} ${ind.title}`, {b: true, sz: 40, c: "4A2C5E"}), {af: 60}) + p(run(`${period === "Whole year" ? year : period + " " + year} · Evidence from lesson observations and learning walks`, {sz: 20, c: "76658A"}), {af: 240}); }
  else body += p(run(`Self-evaluation evidence ${period === "Whole year" ? year : period + " " + year}`, {b: true, sz: 40, c: "4A2C5E"}), {af: 60}) + p(run("Evidence from lesson observations and learning walks, organised by the UAE School Inspection Framework", {sz: 20, c: "76658A"}), {af: 240});
  let first = true;
  for (const std of FW) { const inds = std.ind.filter(i => codes.includes(i.code)); if (!inds.length) continue;
    const pl = phaseList(std);
    body += p(run(`Performance Standard ${std.n}: ${std.title}`, {b: true, sz: 28, c: "4A2C5E"}), {pb: !single && !first, bf: 120, af: 120}); first = false;
    const cw = Math.floor((W - 4200) / pl.length);
    body += tbl([4200, ...pl.map(() => cw)], [c(4200, "Indicator", "E3D6F2", {b: true, sz: 18}) + pl.map(ph => c(cw, ph.name, "E3D6F2", {b: true, sz: 18})).join(""),
      ...inds.map(ind => c(4200, `${ind.code} ${ind.title}`, null, {sz: 18}) + pl.map(ph => { const e = entries[ind.code + "|" + ph.id]; return c(cw, e && e.judgement ? LEVEL(e.judgement) : "", null, {b: true, sz: 18}); }).join(""))]);
    for (const ind of inds) { body += p(run(`${ind.code} ${ind.title}`, {b: true, sz: 24, c: "4A2C5E"}), {bf: 240, af: 80});
      for (const ph of pl) { const e = entries[ind.code + "|" + ph.id], text = e && e.body != null ? e.body : draftFor(ind, ph.id).text;
        if (pl.length > 1) body += p(run(ph.name + (ph.label ? " · " + ph.label : ""), {b: true, sz: 21, c: "6F9E6B"}), {bf: 120, af: 60});
        const list = inPhase(obsAll, ph.id); const rows = [];
        for (const [code] of ind.els) { const src = FROM_JUDGEMENT[code]; if (!src || rows.some(r => r.src === src)) continue; const s = judgementStats(list, judg, src); if (s.n) rows.push({src, code, s}); }
        if (rows.length) body += tbl([3400, 2300, 2366, 2400], [c(3400, "Lesson evidence", "EFE8F5", {b: true, sz: 17}) + c(2300, "Formal observations", "EFE8F5", {b: true, sz: 17}) + c(2366, "Good or better", "EFE8F5", {b: true, sz: 17}) + c(2400, "Very good or better", "EFE8F5", {b: true, sz: 17}),
          ...rows.map(r => c(3400, r.code, null, {sz: 17}) + c(2300, String(r.s.n), null, {sz: 17}) + c(2366, r.s.good + "%", null, {sz: 17}) + c(2400, r.s.vg + "%", null, {sz: 17}))]) + p("", {af: 80});
        body += (text || "").split(/\n+/).filter(t => t.trim()).map(t => p(run(t, {sz: 20}), {af: 100})).join("") || p(run("No evidence recorded in GrowNest for this period.", {i: true, sz: 19, c: "76658A"}));
      } } }
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="800" w:right="720" w:bottom="800" w:left="720" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file("word/document.xml", doc);
  const blob = await z.generateAsync({type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = (single ? `SEF Evidence ${codes[0]}` : "SEF evidence") + ` - ${period === "Whole year" ? year : period + " " + year}.docx`; document.body.appendChild(a); a.click(); a.remove();
}
init();
