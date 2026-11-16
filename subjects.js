/* ===== Nestopia subjects: which subjects each student takes =====
   A subject can be limited to some grades, and to the A pathway (Arab students) or B pathway (non-Arab students).
   Used by TwigNest sheets, report cards, the Parent Portal and the TwigNest setup. */
(function () {
  const ARAB = ["emirati", "uae", "saudi", "saudi arabian", "egyptian", "jordanian", "syrian", "lebanese", "palestinian", "iraqi", "yemeni", "omani", "kuwaiti", "bahraini", "qatari",
    "sudanese", "moroccan", "algerian", "tunisian", "libyan", "mauritanian", "somali", "djiboutian", "comorian",
    "إماراتي", "اماراتي", "سعودي", "مصري", "أردني", "اردني", "سوري", "لبناني", "فلسطيني", "عراقي", "يمني", "عماني", "كويتي", "بحريني", "قطري", "سوداني", "مغربي", "جزائري", "تونسي", "ليبي", "موريتاني", "صومالي"];
  // A = Arab students, B = non-Arab students, null = not known yet
  function pathOf(s) {
    if (!s) return null;
    if (s.pathway === "A" || s.pathway === "B") return s.pathway;
    if (s.emirati === true) return "A";
    const n = String(s.nationality || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!n) return null;
    return ARAB.some(a => n === a || n.startsWith(a + " ") || n.endsWith(" " + a)) ? "A" : "B";
  }
  // does this student take this subject? (unknown pathway: shown both, so nothing is hidden by mistake)
  function takes(sub, s, gradeId) {
    if (!sub) return false;
    if (gradeId != null && Array.isArray(sub.grades) && sub.grades.length && !sub.grades.map(String).includes(String(gradeId))) return false;
    if (sub.pathway === "A" || sub.pathway === "B") { const p = pathOf(s); if (p && p !== sub.pathway) return false; }
    return true;
  }
  const forGrade = (subjects, gradeId) => (subjects || []).filter(sb => gradeId == null || !Array.isArray(sb.grades) || !sb.grades.length || sb.grades.map(String).includes(String(gradeId)));
  const forStudent = (subjects, s, gradeId) => (subjects || []).filter(sb => takes(sb, s, gradeId));

  // ready-made subjects a school can add in TwigNest setup
  const LIBRARY = [
    { name: "Arabic A", lang: "ar", pathway: "A", strands: ["القراءة", "الكتابة", "الاستماع والتحدث"] },
    { name: "Arabic B", lang: "en", pathway: "B", strands: ["Reading", "Writing", "Speaking and listening"] },
    { name: "Islamic Education A", lang: "ar", pathway: "A", strands: ["التربية الإسلامية"] },
    { name: "Islamic Education B", lang: "en", pathway: "B", strands: ["Islamic Education"] },
    { name: "Social Studies A", lang: "ar", pathway: "A", strands: ["الدراسات الاجتماعية"] },
    { name: "Social Studies B", lang: "en", pathway: "B", strands: ["Social Studies"] },
    { name: "Art", strands: ["Art"] }, { name: "Music", strands: ["Music"] }, { name: "STEM", strands: ["STEM"] },
    { name: "Physical Education", strands: ["Physical Education"] }, { name: "Computing", strands: ["Computing"] },
    { name: "French", strands: ["French"] }, { name: "Drama", strands: ["Drama"] },
    { name: "Inquiry (learner skills)", strands: ["Inquiry"] }
  ];
  window.NestSubjects = { pathOf, takes, forGrade, forStudent, LIBRARY };
})();
