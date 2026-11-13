/* Nestopia · Wellbeing surveys (students on the class screen, staff in Nestopia, parents in the parent portal).
   Answers are anonymous. Uses the globals of wellbeing.html: sb, me, school, isTeam, classes, studs, esc, toast, dlg, kiosk, render */
let surveys = [], svResp = {};
const SCALE = { students: ["No, never", "Not often", "Sometimes", "Often", "Yes, always"], other: ["Strongly disagree", "Disagree", "Not sure", "Agree", "Strongly agree"] };
const SFACES = ["😞", "🙁", "😐", "🙂", "😄"];
const TEMPLATES = {
  students: ["I feel happy at school", "I feel safe at school", "There is an adult at school I can talk to", "I have friends at school", "I enjoy learning", "I am treated fairly", "If someone is unkind, adults help to sort it out", "?What would make school even better?"],
  staff: ["I feel valued at work", "My workload is manageable", "I feel supported by school leaders", "I have the resources I need to teach well", "I feel part of a team", "My wellbeing is taken seriously here", "I would recommend this school as a place to work", "?One thing that would improve your wellbeing at work"],
  parents: ["My child is happy at school", "My child feels safe at school", "The school keeps me well informed", "My child’s teachers know my child well", "The school deals well with any concerns I raise", "My child is making good progress", "I would recommend this school to other families", "?Any other comments"]
};
const AUD = { students: "🧒 Students", staff: "👩‍🏫 Staff", parents: "👪 Parents" };
const tplQs = a => TEMPLATES[a].map((t, i) => t.startsWith("?") ? { id: "q" + (i + 1), type: "text", text: t.slice(1) } : { id: "q" + (i + 1), type: "scale", text: t });

async function svLoad(){ const r = await sb.from("wb_surveys").select("*").eq("school_id", String(school.id)).order("created_at", { ascending: false }); surveys = r.error ? [] : r.data || []; return !r.error; }

