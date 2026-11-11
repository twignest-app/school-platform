// GrowNest · English / العربية switch (public pages)
(function(){
  function apply(l){
    var h = document.documentElement; h.lang = l; h.dir = l === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-ar]").forEach(function(el){ if (el.dataset.en == null) el.dataset.en = el.textContent; el.textContent = l === "ar" ? el.dataset.ar : el.dataset.en; });
    document.querySelectorAll("[data-ph-ar]").forEach(function(el){ if (el.dataset.phEn == null) el.dataset.phEn = el.getAttribute("placeholder") || ""; el.setAttribute("placeholder", l === "ar" ? el.dataset.phAr : el.dataset.phEn); });
    var tt = document.querySelector("meta[name=title-ar]"); if (tt) { if (!tt.dataset.en) tt.dataset.en = document.title; document.title = l === "ar" ? tt.content : tt.dataset.en; }
    document.querySelectorAll(".langsw").forEach(function(b){ b.textContent = l === "ar" ? "English" : "العربية"; b.setAttribute("lang", l === "ar" ? "en" : "ar"); b.setAttribute("aria-label", l === "ar" ? "Switch to English" : "التبديل إلى العربية"); });
  }
  window.gnLang = function(){ try { return localStorage.getItem("gn_lang") || "en"; } catch (e) { return "en"; } };
  window.t = function(en, ar){ return document.documentElement.lang === "ar" && ar ? ar : en; };
  document.addEventListener("click", function(e){ var b = e.target.closest(".langsw"); if (!b) return; e.preventDefault();
    var l = gnLang() === "ar" ? "en" : "ar"; try { localStorage.setItem("gn_lang", l); } catch (x) {} apply(l); });
  apply(gnLang());
})();
