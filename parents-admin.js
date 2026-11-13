/* Nestopia · Parent portal for staff: invites and what parents see (used by parents.html). Needs: sb, esc, toast */
async function parentPortal(s){
  const box = document.getElementById("ppBody");
  const D = { reports: ["Report cards (approved comments only)", true], attendance: ["Attendance", true], merits: ["Merits", true], incidents: ["Behaviour incidents", false], calendar: ["School calendar", true], conferences: ["Booking parent conferences", true] };
  const st = await sb.from("parent_portal_settings").select("config").eq("school_id", s.id).maybeSingle();
  if (st.error && /parent_/.test(st.error.message)) { box.innerHTML = '<p class="note">The parent portal needs its database step first. Please run the Parent portal update in Supabase.</p>'; return; }
  const cfg = Object.assign(Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v[1]])), (st.data && st.data.config) || {});
  // codes are made automatically for any student who doesn't have one yet
  try { await sb.rpc("parent_make_codes"); } catch (_) {}
  const codes = (await sb.from("parent_codes").select("student_id,code").eq("school_id", s.id)).data || [];
  const links = (await sb.from("parent_links").select("student_id,parent_name,relationship,created_at").eq("school_id", s.id)).data || [];
  const studs = []; for (let k = 0; k < codes.length; k += 200) { const { data } = await sb.from("students").select("id,full_name,class_id,classes(name)").in("id", codes.slice(k, k + 200).map(x => x.student_id)); studs.push(...(data || [])); }
  const base = location.origin + "/parent.html";
  const rows = codes.map(c => { const x = studs.find(y => String(y.id) === String(c.student_id)) || {}; return { name: x.full_name || "", first: (x.full_name || "").split(" ")[0], cls: (x.classes && x.classes.name) || "", code: c.code, link: base + "?code=" + c.code, parents: links.filter(l => String(l.student_id) === String(c.student_id)) }; })
    .sort((a, b) => a.cls.localeCompare(b.cls, undefined, { numeric: true }) || a.name.localeCompare(b.name));
  const classes2 = [...new Set(rows.map(r => r.cls))];
  window.PP_CLASS = window.PP_CLASS && classes2.includes(window.PP_CLASS) ? window.PP_CLASS : classes2[0];
  const invite = r => `Dear parent, ${s.name} invites you to the Nestopia parent portal for ${r.first}: school news, messages with teachers, reports, attendance and merits. Tap this link and create your account (${r.first} is added automatically): ${r.link}\n\nعزيزي وليّ الأمر، تدعوك المدرسة إلى بوابة أولياء الأمور في Nestopia لمتابعة ${r.first}. اضغط على الرابط وأنشئ حسابك: ${r.link}`;
  const shown = rows.filter(r => r.cls === window.PP_CLASS), joined = rows.filter(r => r.parents.length).length;
  box.innerHTML = `<p class="note" style="margin-top:0">Send each family their <b>invite link</b>. They tap it, create an account, and their child is added automatically. No code to type.</p>
    <p style="margin:0 0 10px"><b>${joined} of ${rows.length}</b> <span class="note">families have joined</span></p>
    ${rows.length ? `<div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><select id="ppCls" aria-label="Class">${classes2.map(c => `<option ${c === window.PP_CLASS ? "selected" : ""}>${esc(c || "No class")}</option>`).join("")}</select>
      <button class="btn ghost small" id="ppCopyCls">📋 Copy all invites for this class</button><button class="btn ghost small" id="ppSlips">⬇ Word: printable slips</button><button class="btn ghost small" id="ppCsv">⬇ CSV</button></div>
      <div class="tablewrap"><table class="reg" style="width:100%">${shown.map((r, i) => `<tr><td style="padding:8px 4px;border-top:1px solid var(--line)"><b>${esc(r.name)}</b><br><span class="note">Code ${esc(r.code)}</span></td>
        <td style="border-top:1px solid var(--line)">${r.parents.length ? `<span style="color:#3F8A4B;font-weight:800">✓ Joined</span><br><span class="note">${r.parents.map(p => esc(p.parent_name || "Parent") + (p.relationship ? " (" + esc(p.relationship) + ")" : "")).join(", ")}</span>` : '<span class="note">Not joined yet</span>'}</td>
        <td style="border-top:1px solid var(--line);text-align:right;white-space:nowrap"><button class="btn ghost small" data-inv="${i}">📋 Copy invite</button> <a class="btn ghost small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(invite(r))}">WhatsApp</a></td></tr>`).join("")}</table></div>` : '<p class="note">Add students in TwigNest first.</p>'}
    <details style="margin-top:14px"><summary class="note">What parents can see</summary><p class="note">Parents never see inclusion, wellbeing or safeguarding records.</p>
      <div class="mods" style="gap:10px">${Object.entries(D).map(([k, v]) => `<label style="display:flex;gap:6px;align-items:center;font-weight:700"><input type="checkbox" data-pp="${k}" ${cfg[k] ? "checked" : ""}> ${v[0]}</label>`).join("")}</div></details>`;
  box.querySelectorAll("[data-pp]").forEach(cb => cb.onchange = async () => { cfg[cb.dataset.pp] = cb.checked; const { error } = await sb.from("parent_portal_settings").upsert({ school_id: s.id, config: cfg, updated_at: new Date().toISOString() }); if (error) { cb.checked = !cb.checked; return toast(error.message); } toast("Saved"); });
  const copy = async t => { try { await navigator.clipboard.writeText(t); toast("Copied. Paste it into WhatsApp or an email."); } catch (_) { prompt("Copy:", t); } };
  box.querySelectorAll("[data-inv]").forEach(b => b.onclick = () => copy(invite(shown[+b.dataset.inv])));
  const sel = document.getElementById("ppCls"); if (sel) sel.onchange = e => { window.PP_CLASS = e.target.value; parentPortal(s); };
  const cc = document.getElementById("ppCopyCls"); if (cc) cc.onclick = () => copy(shown.filter(r => !r.parents.length).map(r => r.name + ": " + r.link).join("\n") || "Every family in this class has joined.");
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
