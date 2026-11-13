/* TwigNest classes and students */
(function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lines = v => v.split("\n").map(x => x.trim()).filter(Boolean);
  let ctx, setup, classes = [], teachers = [], links = [], students = [], openClass = null, bound = false, preview = null;
  const norm = v => String(v ?? "").toLowerCase().replace(/[\s\-_.]/g, "");
  async function loadXLSX() {
    if (window.XLSX) return;
    await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      sc.onload = res; sc.onerror = () => rej(new Error("Couldn’t load the Excel reader. Check your internet connection and try again.")); document.head.appendChild(sc); });
  }
  function matchGrade(v) {
    const grades = setup.config.grades || [], n = norm(v); if (!n) return null;
    let g = grades.find(x => norm(x.name) === n); if (g) return g;
    if (/^\d+$/.test(n)) g = grades.find(x => norm(x.name) === "grade" + n || norm(x.name) === "year" + n); if (g) return g;
    return grades.find(x => norm(x.name).endsWith(n) && n.length >= 2) || null;
  }
  async function readFile(file) {
    await loadXLSX();
    const wb = XLSX.read(await file.arrayBuffer()), ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const hi = rows.findIndex(r => r.some(c => /name/i.test(String(c))));
    if (hi < 0) throw new Error("I couldn’t find a heading row with a “Name” column. Use the template, or add a heading row: Name, Class, Grade, Groups.");
    const head = rows[hi].map(h => String(h).trim().toLowerCase()), find = re => head.findIndex(h => re.test(h));
    let nameI = find(/^(full ?name|student ?name|name)$/), firstI = find(/^first ?name$/), lastI = find(/^(last ?name|surname|family ?name)$/);
    if (nameI < 0 && firstI < 0) nameI = find(/name/);
    const arI = head.findIndex(h => /arabic|عربي|بالعربي|^الاسم/.test(h)), idI = find(/^(student ?id|student ?no\.?|student ?number|school ?(id|number|no\.?)|id|number|emis|esis|sims ?id|admission ?(no\.?|number))$/), classI = find(/^(class|section|homeroom|class ?name)$/), gradeI = find(/^(grade|year ?group|year|grade ?level)$/), groupsI = find(/^(groups?|tags?)$/);
    const setupGroups = setup.config.groups || [], flagCols = setupGroups.map(g => [g, head.findIndex(h => norm(h) === norm(g))]).filter(x => x[1] >= 0);
    if (classI < 0) throw new Error("I couldn’t find a “Class” column. Add a column called Class with names like 2A.");
    const out = [];
    rows.slice(hi + 1).forEach((r, i) => {
      const name = (nameI >= 0 ? String(r[nameI]) : [r[firstI], lastI >= 0 ? r[lastI] : ""].join(" ")).replace(/\s+/g, " ").trim();
      const cls = String(r[classI] ?? "").trim();
      if (!name && !cls) return;
      let groups = groupsI >= 0 ? String(r[groupsI]).split(/[,;\/]/).map(x => x.trim()).filter(Boolean) : [];
      flagCols.forEach(([g, ci]) => { const v = String(r[ci]).trim().toLowerCase(); if (v && !["no", "n", "0", "false", "-"].includes(v)) groups.push(g); });
      const known = [], unknown = [];
      groups.forEach(g => { const m = setupGroups.find(x => norm(x) === norm(g)); if (m) { if (!known.includes(m)) known.push(m); } else unknown.push(g); });
      const existing = classes.find(c => c.name.toLowerCase() === cls.toLowerCase());
      const grade = existing ? (setup.config.grades || []).find(g => g.id === existing.grade_id) : (gradeI >= 0 ? matchGrade(r[gradeI]) : null);
      let problem = "";
      if (!name) problem = "No name"; else if (!cls) problem = "No class"; else if (!grade) problem = gradeI >= 0 && String(r[gradeI]).trim() ? `Grade “${r[gradeI]}” isn’t in your setup` : "No grade for a new class";
      out.push({ row: hi + i + 2, name, sn: idI >= 0 ? String(r[idI] ?? "").trim() || null : null, ar: arI >= 0 ? String(r[arI] ?? "").trim() || null : null, cls, grade, groups: known, unknown, existing, problem });
    });
    const ok = out.filter(x => !x.problem), seen = new Set();
    ok.forEach(x => { const k = x.cls.toLowerCase() + "|" + x.name.toLowerCase(); x.dupe = seen.has(k); seen.add(k);
      const ex = (x.sn && students.find(s => s.student_number && norm(s.student_number) === norm(x.sn))) || (x.existing && students.find(s => s.class_id === x.existing.id && s.full_name.toLowerCase() === x.name.toLowerCase())); x.match = ex || null; });
    const newClasses = [...new Map(ok.filter(x => !x.existing).map(x => [x.cls.toLowerCase(), x])).values()].map(x => ({ name: x.cls, grade: x.grade }));
    preview = { file: file.name, rows: out, newClasses, unknown: [...new Set(out.flatMap(x => x.unknown))] };
  }
  function previewCard() {
    const p = preview, ok = p.rows.filter(x => !x.problem && !x.dupe), bad = p.rows.filter(x => x.problem), dup = p.rows.filter(x => x.dupe);
    const add = ok.filter(x => !x.match).length, upd = ok.filter(x => x.match && (JSON.stringify(x.match.groups || []) !== JSON.stringify(x.groups) || (x.sn && x.match.student_number !== x.sn) || (x.existing && x.match.class_id !== x.existing.id))).length, same = ok.length - add - upd;
    return `<div class="card"><h2>Check the list before importing</h2><p class="note">From <b>${esc(p.file)}</b></p>
      <div class="grid3" style="margin:12px 0">
        <div class="colcard" style="margin:0"><b style="font-size:24px;color:var(--plum)">${add}</b><div class="note">new students to add</div></div>
        <div class="colcard" style="margin:0"><b style="font-size:24px;color:var(--plum)">${p.newClasses.length}</b><div class="note">new classes to create${p.newClasses.length ? ": " + p.newClasses.map(c => esc(c.name) + " (" + esc(c.grade.name) + ")").join(", ") : ""}</div></div>
        <div class="colcard" style="margin:0"><b style="font-size:24px;color:var(--plum)">${upd + same}</b><div class="note">already in TwigNest${upd ? `, ${upd} with groups to update` : ""}</div></div>
      </div>
      ${bad.length ? `<div class="msg err">${bad.length} row${bad.length === 1 ? "" : "s"} can’t be imported and will be skipped:</div><div class="tablewrap"><table><tr><th>Row</th><th>Name</th><th>Class</th><th>Problem</th></tr>${bad.slice(0, 30).map(x => `<tr><td>${x.row}</td><td>${esc(x.name)}</td><td>${esc(x.cls)}</td><td>${esc(x.problem)}</td></tr>`).join("")}</table></div>` : ""}
      ${dup.length ? `<div class="msg info">${dup.length} name${dup.length === 1 ? " appears" : "s appear"} twice in the same class and will only be added once.</div>` : ""}
      ${p.unknown.length ? `<div class="msg info">These groups aren’t in your setup and will be ignored: ${p.unknown.map(esc).join(", ")}. Add them in School setup, step 6, if you need them.</div>` : ""}
      <h3>First rows</h3><div class="tablewrap"><table><tr><th>Name</th><th>Arabic name</th><th>Student ID</th><th>Class</th><th>Grade</th><th>Groups</th><th></th></tr>
      ${ok.slice(0, 15).map(x => `<tr><td>${esc(x.name)}</td><td dir="rtl">${esc(x.ar || "")}</td><td>${esc(x.sn || "")}</td><td>${esc(x.cls)}</td><td>${esc(x.grade.name)}</td><td>${x.groups.map(esc).join(", ")}</td><td class="note">${x.match ? "Already added" : "New"}</td></tr>`).join("")}</table></div>
      ${ok.length > 15 ? `<p class="note">…and ${ok.length - 15} more.</p>` : ""}
      <p class="note">Students already in TwigNest but not in this file are left as they are.</p>
      <div class="row" style="margin-top:12px"><button class="btn" data-cact="do-import" ${add + upd + p.newClasses.length ? "" : "disabled"}>Import ${add} student${add === 1 ? "" : "s"}</button><button class="btn ghost" data-cact="cancel-import">Cancel</button><span id="impMsg" class="note"></span></div></div>`;
  }

  async function load() {
    const sb = ctx.sb, sid = ctx.school.id;
    const s = await sb.from("school_setups").select("*").eq("school_id", sid).order("updated_at", { ascending: false }).limit(1);
    setup = s.data && s.data[0];
    if (!setup) return;
    const [c, t, l, st] = await Promise.all([
      sb.from("classes").select("*").eq("school_id", sid).eq("year", setup.year).order("name"),
      sb.from("profiles").select("id,full_name,email,role,active").eq("school_id", sid),
      sb.from("class_teachers").select("*"),
      sb.from("students").select("*").eq("school_id", sid).eq("archived", false).order("full_name")
    ]);
    const err = c.error || t.error || l.error || st.error;
    if (err) throw err;
    classes = c.data; teachers = t.data.filter(x => x.active); links = l.data; students = st.data;
  }

  function gradeName(id) { const g = (setup.config.grades || []).find(x => x.id === id); return g ? g.name : "Other"; }

  let addFor = null;
  function teacherName(id) { const t = teachers.find(x => x.id === id); return t ? (t.full_name || t.email) : "Former staff"; }
  function render() {
    const el = ctx.el;
    if (!setup) { el.innerHTML = `<div class="card"><h2>Classes and students</h2><p class="note">Finish the school setup first, so TwigNest knows your grades and student groups.</p></div>`; return; }
    const grades = setup.config.grades || [], subs = setup.config.subjects || [];
    const totalSt = students.length;
    let h = `<style>
      .cl-table{width:100%;border-collapse:collapse}.cl-table th{font-size:13px;text-align:left;color:var(--muted,#6B6480);font-weight:600;padding:6px 8px;border-bottom:1px solid var(--line,#E6E1EF)}
      .cl-table td{padding:10px 8px;border-bottom:1px solid var(--line,#E6E1EF);vertical-align:middle;font-size:15px}.cl-table tr:last-child td{border-bottom:0}
      .cl-name{font-weight:700;font-size:16px}.cl-panel{background:var(--bg,#F7F5FB);border-radius:14px;padding:16px;margin:4px 0 8px}
      .cl-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.cl-head h2{margin:0}
      .cl-chip{display:inline-block;font-size:13px;background:var(--bg,#F3EEF8);border-radius:99px;padding:3px 10px;margin:2px 4px 2px 0}
      .cl-sec{margin:14px 0 6px;font-weight:700}
    </style>
    <div class="card"><div class="cl-head"><div><h2>Classes and students</h2><p class="note" style="margin:4px 0 0">${esc(setup.year)} · ${classes.length} class${classes.length === 1 ? "" : "es"} · ${totalSt} student${totalSt === 1 ? "" : "s"}</p></div></div>
      <p class="note">Your classes are listed by grade below. Use <b>Manage</b> on a class to choose its teachers and add or edit its students.</p>
      <details style="margin-top:10px" ${preview ? "open" : ""}><summary style="cursor:pointer;font-weight:700">Import a whole-school student list from Excel</summary>
        <p class="note">Upload an Excel or CSV file with the columns <b>Name</b>, <b>Arabic name</b>, <b>Student ID</b>, <b>Class</b>, <b>Grade</b> and <b>Groups</b>. TwigNest creates any missing classes and shows you a preview before anything is saved.</p>
        <div class="row"><label class="btn" style="display:inline-block;margin:0;font-size:16px;cursor:pointer">Upload a list<input type="file" id="listFile" accept=".xlsx,.xls,.csv" hidden></label><button class="btn ghost" data-cact="template">Download the template</button></div><div id="upMsg"></div>
      </details></div>`;
    if (preview) h += previewCard();
    grades.forEach(g => {
      const list = classes.filter(c => c.grade_id === g.id), n = students.filter(s => list.some(c => c.id === s.class_id)).length;
      h += `<div class="card"><div class="cl-head"><div><h2>${esc(g.name)}</h2><p class="note" style="margin:2px 0 0">${list.length} class${list.length === 1 ? "" : "es"} · ${n} student${n === 1 ? "" : "s"}</p></div>
        <button class="btn ghost small" data-cact="add-open" data-id="${g.id}">+ Add a class</button></div>`;
      if (addFor === g.id) h += `<div class="cl-panel"><div class="row"><input id="newClass-${g.id}" type="text" placeholder="Class name, for example ${esc(g.name.replace(/^grade\s*/i, ""))}A" aria-label="Class name" style="max-width:260px"><button class="btn" data-cact="add-class" data-id="${g.id}">Add class</button><button class="btn ghost" data-cact="add-open" data-id="${g.id}">Cancel</button></div><div id="cMsg-${g.id}"></div></div>`;
      if (!list.length) { h += `<p class="note" style="margin:12px 0 0">No classes in ${esc(g.name)} yet.</p></div>`; return; }
      h += `<div class="tablewrap" style="margin-top:10px"><table class="cl-table"><tr><th>Class</th><th>Class teachers</th><th>Specialist teachers</th><th>Students</th><th></th></tr>`;
      list.forEach(c => {
        const tIds = links.filter(l => l.class_id === c.id && !l.subject_id).map(l => l.teacher_id), spec = links.filter(l => l.class_id === c.id && l.subject_id), cn = students.filter(s => s.class_id === c.id).length, open = openClass === c.id;
        h += `<tr><td class="cl-name">${esc(c.name)}</td><td>${tIds.length ? tIds.map(id => esc(teacherName(id))).join(", ") : `<span class="note">None yet</span>`}</td>
          <td>${spec.length ? spec.length + " teacher" + (spec.length === 1 ? "" : "s") : `<span class="note">None</span>`}</td><td>${cn}</td>
          <td style="text-align:right"><button class="btn ${open ? "" : "ghost "}small" data-cact="students" data-id="${c.id}">${open ? "Close" : "Manage"}</button></td></tr>`;
        if (open) h += `<tr><td colspan="5"><div class="cl-panel">
          <div class="cl-sec">Class teachers <span class="note" style="font-weight:400">(teach all subjects)</span></div>
          ${teachers.length ? teachers.map(t => `<label class="check" style="margin:4px 0"><input type="checkbox" data-teach="${c.id}|${t.id}" ${tIds.includes(t.id) ? "checked" : ""}> ${esc(t.full_name || t.email)}</label>`).join("") : `<p class="note">No approved staff yet.</p>`}
          <div class="cl-sec">Specialist teachers <span class="note" style="font-weight:400">(one subject)</span></div>
          ${spec.map(l => { const sb = subs.find(x => x.id === l.subject_id); return `<span class="cl-chip">${esc(teacherName(l.teacher_id))} · <b>${esc(sb ? sb.name : "Removed subject")}</b> <button class="mini" data-cact="del-spec" data-id="${c.id}|${l.teacher_id}|${l.subject_id}" aria-label="Remove">×</button></span>`; }).join("") || `<p class="note" style="margin:0">None yet.</p>`}
          ${teachers.length && subs.length ? `<div class="row" style="margin-top:8px"><select id="spT-${c.id}" aria-label="Teacher" style="width:auto;padding:6px 8px">${teachers.map(t => `<option value="${t.id}">${esc(t.full_name || t.email)}</option>`).join("")}</select><select id="spS-${c.id}" aria-label="Subject" style="width:auto;padding:6px 8px">${subs.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select><button class="btn ghost small" data-cact="add-spec" data-id="${c.id}">Add</button></div>` : ""}
          <div class="cl-sec">Students</div>${studentEditor(c)}
          <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost small" data-cact="del-class" data-id="${c.id}">Remove this class</button></div>
        </div></td></tr>`;
      });
      h += `</table></div></div>`;
    });
    const other = classes.filter(c => !grades.some(g => g.id === c.grade_id));
    if (other.length) h += `<div class="card"><h2>Other classes</h2><p class="note">These classes belong to a grade that’s no longer in your setup: ${other.map(c => esc(c.name)).join(", ")}.</p></div>`;
    el.innerHTML = h;
  }

  function studentEditor(c) {
    const list = students.filter(s => s.class_id === c.id), groups = setup.config.groups || [];
    return `<div><label for="st-${c.id}">One student per line: full name, Arabic name, student ID, then any groups, separated by commas</label>
      <p class="note">The Arabic name and student ID are optional. Groups you can use: ${groups.map(esc).join(", ") || "none set up"}. For example: Layla Hassan, ليلى حسن, 20145, EAL</p>
      <textarea id="st-${c.id}" style="min-height:220px">${esc(list.map(s => [s.full_name, s.arabic_name, s.student_number, ...(s.groups || [])].filter(Boolean).join(", ")).join("\n"))}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn" data-cact="save-students" data-id="${c.id}">Save students</button><span id="stMsg-${c.id}" class="note"></span></div>
      <p class="note">Removing a name archives that student. Their data is kept, not deleted.</p></div>`;
  }

  async function act(a, id, btn) {
    const sb = ctx.sb;
    if (a === "add-open") { addFor = addFor === id ? null : id; render(); const i = document.getElementById("newClass-" + id); if (i) i.focus(); return; }
    if (a === "add-class") {
      const name = document.getElementById("newClass-" + id).value.trim(), grade = id, m = document.getElementById("cMsg-" + id);
      if (!name) { m.innerHTML = `<div class="msg err">Type a class name first.</div>`; return; }
      const { error } = await sb.from("classes").insert({ school_id: ctx.school.id, year: setup.year, grade_id: grade, name });
      if (error) { m.innerHTML = `<div class="msg err">${esc(/duplicate/i.test(error.message) ? "A class with this name already exists." : error.message)}</div>`; return; }
      addFor = null;
    }
    if (a === "del-class") {
      const n = students.filter(s => s.class_id === id).length;
      if (!confirm(n ? `Remove this class? Its ${n} students will be archived, and their data kept.` : "Remove this class?")) return;
      if (n) await sb.from("students").update({ archived: true }).eq("class_id", id);
      const { error } = await sb.from("classes").delete().eq("id", id); if (error) return alert(error.message);
    }
    if (a === "template") {
      await loadXLSX();
      const g = (setup.config.grades || []), ex = g.find(x => /2/.test(x.name)) || g[0] || { name: "Grade 2" }, grp = setup.config.groups || [];
      const ws = XLSX.utils.aoa_to_sheet([["Name", "Arabic name", "Student ID", "Class", "Grade", "Groups"], ["Layla Hassan", "ليلى حسن", "20145", "2A", ex.name, grp[2] || "EAL"], ["Omar Khalid", "عمر خالد", "20146", "2A", ex.name, ""], ["Yusuf Rahman", "يوسف رحمن", "20147", "2A", ex.name, [grp[0], grp[3]].filter(Boolean).join(", ")]]);
      ws["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 24 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Students"); XLSX.writeFile(wb, "TwigNest student list template.xlsx"); return;
    }
    if (a === "cancel-import") { preview = null; return render(); }
    if (a === "do-import") {
      const msg = document.getElementById("impMsg"), p = preview; msg.textContent = "Importing…";
      if (p.newClasses.length) { const { error } = await sb.from("classes").insert(p.newClasses.map(c => ({ school_id: ctx.school.id, year: setup.year, grade_id: c.grade.id, name: c.name }))); if (error) { msg.textContent = error.message; return; } }
      await load();
      const ok = p.rows.filter(x => !x.problem && !x.dupe), cid = n => classes.find(c => c.name.toLowerCase() === n.toLowerCase()).id;
      const ins = ok.filter(x => !x.match).map(x => ({ school_id: ctx.school.id, class_id: cid(x.cls), full_name: x.name, groups: x.groups, student_number: x.sn, arabic_name: x.ar }));
      for (let i = 0; i < ins.length; i += 400) { const { error } = await sb.from("students").insert(ins.slice(i, i + 400)); if (error) { msg.textContent = error.message; return; } msg.textContent = `Importing… ${Math.min(i + 400, ins.length)} of ${ins.length}`; }
      for (const x of ok.filter(x => x.match)) { const ch = { groups: x.groups, class_id: cid(x.cls) }; if (x.sn) ch.student_number = x.sn; if (x.ar) ch.arabic_name = x.ar; await sb.from("students").update(ch).eq("id", x.match.id); }
      preview = null; await load(); render();
      ctx.el.insertAdjacentHTML("afterbegin", `<div class="msg ok" style="margin-bottom:12px">Imported ${ins.length} student${ins.length === 1 ? "" : "s"}.</div>`); return;
    }
    if (a === "add-spec") {
      const t = document.getElementById("spT-" + id).value, s = document.getElementById("spS-" + id).value;
      if (links.some(l => l.class_id === id && l.teacher_id === t && l.subject_id === s)) return;
      const { error } = await sb.from("class_teachers").insert({ class_id: id, teacher_id: t, subject_id: s }); if (error) return alert(error.message);
    }
    if (a === "del-spec") { const [cid, tid, sid] = id.split("|"); const { error } = await sb.from("class_teachers").delete().eq("class_id", cid).eq("teacher_id", tid).eq("subject_id", sid); if (error) return alert(error.message); }
    if (a === "students") { openClass = openClass === id ? null : id; return render(); }
    if (a === "save-students") {
      const msg = document.getElementById("stMsg-" + id), groups = setup.config.groups || [];
      const rows = lines(document.getElementById("st-" + id).value).map(l => { const p = l.split(/[,\t]/).map(x => x.trim()).filter(Boolean);
        const gs = p.filter(x => groups.some(g => norm(g) === norm(x))).map(x => groups.find(g => norm(g) === norm(x)));
        const isAr = x => /[\u0600-\u06ff]/.test(x), all = p.filter(x => !groups.some(g => norm(g) === norm(x))), ar = all.find(isAr), rest = all.filter(x => !isAr(x)), idf = rest.find(x => /\d/.test(x)), nm = rest.find(x => x !== idf) || ar || "";
        return { full_name: nm, arabic_name: ar || null, student_number: idf && idf !== nm ? idf : null, groups: gs, unknown: rest.filter(x => x !== nm && x !== idf) }; }).filter(r => r.full_name);
      const unknown = [...new Set(rows.flatMap(r => r.unknown))];
      if (unknown.length && !confirm(`These groups aren’t in your setup and will be ignored: ${unknown.join(", ")}. Continue?`)) return;
      const current = students.filter(s => s.class_id === id), keep = new Set();
      const inserts = [], updates = [];
      rows.forEach(r => { const ex = current.find(s => !keep.has(s.id) && r.student_number && s.student_number && norm(s.student_number) === norm(r.student_number)) || current.find(s => s.full_name.toLowerCase() === r.full_name.toLowerCase() && !keep.has(s.id));
        if (ex) { keep.add(ex.id); if (JSON.stringify(ex.groups || []) !== JSON.stringify(r.groups) || ex.full_name !== r.full_name || (ex.student_number || null) !== (r.student_number || null) || (ex.arabic_name || null) !== (r.arabic_name || null)) updates.push({ id: ex.id, full_name: r.full_name, groups: r.groups, student_number: r.student_number, arabic_name: r.arabic_name }); }
        else inserts.push({ school_id: ctx.school.id, class_id: id, full_name: r.full_name, groups: r.groups, student_number: r.student_number, arabic_name: r.arabic_name }); });
      const archive = current.filter(s => !keep.has(s.id)).map(s => s.id);
      msg.textContent = "Saving…";
      if (inserts.length) { const { error } = await sb.from("students").insert(inserts); if (error) { msg.textContent = error.message; return; } }
      for (const u of updates) { const { error } = await sb.from("students").update({ full_name: u.full_name, groups: u.groups, student_number: u.student_number, arabic_name: u.arabic_name }).eq("id", u.id); if (error) { msg.textContent = error.message; return; } }
      if (archive.length) { const { error } = await sb.from("students").update({ archived: true }).in("id", archive); if (error) { msg.textContent = error.message; return; } }
      openClass = null;
    }
    await load(); render();
  }

  async function onClick(e) {
    const b = e.target.closest("[data-cact]"); if (!b || !ctx.el.contains(b)) return;
    b.disabled = true; try { await act(b.dataset.cact, b.dataset.id, b); } catch (err) { alert(err.message || err); } finally { b.disabled = false; }
  }
  async function onChange(e) {
    const t = e.target;
    if (t.id === "listFile" && ctx.el.contains(t)) {
      const f = t.files[0]; if (!f) return; const m = document.getElementById("upMsg"); m.innerHTML = `<p class="note">Reading ${esc(f.name)}…</p>`;
      try { await readFile(f); render(); } catch (err) { m.innerHTML = `<div class="msg err">${esc(err.message || err)}</div>`; } t.value = ""; return;
    }
    if (!t.dataset.teach || !ctx.el.contains(t)) return;
    const [cid, tid] = t.dataset.teach.split("|");
    const q = t.checked ? ctx.sb.from("class_teachers").insert({ class_id: cid, teacher_id: tid }) : ctx.sb.from("class_teachers").delete().eq("class_id", cid).eq("teacher_id", tid).is("subject_id", null);
    const { error } = await q; if (error) { alert(error.message); t.checked = !t.checked; return; }
    await load();
  }

  window.TNClasses = {
    async open(context) {
      ctx = context; ctx.el.innerHTML = `<div class="card"><p class="note">Loading classes…</p></div>`;
      if (!bound) { document.addEventListener("click", onClick); document.addEventListener("change", onChange); bound = true; }
      try { await load(); render(); } catch (err) { ctx.el.innerHTML = `<div class="card"><div class="msg err">${esc(err.message || err)}</div></div>`; }
    },
    async myClasses(context) {
      ctx = context; const sb = ctx.sb, el = ctx.el;
      const { data: l } = await sb.from("class_teachers").select("class_id").eq("teacher_id", ctx.profile.id);
      const ids = (l || []).map(x => x.class_id);
      if (!ids.length) { el.innerHTML += `<div class="card"><h2>My classes</h2><p class="note">You haven’t been added to a class yet. Your school lead adds you to your classes.</p></div>`; return; }
      const { data: cls } = await sb.from("classes").select("*").in("id", ids).order("name");
      const { data: st } = await sb.from("students").select("id,class_id").in("class_id", ids).eq("archived", false);
      el.innerHTML += `<div class="card"><h2>My classes</h2><div class="grid2" style="margin-top:10px">${(cls || []).map(c => { const n = (st || []).filter(s => s.class_id === c.id).length;
        return `<div class="colcard" style="margin:0"><h3 style="margin:0">${esc(c.name)}</h3><p class="note" style="margin:4px 0 0">${n} student${n === 1 ? "" : "s"}. The class sheet is coming next.</p></div>`; }).join("")}</div></div>`;
    }
  };
})();
