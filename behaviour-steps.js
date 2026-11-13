/* Nestopia · Positive Steps 🌱 — positive first; formal steps only for the chosen grades (Grades 4 and 5 by default),
   and for serious incidents in younger grades. Uses the globals of behaviour.html:
   sb, me, school, lead, classes, studs, evs, cfg, esc, toast, dlg, fmt, ymd, avOf, emOf */
const STEPS = {
  0: ["🌟", "Positive first", "No step. Keep catching them being good."],
  1: ["🌱", "Step 1 · Reset", "Restorative chat and a fresh start. Class teacher."],
  2: ["💬", "Step 2 · Parent check-in", "A friendly message to parents that starts with a positive, and a goal of 3 merits this week. Class teacher."],
  3: ["🤝", "Step 3 · Support meeting", "Meeting with the student, parents, class teacher and coordinator, and a “My agreement” with 2 or 3 positive targets."],
  4: ["🧭", "Step 4 · Extra support", "A school leader meets the family. Support plan, and an Inclusion referral or wellbeing concern if needed."]
};
const POSITIVE_TIPS = ["Praise a child nearby who’s getting it right", "A calm, quiet reminder of the expectation", "Give a choice: “You can … or …”", "A reset moment, or the calm corner", "Catch them being good later today"];
let files = {}, bhLog = [], setupGrades = [];
const S = () => Object.assign({ grades: null, s2: 3, s3: 5, window: 28, down: 28 }, cfg.steps || {});
const stepGrades = () => { const g = S().grades; if (g && g.length) return g; return setupGrades.filter(x => /(^|\D)(4|5)(\D|$)/.test(x.name)).map(x => x.id); };
const inSteps = s => { const c = classes.find(x => String(x.id) === String(s.class_id)); return !!(c && stepGrades().includes(c.grade_id)); };

