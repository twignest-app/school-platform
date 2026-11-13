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
  const ok = await svLoad();
  if (!ok) { pane.innerHTML = '<div class="card"><div class="msg">Surveys need their database step first. Please run the Wellbeing surveys update in Supabase.</div></div>'; return; }
  let mine = []; try { const { data } = await sb.rpc("wb_my_staff_surveys"); mine = data || []; } catch (_) {}
  const myCls = classes.filter(c => (typeof myClassIds !== "undefined" ? myClassIds : []).includes(String(c.id)) || isTeam);
  const studentOpen = surveys.filter(s => s.audience === "students" && s.status === "open");
  pane.innerHTML = `${mine.map(s => `<div class="card" style="border-left:5px solid var(--plum)"><h2>📋 ${esc(s.title)}</h2><p class="note" style="margin-top:0">${esc(s.intro || "A short, anonymous survey for staff. Your name is not saved with your answers.")}</p><button class="btn" data-take="${s.id}">Take the survey</button></div>`).join("")}
    ${studentOpen.length && myCls.length ? `<div class="card"><h2>🧒 Run a student survey in class</h2><p class="note" style="margin-top:0">Students answer one by one on your screen with big faces. Answers are anonymous: only the class is saved.</p>
      ${studentOpen.map(s => `<div class="row" style="border-top:1px solid var(--line);padding:8px 0;justify-content:space-between"><b>${esc(s.title)}</b><span class="row"><select data-cls="${s.id}" aria-label="Class">${myCls.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select><button class="btn small" data-run="${s.id}">▶ Start in class</button></span></div>`).join("")}</div>` : ""}
    ${isTeam ? `<div class="card"><div class="row" style="justify-content:space-between"><h2>Surveys</h2><div class="row">${Object.entries(AUD).map(([k, v]) => `<button class="btn ghost small" data-new="${k}">+ ${v} survey</button>`).join("")}</div></div>
      ${surveys.length ? `<div class="tablewrap"><table class="reg"><tr><th>Survey</th><th>For</th><th>Status</th><th></th></tr>${surveys.map(s => `<tr><td><b>${esc(s.title)}</b><br><span class="note">${(s.questions || []).length} questions · ${new Date(s.created_at).toLocaleDateString("en-GB")}</span></td><td>${AUD[s.audience]}</td>
        <td><span class="tag ${s.status === "open" ? "eal" : "other"}">${{ draft: "Draft", open: "Open", closed: "Closed" }[s.status]}</span></td>
        <td style="text-align:right;white-space:nowrap"><button class="btn ghost small" data-res="${s.id}">Results</button> <button class="btn ghost small" data-edit="${s.id}">Edit</button> <button class="btn small" data-st="${s.id}">${s.status === "open" ? "Close" : "Open"}</button></td></tr>`).join("")}</table></div>`
      : '<p class="note" style="margin:0">No surveys yet. Start one from a ready-made template above.</p>'}</div>` : ""}
    ${!mine.length && !isTeam && !(studentOpen.length && myCls.length) ? '<div class="card"><p class="note" style="margin:0">No surveys for you right now.</p></div>' : ""}`;
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
  const ds = document.getElementById("delS"); if (ds) ds.onclick = async () => { if (!confirm("Delete this survey and all its answers?")) return; await sb.from("wb_surveys").delete().eq("id", s.id); dlg.close(); surveysPane(); };
  f.onsubmit = async e => { e.preventDefault();
    const questions = [...box.querySelectorAll("[data-q]")].map((r, i) => ({ id: (qs[+r.dataset.q] && qs[+r.dataset.q].id) || "q" + Date.now().toString(36) + i, type: r.querySelector("[data-qt]").value, text: r.querySelector("[data-qx]").value.trim() })).filter(q => q.text);
    if (!questions.length) return toast("Add at least one question.");
    const row2 = { school_id: String(school.id), title: f.t.value.trim(), intro: f.i.value.trim() || null, audience: s.audience, questions };
    const { error } = s.id ? await sb.from("wb_surveys").update(row2).eq("id", s.id) : await sb.from("wb_surveys").insert(Object.assign(row2, { status: "draft", created_by: me.id }));
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
