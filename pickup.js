/* ===== Nestopia · Pick-up and contacts =====
   For each child: emergency contacts, the adults allowed to collect them (with a photo and an ID photo that the office
   checks once), and anyone who must NOT collect them. Parents keep it up to date in the Parent Portal; school leaders
   and the office can add people from paper forms. ID photos are only seen by the parent and school leaders. */
const PLATFORM = "Nestopia";
const sb = supabase.createClient("https://gvhzbxpgebgjnegdiijp.supabase.co", "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM");
const app = document.getElementById("app"), who = document.getElementById("who"), dlg = document.getElementById("dlg");
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = m => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2800); };
const KIND = { collector: ["🚗", "Allowed to collect"], emergency: ["📞", "Emergency contacts"], blocked: ["⛔", "Must NOT collect"] };

let me, school, lead = false, classes = [], studs = [], people = [], ui = { tab: "find", q: "", cls: "", sid: null };
const clsName = id => (classes.find(c => String(c.id) === String(id)) || {}).name || "";
const of = sid => people.filter(p => String(p.student_id) === String(sid));
const urls = {};
async function signed(path){ if (!path) return null; if (urls[path]) return urls[path]; const { data } = await sb.storage.from("pickup-docs").createSignedUrl(path, 3600); return urls[path] = data ? data.signedUrl : null; }
function fail(t){ app.innerHTML = `<div class="card"><div class="msg">${esc(t)}</div></div>`; }
async function fetchAll(q){ const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; } return out; }
// shrink a photo before upload (max 1200px, JPEG)
async function shrink(file){
  if (!/^image\//.test(file.type)) throw new Error("Please choose a photo.");
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return await new Promise(ok => c.toBlob(ok, "image/jpeg", .85));
}

async function start(){
  const { data: { session } } = await sb.auth.getSession(); if (!session) { location.href = "./"; return; }
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || !p.school_id) return fail("Your account isn’t linked to a school yet.");
  me = p; who.innerHTML = `<span>${esc(p.full_name || p.email)}</span><a class="btn ghost small" href="./">← ${esc(PLATFORM)}</a>`;
  const { data: s } = await sb.from("schools").select("*").eq("id", p.school_id).single(); school = s;
  if (!school || school.status !== "active" || !p.active) return fail("Your school or account isn’t active yet.");
  if (window.hubInit) hubInit("pickup");
  lead = window.NestAccess ? ((await NestAccess.mine(sb))["desk"] === "E") : ["school_lead", "coordinator", "admin"].includes(p.role);   // Edit on desk in the access grid
  classes = ((await sb.from("classes").select("id,name,grade_id").eq("school_id", school.id)).data || []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const ids = classes.map(c => c.id);
  studs = ids.length ? (await fetchAll(() => sb.from("students").select("id,full_name,class_id").in("class_id", ids).eq("archived", false))).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))) : [];
  if (!lead) { const mine = ((await sb.from("class_teachers").select("class_id").eq("teacher_id", me.id)).data || [])[0]; if (mine) ui.cls = String(mine.class_id); }
  await load();
  const h = location.hash.slice(1); if (h.startsWith("s=")) ui.sid = h.slice(2); else if (["find", "check"].includes(h)) ui.tab = h;
  draw();
}
async function load(){
  const r = await fetchAll(() => sb.from("pickup_people").select("*").eq("school_id", String(school.id)));
  people = r;
}
function draw(){
  if (ui.sid) return student(ui.sid);
  const toCheck = people.filter(p => p.kind === "collector" && p.id_path && !p.verified_at).length;
  app.innerHTML = `<div class="phead"><div><h1 class="ptitle">Pick-up and contacts</h1><p class="note" style="margin:0">Who can collect each child, who to call in an emergency, and who must not collect them. Parents keep this up to date in the Parent Portal.</p></div>
      <div class="row"><button class="btn ghost" id="prt">🖨️ Print a class list</button></div></div>
    <div class="tabs" role="tablist"><button class="tab" data-t="find" aria-selected="${ui.tab === "find"}">Find a student</button>${lead ? `<button class="tab" data-t="check" aria-selected="${ui.tab === "check"}">Needs attention${toCheck ? ` (${toCheck})` : ""}</button>` : ""}</div><div id="pane"></div>`;
  app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { ui.tab = b.dataset.t; history.replaceState(null, "", "#" + ui.tab); draw(); });
  document.getElementById("prt").onclick = printDialog;
  (ui.tab === "check" && lead ? check : find)();
}
const badge = sid => { const L = of(sid), c = L.filter(p => p.kind === "collector"), e = L.filter(p => p.kind === "emergency"), b = L.filter(p => p.kind === "blocked");
  return `${b.length ? '<span class="cnt warn">⛔ Restriction</span> ' : ""}<span class="cnt ${c.length ? "ok" : "none"}">🚗 ${c.length}</span> <span class="cnt ${e.length ? "ok" : "none"}">📞 ${e.length}</span>`; };
