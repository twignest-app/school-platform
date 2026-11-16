/* ===== Nestopia · job-based access (shared by the hub menu, the Staff and access page and the pages that check access) =====
   Each person has a job title. The school's access grid says, for each job, whether they can Edit (E), View (V) or have
   no access (N) to each part of Nestopia. Extra access can be given to one person, with an end date if wanted.
   "View" for teachers always means their own classes: that part comes from the class lists automatically. */
(function () {
  const JOBS = [["principal", "Principal"], ["vice_principal", "Vice principal"], ["head_section", "Head of section"], ["coordinator", "Coordinator"],
    ["grade_leader", "Grade leader"], ["class_teacher", "Class teacher"], ["specialist", "Specialist teacher"], ["inclusion", "Inclusion"],
    ["counsellor", "Counsellor"], ["nurse", "Nurse"], ["office", "Office / front desk"], ["it", "IT"]];
  // [id, label, what Edit allows, menu items it shows]
  const AREAS = [
    ["attendance", "Attendance registers", "Take and change registers", ["attendance"]],
    ["desk", "Front desk and pick-up", "Add collectors from paper forms and check IDs", ["pickup"]],
    ["students", "Student records", "Add and change student details", ["students"]],
    ["planning", "Planning, units and lessons", "Plan units and lessons", ["planning", "units"]],
    ["timetable", "Timetable", "Build the timetable and set the periods", ["timetable"]],
    ["assessment", "Assessment (TwigNest)", "Assess and write report comments", ["twignest"]],
    ["reports", "Report cards", "Edit, check and send report cards", ["reports"]],
    ["behaviour", "Behaviour", "Give merits and record incidents", ["behaviour"]],
    ["inclusion", "Inclusion", "Run referrals and support plans", ["inclusion"]],
    ["wellbeing", "Wellbeing and safeguarding", "Handle all concerns (View: class check-ins and raising a concern)", ["wellbeing"]],
    ["grownest", "Observations (GrowNest)", "Observe lessons", ["grownest"]],
    ["parents", "Parents and messages", "Message parents and run the parent portal", ["parents", "messages", "conferences"]],
    ["nestlings", "Nestlings", "Approve and post in Nestlings", ["nestlings"]],
    ["trips", "Trips and forms", "Plan trips and send permission slips", ["trips"]],
    ["cover", "Leave approvals and cover", "Approve leave, see reasons, arrange cover", []],
    ["evidence", "Evidence packs", "Build evidence packs", ["evidence"]],
    ["admissions", "Admissions", "Review applications, make offers and enrol", ["admissions"]],
    ["fees", "Fees and payments", "Create invoices and record payments", ["fees"]],
    ["settings", "School settings and access", "Change school settings and who can do what", ["access", "newyear"]]];
  const g = s => Object.fromEntries(AREAS.map((a, i) => [a[0], s[i]]));
  // order of letters = order of AREAS above
  const DEFAULT = {
    principal:      g("EEEEEEEEEEEEEEEEEEE"),
    vice_principal: g("EEEEEEEEEEEEEEEEEEE"),
    head_section:   g("EEEEEEEEEEEEEEEEEVV"),
    coordinator:    g("VVEEEEEEVVEEEEVEVNV"),
    grade_leader:   g("EVVEVEEEVVVEEENVNNN"),
    class_teacher:  g("EVVEVEEEVVVEEENNNNN"),
    specialist:     g("VVVEVEEEVVVEEENNNNN"),
    inclusion:      g("VVVVVVVVEVNENVNEVNN"),
    counsellor:     g("VVVNVNNEVENENNNVNNN"),
    nurse:          g("VVVNVNNNNVNVNNNNNNN"),
    office:         g("EEVNVNNNNVNENVVNEEN"),
    it:             g("NNVNVNNNNNNNNNNNNNV")
  };
  const RANK = { N: 0, V: 1, E: 2 };
  const jobOf = p => p.job || (["school_lead", "admin"].includes(p.role) ? "principal" : p.role === "coordinator" ? "coordinator" : "class_teacher");
  const today = () => { const x = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(v => [v.type, v.value])); return `${x.year}-${x.month}-${x.day}`; };
  function grid(config){ const own = (config && config.access && config.access.jobs) || {}; const out = {};
    JOBS.forEach(([j]) => { out[j] = Object.assign({}, DEFAULT[j], own[j] || {}); }); out.principal.settings = "E"; return out; }
  // the levels for one person: their job's row, raised by any extra access that hasn't ended
  function levels(p, config, grants){
    if (p.role === "admin") return Object.fromEntries(AREAS.map(a => [a[0], "E"]));
    const row = Object.assign({}, grid(config)[jobOf(p)] || DEFAULT.class_teacher), t = today();
    (grants || []).filter(x => x.user_id === p.id && (!x.until || x.until >= t)).forEach(x => { if (RANK[x.level] > RANK[row[x.area] || "N"]) row[x.area] = x.level; });
    if (p.role === "school_lead") row.settings = "E";   // a school lead can never lock themselves out
    return row;
  }
  // for the person signed in on this page (cached for the page)
  let mineP = null;
  async function mine(sb){
    if (mineP) return mineP;
    mineP = (async () => {
      const { data: { session } } = await sb.auth.getSession(); if (!session) return {};
      let r = await sb.from("profiles").select("id,role,job,school_id").eq("id", session.user.id).single();
      if (r.error) r = await sb.from("profiles").select("id,role,school_id").eq("id", session.user.id).single();
      const p = r.data || {}; if (!p.school_id) return {};
      const set = await sb.from("school_setups").select("config").eq("school_id", p.school_id).order("updated_at", { ascending: false }).limit(1);
      let gr = []; try { const x = await sb.from("access_grants").select("user_id,area,level,until").eq("user_id", p.id); gr = x.data || []; } catch (_) {}
      return levels(p, set.data && set.data[0] && set.data[0].config, gr);
    })();
    return mineP;
  }
  const areaOfNav = id => (AREAS.find(a => a[3].includes(id)) || [])[0] || null;
  window.NestAccess = { JOBS, AREAS, DEFAULT, RANK, jobOf, grid, levels, mine, areaOfNav, today, jobName: j => (JOBS.find(x => x[0] === j) || [, "Class teacher"])[1] };
})();
