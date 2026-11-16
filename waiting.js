/* ===== Nestopia · "Waiting for you" and the SLT dashboard on the Overview page =====
   waitingReminders: report cards, unit plans and Nestlings posts that need this person.
   sltPanel: one view of planning, assessment, report cards, teaching and care for school leaders. */
(function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const isLead = p => ["school_lead", "coordinator", "admin"].includes(p.role);
  async function setupOf(sb, school) {
    const r = await sb.from("school_setups").select("config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1);
    return (r.data && r.data[0] && r.data[0].config) || {};
  }
  async function myClasses(sb, p) {
    const r = await sb.from("class_teachers").select("class_id,subject_id").eq("teacher_id", p.id);
    return { home: (r.data || []).filter(x => !x.subject_id).map(x => String(x.class_id)), all: (r.data || []).map(x => String(x.class_id)) };
  }
  const note = (place, icon, text, href, label) => { const b = document.createElement("div");
    b.innerHTML = `<p style="margin:0;font-weight:700">${icon} ${text}</p><p style="margin:8px 0 0"><a class="btn" href="${href}">${label}</a></p>`; place(b); };

  async function waitingReminders(sb, p, school, place) {
    const lead = isLead(p), on = school.modules || [];
    let C = {}, mc = { home: [], all: [] };
    try { [C, mc] = await Promise.all([setupOf(sb, school), myClasses(sb, p)]); } catch (_) {}
    const jobs = [];
    // report cards: checks waiting for me, ready to send, or sent back to me
    jobs.push((async () => {
      const steps = ((C.card || {}).steps || []).filter(x => x && x.name), mine = steps.map((x, k) => (x.people || []).includes(String(p.id)) ? k + 1 : 0).filter(Boolean);
      const r = await sb.from("report_cards").select("student_id,term,stage,history").neq("stage", "sent"); if (r.error) return;
      const rows = r.data || []; let check = 0, send = 0, back = 0;
      rows.forEach(x => { const d = x.stage === "ready" ? 0 : String(x.stage).startsWith("checked:") ? +x.stage.split(":")[1] : -1;
        if (d >= 0 && d < steps.length && mine.includes(d + 1)) check++;
        if (d >= steps.length && (lead || mine.includes(steps.length))) send++; });
      if (mc.home.length) { const st = await sb.from("students").select("id").in("class_id", mc.home); const ids = new Set((st.data || []).map(x => String(x.id)));
        back = rows.filter(x => x.stage === "draft" && ids.has(String(x.student_id)) && ((x.history || []).slice(-1)[0] || {}).action === "back").length; }
      if (check) note(place, "📝", `${check} report card${check === 1 ? "" : "s"} waiting for your check.`, "reports.html", "Open Report cards");
      if (send) note(place, "📤", `${send} report card${send === 1 ? " is" : "s are"} checked and ready to send to parents.`, "reports.html", "Open Report cards");
      if (back) note(place, "↩️", `${back} report card${back === 1 ? " was" : "s were"} sent back to you with notes.`, "reports.html", "See the notes");
    })());
    // unit plans: waiting for review (leaders) or changes requested (grade team)
    if (on.includes("planning")) jobs.push((async () => {
      const r = await sb.from("unit_plans").select("id,grade_id,status").in("status", ["submitted", "changes"]); if (r.error) return;
      const rows = r.data || [];
      if (lead && (C.planner || {}).review) { const n = rows.filter(x => x.status === "submitted").length; if (n) note(place, "📘", `${n} unit plan${n === 1 ? "" : "s"} waiting for your review.`, "units.html", "Open Units and lessons"); }
      if (mc.home.length) { const cl = await sb.from("classes").select("grade_id").in("id", mc.home); const g = new Set((cl.data || []).map(x => String(x.grade_id)));
        const n = rows.filter(x => x.status === "changes" && g.has(String(x.grade_id))).length; if (n) note(place, "📘", `${n} unit plan${n === 1 ? " needs" : "s need"} changes from your grade team.`, "units.html", "Open Units and lessons"); }
    })());
    // Nestlings: students' posts waiting for approval in my classes
    jobs.push((async () => {
      const r = await sb.from("nestling_posts").select("class_id").eq("status", "pending"); if (r.error) return;
      const n = (r.data || []).filter(x => lead ? false : mc.all.includes(String(x.class_id))).length;
      if (n) note(place, "🐣", `${n} Nestlings post${n === 1 ? "" : "s"} from your students waiting for approval.`, "nestlings/", "Open Nestlings");
    })());
    await Promise.all(jobs.map(j => j.catch(() => {})));
  }

  // ---------- SLT dashboard ----------
  async function sltPanel(sb, p, school, box) {
    if (!box || !isLead(p)) return;
    box.hidden = false;
    box.innerHTML = `<div class="ovph"><h2>School at a glance</h2><span class="note">For leaders · live from every part of Nestopia</span></div><div class="sltgrid" id="sltg"><p class="note">Loading…</p></div>`;
    const tiles = [], add = (group, label, value, sub, href, tone) => tiles.push({ group, label, value, sub, href, tone });
    const cnt = async q => { try { const { count, error } = await q; return error ? null : (count || 0); } catch (_) { return null; } };
    const sid = school.id, d0 = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), now = new Date(), y0 = (now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1) + "-08-01";
    let C = {}; try { C = await setupOf(sb, school); } catch (_) {}
    const on = school.modules || [];
    await Promise.all([
      // planning
      (async () => { if (!on.includes("planning")) return; const r = await sb.from("unit_plans").select("status,objectives"); if (r.error) return; const u = r.data || [];
        add("Planning", "Unit plans", u.length, (C.planner || {}).review ? `${u.filter(x => x.status === "approved").length} approved · ${u.filter(x => x.status === "submitted").length} waiting for review` : "Across all grades", "units.html");
        const tg = await cnt(sb.from("taught").select("obj_id", { count: "exact", head: true }));
        if (tg != null) add("Planning", "Objectives taught", tg, "Class and objective pairs ticked as taught", "planning.html"); })(),
      // assessment and report comments
      (async () => { const r = await sb.from("report_comments").select("status"); if (r.error) return; const c = r.data || [];
        const ap = c.filter(x => x.status === "approved").length, rd = c.filter(x => x.status === "ready").length;
        add("Assessment", "Report comments", c.length, `${ap} approved · ${rd} waiting to be checked`, "reports.html#progress", rd ? "amber" : ""); })(),
      (async () => { const r = await sb.from("report_cards").select("stage"); if (r.error) return; const c = r.data || [];
        const sent = c.filter(x => x.stage === "sent").length, inCheck = c.filter(x => x.stage !== "sent" && x.stage !== "draft").length;
        const ack = await cnt(sb.from("report_card_acks").select("student_id", { count: "exact", head: true }));
        add("Assessment", "Report cards sent", sent, `${inCheck} being checked${ack != null ? ` · ${ack} confirmed by parents` : ""}`, "reports.html"); })(),
      (async () => { const r = await sb.from("sat_scores").select("unit_id", { count: "exact", head: true }); if (r.error) return; add("Assessment", "SAT scores", r.count || 0, "Rubric levels given this year", "units.html"); })(),
      // teaching
      (async () => { if (!on.includes("grownest")) return; const n = await cnt(sb.from("observations").select("id", { count: "exact", head: true }).gte("observed_on", y0)); if (n != null) add("Teaching", "Observations", n, "This school year, in GrowNest", "grownest/observations.html"); })(),
      // attendance and behaviour
      (async () => { const r = await sb.from("attendance_marks").select("status").eq("school_id", sid).gte("day", d0); if (r.error) return; const m = r.data || [], n = m.length, a = m.filter(x => x.status === "present" || x.status === "late").length;
        add("Care", "Attendance, last 7 days", n ? Math.round(a / n * 100) + "%" : "–", n ? `${n - a} absence${n - a === 1 ? "" : "s"} recorded` : "No registers yet", "attendance.html", n && a / n < .95 ? "amber" : ""); })(),
      (async () => { if (!on.includes("behaviour")) return; const [m, i] = await Promise.all([cnt(sb.from("behaviour_events").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("kind", "merit").gte("happened_on", d0)),
        cnt(sb.from("behaviour_events").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("kind", "incident").eq("status", "open"))]);
        if (m != null) add("Care", "Merits this week", m, i ? `${i} open incident${i === 1 ? "" : "s"}` : "No open incidents", "behaviour.html", i ? "amber" : ""); })(),
      (async () => { if (!on.includes("inclusion")) return; const r = await cnt(sb.from("inclusion_referrals").select("id", { count: "exact", head: true }).eq("school_id", sid).not("status", "in", "(closed,declined)"));
        const s = await cnt(sb.from("inclusion_students").select("student_id", { count: "exact", head: true }).eq("school_id", sid).neq("active", false));
        if (s != null || r != null) add("Care", "Inclusion register", s ?? "–", r ? `${r} open referral${r === 1 ? "" : "s"}` : "No open referrals", "inclusion.html"); })(),
      (async () => { if (!on.includes("wellbeing")) return; const n = await cnt(sb.from("wellbeing_concerns").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("status", "new"));
        if (n != null) add("Care", "New wellbeing concerns", n, n ? "Waiting to be picked up" : "All followed up", "wellbeing.html", n ? "red" : ""); })(),
      // parents
      (async () => { const [msg, notes] = await Promise.all([sb.from("pm_threads").select("staff_unread").eq("school_id", sid).gt("staff_unread", 0), cnt(sb.from("att_parent_notes").select("id", { count: "exact", head: true }).eq("school_id", String(sid)).eq("status", "pending"))]);
        if (!msg.error) add("Parents", "Messages to answer", (msg.data || []).length, notes ? `${notes} absence note${notes === 1 ? "" : "s"} to check` : "No absence notes waiting", "messages.html", (msg.data || []).length ? "amber" : ""); })()
    ].map(x => x.catch(() => {})));
    const ORDER = ["Planning", "Assessment", "Teaching", "Care", "Parents"];
    tiles.sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
    document.getElementById("sltg").innerHTML = tiles.length ? tiles.map(t => `<a class="slt ${t.tone || ""}" href="${t.href}"><small>${esc(t.group)}</small><span>${esc(t.label)}</span><b>${esc(t.value)}</b><em>${esc(t.sub)}</em></a>`).join("")
      : '<p class="note">Nothing to show yet.</p>';
  }
  window.NestWaiting = { waitingReminders, sltPanel };
})();