function find(){
  const pane = document.getElementById("pane");
  const list = () => studs.filter(s => (!ui.cls || String(s.class_id) === ui.cls) && (!ui.q || s.full_name.toLowerCase().includes(ui.q.toLowerCase()))).slice(0, 200);
  pane.innerHTML = `<div class="row" style="margin-bottom:12px"><input type="search" id="q" placeholder="Type a student’s name…" value="${esc(ui.q)}" style="max-width:340px" autofocus>
      <select id="cl"><option value="">All classes</option>${classes.map(c => `<option value="${c.id}" ${String(c.id) === ui.cls ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div><div id="res"></div>`;
  const res = () => { const L = list(); document.getElementById("res").innerHTML = L.length ? L.map(s => `<button class="srow" data-s="${s.id}"><span class="grow"><b>${esc(s.full_name)}</b> <span class="note">${esc(clsName(s.class_id))}</span></span>${badge(s.id)}</button>`).join("") : '<p class="note">No students found.</p>';
    document.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { ui.sid = b.dataset.s; history.replaceState(null, "", "#s=" + ui.sid); draw(); }); };
  document.getElementById("q").oninput = e => { ui.q = e.target.value; res(); };
  document.getElementById("cl").onchange = e => { ui.cls = e.target.value; res(); };
  res();
}
function check(){
  const pane = document.getElementById("pane"), ids = people.filter(p => p.kind === "collector" && p.id_path && !p.verified_at);
  const noC = studs.filter(s => !of(s.id).some(p => p.kind === "collector")), noE = studs.filter(s => !of(s.id).some(p => p.kind === "emergency"));
  const sn = id => (studs.find(s => String(s.id) === String(id)) || {}).full_name || "";
  pane.innerHTML = `<div class="card"><h2>🪪 IDs to check (${ids.length})</h2>${ids.length ? ids.map(p => `<button class="srow" data-s="${p.student_id}"><span class="grow"><b>${esc(p.name)}</b>${p.relation ? " · " + esc(p.relation) : ""}<br><span class="note">For ${esc(sn(p.student_id))} (${esc(clsName((studs.find(s => String(s.id) === String(p.student_id)) || {}).class_id))})</span></span><span class="cnt part">Check the ID</span></button>`).join("") : '<p class="note">All IDs are checked. ✨</p>'}</div>
    <div class="card"><h2>🚗 No one listed to collect (${noC.length})</h2><p class="note" style="margin-top:0">${noC.length ? esc(noC.slice(0, 60).map(s => s.full_name).join(", ")) + (noC.length > 60 ? "…" : "") : "Every student has someone listed. ✨"}</p></div>
    <div class="card"><h2>📞 No emergency contact (${noE.length})</h2><p class="note" style="margin-top:0">${noE.length ? esc(noE.slice(0, 60).map(s => s.full_name).join(", ")) + (noE.length > 60 ? "…" : "") : "Every student has an emergency contact. ✨"}</p></div>`;
  pane.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { ui.sid = b.dataset.s; history.replaceState(null, "", "#s=" + ui.sid); draw(); });
}

// ---------- one student ----------
async function student(sid){
  const s = studs.find(x => String(x.id) === String(sid)); if (!s) { ui.sid = null; return draw(); }
  const L = of(sid), block = L.filter(p => p.kind === "blocked");
  let info = null; try { const r = await sb.rpc("desk_student_info", { p_student: String(sid) }); info = r.data; } catch (_) {}
  app.innerHTML = `<p><a href="#" class="note" id="back">← All students</a></p>
    <div class="phead"><div><h1 class="ptitle">${esc(s.full_name)}</h1><p class="note" style="margin:0">${esc(clsName(s.class_id))}</p></div>${lead ? '<div class="row"><button class="btn" id="add">+ Add a person</button></div>' : ""}</div>
    ${block.length ? `<div class="blk">⛔ Must NOT collect ${esc(s.full_name.split(" ")[0])}: ${block.map(p => esc(p.name) + (p.relation ? " (" + esc(p.relation) + ")" : "") + (p.note ? " · " + esc(p.note) : "")).join("; ")}. If this person comes to collect, do not release the child and tell a school leader straight away.</div>` : ""}
    ${info && (info.allergies || info.conditions) ? `<div class="blk" style="border-color:var(--amber);background:var(--amber-soft);color:var(--amber)">🩺 ${info.allergies ? "Allergies: " + esc(info.allergies) : ""}${info.allergies && info.conditions ? " · " : ""}${info.conditions ? "Medical: " + esc(info.conditions) : ""}</div>` : ""}
    ${["collector", "emergency", "blocked"].map(k => { const list = L.filter(p => p.kind === k);
      return `<div class="card"><h2>${KIND[k][0]} ${KIND[k][1]}</h2>${list.length ? list.map(p => `<div class="pp"><div class="ph" data-ph="${esc(p.photo_path || "")}">${p.photo_path ? "" : KIND[k][0]}</div>
        <div><b>${esc(p.name)}</b>${p.relation ? " · " + esc(p.relation) : ""}${p.phone ? `<small>📞 <a href="tel:${esc(p.phone.replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a></small>` : ""}${p.note ? `<small>${esc(p.note)}</small>` : ""}
          <small>${p.by_staff ? "Added by the school" : "Added by a parent"}${k === "collector" ? (p.verified_at ? " · <b style='color:var(--sage)'>✓ ID checked</b>" : p.id_path ? " · <b style='color:var(--amber)'>ID not checked yet</b>" : " · no ID photo") : ""}</small></div>
        <div class="row">${lead && p.id_path ? `<button class="btn ghost small" data-id="${p.id}">🪪 ${p.verified_at ? "See ID" : "Check ID"}</button>` : ""}${lead ? `<button class="mini" data-rm="${p.id}">Remove</button>` : ""}</div></div>`).join("")
        : `<p class="note">${k === "blocked" ? "No restrictions." : "No one yet."}</p>`}
        ${k === "emergency" && info && ((info.contacts || []).length || (info.emergency || []).length) ? `<h3 style="margin:12px 0 4px;font-size:15px">On the school record</h3>${[...(info.contacts || []), ...(info.emergency || [])].filter(x => x && (x.name || x.phone)).map(x => `<div class="pp" style="grid-template-columns:64px 1fr"><div class="ph">👪</div><div><b>${esc(x.name || "")}</b>${x.relation ? " · " + esc(x.relation) : ""}${x.phone ? `<small>📞 <a href="tel:${esc(String(x.phone).replace(/[^\d+]/g, ""))}">${esc(x.phone)}</a></small>` : ""}</div></div>`).join("")}` : ""}</div>`; }).join("")}`;
  document.getElementById("back").onclick = e => { e.preventDefault(); ui.sid = null; history.replaceState(null, "", "#" + ui.tab); draw(); };
  const ad = document.getElementById("add"); if (ad) ad.onclick = () => addDialog(s);
  app.querySelectorAll("[data-ph]").forEach(async el => { if (!el.dataset.ph) return; const u = await signed(el.dataset.ph); if (u) el.innerHTML = `<img src="${u}" alt="" class="ph">`; });
  app.querySelectorAll("[data-id]").forEach(b => b.onclick = () => idDialog(people.find(p => p.id === b.dataset.id)));
  app.querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => { const p = people.find(x => x.id === b.dataset.rm); if (!confirm(`Remove ${p.name} from this list?`)) return;
    const { error } = await sb.from("pickup_people").delete().eq("id", p.id); if (error) return alert(error.message); await load(); student(sid); });
}
async function idDialog(p){
  const u = await signed(p.id_path);
  dlg.innerHTML = `<form class="dlg" method="dialog"><h2>🪪 ${esc(p.name)}</h2>${u ? `<img src="${u}" class="idimg" alt="ID photo">` : '<p class="msg">The ID photo couldn’t be loaded.</p>'}
    <p class="note" style="margin:0">Check the name matches and the ID is in date. ${p.verified_at ? `Checked on ${new Date(p.verified_at).toLocaleDateString("en-GB")}.` : ""}</p>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel">Close</button>${p.verified_at ? "" : '<button class="btn" value="ok">✓ ID checked</button>'}</div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  dlg.querySelector("form").onsubmit = async e => { if (!e.submitter || e.submitter.value !== "ok") return; e.preventDefault();
    const { error } = await sb.from("pickup_people").update({ verified_by: me.id, verified_at: new Date().toISOString() }).eq("id", p.id); if (error) return alert(error.message);
    dlg.close(); toast("ID checked."); await load(); draw(); };
}
function addDialog(s){
  dlg.innerHTML = `<form class="dlg" method="dialog" id="af"><h2>Add a person for ${esc(s.full_name)}</h2>
    <label class="f">List<select id="k">${Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v[0]} ${v[1]}</option>`).join("")}</select></label>
    <div class="two"><label class="f">Full name<input type="text" id="n" required maxlength="100"></label><label class="f">Relation to the child<input type="text" id="r" maxlength="60" placeholder="e.g. Mother, Uncle, Driver"></label></div>
    <div class="two"><label class="f">Phone<input type="text" id="ph" maxlength="30"></label><label class="f">Note<input type="text" id="nt" maxlength="200" placeholder="e.g. Court order on file"></label></div>
    <div class="two"><label class="f">Photo of the person (optional)<input type="file" id="fp" accept="image/*"></label><label class="f">Photo of their ID (optional)<input type="file" id="fi" accept="image/*"></label></div>
    <div class="msg" id="ae" hidden></div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok" id="as">Add</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  dlg.querySelector("form").onsubmit = async e => { if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault();
    const g = id => document.getElementById(id).value.trim(), er = document.getElementById("ae"); document.getElementById("as").disabled = true;
    try {
      const up = async (inp, pre) => { const f = document.getElementById(inp).files[0]; if (!f) return null; const path = `${school.id}/${s.id}/${pre}${Date.now().toString(36)}.jpg`;
        const { error } = await sb.storage.from("pickup-docs").upload(path, await shrink(f), { contentType: "image/jpeg" }); if (error) throw error; return path; };
      const photo = await up("fp", "p-"), idp = await up("fi", "id-");
      const { error } = await sb.from("pickup_people").insert({ school_id: String(school.id), student_id: String(s.id), kind: g("k"), name: g("n"), relation: g("r") || null, phone: g("ph") || null, note: g("nt") || null,
        photo_path: photo, id_path: idp, by_staff: true, added_by: me.id, verified_by: idp ? me.id : null, verified_at: idp ? new Date().toISOString() : null });
      if (error) throw error;
      dlg.close(); toast("Added."); await load(); student(s.id);
    } catch (x) { document.getElementById("as").disabled = false; er.hidden = false; er.textContent = "This wasn’t saved: " + (x.message || x); }
  };
}
function printDialog(){
  dlg.innerHTML = `<form class="dlg" method="dialog"><h2>Print a class list</h2><p class="note" style="margin:0">One page per class with who can collect each child, emergency numbers and any restrictions. Keep it somewhere safe: it has personal details.</p>
    <label class="f">Class<select id="pc">${classes.map(c => `<option value="${c.id}" ${String(c.id) === ui.cls ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel">Cancel</button><button class="btn" value="ok">Print</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  dlg.querySelector("form").onsubmit = async e => { if (!e.submitter || e.submitter.value !== "ok") return; e.preventDefault();
    const cid = document.getElementById("pc").value, list = studs.filter(s => String(s.class_id) === cid); dlg.close();
    const imgs = {}; for (const s of list) for (const p of of(s.id).filter(p => p.photo_path && p.kind !== "emergency")) imgs[p.id] = await signed(p.photo_path);
    const w = window.open("", "_blank"); if (!w) return alert("Please allow pop-ups to print.");
    const pp = p => `${imgs[p.id] ? `<img src="${imgs[p.id]}">` : ""}<b>${esc(p.name)}</b>${p.relation ? " (" + esc(p.relation) + ")" : ""}${p.phone ? " · " + esc(p.phone) : ""}`;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pick-up ${esc(clsName(cid))}</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h1{font-size:18px;margin:0 0 8px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:6px;vertical-align:top;text-align:left}th{background:#f0ecf5}img{width:34px;height:34px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:6px}.x{color:#b00;font-weight:bold}div{margin:2px 0}</style></head><body>
      <h1>${esc(school.name || "")}: pick-up list for ${esc(clsName(cid))}</h1><table><thead><tr><th style="width:18%">Student</th><th>Allowed to collect</th><th style="width:26%">Emergency contacts</th></tr></thead><tbody>
      ${list.map(s => { const L = of(s.id), b = L.filter(p => p.kind === "blocked");
        return `<tr><td><b>${esc(s.full_name)}</b>${b.length ? `<div class="x">⛔ NOT: ${esc(b.map(p => p.name).join(", "))}</div>` : ""}</td><td>${L.filter(p => p.kind === "collector").map(p => `<div>${pp(p)}</div>`).join("") || "<i>None listed</i>"}</td>
          <td>${L.filter(p => p.kind === "emergency").map(p => `<div><b>${esc(p.name)}</b>${p.relation ? " (" + esc(p.relation) + ")" : ""}${p.phone ? " · " + esc(p.phone) : ""}</div>`).join("") || "<i>None listed</i>"}</td></tr>`; }).join("")}
      </tbody></table><script>window.onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close(); };
}
start();