async function surveysPane(){
  const pane = document.getElementById("pane"); pane.innerHTML = '<div class="card"><p class="note">Loading…</p></div>';
  if (isTeam || true) await svRunSchedule();
  const ok = await svLoad();
  if (!ok) { pane.innerHTML = '<div class="card"><div class="msg">Surveys need their database step first. Please run the Wellbeing surveys update in Supabase.</div></div>'; return; }
  let mine = []; try { const { data } = await sb.rpc("wb_my_staff_surveys"); mine = data || []; } catch (_) {}
  const myCls = classes.filter(c => (typeof myClassIds !== "undefined" ? myClassIds : []).includes(String(c.id)) || isTeam);
  const studentOpen = surveys.filter(s => s.audience === "students" && s.status === "open");
  pane.innerHTML = `${mine.map(s => `<div class="card" style="border-left:5px solid var(--plum)"><h2>📋 ${esc(s.title)}</h2><p class="note" style="margin-top:0">${esc(s.intro || "A short, anonymous survey for staff. Your name is not saved with your answers.")}</p><button class="btn" data-take="${s.id}">Take the survey</button></div>`).join("")}
    ${studentOpen.length && myCls.length ? `<div class="card"><h2>🧒 Run a student survey in class</h2><p class="note" style="margin-top:0">Students answer one by one on your screen with big faces. Answers are anonymous: only the class is saved.</p>
      ${studentOpen.map(s => `<div class="row" style="border-top:1px solid var(--line);padding:8px 0;justify-content:space-between"><b>${esc(s.title)}</b><span class="row"><select data-cls="${s.id}" aria-label="Class">${myCls.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select><button class="btn small" data-run="${s.id}">▶ Start in class</button></span></div>`).join("")}</div>` : ""}
    ${isTeam ? (await scheduleHtml()) + (await progressHtml()) : ""}
    ${isTeam ? `<div class="card"><div class="row" style="justify-content:space-between"><h2>Surveys</h2><div class="row">${Object.entries(AUD).map(([k, v]) => `<button class="btn ghost small" data-new="${k}">+ ${v} survey</button>`).join("")}</div></div>
      ${surveys.length ? `<div class="tablewrap"><table class="reg"><tr><th>Survey</th><th>For</th><th>Status</th><th></th></tr>${surveys.map(s => `<tr><td><b>${esc(s.title)}</b><br><span class="note">${(s.questions || []).length} questions · ${new Date(s.created_at).toLocaleDateString("en-GB")}</span></td><td>${AUD[s.audience]}</td>
        <td><span class="tag ${s.status === "open" ? "eal" : "other"}">${{ draft: "Draft", open: "Open", closed: "Closed" }[s.status]}</span></td>
        <td style="text-align:right;white-space:nowrap"><button class="btn ghost small" data-res="${s.id}">Results</button> <button class="btn ghost small" data-edit="${s.id}">Edit</button> <button class="btn small" data-st="${s.id}">${s.status === "open" ? "Close" : "Open"}</button></td></tr>`).join("")}</table></div>`
      : '<p class="note" style="margin:0">No surveys yet. Start one from a ready-made template above.</p>'}</div>` : ""}
    ${!mine.length && !isTeam && !(studentOpen.length && myCls.length) ? '<div class="card"><p class="note" style="margin:0">No surveys for you right now.</p></div>' : ""}`;
  const sn = document.getElementById("schNew"); if (sn) sn.onclick = () => editSchedule(null);
  pane.querySelectorAll("[data-sch]").forEach(b => b.onclick = () => editSchedule((window.WB_SCHED || []).find(s => s.id === b.dataset.sch)));
  pane.querySelectorAll("[data-now]").forEach(b => b.onclick = async () => { const s = (window.WB_SCHED || []).find(x => x.id === b.dataset.now); if (!confirm(`Send “${s.title}” to ${AUD[s.audience].replace(/^\S+ /, "").toLowerCase()} now?`)) return;
    const today = new Date().toISOString().slice(0, 10); const { error } = await sb.from("wb_schedules").update({ next_open: today, active: true }).eq("id", s.id); if (error) return toast(error.message);
    const n = await svRunSchedule(); toast(n ? "Sent. The survey is open now." : "Couldn’t open it. Please try again."); surveysPane(); });
  pane.querySelectorAll("[data-trend]").forEach(b => b.onclick = () => { window.WB_TREND = b.dataset.trend; surveysPane(); });
  pane.querySelectorAll("[data-take]").forEach(b => b.onclick = () => takeStaff(mine.find(s => s.id === b.dataset.take)));
  pane.querySelectorAll("[data-run]").forEach(b => b.onclick = () => runClass(surveys.find(s => s.id === b.dataset.run), pane.querySelector(`[data-cls="${b.dataset.run}"]`).value));
  pane.querySelectorAll("[data-new]").forEach(b => b.onclick = () => editSurvey({ audience: b.dataset.new, title: { students: "Student wellbeing survey", staff: "Staff wellbeing survey", parents: "Parent survey" }[b.dataset.new] + " " + new Date().getFullYear(), questions: tplQs(b.dataset.new), status: "draft" }));
  pane.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editSurvey(surveys.find(s => s.id === b.dataset.edit)));
  pane.querySelectorAll("[data-res]").forEach(b => b.onclick = () => results(surveys.find(s => s.id === b.dataset.res)));
  pane.querySelectorAll("[data-st]").forEach(b => b.onclick = async () => { const s = surveys.find(x => x.id === b.dataset.st), nx = s.status === "open" ? "closed" : "open";
    if (nx === "open" && !confirm(`Open “${s.title}”? ${s.audience === "staff" ? "Staff will see it in Wellbeing and on their Overview." : s.audience === "parents" ? "Parents will see it in their portal." : "Teachers can then run it in class."}`)) return;
    const { error } = await sb.from("wb_surveys").update({ status: nx }).eq("id", s.id); if (error) return toast(error.message); surveysPane(); });
}

