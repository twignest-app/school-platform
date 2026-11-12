/* Nestopia · Getting started: a checklist that notices what a new school has already done.
   Shown on the Overview (leaders, until finished) and at the top of Settings. */
async function gsSteps(sbc, school){
  const q = async fn => { try { return await fn(); } catch (_) { return null; } };
  const count = async (t, f) => q(async () => { let r = sbc.from(t).select("*", { count: "exact", head: true }); r = f(r); const { count, error } = await r; return error ? null : count || 0; });
  const on = school.modules || [], sid = school.id;
  const set = await q(async () => (await sbc.from("school_setups").select("config").eq("school_id", sid).order("updated_at", { ascending: false }).limit(1)).data);
  const C = set && set[0] ? set[0].config : null;
  const [cl, st, staffN, pending, ct, events, team] = await Promise.all([
    count("classes", r => r.eq("school_id", sid)), count("students", r => r.eq("school_id", sid).eq("archived", false)),
    count("profiles", r => r.eq("school_id", sid).eq("active", true)), count("profiles", r => r.eq("school_id", sid).eq("active", false)),
    q(async () => { const { data } = await sbc.from("classes").select("id").eq("school_id", sid); if (!data || !data.length) return 0; const { count } = await sbc.from("class_teachers").select("*", { count: "exact", head: true }).in("class_id", data.map(x => x.id)); return count || 0; }),
    count("school_events", r => r.eq("school_id", sid)),
    q(async () => (await sbc.from("profiles").select("inclusion_head,safeguarding_lead").eq("school_id", sid)).data || [])]);
  const steps = [
    ["Set up grades, subjects and grading", "Your grades, subjects, terms and grading scale. Use the ready-made British curriculum or your own.", !!(C && (C.grades || []).length && (C.subjects || []).length), "twignest/#setup", "Open setup", on.includes("twignest")],
    ["Add classes and students", "Upload an Excel or CSV list with the columns Name, Arabic name, Student ID, Class, Grade and Groups. Nestopia creates the classes for you.", !!(cl && st), "twignest/#classes", "Add students", on.includes("twignest"), true],
    ["Invite your staff", `Give teachers your school code: <b>${school.join_code || ""}</b>. They sign up at nestopia.school, choose “Join my school” and enter it.${pending ? ` <b style="color:#B07A1E">${pending} waiting for you to approve.</b>` : ""}`, (staffN || 0) > 1 && !pending, "twignest/#staff", pending ? "Approve staff" : "Staff and roles", true],
    ["Link teachers to their classes", "So teachers see their own students, registers, plans and parent bookings.", (ct || 0) > 0, "twignest/#classes", "Link teachers", on.includes("twignest")],
    ["Choose your inclusion head", "They review teachers’ referrals and assign the inclusion team.", (team || []).some(p => p.inclusion_head), "inclusion.html", "Inclusion team", on.includes("inclusion")],
    ["Choose your safeguarding lead", "Only they, and school leaders, see safeguarding concerns.", (team || []).some(p => p.safeguarding_lead), "wellbeing.html", "Wellbeing team", on.includes("wellbeing")],
    ["Add your school calendar", "Holidays, assessment weeks and events, so everyone sees what’s coming up.", (events || 0) > 0, "calendar.html", "Open the calendar", events !== null],
    ["Take the first register", "Teachers take the daily register in Attendance, so the Overview shows today’s attendance.", false, "attendance.html", "Attendance", true]
  ].filter(s => s[5]);
  // the last step is done once any register exists
  const att = await count("attendance_marks", r => r.eq("school_id", sid));
  const last = steps.find(s => s[3] === "attendance.html"); if (last) last[2] = (att || 0) > 0;
  return steps;
}
function gsCsvTemplate(){
  const t = "\ufeffName,Arabic name,Student ID,Class,Grade,Groups\nOmar Ali,عمر علي,S001,1A,Grade 1,EAL\nJana Ahmed,جنى أحمد,S002,1A,Grade 1,\n";
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = "students-template.csv"; document.body.appendChild(a); a.click(); a.remove();
}
function gsHtml(steps, compact){
  const done = steps.filter(s => s[2]).length, pct = Math.round(done / steps.length * 100), next = steps.find(s => !s[2]);
  const e = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  if (compact) return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><b style="font-size:18px">🚀 Getting started: ${done} of ${steps.length} done</b>${next ? `<br><span style="color:var(--muted)">Next: ${e(next[0])}</span>` : ""}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${next ? `<a class="btn" href="${next[3]}">${e(next[4])} →</a>` : ""}<a class="btn light small" href="settings.html#start">See all steps</a></div></div>
    <div style="height:8px;border-radius:9px;background:var(--line);margin-top:12px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:#3F8A5B"></i></div>`;
  return `<div style="height:8px;border-radius:9px;background:var(--line);margin:4px 0 14px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:#3F8A4B"></i></div>
    <ol style="margin:0;padding:0;list-style:none;display:grid;gap:10px">${steps.map((s, i) => `<li style="display:grid;grid-template-columns:32px 1fr auto;gap:10px;align-items:start;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:${s[2] ? "var(--bg)" : "var(--card)"}">
      <span style="width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:${s[2] ? "#E4F1E6" : "var(--line)"};color:${s[2] ? "#3F8A4B" : "var(--muted)"}">${s[2] ? "✓" : i + 1}</span>
      <div><b style="${s[2] ? "color:var(--muted)" : ""}">${e(s[0])}</b><br><span style="color:var(--muted);font-size:14px">${s[1]}</span>${s[6] ? `<br><button type="button" class="btn ghost small" style="margin-top:6px" onclick="gsCsvTemplate()">⬇ Download a student list template</button>` : ""}</div>
      ${s[2] ? '<span style="color:#3F8A4B;font-weight:800;font-size:14px">Done</span>' : `<a class="btn small" href="${s[3]}">${e(s[4])} →</a>`}</li>`).join("")}</ol>`;
}
