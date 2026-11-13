/* Nestopia · Parent portal for staff: invites and what parents see (used by parents.html). Needs: sb, esc, toast */
async function parentPortal(s){
  const box = document.getElementById("ppBody");
  const D = { reports: ["Report cards (approved comments only)", true], learning: ["What the class is learning (objectives covered)", true], attendance: ["Attendance", true], merits: ["Merits", true], incidents: ["Behaviour incidents", false], calendar: ["School calendar", true], conferences: ["Booking parent conferences", true] };
  const st = await sb.from("parent_portal_settings").select("config").eq("school_id", s.id).maybeSingle();
  if (st.error && /parent_/.test(st.error.message)) { box.innerHTML = '<p class="note">The parent portal needs its database step first. Please run the Parent portal update in Supabase.</p>'; return; }
  const cfg = Object.assign(Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v[1]])), (st.data && st.data.config) || {});
  // codes are made automatically for any student who doesn't have one yet
  try { await sb.rpc("parent_make_codes"); } catch (_) {}
  const codes = (await sb.from("parent_codes").select("student_id,code").eq("school_id", s.id)).data || [];
  const links = (await sb.from("parent_links").select("student_id,parent_name,relationship,created_at").eq("school_id", s.id)).data || [];
  let usage = []; try { const u = await sb.rpc("parent_usage"); usage = u.data || []; } catch (_) {}
  const lastSeen = sid => { const l = usage.filter(x => String(x.student_id) === String(sid) && x.last_seen).map(x => x.last_seen).sort().reverse(); return l[0] || null; };
  const ago = d => { if (!d) return null; const n = Math.floor((Date.now() - new Date(d)) / 864e5); return n <= 0 ? "today" : n === 1 ? "yesterday" : n + " days ago"; };
  const studs = []; for (let k = 0; k < codes.length; k += 200) { const { data } = await sb.from("students").select("id,full_name,class_id,classes(name)").in("id", codes.slice(k, k + 200).map(x => x.student_id)); studs.push(...(data || [])); }
  const base = location.origin + "/parent.html";
  const rows = codes.map(c => { const x = studs.find(y => String(y.id) === String(c.student_id)) || {}; return { name: x.full_name || "", first: (x.full_name || "").split(" ")[0], cls: (x.classes && x.classes.name) || "", code: c.code, link: base + "?code=" + c.code, parents: links.filter(l => String(l.student_id) === String(c.student_id)), seen: lastSeen(c.student_id) }; })
    .sort((a, b) => a.cls.localeCompare(b.cls, undefined, { numeric: true }) || a.name.localeCompare(b.name));
  const classes2 = [...new Set(rows.map(r => r.cls))];
  window.PP_CLASS = window.PP_CLASS && (classes2.includes(window.PP_CLASS) || window.PP_CLASS === "__quiet") ? window.PP_CLASS : classes2[0];
  const invite = r => `Dear parent, ${s.name} invites you to the Nestopia parent portal for ${r.first}: school news, messages with teachers, reports, attendance and merits. Tap this link and create your account (${r.first} is added automatically): ${r.link}\n\nعزيزي وليّ الأمر، تدعوك المدرسة إلى بوابة أولياء الأمور في Nestopia لمتابعة ${r.first}. اضغط على الرابط وأنشئ حسابك: ${r.link}`;
  const quiet = r => r.parents.length && (!r.seen || Date.now() - new Date(r.seen) > 30 * 864e5);
  const shown = rows.filter(r => window.PP_CLASS === "__quiet" ? quiet(r) : r.cls === window.PP_CLASS), joined = rows.filter(r => r.parents.length).length, active = rows.filter(r => r.seen && Date.now() - new Date(r.seen) <= 30 * 864e5).length;
  box.innerHTML = `<p class="note" style="margin-top:0">Send each family their <b>invite link</b>. They tap it, create an account, and their child is added automatically. No code to type.</p>
    <p style="margin:0 0 10px"><b>${joined} of ${rows.length}</b> <span class="note">families have joined</span> · <b>${active}</b> <span class="note">opened the portal in the last 30 days</span>${rows.filter(quiet).length ? ` · <b style="color:#B07A1E">${rows.filter(quiet).length}</b> <span class="note">joined but quiet</span>` : ""}</p>
    ${rows.length ? `<div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><select id="ppCls" aria-label="Class">${classes2.map(c => `<option ${c === window.PP_CLASS ? "selected" : ""}>${esc(c || "No class")}</option>`).join("")}<option value="__quiet" ${window.PP_CLASS === "__quiet" ? "selected" : ""}>😴 Joined, but not opened in 30 days</option></select>
      <button class="btn ghost small" id="ppCopyCls">${window.PP_CLASS === "__quiet" ? "📋 Copy reminders for these families" : "📋 Copy all invites for this class"}</button><button class="btn ghost small" id="ppSlips">⬇ Word: printable slips</button><button class="btn ghost small" id="ppCsv">⬇ CSV</button></div>
      <div class="tablewrap"><table class="reg" style="width:100%">${shown.map((r, i) => `<tr><td style="padding:8px 4px;border-top:1px solid var(--line)"><b>${esc(r.name)}</b><br><span class="note">Code ${esc(r.code)}</span></td>
        <td style="border-top:1px solid var(--line)">${r.parents.length ? `<span style="color:#3F8A4B;font-weight:800">✓ Joined</span><br><span class="note">${r.parents.map(p => esc(p.parent_name || "Parent") + (p.relationship ? " (" + esc(p.relationship) + ")" : "")).join(", ")}</span><br><span class="note" style="color:${quiet(r) ? "#B07A1E" : "inherit"}">${r.seen ? "Last opened " + ago(r.seen) : "Hasn’t opened it yet"}</span>` : '<span class="note">Not joined yet</span>'}</td>
        <td style="border-top:1px solid var(--line);text-align:right;white-space:nowrap"><button class="btn ghost small" data-inv="${i}">📋 Copy invite</button> <a class="btn ghost small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(invite(r))}">WhatsApp</a></td></tr>`).join("")}</table></div>` : '<p class="note">Add students in TwigNest first.</p>'}
    <details style="margin-top:14px"><summary class="note">What parents can see</summary><p class="note">Parents never see inclusion, wellbeing or safeguarding records.</p>
      <div class="mods" style="gap:10px">${Object.entries(D).map(([k, v]) => `<label style="display:flex;gap:6px;align-items:center;font-weight:700"><input type="checkbox" data-pp="${k}" ${cfg[k] ? "checked" : ""}> ${v[0]}</label>`).join("")}</div></details>`;
  box.querySelectorAll("[data-pp]").forEach(cb => cb.onchange = async () => { cfg[cb.dataset.pp] = cb.checked; const { error } = await sb.from("parent_portal_settings").upsert({ school_id: s.id, config: cfg, updated_at: new Date().toISOString() }); if (error) { cb.checked = !cb.checked; return toast(error.message); } toast("Saved"); });
  const copy = async t => { try { await navigator.clipboard.writeText(t); toast("Copied. Paste it into WhatsApp or an email."); } catch (_) { prompt("Copy:", t); } };
  box.querySelectorAll("[data-inv]").forEach(b => b.onclick = () => copy(invite(shown[+b.dataset.inv])));
  const sel = document.getElementById("ppCls"); if (sel) sel.onchange = e => { window.PP_CLASS = e.target.value; parentPortal(s); };
  const cc = document.getElementById("ppCopyCls"); if (cc) cc.onclick = () => copy(window.PP_CLASS === "__quiet"
    ? shown.map(r => `Dear parent of ${r.first}, there’s news, messages and ${r.first}’s stars waiting for you in the Nestopia parent portal: ${base}\nعزيزي وليّ الأمر، توجد أخبار ورسائل بانتظارك في بوابة أولياء الأمور.`).join("\n\n") || "Everyone who joined has opened it recently."
    : shown.filter(r => !r.parents.length).map(r => r.name + ": " + r.link).join("\n") || "Every family in this class has joined.");
  const sl = document.getElementById("ppSlips"); if (sl) sl.onclick = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}td{border:1px dashed #999;padding:12px;width:50%;vertical-align:top;font-size:10.5pt}</style></head><body><table width="100%" cellspacing="6">${rows.reduce((a, x, i) => a + (i % 2 ? "" : "<tr>") + `<td><b>${esc(s.name)}</b> · Parent portal<br><br>For the parents of <b>${esc(x.name)}</b> (${esc(x.cls)})<br>Open this link on your phone and create your account:<br><b>${esc(x.link)}</b><br><br>Or go to ${esc(base)} and type the code <b style="font-size:14pt;letter-spacing:2px">${esc(x.code)}</b><br><br><span dir="rtl" lang="ar">افتح الرابط وأنشئ حسابك، وستتم إضافة طفلك تلقائيًا.</span></td>` + (i % 2 ? "</tr>" : ""), "")}${rows.length % 2 ? "<td></td></tr>" : ""}</table></body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/msword" })); a.download = "Parent portal invites.doc"; document.body.appendChild(a); a.click(); a.remove(); };
  const cv = document.getElementById("ppCsv"); if (cv) cv.onclick = () => { const q = v => '"' + String(v).replace(/"/g, '""') + '"', t = "\ufeff" + [["Student", "Class", "Parent code", "Invite link", "Joined"], ...rows.map(r => [r.name, r.cls, r.code, r.link, r.parents.length ? "Yes" : "No"])].map(r => r.map(q).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = "Parent portal invites.csv"; document.body.appendChild(a); a.click(); a.remove(); };
}

/* School information for parents: contacts, the school day, documents and FAQs */
async function schoolInfoEditor(s, box){
  const r = await sb.from("school_info").select("data").eq("school_id", String(s.id)).maybeSingle();
  if (r.error && /school_info/.test(r.error.message)) { box.innerHTML = '<p class="note">School information needs its database step first (Parent portal v2 update).</p>'; return; }
  const d = Object.assign({ contacts: [], day: {}, faqs: [], docs: [] }, (r.data && r.data.data) || {});
  if (!d.contacts.length) d.contacts = [{ role: "Class teacher" }, { role: "Grade coordinator" }, { role: "School nurse" }, { role: "Finance and fees" }, { role: "Transport" }];
  const inp = (n, v, ph, w) => `<input data-k="${n}" value="${esc(v || "")}" placeholder="${esc(ph)}" style="${w ? "max-width:" + w : ""};padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit">`;
  const draw = () => {
    box.innerHTML = `<p class="note" style="margin-top:0">Everything parents need, in one place. They see it in the parent portal under <b>More → School information</b>.</p>
      <h3 style="margin:14px 0 6px">📞 Who to contact</h3><div id="ct">${d.contacts.map((c, i) => `<div class="row" data-ct="${i}" style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0">${inp("role", c.role, "Role", "170px")}${inp("name", c.name, "Name", "170px")}${inp("phone", c.phone, "Phone", "150px")}${inp("whatsapp", c.whatsapp, "WhatsApp", "150px")}${inp("email", c.email, "Email", "200px")}<button type="button" class="btn ghost small" data-rmct="${i}">✕</button></div>`).join("")}</div>
      <button type="button" class="btn ghost small" id="addct">+ Add a contact</button>
      <h3 style="margin:16px 0 6px">🕗 The school day</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">${[["start", "School starts (e.g. 7:30)"], ["end", "School ends (e.g. 2:30, Friday 11:30)"], ["uniform", "Uniform"], ["pe", "PE days and kit"], ["canteen", "Canteen"], ["bring", "What to bring each day"]].map(([k, l]) => `<label style="display:grid;gap:4px;font-weight:700;font-size:14px">${l}<textarea data-day="${k}" rows="2" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit">${esc(d.day[k] || "")}</textarea></label>`).join("")}</div>
      <h3 style="margin:16px 0 6px">📄 Documents <span class="note">(handbook, policies, term dates, menus)</span></h3>${d.docs.map((x, i) => `<p style="margin:4px 0">📄 ${esc(x.title)} <button type="button" class="btn ghost small" data-rmdoc="${i}">Remove</button></p>`).join("") || '<p class="note" style="margin:0">No documents yet.</p>'}
      <div class="row" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><input id="docT" placeholder="Title, e.g. Parent handbook 2026–2027" style="max-width:300px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit"><input type="file" id="docF" accept=".pdf,.doc,.docx,image/*"><button type="button" class="btn ghost small" id="docU">Upload</button></div>
      <h3 style="margin:16px 0 6px">❓ Questions parents ask</h3><div id="fq">${d.faqs.map((x, i) => `<div data-fq="${i}" style="margin:6px 0;display:grid;gap:4px">${inp("q", x.q, "Question, e.g. What time can I pick up my child?")}<textarea data-k="a" rows="2" placeholder="Answer" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit">${esc(x.a || "")}</textarea><button type="button" class="btn ghost small" data-rmfq="${i}" style="justify-self:start">Remove</button></div>`).join("")}</div>
      <button type="button" class="btn ghost small" id="addfq">+ Add a question</button>
      <p style="margin:16px 0 0"><button class="btn" id="siSave">Save school information</button></p>`;
    const collect = () => { d.contacts = [...box.querySelectorAll("[data-ct]")].map(r => Object.fromEntries([...r.querySelectorAll("[data-k]")].map(i => [i.dataset.k, i.value.trim()]))).filter(c => c.role || c.name);
      box.querySelectorAll("[data-day]").forEach(t => d.day[t.dataset.day] = t.value.trim());
      d.faqs = [...box.querySelectorAll("[data-fq]")].map(r => ({ q: r.querySelector('[data-k="q"]').value.trim(), a: r.querySelector('[data-k="a"]').value.trim() })).filter(x => x.q); };
    box.querySelector("#addct").onclick = () => { collect(); d.contacts.push({}); draw(); };
    box.querySelector("#addfq").onclick = () => { collect(); d.faqs.push({}); draw(); };
    box.querySelectorAll("[data-rmct]").forEach(b => b.onclick = () => { collect(); d.contacts.splice(+b.dataset.rmct, 1); draw(); });
    box.querySelectorAll("[data-rmfq]").forEach(b => b.onclick = () => { collect(); d.faqs.splice(+b.dataset.rmfq, 1); draw(); });
    box.querySelectorAll("[data-rmdoc]").forEach(b => b.onclick = async () => { collect(); const x = d.docs.splice(+b.dataset.rmdoc, 1)[0]; if (x && x.path) await sb.storage.from("school-docs").remove([x.path]); await save(); draw(); });
    box.querySelector("#docU").onclick = async () => { const f = box.querySelector("#docF").files[0], t = box.querySelector("#docT").value.trim(); if (!f) return toast("Choose a file first."); collect();
      const path = `${s.id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`; const up = await sb.storage.from("school-docs").upload(path, f); if (up.error) return toast(up.error.message);
      d.docs.push({ title: t || f.name, path }); await save(); toast("Uploaded"); draw(); };
    const save = async () => { const { error } = await sb.from("school_info").upsert({ school_id: String(s.id), data: d, updated_at: new Date().toISOString() }); if (error) { toast(error.message); return false; } return true; };
    box.querySelector("#siSave").onclick = async () => { collect(); if (await save()) toast("Saved. Parents can see it now."); };
  };
  draw();
}

/* "This unit" for parents: by grade */
async function unitEditor(s, box){
  const set = await sb.from("school_setups").select("config").eq("school_id", s.id).order("updated_at", { ascending: false }).limit(1);
  const grades = (set.data && set.data[0] && set.data[0].config && set.data[0].config.grades) || [];
  const r = await sb.from("unit_info").select("*").eq("school_id", String(s.id)).order("starts_on", { ascending: false });
  if (r.error) { box.innerHTML = '<p class="note">“This unit” needs its database step first (Parent portal Part 2 update).</p>'; return; }
  const units = r.data || [], gName = id => (grades.find(g => g.id === id) || { name: id }).name, today = new Date().toISOString().slice(0, 10);
  box.innerHTML = `<p class="note" style="margin-top:0">What each grade is learning now, and how families can talk about it at home. Parents see it under <b>Learning</b>.</p>
    ${units.length ? `<div class="tablewrap"><table class="reg" style="width:100%">${units.map(u => `<tr><td style="padding:8px 4px;border-top:1px solid var(--line)"><b>${esc(u.title)}</b><br><span class="note">${esc(gName(u.grade_id))}${u.starts_on ? " · " + esc(u.starts_on) + (u.ends_on ? " to " + esc(u.ends_on) : "") : ""}${u.starts_on <= today && (!u.ends_on || u.ends_on >= today) ? " · <b>now</b>" : ""}</span></td><td style="border-top:1px solid var(--line);text-align:right"><button class="btn ghost small" data-ue="${u.id}">Edit</button></td></tr>`).join("")}</table></div>` : '<p class="note">No units yet.</p>'}
    <p style="margin:10px 0 0"><button class="btn small" id="uNew">+ Add a unit</button></p><div id="uForm"></div>`;
  const form = u => { u = u || {}; const f = box.querySelector("#uForm");
    f.innerHTML = `<div style="border:1px solid var(--line);border-radius:14px;padding:14px;margin-top:12px;display:grid;gap:8px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px"><label style="display:grid;gap:4px;font-weight:700">Grade <select id="uG" style="padding:8px;border:1px solid var(--line);border-radius:10px;font:inherit">${grades.map(g => `<option value="${esc(g.id)}" ${u.grade_id === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label>
        <label style="display:grid;gap:4px;font-weight:700">Starts <input type="date" id="uS" value="${esc(u.starts_on || "")}" style="padding:8px;border:1px solid var(--line);border-radius:10px;font:inherit"></label><label style="display:grid;gap:4px;font-weight:700">Ends <input type="date" id="uE" value="${esc(u.ends_on || "")}" style="padding:8px;border:1px solid var(--line);border-radius:10px;font:inherit"></label></div>
      ${[["uT", "Unit title", u.title, 1, "For example: How we organise ourselves"], ["uTh", "Transdisciplinary theme (optional)", u.theme, 1, ""], ["uC", "Central idea", u.central_idea, 2, ""], ["uI", "We will find out about (lines of inquiry)", u.inquiry, 3, ""], ["uH", "Talk about it at home (questions and ideas for families)", u.talk_home, 3, "For example: Ask your child who helps in our community, and how."], ["uV", "Words to use (vocabulary, optional)", u.vocabulary, 1, ""]].map(([id, l, v, rows, ph]) => `<label style="display:grid;gap:4px;font-weight:700">${l}${rows > 1 ? `<textarea id="${id}" rows="${rows}" placeholder="${esc(ph)}" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit">${esc(v || "")}</textarea>` : `<input id="${id}" value="${esc(v || "")}" placeholder="${esc(ph)}" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit">`}</label>`).join("")}
      <label style="display:grid;gap:4px;font-weight:700">Parent guide (optional) ${u.doc_name ? `<span class="note">Now: ${esc(u.doc_name)}</span>` : ""}<input type="file" id="uD" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"></label>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap"><span>${u.id ? '<button class="btn ghost small" id="uDel">Delete</button>' : ""}</span><span><button class="btn ghost small" id="uX">Cancel</button> <button class="btn small" id="uSave">Save</button></span></div></div>`;
    const v = id => f.querySelector("#" + id).value.trim();
    f.querySelector("#uX").onclick = () => f.innerHTML = "";
    const del = f.querySelector("#uDel"); if (del) del.onclick = async () => { if (!confirm("Delete this unit?")) return; await sb.from("unit_info").delete().eq("id", u.id); unitEditor(s, box); };
    f.querySelector("#uSave").onclick = async () => { if (!v("uT")) return toast("Add the unit title.");
      const row = { school_id: String(s.id), grade_id: v("uG"), title: v("uT"), theme: v("uTh") || null, central_idea: v("uC") || null, inquiry: v("uI") || null, talk_home: v("uH") || null, vocabulary: v("uV") || null, starts_on: v("uS") || null, ends_on: v("uE") || null, updated_at: new Date().toISOString() };
      const file = f.querySelector("#uD").files[0];
      if (file) { const path = `${s.id}/units/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`; const up = await sb.storage.from("parent-media").upload(path, file); if (up.error) return toast(up.error.message); row.doc_path = path; row.doc_name = file.name; }
      const { error } = u.id ? await sb.from("unit_info").update(row).eq("id", u.id) : await sb.from("unit_info").insert(row); if (error) return toast(error.message);
      toast("Saved. Parents of this grade can see it."); unitEditor(s, box); };
    f.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  box.querySelector("#uNew").onclick = () => form(null);
  box.querySelectorAll("[data-ue]").forEach(b => b.onclick = () => form(units.find(u => u.id === b.dataset.ue)));
}


/* Objectives in simple words, for parents */
async function objEditor(s, box){
  const set = await sb.from("school_setups").select("config").eq("school_id", s.id).order("updated_at", { ascending: false }).limit(1);
  const C = set.data && set.data[0] ? set.data[0].config : null;
  if (!C || !C.subjects) { box.innerHTML = '<p class="note">Set up subjects and curriculum objectives in TwigNest first.</p>'; return; }
  const r = await sb.from("obj_parent_text").select("*").eq("school_id", String(s.id));
  if (r.error) { box.innerHTML = '<p class="note">This needs its database step first (Parent learning update).</p>'; return; }
  const saved = Object.fromEntries((r.data || []).map(x => [x.obj_id, x]));
  window.OBJ_UI = window.OBJ_UI || { g: (C.grades || [])[0] && C.grades[0].id, s: 0 };
  const simple = t => { let x = String(t || "").trim().replace(/^(pupils|children|students) should (be taught to|learn to)\s*/i, "").replace(/\be\.g\./gi, "for example").replace(/\bi\.e\./gi, "that is");
    return /^(use|read|write|count|recognise|recognize|identify|compare|describe|explain|solve|add|subtract|multiply|divide|know|understand|apply|spell|listen|speak|retell|measure|draw|make|ask|answer|name|sort|order|find|round|estimate|plan|create|investigate|observe|record|discuss|develop|show|choose|join|form|perform|explore|predict)\b/i.test(x) ? "Your child is learning to " + x.charAt(0).toLowerCase() + x.slice(1) : "Your child is learning about " + x.charAt(0).toLowerCase() + x.slice(1); };
  const draw = () => { const U = window.OBJ_UI, sub = C.subjects[U.s] || C.subjects[0], rows = [];
    (sub.strands || []).forEach(st => (st.cols || []).filter(c => c.type === "objectives").forEach(c => (((c.objectives || {})[U.g]) || []).forEach((list, t) => (list || []).forEach(o => rows.push([st.name, t, o])))));
    const done = rows.filter(([, , o]) => saved[o.id] && saved[o.id].text_en).length;
    box.innerHTML = `<p class="note" style="margin-top:0">Parents see which objectives their child’s class has covered. Write each one in simple words, once: it’s used for every class and every year. Empty ones show the objective with “Your child is learning to…”.</p>
      <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select id="oG">${(C.grades || []).map(g => `<option value="${esc(g.id)}" ${g.id === U.g ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select><select id="oS">${C.subjects.map((x, k) => `<option value="${k}" ${k === U.s ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
        <span class="note">${done} of ${rows.length} written</span><button class="btn ghost small" id="oSug">✨ Suggest simple wording for empty ones</button><button class="btn small" id="oSave">Save</button></div>
      <div style="max-height:520px;overflow:auto;margin-top:10px">${rows.map(([st, t, o]) => { const v = saved[o.id] || {}; return `<div data-o="${esc(o.id)}" style="border-top:1px solid var(--line);padding:10px 0;display:grid;gap:6px">
        <div><span class="note">${esc((C.terms || [])[t] || "Term " + (t + 1))} · ${esc(st)}</span><br><b>${esc(o.text)}</b></div>
        <textarea data-f="text_en" rows="2" placeholder="In simple words for parents" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit">${esc(v.text_en || "")}</textarea>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px"><input data-f="tip_en" value="${esc(v.tip_en || "")}" placeholder="🏠 Try at home (optional)" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit"><input data-f="text_ar" dir="rtl" value="${esc(v.text_ar || "")}" placeholder="بالعربية (اختياري)" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit"><input data-f="tip_ar" dir="rtl" value="${esc(v.tip_ar || "")}" placeholder="🏠 فكرة للبيت (اختياري)" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;font:inherit"></div></div>`; }).join("") || '<p class="note">No objectives for this grade and subject.</p>'}</div>`;
    box.querySelector("#oG").onchange = e => { U.g = e.target.value; draw(); };
    box.querySelector("#oS").onchange = e => { U.s = +e.target.value; draw(); };
    box.querySelector("#oSug").onclick = () => { let n = 0; box.querySelectorAll("[data-o]").forEach(d => { const ta = d.querySelector('[data-f="text_en"]'); if (!ta.value.trim()) { ta.value = simple(d.querySelector("b").textContent); n++; } }); toast(n ? n + " filled in. Read them through, edit, then Save." : "Nothing empty."); };
    box.querySelector("#oSave").onclick = async () => { const up = [...box.querySelectorAll("[data-o]")].map(d => { const g = f => d.querySelector(`[data-f="${f}"]`).value.trim() || null; return { school_id: String(s.id), obj_id: d.dataset.o, text_en: g("text_en"), text_ar: g("text_ar"), tip_en: g("tip_en"), tip_ar: g("tip_ar"), updated_at: new Date().toISOString() }; }).filter(x => x.text_en || x.text_ar || x.tip_en || x.tip_ar || saved[x.obj_id]);
      for (let k = 0; k < up.length; k += 200) { const { error } = await sb.from("obj_parent_text").upsert(up.slice(k, k + 200), { onConflict: "school_id,obj_id" }); if (error) return toast(error.message); }
      up.forEach(x => saved[x.obj_id] = x); toast("Saved"); draw(); };
  };
  draw();
}