function editSurvey(s){
  const qs = (s.questions || []).slice();
  const row = (q, i) => `<div class="row" style="gap:6px;margin:6px 0" data-q="${i}"><select data-qt style="max-width:150px"><option value="scale" ${q.type === "scale" ? "selected" : ""}>Scale (1 to 5)</option><option value="yesno" ${q.type === "yesno" ? "selected" : ""}>Yes or no</option><option value="text" ${q.type === "text" ? "selected" : ""}>Written answer</option></select><input type="text" data-qx value="${esc(q.text)}" style="flex:1;min-width:200px"><button type="button" class="btn ghost small" data-rm>✕</button></div>`;
  dlg.innerHTML = `<form class="dlg"><h2>${s.id ? "Edit survey" : "New survey"} · ${AUD[s.audience]}</h2>
    <label class="f">Title <input type="text" name="t" required value="${esc(s.title || "")}"></label>
    <label class="f">A short introduction (optional) <textarea name="i" rows="2" placeholder="Why you’re asking, and that answers are anonymous">${esc(s.intro || "")}</textarea></label>
    <div><b>Questions</b> <span class="note">${s.audience === "students" ? "(students answer with faces: No, never … Yes, always)" : "(Strongly disagree … Strongly agree)"}</span><div id="qs">${qs.map(row).join("")}</div><button type="button" class="btn ghost small" id="addq">+ Add a question</button></div>
    ${s.id && s.status !== "draft" ? '<p class="note">This survey already has answers. Changing questions now can make results harder to compare.</p>' : ""}
    <div class="row" style="justify-content:space-between"><div>${s.id ? '<button type="button" class="btn ghost small" id="delS">Delete</button>' : ""}</div><div class="row"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save</button></div></div></form>`;
  const f = dlg.querySelector("form"), box = document.getElementById("qs");
  dlg.querySelector("[data-x]").onclick = () => dlg.close();
  document.getElementById("addq").onclick = () => box.insertAdjacentHTML("beforeend", row({ type: "scale", text: "" }, box.children.length));
  box.onclick = e => { const r = e.target.closest("[data-rm]"); if (r) r.closest("[data-q]").remove(); };
  if (s.__schedule) { const ds0 = document.getElementById("delS"); if (ds0) ds0.remove(); }
  const ds = document.getElementById("delS"); if (ds) ds.onclick = async () => { if (!confirm("Delete this survey and all its answers?")) return; await sb.from("wb_surveys").delete().eq("id", s.id); dlg.close(); surveysPane(); };
  f.onsubmit = async e => { e.preventDefault();
    const questions = [...box.querySelectorAll("[data-q]")].map((r, i) => ({ id: (qs[+r.dataset.q] && qs[+r.dataset.q].id) || "q" + Date.now().toString(36) + i, type: r.querySelector("[data-qt]").value, text: r.querySelector("[data-qx]").value.trim() })).filter(q => q.text);
    if (!questions.length) return toast("Add at least one question.");
    const row2 = { school_id: String(school.id), title: f.t.value.trim(), intro: f.i.value.trim() || null, audience: s.audience, questions };
    const { error } = s.__schedule ? await sb.from("wb_schedules").update({ title: row2.title, intro: row2.intro, questions }).eq("id", s.id) : s.id ? await sb.from("wb_surveys").update(row2).eq("id", s.id) : await sb.from("wb_surveys").insert(Object.assign(row2, { status: "draft", created_by: me.id }));
    if (error) return toast(/wb_surveys/.test(error.message) ? "Please run the Wellbeing surveys database step first." : error.message); dlg.close(); toast("Saved. Press Open when you’re ready."); surveysPane(); };
  dlg.showModal();
}

function formHtml(s, lab){
  return (s.questions || []).map((q, i) => `<div class="box" style="margin-bottom:10px"><p style="margin:0 0 8px;font-weight:700">${i + 1}. ${esc(q.text)}</p>
    ${q.type === "scale" ? `<div class="row" style="gap:6px">${lab.map((l, k) => `<label style="display:flex;gap:5px;align-items:center;font-size:14px;border:1px solid var(--line);border-radius:10px;padding:6px 10px;background:var(--card)"><input type="radio" name="${q.id}" value="${k + 1}"> ${esc(l)}</label>`).join("")}</div>`
      : q.type === "yesno" ? `<div class="row" style="gap:6px">${["Yes", "No"].map(v => `<label style="display:flex;gap:5px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:6px 12px;background:var(--card)"><input type="radio" name="${q.id}" value="${v === "Yes" ? 1 : 0}"> ${v}</label>`).join("")}</div>`
      : `<textarea name="${q.id}" rows="2" maxlength="800" style="width:100%"></textarea>`}</div>`).join("");
}
const collect = (f, s) => { const a = {}; (s.questions || []).forEach(q => { if (q.type === "text") { const v = (f[q.id] && f[q.id].value || "").trim(); if (v) a[q.id] = v; } else { const c = f.querySelector(`input[name="${q.id}"]:checked`); if (c) a[q.id] = +c.value; } }); return a; };
function takeStaff(s){
  dlg.innerHTML = `<form class="dlg"><h2>📋 ${esc(s.title)}</h2><p class="note" style="margin-top:0">${esc(s.intro || "")} Your answers are anonymous: your name is not saved with them.</p>${formHtml(s, SCALE.other)}
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-x>Later</button><button class="btn">Send my answers</button></div></form>`;
  const f = dlg.querySelector("form"); dlg.querySelector("[data-x]").onclick = () => dlg.close();
  f.onsubmit = async e => { e.preventDefault(); const a = collect(f, s); if (!Object.keys(a).length) return toast("Answer at least one question.");
    const { error } = await sb.rpc("wb_submit_staff", { p_survey: s.id, p_answers: a }); if (error) return toast(error.message); dlg.close(); toast("💛 Thank you. Your answers have been sent anonymously."); surveysPane(); };
  dlg.showModal();
}