async function stepsLoad(){
  try { const set = await sb.from("school_setups").select("config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1); setupGrades = (set.data && set.data[0] && set.data[0].config && set.data[0].config.grades) || []; } catch (_) {}
  const [f, l] = await Promise.all([sb.from("bh_files").select("*").eq("school_id", String(school.id)), sb.from("bh_log").select("*").eq("school_id", String(school.id)).order("created_at", { ascending: false }).limit(2000)]);
  if (f.error) return false; files = {}; (f.data || []).forEach(x => files[x.student_id] = x); bhLog = l.data || []; return true;
}
// Work out each student's step from their recent incidents; step down after a calm spell
async function runSteps(){
  const cf = S(), since = ymd(new Date(Date.now() - (cf.window - 1) * 864e5)), today = ymd(new Date()), changes = [];
  for (const s of studs) {
    const inc = evs.filter(e => String(e.student_id) === String(s.id) && e.kind === "incident" && e.happened_on >= since);
    const steps = inSteps(s), cur = files[String(s.id)] || { step: 0, step_since: today };
    let target = 0;
    if (inc.some(e => e.level === "high")) target = 4;
    else if (steps) target = inc.some(e => e.level === "medium") || inc.length >= cf.s3 ? 3 : inc.length >= cf.s2 ? 2 : inc.length ? 1 : 0;
    let next = cur.step;
    if (target > cur.step) next = target;
    else if (cur.step > 0 && !inc.length && (new Date(today) - new Date(cur.step_since)) / 864e5 >= cf.down) next = cur.step - 1;
    if (next !== cur.step) changes.push([s, cur.step, next]);
  }
  for (const [s, from, to] of changes) {
    const { error } = await sb.from("bh_files").upsert({ student_id: String(s.id), school_id: String(school.id), step: to, step_since: today, updated_at: new Date().toISOString() });
    if (error) continue;
    files[String(s.id)] = { student_id: String(s.id), step: to, step_since: today };
    const up = to > from, t = up ? `Moved to ${STEPS[to][1]}` : to === 0 ? "🎉 Back to positive first: 4 calm weeks!" : `🎉 Stepped down to ${STEPS[to][1]}: 4 calm weeks`;
    const { data } = await sb.from("bh_log").insert({ school_id: String(school.id), student_id: String(s.id), kind: "step", title: t, data: { from, to, auto: true }, created_by: me.id }).select().single();
    if (data) bhLog.unshift(data);
  }
  return changes.length;
}
const needs = sid => { const f = files[String(sid)]; if (!f || !f.step) return null; const L = bhLog.filter(x => x.student_id === String(sid) && x.created_at.slice(0, 10) >= f.step_since);
  if (f.step === 2 && !L.some(x => x.kind === "parent")) return "Contact parents";
  if (f.step >= 3 && !L.some(x => x.kind === "meeting")) return "Hold the support meeting";
  if (f.step >= 3 && !L.some(x => x.kind === "agreement")) return "Write “My agreement”";
  if (f.review_on && f.review_on < ymd(new Date())) return "Review is due";
  return null; };

/* ---------- Steps tab ---------- */
async function stepsPane(){
  const pane = document.getElementById("pane"); pane.innerHTML = '<div class="card"><p class="note">Loading…</p></div>';
  if (!(await stepsLoad())) { pane.innerHTML = '<div class="card"><div class="msg">Positive Steps needs its database step first. Please run the Behaviour steps update in Supabase.</div></div>'; return; }
  const n = await runSteps(); if (n) toast(n + " step change" + (n === 1 ? "" : "s") + " today");
  const mine = studs.filter(s => lead || (typeof myClassIds !== "undefined" && myClassIds.includes(String(s.class_id))));
  const on = mine.filter(s => (files[String(s.id)] || {}).step > 0);
  const gNames = stepGrades().map(g => (setupGrades.find(x => x.id === g) || { name: g }).name).join(" and ") || "the chosen grades";
  pane.innerHTML = `<div class="card" style="background:linear-gradient(160deg,#FFF8E7,#F3EDFA)"><h2>🌱 Positive Steps</h2><p style="margin:0">We start with <b>positive reinforcement</b>, always. Steps are only for <b>${esc(gNames)}</b>, and for serious incidents in younger grades. Four calm weeks moves a child down a step. 🎉</p>
      <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px">${[1, 2, 3, 4].map(k => `<span class="tag other" title="${esc(STEPS[k][2])}">${STEPS[k][0]} ${esc(STEPS[k][1])}</span>`).join("")}</div></div>
    ${[4, 3, 2, 1].map(k => { const l = on.filter(s => files[String(s.id)].step === k); if (!l.length) return "";
      return `<div class="card"><h2>${STEPS[k][0]} ${esc(STEPS[k][1])} <span class="note">(${l.length})</span></h2><p class="note" style="margin-top:0">${esc(STEPS[k][2])}</p>
        <div class="tablewrap"><table class="reg">${l.map(s => { const f = files[String(s.id)], nd = needs(s.id); return `<tr><td style="width:54px;font-size:30px">${avOf(s.id)}</td><td><button class="nm" data-file="${esc(s.id)}">${esc(s.full_name)}</button><br><span class="note">${esc((classes.find(c => String(c.id) === String(s.class_id)) || {}).name || "")} · since ${fmt(f.step_since)}</span></td>
          <td>${nd ? `<b style="color:var(--amber)">→ ${esc(nd)}</b>` : '<span class="note">Up to date</span>'}</td><td style="text-align:right"><button class="btn small" data-file="${esc(s.id)}">Open the file</button></td></tr>`; }).join("")}</table></div></div>`; }).join("")}
    ${on.length ? "" : '<div class="card"><p class="note" style="margin:0">🌟 Nobody is on a step. Keep catching them being good!</p></div>'}`;
  pane.querySelectorAll("[data-file]").forEach(b => b.onclick = () => openFile(b.dataset.file));
}

/* ---------- The behaviour file ---------- */
const KINDS = { step: "🪜", parent: "💬", meeting: "🤝", agreement: "✍️", review: "🔁", note: "📝", evidence: "📎" };
async function openFile(sid){
  if (!Object.keys(files).length) await stepsLoad();
  const s = studs.find(x => String(x.id) === String(sid)); if (!s) return;
  if (window.nestLog) nestLog("behaviour", null, sid);
  const f = files[String(sid)] || { step: 0 }, y0 = (() => { const d = new Date(), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return y + "-08-01"; })();
  const inc = evs.filter(e => String(e.student_id) === String(sid) && e.kind === "incident" && e.happened_on >= y0), mer = evs.filter(e => String(e.student_id) === String(sid) && e.kind === "merit" && e.happened_on >= y0);
  const byType = Object.entries(inc.reduce((a, e) => (a[e.category] = (a[e.category] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]);
  const L = bhLog.filter(x => x.student_id === String(sid));
  const items = [...inc.map(e => [e.happened_on + "T" + (e.created_at || "").slice(11, 19), `⚠️ <b>${esc({ low: "Low", medium: "Medium", high: "High" }[e.level] || "")}: ${esc(e.category)}</b>${e.details ? ` · ${esc(e.details)}` : ""}${e.action ? `<br><span class="note">Action: ${esc(e.action)}</span>` : ""}${e.tried_positive ? ' <span class="note">· 🌟 positive approach tried first</span>' : ""}`]),
    ...L.map(x => [x.event_date + "T" + x.created_at.slice(11, 19), `${KINDS[x.kind]} <b>${esc(x.title)}</b>${x.data && x.data.text ? `<br><span style="white-space:pre-line">${esc(x.data.text)}</span>` : ""}${x.data && x.data.targets ? `<ul style="margin:4px 0 0">${x.data.targets.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}${x.file_path ? `<br><a href="#" data-ev="${esc(x.file_path)}">📎 ${esc(x.file_name || "Evidence")}</a>` : ""}${["meeting", "agreement"].includes(x.kind) ? `<br><span class="note">${x.parent_ack_at ? "✅ Parents confirmed " + new Date(x.parent_ack_at).toLocaleDateString("en-GB") : x.data && x.data.share === false ? "Not shared with parents" : "⏳ Waiting for parents to confirm in the portal"}</span>` : ""}`])].sort((a, b) => b[0].localeCompare(a[0]));
  const grade = (classes.find(c => String(c.id) === String(s.class_id)) || {}).grade_id;
  dlg.innerHTML = `<div class="dlg" style="max-width:880px"><div class="row" style="justify-content:space-between;align-items:flex-start"><div class="row"><span style="font-size:46px">${avOf(sid)}</span><div><h2 style="margin:0">${esc(s.full_name)}</h2><p class="note" style="margin:2px 0 0">${esc((classes.find(c => String(c.id) === String(s.class_id)) || {}).name || "")} · ${inSteps(s) ? "Positive Steps grade" : "No steps in this grade (serious cases only)"}</p></div></div><button class="btn ghost small" data-x>Close</button></div>
    <div class="box" style="background:#FFF8E7"><b style="font-size:18px">${STEPS[f.step || 0][0]} ${esc(STEPS[f.step || 0][1])}</b>${f.step ? ` <span class="note">since ${fmt(f.step_since)}${f.review_on ? " · review " + fmt(f.review_on) : ""}</span>` : ""}<p class="note" style="margin:4px 0 0">${esc(STEPS[f.step || 0][2])}</p>
      <p style="margin:8px 0 0">⭐ <b>${mer.reduce((a, e) => a + (e.points || 1), 0)}</b> merit points · ⚠️ <b>${inc.length}</b> incidents this year${inc.length && mer.length < inc.length * 4 ? ` · <span style="color:var(--amber)">💛 Aim for 4 positives for every correction: catch ${esc(s.full_name.split(" ")[0])} being good today.</span>` : ""}</p>
      ${byType.length ? `<p style="margin:6px 0 0">${byType.map(([k, n]) => `<span class="tag other">${esc(k)} × ${n}</span>`).join("")}</p>` : ""}</div>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin:8px 0">${f.step >= 2 || lead ? '<button class="btn small" data-act="parent">💬 Contact parents</button>' : ""}${f.step >= 3 || lead ? '<button class="btn small" data-act="meeting">🤝 Record a meeting</button><button class="btn small" data-act="agreement">✍️ My agreement</button>' : ""}<button class="btn ghost small" data-act="evidence">📎 Add evidence</button><button class="btn ghost small" data-act="note">📝 Note</button>${f.step >= 3 ? '<button class="btn ghost small" data-act="review">🔁 Review</button>' : ""}${lead ? '<button class="btn ghost small" data-act="step">🪜 Change the step</button>' : ""}</div>
    <h3 style="color:var(--plum);margin:14px 0 6px">Timeline</h3>${items.length ? items.map(([d, h]) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><span class="note" style="font-size:12.5px">${fmt(d.slice(0, 10))}</span><br>${h}</div>`).join("") : '<p class="note">Nothing yet. 🌟</p>'}</div>`;
  dlg.querySelector("[data-x]").onclick = () => { dlg.close(); if (ui.tab === "steps") stepsPane(); };
  dlg.querySelectorAll("[data-ev]").forEach(a => a.onclick = async e => { e.preventDefault(); const { data } = await sb.storage.from("behaviour-evidence").createSignedUrl(a.dataset.ev, 3600); if (data) window.open(data.signedUrl, "_blank"); });
  dlg.querySelectorAll("[data-act]").forEach(b => b.onclick = () => fileAction(s, b.dataset.act));
  dlg.open || dlg.showModal();
}
function fileAction(s, act){
  const first = s.full_name.split(" ")[0], today = ymd(new Date()), f = files[String(s.id)] || { step: 0 };
  const tpl = `Dear parent,\n\nWe wanted to share something positive first: ${first} has been [something going well].\n\nWe have also noticed [the behaviour] a few times recently. At school we are [what we are doing]. It would really help if you could talk with ${first} about [the expectation] at home.\n\nThis week ${first}’s goal is to earn 3 merits, and we will let you know how it goes.\n\nKind regards,\n${me.full_name || ""}`;
  const F = { parent: ["💬 Contact parents", `<label class="f">How <select name="how"><option>Message in Nestopia</option><option>Phone call</option><option>Meeting in person</option><option>Note home</option></select></label><label class="f">What was said <textarea name="t" rows="9">${esc(tpl)}</textarea></label><p class="note" style="margin:0">Start with something positive. You can copy this text into a message to the parents.</p>`],
    meeting: ["🤝 Record a meeting", `<label class="f">Date <input type="date" name="d" value="${today}"></label><label class="f">Who came <input type="text" name="who" placeholder="Student, mother, class teacher, coordinator"></label><label class="f">${esc(first)}’s voice: what ${esc(first)} said <textarea name="v" rows="2"></textarea></label><label class="f">What we talked about <textarea name="t" rows="3"></textarea></label><label class="f">What we agreed <textarea name="a" rows="2"></textarea></label><div class="checks"><label><input type="checkbox" name="sh" checked> Share with parents in the portal, to confirm</label></div>`],
    agreement: ["✍️ My agreement", `<p class="note" style="margin-top:0">2 or 3 positive targets, in ${esc(first)}’s words where possible (“I will…”).</p><label class="f">Targets (one per line) <textarea name="tg" rows="4" placeholder="I will put my hand up when I want to talk.\nI will use kind words with my friends.\nI will ask for a calm break when I feel cross."></textarea></label><label class="f">How we’ll help <textarea name="t" rows="2" placeholder="Praise when it goes well; a calm corner; a daily check-in with the teacher"></textarea></label><label class="f">Review on <input type="date" name="r" value="${ymd(new Date(Date.now() + 21 * 864e5))}"></label><div class="checks"><label><input type="checkbox" name="sh" checked> Share with parents in the portal, to confirm</label></div>`],
    review: ["🔁 Review", `<label class="f">How it went <select name="o"><option value="down">🎉 Going well: step down</option><option value="same">Some progress: keep going</option><option value="up">Not working: more support (step up)</option></select></label><label class="f">Notes <textarea name="t" rows="3"></textarea></label>`],
    note: ["📝 Note", `<label class="f">Note <textarea name="t" rows="4"></textarea></label>`],
    evidence: ["📎 Add evidence", `<label class="f">What it is <input type="text" name="ti" placeholder="Witness statement, photo, signed agreement"></label><label class="f">File <input type="file" name="fl" accept="image/*,.pdf,.doc,.docx" required></label><p class="lock">Kept private. Only school leaders and ${esc(first)}’s teachers can open it.</p>`],
    step: ["🪜 Change the step", `<label class="f">Step <select name="st">${[0, 1, 2, 3, 4].map(k => `<option value="${k}" ${k === f.step ? "selected" : ""}>${STEPS[k][0]} ${STEPS[k][1]}</option>`).join("")}</select></label><label class="f">Why <textarea name="t" rows="2"></textarea></label>`] }[act];
  dlg.innerHTML = `<form class="dlg"><h2>${F[0]} · ${esc(s.full_name)}</h2>${F[1]}<div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-back>Back</button><button class="btn">Save</button></div></form>`;
  const fm = dlg.querySelector("form"); dlg.querySelector("[data-back]").onclick = () => openFile(s.id);
  fm.onsubmit = async e => { e.preventDefault(); const v = n => fm[n] ? fm[n].value.trim() : "";
    const row = { school_id: String(school.id), student_id: String(s.id), kind: act, created_by: me.id, event_date: today, data: {} };
    if (act === "parent") { row.title = "Parents contacted · " + v("how"); row.data = { text: v("t"), how: v("how") }; try { await navigator.clipboard.writeText(v("t")); toast("Copied: paste it into your message to the parents."); } catch (_) {} }
    if (act === "meeting") { row.title = "Support meeting" + (v("who") ? " · " + v("who") : ""); row.event_date = v("d") || today; row.data = { text: [v("v") && "Student’s voice: " + v("v"), v("t") && "Discussed: " + v("t"), v("a") && "Agreed: " + v("a")].filter(Boolean).join("\n"), share: fm.sh.checked }; }
    if (act === "agreement") { const tg = v("tg").split("\n").map(x => x.trim()).filter(Boolean); if (!tg.length) return toast("Add at least one target."); row.title = "My agreement"; row.data = { targets: tg, text: v("t") ? "How we’ll help: " + v("t") : "", share: fm.sh.checked, review_on: v("r") };
      await sb.from("bh_files").upsert({ student_id: String(s.id), school_id: String(school.id), step: Math.max(3, f.step || 0), step_since: f.step_since || today, review_on: v("r") || null, updated_at: new Date().toISOString() }); }
    if (act === "review") { const o = v("o"), to = Math.max(0, Math.min(4, (f.step || 0) + (o === "down" ? -1 : o === "up" ? 1 : 0))); row.title = "Review: " + { down: "going well, step down 🎉", same: "keep going", up: "more support needed" }[o]; row.data = { text: v("t") };
      await sb.from("bh_files").upsert({ student_id: String(s.id), school_id: String(school.id), step: to, step_since: to !== f.step ? today : f.step_since, review_on: o === "same" ? ymd(new Date(Date.now() + 21 * 864e5)) : null, updated_at: new Date().toISOString() }); }
    if (act === "note") { if (!v("t")) return; row.title = "Note"; row.data = { text: v("t") }; }
    if (act === "step") { const to = +v("st"); row.kind = "step"; row.title = "Step changed to " + STEPS[to][1] + " (by a leader)"; row.data = { text: v("t"), to };
      await sb.from("bh_files").upsert({ student_id: String(s.id), school_id: String(school.id), step: to, step_since: today, updated_at: new Date().toISOString() }); }
    if (act === "evidence") { const file = fm.fl.files[0]; if (!file) return; if (file.size > 15 * 1024 * 1024) return toast("Please choose a file smaller than 15 MB.");
      const path = `${school.id}/${s.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`; const up = await sb.storage.from("behaviour-evidence").upload(path, file);
      if (up.error) return toast(up.error.message); row.title = v("ti") || "Evidence"; row.file_path = path; row.file_name = file.name; }
    const { error } = await sb.from("bh_log").insert(row); if (error) return toast(/bh_log/.test(error.message) ? "Please run the Behaviour steps database step first." : error.message);
    await stepsLoad(); toast("Saved"); openFile(s.id); };
  dlg.open || dlg.showModal();
}
// the “positive first” box shown before logging an incident
function positiveFirstHtml(s){
  const steps = s && inSteps(s);
  return `<div class="box" style="background:#FFF8E7;border-color:#F3D98B"><b>🌟 Positive first</b><p class="note" style="margin:4px 0 6px">Before logging, have you tried:</p><ul style="margin:0 0 8px;padding-left:20px">${POSITIVE_TIPS.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="checks"><label><input type="checkbox" name="tp"> I tried a positive approach first</label></div>${s && !steps ? '<p class="note" style="margin:6px 0 0">In this grade there are no behaviour steps: incidents are logged to spot patterns. Only high-level incidents go to a leader.</p>' : ""}</div>`;
}
