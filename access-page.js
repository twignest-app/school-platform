/* ===== Nestopia · Staff and access =====
   Pick each person's job title; the access grid says what each job can Edit, View or not see. Classes and subjects come
   from the class lists automatically. Leaders can give extra access (with an end date), answer "Ask for access"
   requests, see Nestopia's menu as any person, and print who can do what. */
const PLATFORM = "Nestopia";
const sb = supabase.createClient("https://gvhzbxpgebgjnegdiijp.supabase.co", "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM");
const app = document.getElementById("app"), who = document.getElementById("who"), dlg = document.getElementById("dlg");
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = m => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2800); };
const A = window.NestAccess, LBL = { E: "Edit", V: "View", N: "—" }, NEXT = { E: "V", V: "N", N: "E" };
const areaName = id => (A.AREAS.find(a => a[0] === id) || [, id])[1];
const fmtD = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

let me, school, C = {}, setupId, canEdit = false, staff = [], classes = [], ct = [], grants = [], reqs = [], ui = { tab: "staff" }, G = null;
function fail(t){ app.innerHTML = `<div class="card"><div class="msg">${esc(t)}</div></div>`; }
const mail = body => sb.functions.invoke("nestopia-mail", { body: Object.assign({ action: "access" }, body) }).catch(() => {});

async function start(){
  const { data: { session } } = await sb.auth.getSession(); if (!session) { location.href = "./"; return; }
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || !p.school_id) return fail("Your account isn’t linked to a school yet.");
  me = p; who.innerHTML = `<span>${esc(p.full_name || p.email)}</span><a class="btn ghost small" href="./">← ${esc(PLATFORM)}</a>`;
  const { data: s } = await sb.from("schools").select("*").eq("id", p.school_id).single(); school = s;
  if (!school || school.status !== "active" || !p.active) return fail("Your school or account isn’t active yet.");
  if (window.hubInit) hubInit("access");
  const my = await A.mine(sb); canEdit = (my.settings || "N") === "E";
  if ((my.settings || "N") === "N") return;   // the hub shows "Ask for access"
  const set = await sb.from("school_setups").select("id,config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1);
  if (set.data && set.data[0]) { setupId = set.data[0].id; C = set.data[0].config || {}; }
  await load();
  const h = location.hash.slice(1); if (["staff", "grid", "requests", "who"].includes(h)) ui.tab = h;
  draw();
}
async function load(){
  let r = await sb.from("profiles").select("id,full_name,email,role,job,active").eq("school_id", school.id);
  if (r.error) return fail("Please run access.sql in Supabase first (it adds job titles).");
  staff = (r.data || []).filter(x => x.role !== "admin").sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || String(a.full_name || a.email).localeCompare(String(b.full_name || b.email)));
  classes = (await sb.from("classes").select("id,name").eq("school_id", school.id)).data || [];
  ct = classes.length ? ((await sb.from("class_teachers").select("class_id,teacher_id,subject_id").in("class_id", classes.map(c => c.id))).data || []) : [];
  grants = (await sb.from("access_grants").select("*").eq("school_id", String(school.id))).data || [];
  reqs = (await sb.from("access_requests").select("*").eq("school_id", String(school.id)).eq("status", "pending").order("created_at")).data || [];
}
const clsName = id => (classes.find(c => String(c.id) === String(id)) || {}).name || "";
const subjName = id => ((C.subjects || []).find(s => String(s.id) === String(id)) || {}).name || id;
const nameOf = id => { const x = staff.find(s => s.id === id); return x ? x.full_name || x.email : "a colleague"; };
const live = g => !g.until || g.until >= A.today();

function draw(){
  app.innerHTML = `<div class="phead"><div><h1 class="ptitle">Staff and access</h1><p class="note" style="margin:0">Choose each person’s job. The job decides what they can do; their classes and subjects come from the class lists automatically.</p></div></div>
    <div class="tabs noprint" role="tablist">${[["staff", "Staff"], ["grid", "Access grid"], ["requests", `Requests${reqs.length ? ` (${reqs.length})` : ""}`], ["who", "Who can do what"]]
      .map(([k, l]) => `<button class="tab" data-t="${k}" aria-selected="${ui.tab === k}">${l}</button>`).join("")}</div><div id="pane"></div>`;
  app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { ui.tab = b.dataset.t; history.replaceState(null, "", "#" + ui.tab); draw(); });
  ({ staff: staffTab, grid: gridTab, requests: reqTab, who: whoTab })[ui.tab]();
}