/* Students answer one by one on the class screen: faces, anonymous */
function runClass(s, classId){
  const c = classes.find(x => String(x.id) === String(classId)) || {}; let done = 0;
  try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); } catch (_) {}
  kiosk.hidden = false;
  const startScreen = () => { kiosk.innerHTML = `<div class="row" style="justify-content:space-between"><b class="note">${esc(c.name || "")} · ${esc(s.title)}</b><button class="btn ghost small" id="kEnd">Finish (teacher)</button></div>
      <h1 style="margin-top:12vh">Your turn! Tap to start 👇</h1><p style="text-align:center;font-size:20px">Nobody will know your answers. Please answer honestly. 💛</p>
      <p style="text-align:center;margin-top:24px"><button class="btn" id="go" style="font-size:24px;padding:18px 40px">Start</button></p><p class="note" style="text-align:center;margin-top:20px">${done} student${done === 1 ? "" : "s"} have answered.</p>`;
    kiosk.querySelector("#kEnd").onclick = () => { if (!confirm("Finish the survey for this class? (Teacher only)")) return; kiosk.hidden = true; try { document.fullscreenElement && document.exitFullscreen(); } catch (_) {} };
    kiosk.querySelector("#go").onclick = () => ask(0, {}); };
  const ask = (i, a) => { const qs = s.questions || [];
    if (i >= qs.length) return send(a); const q = qs[i];
    kiosk.innerHTML = `<p class="note" style="text-align:center">Question ${i + 1} of ${qs.length}</p><h1>${esc(q.text)}</h1>
      ${q.type === "scale" ? `<div class="faces">${SCALE.students.map((l, k) => `<button class="face" data-v="${k + 1}" aria-label="${l}">${SFACES[k]}<span>${l}</span></button>`).join("")}</div>`
        : q.type === "yesno" ? `<div class="yn"><button style="background:var(--plum);color:#fff" data-v="1">👍 Yes</button><button style="background:var(--card);border:2px solid var(--line);color:var(--ink)" data-v="0">👎 No</button></div>`
        : `<div style="max-width:700px;margin:0 auto"><textarea id="tx" rows="4" style="width:100%;font-size:20px;padding:12px;border-radius:14px;border:2px solid var(--line)"></textarea><p style="text-align:center"><button class="btn" id="nx" style="font-size:20px;padding:14px 30px">Next</button></p></div>`}
      <p style="text-align:center;margin-top:18px"><button class="btn ghost small" id="skip">Skip this question</button></p>`;
    kiosk.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { a[q.id] = +b.dataset.v; ask(i + 1, a); });
    const nx = kiosk.querySelector("#nx"); if (nx) nx.onclick = () => { const v = kiosk.querySelector("#tx").value.trim(); if (v) a[q.id] = v; ask(i + 1, a); };
    kiosk.querySelector("#skip").onclick = () => ask(i + 1, a); };
  const send = async a => { const { error } = await sb.rpc("wb_submit_class", { p_survey: s.id, p_class: String(classId), p_answers: a });
    if (error) { toast(error.message); return startScreen(); } done++;
    kiosk.innerHTML = `<h1 style="margin-top:18vh">Thank you! 🌟</h1><p style="text-align:center;font-size:20px">Please call the next person.</p>`; setTimeout(startScreen, 1800); };
  startScreen();
}

