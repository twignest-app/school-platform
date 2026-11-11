// GrowNest shared settings and helpers
const GN_URL = "https://gvhzbxpgebgjnegdiijp.supabase.co";
const GN_KEY = "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM";
const sb = window.supabase.createClient(GN_URL, GN_KEY);
const SITE = location.origin + location.pathname.replace(/[^/]*$/, "");
const $ = id => document.getElementById(id);
const logoUrl = p => p ? GN_URL + "/storage/v1/object/public/school-logos/" + p : "";
function esc(s){return String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function showMsg(el, text, type="info"){el.className="msg "+type; el.textContent=text; el.classList.remove("hide");}
if (typeof window.t !== "function") window.t = (en, ar) => en;
function friendly(err){
  const m = (err && err.message) || String(err);
  if (/Invalid login/i.test(m)) return t("The email or password is not correct.", "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
  if (/already registered|already been registered/i.test(m)) return t("An account with this email already exists. Please sign in instead.", "يوجد حساب بهذا البريد الإلكتروني بالفعل. يُرجى تسجيل الدخول بدلًا من ذلك.");
  if (/Password should be/i.test(m)) return t("Please choose a password with at least 8 characters.", "يُرجى اختيار كلمة مرور لا تقل عن 8 أحرف.");
  if (/rate limit/i.test(m)) return t("Too many emails were sent in a short time. Please wait a few minutes and try again.", "تم إرسال عدد كبير من الرسائل في وقت قصير. يُرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.");
  if (/Email not confirmed/i.test(m)) return t("Please confirm your email first using the link we sent you.", "يُرجى تأكيد بريدك الإلكتروني أولًا من خلال الرابط الذي أرسلناه إليك.");
  return m;
}

// Make sure the person is signed in, approved and their school is active. Returns {user, staff, school}.
async function requireStaff(){
  const {data:{session}} = await sb.auth.getSession();
  if(!session){ location.href = "login.html"; return null; }
  const {data:staff} = await sb.from("staff").select("*, schools(*)").eq("id", session.user.id).maybeSingle();
  if(!staff || !staff.active || !staff.schools || staff.schools.status !== "active"){ location.href = "app.html"; return null; }
  if (window.gnAddAR && gnLang() === "ar") { try { // show the MOE criteria in Arabic on screen
    let m = null; try { m = JSON.parse(sessionStorage.getItem("gn_ar_db") || "null"); } catch (_) {}
    if (!m) { m = {};
      const [i, s, a] = await Promise.all([sb.from("indicators").select("title,title_ar,look_fors,look_fors_ar"), sb.from("statements").select("text,text_ar").not("text_ar", "is", null), sb.from("also_seen_options").select("label,label_ar")]);
      (i.data || []).forEach(r => { if (r.title_ar) m[r.title] = r.title_ar; if (r.look_fors_ar && r.look_fors) m[r.look_fors] = r.look_fors_ar; });
      (s.data || []).forEach(r => { m[r.text] = r.text_ar; }); (a.data || []).forEach(r => { if (r.label_ar) m[r.label] = r.label_ar; });
      try { sessionStorage.setItem("gn_ar_db", JSON.stringify(m)); } catch (_) {} }
    gnAddAR(m); } catch (_) {} }
  try { // "Also seen" options can be edited by the GrowNest owner
    const {data: opts} = await sb.from("also_seen_options").select("*").eq("active", true).order("sort");
    if (opts && opts.length) { ALSO_SEEN.length = 0; opts.forEach(o => ALSO_SEEN.push({code: o.code, label: o.label, els: o.els || []})); }
  } catch (_) {}
  return {user: session.user, staff, school: staff.schools};
}
async function signOut(){ await sb.auth.signOut(); location.href = "index.html"; }

// Six-point MOE scale
const LEVELS = [
  {n:6, name:"Outstanding", bg:"#4F8A4B", fg:"#FFFFFF"},
  {n:5, name:"Very good",   bg:"#8BBF86", fg:"#1E3A1C"},
  {n:4, name:"Good",        bg:"#CFE6CA", fg:"#1E3A1C"},
  {n:3, name:"Acceptable",  bg:"#F6D892", fg:"#4A3500"},
  {n:2, name:"Weak",        bg:"#F3B08A", fg:"#4A2000"},
  {n:1, name:"Very weak",   bg:"#E07C7C", fg:"#FFFFFF"}];
const lvl = n => LEVELS.find(l => l.n === n);
function levelChip(n){ const L = lvl(n); return L ? `<span class="lchip" style="background:${L.bg};color:${L.fg}">${n} · ${L.name}</span>` : '<span class="lchip">Not judged</span>'; }
function academicYear(d){ const dt = d ? new Date(d) : new Date(); const y = dt.getFullYear(); return dt.getMonth() >= 7 ? `${y}–${y+1}` : `${y-1}–${y}`; }
function gnLocale(){ return document.documentElement.lang === "ar" ? "ar-AE-u-nu-latn" : "en-GB"; }
function fmtDate(s){ if(!s) return ""; const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString(gnLocale(),{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
function headerButtons(links){ // replaces the header button with Dashboard/others + Sign out
  const hb = document.querySelector("header.top .btn"); const box = document.createElement("div"); box.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center";
  hb.replaceWith(box);
  if (window.gnAppLang) { const sw = document.createElement("button"); sw.type = "button"; sw.className = "langsw notr"; sw.textContent = gnLang() === "ar" ? "English" : "العربية"; box.append(sw); }
  links.forEach(([href, text]) => { const a = document.createElement("a"); a.className = "btn ghost small"; a.href = href; a.textContent = text; box.append(a); });
  const so = document.createElement("a"); so.className = "btn ghost small"; so.href = "#"; so.textContent = "Sign out"; so.onclick = e => { e.preventDefault(); signOut(); }; box.append(so);
}

const SUBJECTS = ["Unit of Inquiry","English","Maths","Science","Arabic A","Arabic B","Islamic A","Islamic B","Social Studies A","Social Studies B","Moral Education","Art","Music","PE","Computing","French","Read Write Inc.","Library"];
// "Other subject" choice in subject lists: lets the observer type any subject
const OTHER_OPT = '<option value="__other">Other subject – type it…</option>';
function watchOther(sel){
  let prev = sel.value;
  sel.addEventListener("focus", () => { prev = sel.value; });
  sel.addEventListener("change", e => {
    if (sel.value !== "__other") { prev = sel.value; return; }
    e.stopImmediatePropagation();
    const v = (prompt(t("Type the subject of this lesson", "اكتب مادة هذه الحصة")) || "").trim();
    if (!v) { sel.value = prev; return; }
    if (![...sel.options].some(o => o.value === v)) { const o = document.createElement("option"); o.value = v; o.textContent = v; sel.insertBefore(o, sel.querySelector('option[value="__other"]')); }
    sel.value = v; prev = v; sel.dispatchEvent(new Event("change"));
  }, true);
}

// Sends feedback automatically from feedback@ via the GrowNest email function; falls back to the email app.
async function deliverFeedback(o){
  const cut = o.lines.findIndex(l => /^(Please let me know|يُرجى إعلامي)/.test(l));
  const core = cut > 0 ? o.lines.slice(0, cut) : o.lines;
  try {
    const {data, error} = await sb.functions.invoke("grownest-mail", {body: {action: "send", observation_id: o.observationId, subject: o.subject, lines: core, attachment: o.attachment || null, lang: o.lang || "en"}});
    if (error) { let m = error.message; try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (_) {} throw new Error(m); }
    if (data && data.error) throw new Error(data.error);
    return "sent";
  } catch (e) {
    console.warn(e);
    if (!confirm("GrowNest couldn’t send the email automatically (" + (e.message || e) + ").\n\nOpen your email app with the feedback instead?")) return "cancelled";
    location.href = "mailto:" + encodeURIComponent(o.to) + "?subject=" + encodeURIComponent(o.subject) + "&body=" + encodeURIComponent(o.lines.join("\n"));
    return "mailto";
  }
}
// Arabic feedback for teachers who choose it
const LV_AR = {6: "متميز", 5: "جيد جدًا", 4: "جيد", 3: "مقبول", 2: "ضعيف", 1: "ضعيف جدًا"};
const SUBJ_AR = {"Arabic A": "اللغة العربية (أ)", "Arabic B": "اللغة العربية (ب)", "Islamic A": "التربية الإسلامية (أ)", "Islamic B": "التربية الإسلامية (ب)", "Social Studies A": "الدراسات الاجتماعية (أ)", "Social Studies B": "الدراسات الاجتماعية (ب)", "Unit of Inquiry": "وحدة الاستقصاء", "English": "اللغة الإنجليزية", "Maths": "الرياضيات", "Science": "العلوم", "Arabic": "اللغة العربية", "Islamic Education": "التربية الإسلامية", "Social Studies": "الدراسات الاجتماعية",
  "Moral Education": "التربية الأخلاقية", "Art": "الفنون", "Music": "الموسيقى", "PE": "التربية البدنية", "Computing": "الحوسبة", "French": "اللغة الفرنسية", "Read Write Inc.": "Read Write Inc.", "Library": "المكتبة"};
const subjAr = s => SUBJ_AR[s] || s || "";
function fmtDateIn(s, lang){ if (!s) return ""; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(lang === "ar" ? "ar-AE-u-nu-latn" : "en-GB", {weekday: "long", day: "numeric", month: "long", year: "numeric"}); }
const teacherLang = t => (t && t.feedback_lang === "ar") ? "ar" : "en";
function arStmt(list, text){ const s = (list || []).find(x => x.text === text); return s && s.text_ar ? s.text_ar : text; }
function blobToBase64(b){ return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(b); }); }

// "Also seen in this lesson" options, linked to SEF elements
const ALSO_SEEN = [
  {code:"islamic",       label:"Islamic values reflected in the learning",           els:["2.2.1"]},
  {code:"uae",           label:"Links to UAE heritage and culture",                  els:["2.2.2","4.2.3"]},
  {code:"world",         label:"Understanding of other world cultures",              els:["2.2.3"]},
  {code:"community",     label:"Community involvement or social responsibility",     els:["2.3.1"]},
  {code:"enterprise",    label:"Enterprise, innovation or entrepreneurship",         els:["2.3.2","4.2.2"]},
  {code:"environment",   label:"Environmental awareness or sustainability",          els:["2.3.3"]},
  {code:"crosscurric",   label:"Cross-curricular links",                             els:["4.1.4"]},
  {code:"enhance",       label:"Curriculum enhancement (trips, visitors, projects)", els:["4.2.2"]},
  {code:"adapted",       label:"Curriculum adapted for different groups",            els:["4.2.1"]},
  {code:"healthy",       label:"Safe and healthy lifestyles promoted",               els:["5.1.5","2.1.4"]},
  {code:"send",          label:"Effective support for students of determination",   els:["5.2.4"]},
  {code:"gifted",        label:"Challenge for gifted and talented students",         els:["5.2.4"]},
  {code:"relationships", label:"Positive staff–student relationships",               els:["5.2.1","2.1.3"]}
];
function alsoSeenHtml(selected, attr){ // attr: extra data attribute string for the buttons
  return '<div class="also">' + ALSO_SEEN.map(a => `<button type="button" class="alsob" ${attr} data-also="${a.code}" aria-pressed="${(selected||[]).includes(a.code)}">${esc(a.label)}</button>`).join("") + "</div>";
}
// Which school phase a class belongs to ("Grade 3A" → the phase containing "Grade 3")
function gradeKey(s){ return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function phaseOf(gradeClass, phases){
  const g = gradeKey(gradeClass);
  for (const p of phases || []) for (const gr of p.grades || []) {
    const k = gradeKey(gr);
    if (k && g.startsWith(k) && !/[0-9]/.test(g.charAt(k.length))) return p.id;
  }
  return null;
}

// The founders now appear on Nestopia's landing page, so GrowNest no longer shows its own Founders section or menu link
(function () {
  const hide = () => { const f = document.getElementById("founders"); if (f) f.remove(); document.querySelectorAll('a[href$="#founders"]').forEach(a => a.remove()); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hide); else hide();
})();