// ---------- staff ----------
function staffTab(){
  const pane = document.getElementById("pane"), noJob = staff.filter(s => s.active && !s.job).length;
  pane.innerHTML = `${noJob ? `<p class="okmsg" style="background:var(--amber-soft);color:var(--amber)">${noJob} ${noJob === 1 ? "person has" : "people have"} no job title yet, so Nestopia is guessing from their old role. Choose a job for each person.</p>` : ""}
    <div class="card"><div class="tablewrap"><table class="reg ppl"><thead><tr><th>Name</th><th>Job</th><th class="hide-sm">From the class lists</th><th>Extra access</th><th></th></tr></thead><tbody>
    ${staff.map(s => { const cl = ct.filter(x => x.teacher_id === s.id), home = cl.filter(x => !x.subject_id).map(x => clsName(x.class_id)), subs = [...new Set(cl.filter(x => x.subject_id).map(x => subjName(x.subject_id)))];
      const g = grants.filter(x => x.user_id === s.id && live(x));
      return `<tr><td><b>${esc(s.full_name || "")}</b><br><span class="note">${esc(s.email || "")}</span>${s.active ? "" : '<br><span class="cnt part">Waiting to join</span>'}</td>
        <td>${s.active ? `<select data-job="${s.id}" ${canEdit ? "" : "disabled"}>${!s.job ? `<option value="">Choose…</option>` : ""}${A.JOBS.map(([k, l]) => `<option value="${k}" ${s.job === k ? "selected" : ""}>${l}</option>`).join("")}</select>${!s.job ? `<br><span class="note">Now: ${esc(A.jobName(A.jobOf(s)))}</span>` : ""}`
          : canEdit ? `<button class="btn small" data-ok="${s.id}">Approve</button>` : ""}</td>
        <td class="hide-sm note">${home.length ? "Class: " + esc(home.join(", ")) : ""}${home.length && subs.length ? "<br>" : ""}${subs.length ? "Teaches: " + esc(subs.join(", ")) : ""}${!home.length && !subs.length ? "—" : ""}</td>
        <td>${g.map(x => `<span class="grant">${esc(areaName(x.area))}: ${LBL[x.level]}${x.until ? " until " + esc(fmtD(x.until)) : ""}${canEdit ? `<button data-rg="${x.id}" aria-label="Remove">✕</button>` : ""}</span>`).join("")}${canEdit && s.active ? `<button class="mini" data-add="${s.id}">+ Add</button>` : ""}</td>
        <td>${s.active ? `<button class="btn ghost small" data-va="${s.id}">👀 View as</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div><p class="note" style="margin:10px 0 0">New staff join with your school code (Settings), then appear here as “Waiting to join”.</p></div>`;
  pane.querySelectorAll("[data-job]").forEach(sel => sel.onchange = async () => { if (!sel.value) return;
    const { error } = await sb.rpc("set_job", { p_member: sel.dataset.job, p_job: sel.value }); if (error) { alert(error.message); await load(); return draw(); }
    toast(`${nameOf(sel.dataset.job)} is now ${A.jobName(sel.value)}.`); await load(); draw(); });
  pane.querySelectorAll("[data-ok]").forEach(b => b.onclick = async () => {
    const { error } = await sb.rpc("set_member", { p_member: b.dataset.ok, p_role: "teacher", p_active: true }); if (error) return alert(error.message);
    toast("Approved. Now choose their job."); await load(); draw(); });
  pane.querySelectorAll("[data-add]").forEach(b => b.onclick = () => grantDialog(b.dataset.add));
  pane.querySelectorAll("[data-rg]").forEach(b => b.onclick = async () => { if (!confirm("Remove this extra access?")) return;
    const { error } = await sb.from("access_grants").delete().eq("id", b.dataset.rg); if (error) return alert(error.message); await load(); draw(); });
  pane.querySelectorAll("[data-va]").forEach(b => b.onclick = () => viewAs(staff.find(s => s.id === b.dataset.va)));
}
function grantDialog(uid, req){
  dlg.innerHTML = `<form class="dlg" method="dialog"><h2>Extra access for ${esc(nameOf(uid))}</h2>
    <p class="note" style="margin:0">On top of what their job allows. Leave the end date empty to keep it.</p>
    <label class="f">Part of Nestopia<select id="ga">${A.AREAS.map(a => `<option value="${a[0]}" ${req && req.area === a[0] ? "selected" : ""}>${esc(a[1])}</option>`).join("")}</select></label>
    <div class="two"><label class="f">Level<select id="gl"><option value="V">View</option><option value="E" selected>Edit</option></select></label><label class="f">Until (optional)<input type="date" id="gu" min="${A.today()}"></label></div>
    <label class="f">Reason (optional)<input type="text" id="gr" maxlength="200" placeholder="For example: acting head while the principal is away" value="${esc(req && req.note || "")}"></label>
    <p class="note" id="gx" style="margin:0"></p>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel">Cancel</button><button class="btn" value="ok">Give access</button></div></form>`;
  dlg.showModal(); dlg.onclick = null;
  const hint = () => { const a = A.AREAS.find(x => x[0] === document.getElementById("ga").value); document.getElementById("gx").textContent = "Edit: " + a[2] + "."; };
  dlg.onchange = hint; hint();
  dlg.querySelector("form").onsubmit = async e => { if (!e.submitter || e.submitter.value !== "ok") return; e.preventDefault();
    const row = { school_id: String(school.id), user_id: uid, area: document.getElementById("ga").value, level: document.getElementById("gl").value, until: document.getElementById("gu").value || null, reason: document.getElementById("gr").value.trim() || null, granted_by: me.id };
    const { error } = await sb.from("access_grants").insert(row); if (error) return alert("This wasn’t saved: " + error.message);
    if (req) { await sb.from("access_requests").update({ status: "approved", decided_by: me.id, decided_at: new Date().toISOString() }).eq("id", req.id); mail({ id: req.id, kind: "decided" }); }
    dlg.close(); toast("Access given."); await load(); draw(); };
}
function viewAs(s){
  const lv = A.levels(s, C, grants), cl = ct.filter(x => x.teacher_id === s.id);
  dlg.innerHTML = `<form class="dlg" method="dialog"><h2>👀 ${esc(s.full_name || s.email)}</h2><p class="note" style="margin:0">${esc(A.jobName(A.jobOf(s)))}${cl.length ? " · " + esc([...new Set(cl.map(x => clsName(x.class_id)))].join(", ")) : ""}</p>
    <div class="two"><div class="box"><h3>Can change</h3>${A.AREAS.filter(a => lv[a[0]] === "E").map(a => `<div>✏️ ${esc(a[1])}</div>`).join("") || '<p class="note">Nothing</p>'}</div>
      <div class="box"><h3>Can see</h3>${A.AREAS.filter(a => lv[a[0]] === "V").map(a => `<div>👁️ ${esc(a[1])}</div>`).join("") || '<p class="note">Nothing extra</p>'}</div></div>
    <p class="note" style="margin:0">Everyone also has Overview, Calendar, their own leave, their own timetable and their own account. Teachers only see their own classes.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel">Close</button><button class="btn" value="ok">Open Nestopia with their menu</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  dlg.querySelector("form").onsubmit = e => { if (!e.submitter || e.submitter.value !== "ok") return;
    sessionStorage.setItem("nest_viewas", JSON.stringify({ name: s.full_name || s.email, jobName: A.jobName(A.jobOf(s)), levels: lv })); location.href = "./"; };
}

// ---------- the access grid ----------
function gridTab(){
  const pane = document.getElementById("pane"); G = G || A.grid(C);
  const draw2 = () => {
    pane.innerHTML = `<div class="card"><div class="row noprint" style="justify-content:space-between;margin-bottom:8px"><p class="note" style="margin:0">${canEdit ? "Click a square to change it: Edit → View → none. It applies to everyone with that job." : "Only people who can change settings can edit this."}</p>
      ${canEdit ? '<div class="row"><button class="btn ghost small" id="rst">Back to the recommended grid</button><button class="btn" id="sv">Save</button></div>' : ""}</div>
      <div class="tablewrap"><table class="ag"><thead><tr><th class="ar"></th>${A.JOBS.map(([, l]) => `<th>${esc(l)}</th>`).join("")}</tr></thead><tbody>
      ${A.AREAS.map(a => `<tr><th class="ar">${esc(a[1])}<small>Edit: ${esc(a[2])}</small></th>${A.JOBS.map(([j]) => { const v = G[j][a[0]] || "N", lock = j === "principal" && a[0] === "settings";
        return `<td><button class="cell3 ${v}" data-c="${j}|${a[0]}" ${!canEdit || lock ? "disabled" : ""} title="${lock ? "The principal always keeps this" : ""}">${LBL[v]}</button></td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div><p class="note" style="margin:10px 0 0">View for teachers means their own classes. Everyone keeps their own leave, timetable and account whatever the grid says.</p></div>`;
    pane.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { const [j, a] = b.dataset.c.split("|"); G[j][a] = NEXT[G[j][a] || "N"]; b.className = "cell3 " + G[j][a]; b.textContent = LBL[G[j][a]]; });
    const rs = document.getElementById("rst"); if (rs) rs.onclick = () => { if (!confirm("Go back to the recommended grid? Click Save to keep it.")) return; G = JSON.parse(JSON.stringify(A.DEFAULT)); draw2(); };
    const sv = document.getElementById("sv"); if (sv) sv.onclick = async () => {
      if (!setupId) return alert("Finish the school setup in TwigNest first.");
      const { data: row, error: e1 } = await sb.from("school_setups").select("id,config").eq("id", setupId).single(); if (e1) return alert("This wasn’t saved: " + e1.message);
      const cfg = row.config || {}, diff = {};
      A.JOBS.forEach(([j]) => A.AREAS.forEach(([a]) => { if (G[j][a] !== A.DEFAULT[j][a]) (diff[j] = diff[j] || {})[a] = G[j][a]; }));
      cfg.access = { jobs: diff };
      const { error } = await sb.from("school_setups").update({ config: cfg }).eq("id", setupId); if (error) return alert("This wasn’t saved: " + error.message);
      C = cfg; toast("Access grid saved. It applies straight away."); };
  };
  draw2();
}

// ---------- requests ----------
function reqTab(){
  const pane = document.getElementById("pane");
  pane.innerHTML = reqs.length ? reqs.map(r => `<div class="lrow" style="cursor:default"><span style="flex:1"><b>${esc(nameOf(r.user_id))}</b> asks for <b>${esc(areaName(r.area))}</b><br><span class="note">${esc(new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }))}${r.note ? " · " + esc(r.note) : ""}</span></span>
      ${canEdit ? `<button class="btn small" data-yes="${r.id}">Give access…</button><button class="btn ghost small" data-no="${r.id}">Decline</button>` : ""}</div>`).join("")
    : '<div class="card empty"><p class="note">No one is waiting for access. ✨</p></div>';
  pane.querySelectorAll("[data-yes]").forEach(b => b.onclick = () => { const r = reqs.find(x => x.id === b.dataset.yes); grantDialog(r.user_id, r); });
  pane.querySelectorAll("[data-no]").forEach(b => b.onclick = async () => { if (!confirm("Decline this request?")) return;
    const { error } = await sb.from("access_requests").update({ status: "declined", decided_by: me.id, decided_at: new Date().toISOString() }).eq("id", b.dataset.no); if (error) return alert(error.message);
    mail({ id: b.dataset.no, kind: "decided" }); await load(); draw(); });
}

// ---------- who can do what (printable) ----------
function whoTab(){
  const pane = document.getElementById("pane");
  pane.innerHTML = `<div class="row noprint" style="justify-content:flex-end;margin-bottom:10px"><button class="btn ghost" onclick="print()">🖨️ Print</button></div>
    <div class="card"><h2>${esc(school.name || "")}: who can do what</h2><p class="note" style="margin-top:0">${esc(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}</p>
    <div class="tablewrap"><table class="reg"><thead><tr><th>Name</th><th>Job</th><th>Can change</th><th>Can see</th></tr></thead><tbody>
    ${staff.filter(s => s.active).map(s => { const lv = A.levels(s, C, grants);
      return `<tr><td><b>${esc(s.full_name || s.email)}</b></td><td>${esc(A.jobName(A.jobOf(s)))}</td><td>${esc(A.AREAS.filter(a => lv[a[0]] === "E").map(a => a[1]).join(", ") || "—")}</td><td class="note">${esc(A.AREAS.filter(a => lv[a[0]] === "V").map(a => a[1]).join(", ") || "—")}</td></tr>`; }).join("")}
    </tbody></table></div></div>`;
}
start();