/* Results for the wellbeing team */
async function results(s){
  const { data, error } = await sb.from("wb_responses").select("answers,class_id,grade_id").eq("survey_id", s.id);
  if (error) return toast(error.message);
  const R = data || [], n = R.length, lab = s.audience === "students" ? SCALE.students : SCALE.other;
  const stat = (q, list) => { const v = list.map(r => r.answers[q.id]).filter(x => typeof x === "number"); if (!v.length) return null;
    return q.type === "yesno" ? { n: v.length, yes: Math.round(v.filter(x => x === 1).length / v.length * 100) } : { n: v.length, avg: (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), pos: Math.round(v.filter(x => x >= 4).length / v.length * 100), dist: [1, 2, 3, 4, 5].map(k => v.filter(x => x === k).length) }; };
  const COL = ["#B4473A", "#D9822B", "#C9A227", "#7BAE6F", "#3F8A4B"];
  const bar = st => `<div style="display:flex;height:12px;border-radius:99px;overflow:hidden;background:var(--empty);min-width:140px">${st.dist.map((k, i) => k ? `<i title="${lab[i]}: ${k}" style="display:block;width:${k / st.n * 100}%;background:${COL[i]}"></i>` : "").join("")}</div>`;
  const groups = s.audience === "students" ? [...new Set(R.map(r => r.class_id).filter(Boolean))].map(cid => [((classes.find(c => String(c.id) === String(cid)) || {}).name || "Class"), R.filter(r => r.class_id === cid)]).filter(([, l]) => l.length >= 5) : [];
  const scaleQs = (s.questions || []).filter(q => q.type !== "text"), textQs = (s.questions || []).filter(q => q.type === "text");
  const summary = scaleQs.map(q => { const st = stat(q, R); return st ? `${q.text}: ${q.type === "yesno" ? st.yes + "% yes" : st.pos + "% positive (average " + st.avg + " out of 5)"}` : ""; }).filter(Boolean);
  dlg.innerHTML = `<div class="dlg" style="max-width:900px"><div class="row" style="justify-content:space-between"><h2>${esc(s.title)}</h2><button class="btn ghost small" data-x>Close</button></div>
    <p class="note" style="margin:0">${AUD[s.audience]} · <b>${n}</b> response${n === 1 ? "" : "s"} · anonymous</p>
    ${n ? `<div class="tablewrap"><table class="reg"><tr><th>Question</th><th>Positive</th><th>Average</th><th>Answers</th></tr>${scaleQs.map(q => { const st = stat(q, R); return `<tr><td>${esc(q.text)}</td>${st ? (q.type === "yesno" ? `<td><b>${st.yes}%</b> yes</td><td>–</td><td>${st.n}</td>` : `<td><b style="color:${st.pos >= 75 ? "var(--sage)" : st.pos >= 50 ? "var(--amber)" : "var(--red)"}">${st.pos}%</b></td><td>${st.avg}${bar(st)}</td><td>${st.n}</td>`) : '<td colspan="3" class="note">No answers</td>'}</tr>`; }).join("")}</table></div>
      <div class="legend">${lab.map((l, i) => `<span><i style="background:${COL[i]}"></i>${esc(l)}</span>`).join("")}</div>
      ${groups.length ? `<h3 style="color:var(--plum);margin:14px 0 6px">By class <span class="note">(only classes with 5 or more answers, to keep them anonymous)</span></h3><div class="tablewrap"><table class="reg"><tr><th>Question</th>${groups.map(([g]) => `<th>${esc(g)}</th>`).join("")}</tr>${scaleQs.filter(q => q.type === "scale").map(q => `<tr><td>${esc(q.text)}</td>${groups.map(([, l]) => { const st = stat(q, l); return `<td>${st ? st.pos + "%" : "–"}</td>`; }).join("")}</tr>`).join("")}</table></div>` : ""}
      ${textQs.map(q => { const t = R.map(r => r.answers[q.id]).filter(x => typeof x === "string"); return `<h3 style="color:var(--plum);margin:14px 0 6px">${esc(q.text)} <span class="note">(${t.length})</span></h3>${t.length ? `<ul style="max-height:220px;overflow:auto;margin:0">${t.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : '<p class="note">No comments.</p>'}`; }).join("")}
      <div class="row" style="margin-top:14px"><button class="btn ghost" id="svWord">⬇ Word</button><button class="btn ghost" id="svPack">📁 Add to an evidence pack</button></div>` : '<p class="note">No answers yet.</p>'}</div>`;
  dlg.querySelector("[data-x]").onclick = () => dlg.close();
  const w = document.getElementById("svWord"); if (w) w.onclick = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}h1{color:#462D5B}td,th{border:1px solid #bbb;padding:6px;text-align:left}table{border-collapse:collapse;width:100%}th{background:#EDE6F5}</style></head><body><h1>${esc(s.title)}</h1><p>${esc(school.name)} · ${n} anonymous responses</p>
      <table><tr><th>Question</th><th>Positive</th><th>Average (out of 5)</th></tr>${scaleQs.map(q => { const st = stat(q, R); return `<tr><td>${esc(q.text)}</td><td>${st ? (q.type === "yesno" ? st.yes + "% yes" : st.pos + "%") : "–"}</td><td>${st && st.avg ? st.avg : "–"}</td></tr>`; }).join("")}</table>
      ${textQs.map(q => `<h2>${esc(q.text)}</h2><ul>${R.map(r => r.answers[q.id]).filter(x => typeof x === "string").map(x => `<li>${esc(x)}</li>`).join("")}</ul>`).join("")}</body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/msword" })); a.download = s.title + " - results.doc"; document.body.appendChild(a); a.click(); a.remove(); };
  const pk = document.getElementById("svPack"); if (pk) pk.onclick = async () => {
    const { data: packs } = await sb.from("evidence_packs").select("id,standard,title").eq("school_id", school.id).order("standard");
    if (!packs || !packs.length) return toast("Create an evidence pack first (for example 2.1 Personal development or 5.2 Care and support).");
    const pick = prompt("Which pack? Type its standard:\n" + packs.map(p => p.standard + (p.title ? " · " + p.title : "")).join("\n"), (packs.find(p => /^(2\.1|5\.2|6\.3)$/.test(p.standard)) || packs[0]).standard); if (!pick) return;
    const p = packs.find(x => x.standard === pick.trim()); if (!p) return toast("No pack for that standard.");
    const { error: e2 } = await sb.from("evidence_items").insert({ school_id: school.id, pack_id: p.id, kind: "data", title: s.title + " (" + n + " responses)", description: summary.join("\n"), evidence_date: new Date().toISOString().slice(0, 10), added_by: me.id, elements: [] });
    if (e2) return toast(e2.message); toast("Added to " + p.standard + "."); };
  dlg.showModal();
}

/* ---------- Schedule: rounds open and close by themselves ---------- */
const FREQ = { monthly: "Every month", halfterm: "Every half term (6 weeks)", termly: "Every term" };
async function svRunSchedule(){
  try { const { data } = await sb.rpc("wb_run_schedule"); (data || []).forEach(o => { if (o.email && window.nestMail) nestMail("survey", o.id); }); return (data || []).length; } catch (_) { return 0; }
}
async function scheduleHtml(){
  const r = await sb.from("wb_schedules").select("*").eq("school_id", String(school.id)).order("audience");
  if (r.error) return `<div class="card"><p class="note" style="margin:0">Scheduled surveys need their database step first (Wellbeing schedule update).</p></div>`;
  const list = r.data || []; window.WB_SCHED = list;
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2>📅 Survey schedule</h2><button class="btn small" id="schNew">+ Schedule a survey</button></div>
    <p class="note" style="margin-top:0">Scheduled surveys open by themselves on the date, close after the days you choose, and tell staff, parents or class teachers. Every round appears in <b>Progress over time</b>.</p>
    ${list.length ? `<div class="tablewrap"><table class="reg"><tr><th>Survey</th><th>How often</th><th>Next round</th><th></th></tr>${list.map(s => `<tr><td><b>${AUD[s.audience]}</b> · ${esc(s.title)}<br><span class="note">${s.questions.length} questions · open for ${s.open_days} days${s.email ? " · with emails" : ""}</span></td><td>${FREQ[s.frequency]}</td>
      <td>${s.active ? new Date(s.next_open + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : '<span class="note">Paused</span>'}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn small" data-now="${s.id}">Send now</button> <button class="btn ghost small" data-sch="${s.id}">Edit</button></td></tr>`).join("")}</table></div>`
      : '<p class="note" style="margin:0">Nothing scheduled yet. For example: students, staff and parents every month.</p>'}</div>`;
}
function editSchedule(s){
  const isNew = !s, d0 = new Date(); d0.setDate(d0.getDate() + 1);
  dlg.innerHTML = `<form class="dlg"><h2>${isNew ? "Schedule a survey" : "Edit the schedule"}</h2>
    ${isNew ? `<div><b>Who</b> <span class="note">(one schedule each, using the ready-made questions; you can edit them after)</span><div class="checks">${Object.entries(AUD).map(([k, v]) => `<label><input type="checkbox" name="aud" value="${k}" checked> ${v}</label>`).join("")}</div></div>`
      : `<p class="note" style="margin:0">${AUD[s.audience]}</p><label class="f">Title <input type="text" name="t" value="${esc(s.title)}"></label>`}
    <div class="two"><label class="f">How often <select name="fq">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}" ${(s ? s.frequency : "monthly") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="f">${isNew ? "First round on" : "Next round on"} <input type="date" name="nx" required value="${esc(s ? s.next_open : d0.toISOString().slice(0, 10))}"></label></div>
    <div class="two"><label class="f">Open for (days) <input type="number" name="od" min="1" max="30" value="${s ? s.open_days : 7}"></label><div class="checks" style="align-self:end"><label><input type="checkbox" name="em" ${!s || s.email ? "checked" : ""}> Email people when it opens</label>${s ? `<label><input type="checkbox" name="ac" ${s.active ? "checked" : ""}> Active</label>` : ""}</div></div>
    ${s ? `<p><button type="button" class="btn ghost small" id="schQs">Edit the questions</button></p>` : ""}
    <div class="row" style="justify-content:space-between"><div>${s ? '<button type="button" class="btn ghost small" id="schDel">Delete the schedule</button>' : ""}</div><div class="row"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save</button></div></div></form>`;
  const f = dlg.querySelector("form"); dlg.querySelector("[data-x]").onclick = () => dlg.close();
  const dl = document.getElementById("schDel"); if (dl) dl.onclick = async () => { if (!confirm("Delete this schedule? Rounds already sent, and their results, are kept.")) return; await sb.from("wb_schedules").delete().eq("id", s.id); dlg.close(); surveysPane(); };
  const qb = document.getElementById("schQs"); if (qb) qb.onclick = () => editSurvey(Object.assign({}, s, { __schedule: true }));
  f.onsubmit = async e => { e.preventDefault();
    const base = { school_id: String(school.id), frequency: f.fq.value, next_open: f.nx.value, open_days: Math.max(1, Math.min(30, +f.od.value || 7)), email: f.em.checked };
    let error;
    if (isNew) { const auds = [...f.querySelectorAll("input[name=aud]:checked")].map(x => x.value); if (!auds.length) return toast("Choose at least one group.");
      ({ error } = await sb.from("wb_schedules").insert(auds.map(a => Object.assign({}, base, { audience: a, title: { students: "Student wellbeing", staff: "Staff wellbeing", parents: "Parent survey" }[a], questions: tplQs(a), created_by: me.id })))); }
    else ({ error } = await sb.from("wb_schedules").update(Object.assign(base, { title: f.t.value.trim() || s.title, active: f.ac.checked })).eq("id", s.id));
    if (error) return toast(/wb_schedules/.test(error.message) ? "Please run the Wellbeing schedule database step first." : error.message);
    dlg.close(); const n = await svRunSchedule(); toast(n ? "Saved, and a round has opened now." : "Saved. It opens by itself on the date."); surveysPane(); };
  dlg.showModal();
}

/* ---------- Progress over time: % positive per round, one line per group ---------- */
async function progressHtml(){
  const done = surveys.filter(s => s.status !== "draft").sort((a, b) => String(a.opened_at || a.created_at).localeCompare(String(b.opened_at || b.created_at)));
  if (!done.length) return "";
  const { data } = await sb.from("wb_responses").select("survey_id,answers").in("survey_id", done.map(s => s.id));
  const R = data || [];
  const pos = (s, qText) => { const qs = (s.questions || []).filter(q => q.type === "scale" && (!qText || q.text === qText)); let n = 0, p = 0;
    R.filter(r => r.survey_id === s.id).forEach(r => qs.forEach(q => { const v = r.answers[q.id]; if (typeof v === "number") { n++; if (v >= 4) p++; } })); return n ? Math.round(p / n * 100) : null; };
  const COLS = { students: "#3F8A4B", staff: "#6E9BD8", parents: "#B07A1E" };
  const pts = Object.keys(AUD).map(a => [a, done.filter(s => s.audience === a).map(s => [s, pos(s)]).filter(x => x[1] != null)]).filter(([, l]) => l.length);
  if (!pts.length) return `<div class="card"><h2>📈 Progress over time</h2><p class="note" style="margin:0">The graph appears once surveys have answers.</p></div>`;
  const times = [...new Set(pts.flatMap(([, l]) => l.map(([s]) => (s.opened_at || s.created_at).slice(0, 7))))].sort();
  const W = 700, H = 230, pad = 40, xs = k => times.length === 1 ? W / 2 : pad + k * (W - 2 * pad) / (times.length - 1), ys = v => H - pad - v / 100 * (H - 2 * pad);
  const lines = pts.map(([a, l]) => { const p = l.map(([s, v]) => [times.indexOf((s.opened_at || s.created_at).slice(0, 7)), v]);
    return `<path d="${p.map(([k, v], i) => (i ? "L" : "M") + xs(k).toFixed(1) + " " + ys(v).toFixed(1)).join(" ")}" fill="none" stroke="${COLS[a]}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` + p.map(([k, v], i) => `<circle cx="${xs(k)}" cy="${ys(v)}" r="5" fill="${COLS[a]}"><title>${AUD[a]}: ${v}%</title></circle>${i === p.length - 1 ? `<text x="${xs(k) + 9}" y="${ys(v) + 4}" font-size="12" font-weight="800" fill="${COLS[a]}">${v}%</text>` : ""}`).join(""); }).join("");
  const label = t => new Date(t + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  const sel = window.WB_TREND || pts[0][0], sl = done.filter(s => s.audience === sel), qTexts = [...new Set(sl.flatMap(s => (s.questions || []).filter(q => q.type === "scale").map(q => q.text)))];
  return `<div class="card"><h2>📈 Progress over time</h2><p class="note" style="margin-top:0">% of positive answers in each round (Often or Yes, always for students; Agree or Strongly agree for staff and parents).</p>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Wellbeing survey results over time">${[25, 50, 75, 100].map(v => `<line x1="${pad}" x2="${W - pad}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)"/><text x="4" y="${ys(v) + 4}" font-size="10" fill="var(--muted)">${v}%</text>`).join("")}${lines}${times.map((t, k) => `<text x="${xs(k)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${label(t)}</text>`).join("")}</svg>
    <div class="legend">${pts.map(([a]) => `<span><i style="background:${COLS[a]}"></i>${AUD[a]}</span>`).join("")}</div>
    <div class="row" style="margin:14px 0 6px">${pts.map(([a]) => `<button class="btn ${a === sel ? "" : "ghost"} small" data-trend="${a}">${AUD[a]}: question by question</button>`).join("")}</div>
    <div class="tablewrap"><table class="reg"><tr><th>Question</th>${sl.map(s => `<th>${esc(s.round_label || new Date(s.opened_at || s.created_at).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }))}</th>`).join("")}</tr>
      ${qTexts.map(t => `<tr><td>${esc(t)}</td>${sl.map(s => { const v = pos(s, t); return `<td style="color:${v == null ? "var(--muted)" : v >= 75 ? "var(--sage)" : v >= 50 ? "var(--amber)" : "var(--red)"};font-weight:700">${v == null ? "–" : v + "%"}</td>`; }).join("")}</tr>`).join("")}</table></div></div>`;
}

/* ---------- Wellbeing evidence: the SEF packs for wellbeing ---------- */
const WB_STD = [["2.1", "Personal development"], ["5.1", "Health and safety, including safeguarding"], ["5.2", "Care and support"]];
async function wbEvidencePane(){
  const pane = document.getElementById("pane"); pane.innerHTML = '<div class="card"><p class="note">Loading…</p></div>';
  const [{ data: packs, error }, { data: items }] = await Promise.all([sb.from("evidence_packs").select("*").eq("school_id", school.id), sb.from("evidence_items").select("id,pack_id,kind,title,evidence_date").eq("school_id", school.id).order("created_at", { ascending: false })]);
  if (error) { pane.innerHTML = '<div class="card"><div class="msg">Evidence packs need to be switched on and set up first.</div></div>'; return; }
  const yr = () => { const d = new Date(), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return y + "–" + (y + 1); };
  pane.innerHTML = `<div class="card"><h2>📁 Wellbeing evidence</h2><p class="note" style="margin:0">Evidence for the inspection framework indicators linked to wellbeing. Everything you add here goes straight into the matching evidence pack.</p></div>
    ${WB_STD.map(([ref, name]) => { const p = (packs || []).find(x => x.standard === ref), its = p ? (items || []).filter(i => i.pack_id === p.id) : [];
      return `<div class="card"><div class="row" style="justify-content:space-between"><div><p class="note" style="margin:0;font-weight:800;color:var(--plum)">SEF EVIDENCE: ${ref}</p><h2 style="margin:2px 0 0">${esc(name)}</h2></div>
        <div class="row"><button class="btn small" data-add="${ref}">+ Add evidence</button><button class="btn ghost small" data-sum="${ref}">📊 Add this month’s summary</button>${p ? `<a class="btn ghost small" href="evidence.html?pack=${p.id}">Open the pack →</a>` : ""}</div></div>
        ${its.length ? `<ul style="margin:10px 0 0;padding-left:18px">${its.slice(0, 5).map(i => `<li>${esc({ photo: "📷", file: "📄", link: "🔗", note: "📝", data: "📊" }[i.kind] || "")} ${esc(i.title)}${i.evidence_date ? ` <span class="note">· ${new Date(i.evidence_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>` : ""}</li>`).join("")}</ul>${its.length > 5 ? `<p class="note" style="margin:4px 0 0">and ${its.length - 5} more in the pack</p>` : ""}`
          : `<p class="note" style="margin:10px 0 0">${p ? "No evidence yet." : "The pack will be created when you add the first piece of evidence."}</p>`}</div>`; }).join("")}`;
  const ensure = async ref => { let p = (packs || []).find(x => x.standard === ref); if (p) return p;
    const { data, error: e } = await sb.from("evidence_packs").insert({ school_id: school.id, standard: ref, year: yr(), created_by: me.id }).select().single(); if (e) { toast(e.message); return null; } packs.push(data); return data; };
  pane.querySelectorAll("[data-add]").forEach(b => b.onclick = async () => { const p = await ensure(b.dataset.add); if (p) location.href = "evidence.html?pack=" + p.id + "&add=1"; });
  pane.querySelectorAll("[data-sum]").forEach(b => b.onclick = async () => { const p = await ensure(b.dataset.sum); if (!p) return;
    const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), C = checks.filter(c => c.day >= since);
    const avg = C.length ? (C.reduce((a, c) => a + c.mood, 0) / C.length).toFixed(1) : null, low = C.length ? Math.round(C.filter(c => c.mood <= 2).length / C.length * 100) : null, talk = C.filter(c => c.talk).length, fu = C.filter(c => c.talk && c.followed_up_at).length;
    const lines = [`Daily check-ins in the last 30 days: ${C.length}${avg ? " · average mood " + avg + " out of 5" : ""}${low != null ? " · " + low + "% chose sad or very sad" : ""}.`,
      `Students who asked to talk: ${talk}${talk ? " · followed up: " + fu + " (" + Math.round(fu / talk * 100) + "%)" : ""}.`];
    const recent = surveys.filter(s => s.status !== "draft").slice(0, 3); if (recent.length) lines.push("Recent surveys: " + recent.map(s => s.title).join("; ") + ".");
    const { error: e2 } = await sb.from("evidence_items").insert({ school_id: school.id, pack_id: p.id, kind: "data", title: "Wellbeing summary · " + new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }), description: lines.join("\n"), evidence_date: new Date().toISOString().slice(0, 10), added_by: me.id, elements: [] });
    if (e2) return toast(e2.message); toast("Summary added to " + b.dataset.sum); wbEvidencePane(); });
}
