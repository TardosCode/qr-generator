/* ============================================================
   QR Stúdió – application logic
   - Builds the QR payload string from the active type/form
   - Renders it with qr-code-styling (vendored, no CDN)
   - Handles styling, logo, downloads and clipboard copy
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- DOM helpers ---------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const tabs = $$(".type-tab");
  const forms = $$(".qr-form");
  const canvasEl = $("#qr-canvas");
  const emptyMsg = $("#qr-empty");
  const styleBody = $(".style-body");
  const toastEl = $("#toast");

  const dlButtons = {
    png: $("#dl-png"),
    svg: $("#dl-svg"),
    jpg: $("#dl-jpg"),
  };
  const copyBtn = $("#copy-png");
  const logoInput = $('input[name="logo"]');
  const removeLogoBtn = $("#remove-logo");

  let activeType = "url";
  let logoDataUrl = null;
  let qrCode = null;
  let hasContent = false;

  /* ---------------- value escaping ---------------- */

  // WiFi & MECARD style: escape \ ; , : "
  const escWifi = (s) => String(s).replace(/([\\;,:"])/g, "\\$1");

  // vCard 3.0 text values: escape \ ; , and newlines
  const escVCard = (s) =>
    String(s)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  // iCalendar text values: escape \ ; , and newlines
  const escICal = (s) =>
    String(s)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  const enc = (s) => encodeURIComponent(String(s));

  // "2026-06-23T10:30" -> "20260623T103000" (floating local time)
  function toICalDate(local) {
    if (!local) return "";
    // local is YYYY-MM-DDTHH:mm (optionally :ss)
    const digits = local.replace(/[-:]/g, "").replace("T", "T");
    // ensure seconds present: date(8) + 'T' + time
    const [d, t = ""] = digits.split("T");
    const time = (t + "000000").slice(0, 6);
    return d + "T" + time;
  }

  /* ---------------- payload builders ---------------- */

  const builders = {
    url(f) {
      let v = (f.url.value || "").trim();
      if (!v || v === "https://" || v === "http://") return "";
      // Prepend https:// unless the value already carries a scheme.
      // The 2nd test allows schemeless schemes (mailto:, tel:, geo:) but the
      // (?!\d) guard keeps "host:port" (e.g. localhost:8080) from being
      // mistaken for a scheme and left as a broken link.
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && !/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v)) {
        v = "https://" + v;
      }
      return v;
    },

    text(f) {
      return (f.text.value || "").trim();
    },

    email(f) {
      const to = (f.to.value || "").trim();
      const subject = (f.subject.value || "").trim();
      const body = (f.body.value || "").trim();
      if (!to && !subject && !body) return "";
      const params = [];
      if (subject) params.push("subject=" + enc(subject));
      if (body) params.push("body=" + enc(body));
      return "mailto:" + to + (params.length ? "?" + params.join("&") : "");
    },

    phone(f) {
      const v = (f.phone.value || "").trim();
      return v ? "tel:" + v.replace(/[^\d+]/g, "") : "";
    },

    sms(f) {
      const num = (f.number.value || "").trim().replace(/[^\d+]/g, "");
      const msg = (f.message.value || "").trim();
      if (!num && !msg) return "";
      // SMSTO is the most widely supported scheme across QR readers
      return "SMSTO:" + num + (msg ? ":" + msg : "");
    },

    wifi(f) {
      const ssid = (f.ssid.value || "").trim();
      if (!ssid) return "";
      const enc_ = f.encryption.value;
      const pass = f.password.value || "";
      const hidden = f.hidden.checked;
      let out = "WIFI:T:" + (enc_ === "nopass" ? "nopass" : enc_) + ";S:" + escWifi(ssid) + ";";
      if (enc_ !== "nopass") out += "P:" + escWifi(pass) + ";";
      if (hidden) out += "H:true;";
      out += ";";
      return out;
    },

    vcard(f) {
      const first = (f.firstName.value || "").trim();
      const last = (f.lastName.value || "").trim();
      const phone = (f.phone.value || "").trim();
      const email = (f.email.value || "").trim();
      const org = (f.org.value || "").trim();
      const title = (f.title.value || "").trim();
      const url = (f.url.value || "").trim();
      const address = (f.address.value || "").trim();
      const note = (f.note.value || "").trim();

      if (!(first || last || phone || email || org)) return "";

      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      lines.push("N:" + escVCard(last) + ";" + escVCard(first) + ";;;");
      lines.push("FN:" + escVCard((first + " " + last).trim()));
      if (org) lines.push("ORG:" + escVCard(org));
      if (title) lines.push("TITLE:" + escVCard(title));
      if (phone) lines.push("TEL;TYPE=CELL:" + phone);
      if (email) lines.push("EMAIL;TYPE=INTERNET:" + email);
      if (url) lines.push("URL:" + url);
      if (address) lines.push("ADR;TYPE=HOME:;;" + escVCard(address) + ";;;;");
      if (note) lines.push("NOTE:" + escVCard(note));
      lines.push("END:VCARD");
      return lines.join("\n");
    },

    geo(f) {
      const lat = (f.lat.value || "").trim();
      const lng = (f.lng.value || "").trim();
      if (!lat || !lng) return "";
      return "geo:" + lat + "," + lng;
    },

    event(f) {
      const title = (f.title.value || "").trim();
      const location = (f.location.value || "").trim();
      const start = toICalDate(f.start.value);
      const end = toICalDate(f.end.value);
      const desc = (f.description.value || "").trim();
      if (!title && !start) return "";

      const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT"];
      if (title) lines.push("SUMMARY:" + escICal(title));
      if (location) lines.push("LOCATION:" + escICal(location));
      if (start) lines.push("DTSTART:" + start);
      if (end) lines.push("DTEND:" + end);
      if (desc) lines.push("DESCRIPTION:" + escICal(desc));
      lines.push("END:VEVENT", "END:VCALENDAR");
      return lines.join("\n");
    },

    whatsapp(f) {
      const num = (f.number.value || "").trim().replace(/[^\d]/g, "");
      const msg = (f.message.value || "").trim();
      if (!num) return "";
      return "https://wa.me/" + num + (msg ? "?text=" + enc(msg) : "");
    },
  };

  /* ---------------- read current data ---------------- */
  function currentData() {
    const form = $(`.qr-form[data-form="${activeType}"]`);
    if (!form || !builders[activeType]) return "";
    try {
      return builders[activeType](form.elements);
    } catch (err) {
      console.error("Payload build error:", err);
      return "";
    }
  }

  /* ---------------- read current style options ---------------- */
  function styleOptions() {
    const v = (name) => {
      const el = styleBody.querySelector(`[name="${name}"]`);
      return el ? el.value : "";
    };
    const checked = (name) => {
      const el = styleBody.querySelector(`[name="${name}"]`);
      return el ? el.checked : false;
    };

    const size = Math.min(2000, Math.max(120, parseInt(v("size"), 10) || 320));
    const transparent = checked("transparent");

    return {
      width: size,
      height: size,
      data: " ",
      margin: 8,
      qrOptions: { errorCorrectionLevel: v("ecc") || "Q" },
      dotsOptions: { color: v("dotColor") || "#222222", type: v("dotStyle") || "rounded" },
      backgroundOptions: { color: transparent ? "rgba(0,0,0,0)" : v("bgColor") || "#ffffff" },
      cornersSquareOptions: { color: v("dotColor") || "#222222", type: v("cornerStyle") || "extra-rounded" },
      cornersDotOptions: { color: v("dotColor") || "#222222" },
      image: logoDataUrl || undefined,
      imageOptions: { crossOrigin: "anonymous", margin: 6, imageSize: 0.35, hideBackgroundDots: true },
    };
  }

  /* ---------------- render ---------------- */
  function render() {
    const data = currentData();
    hasContent = !!data;

    if (!hasContent) {
      emptyMsg.style.display = "";
      canvasEl.innerHTML = "";
      qrCode = null;
      setDownloads(false);
      return;
    }

    emptyMsg.style.display = "none";
    setDownloads(true);

    const opts = styleOptions();
    opts.data = data;

    if (!qrCode) {
      qrCode = new QRCodeStyling(opts);
      canvasEl.innerHTML = "";
      qrCode.append(canvasEl);
    } else {
      qrCode.update(opts);
    }
  }

  function setDownloads(on) {
    Object.values(dlButtons).forEach((b) => (b.disabled = !on));
    copyBtn.disabled = !on;
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  /* ---------------- downloads ---------------- */
  function download(ext) {
    if (!qrCode) return;
    const name = "qr-" + activeType;
    qrCode.download({ name, extension: ext }).catch((e) => {
      console.error(e);
      toast("A letöltés nem sikerült.");
    });
  }

  async function copyPng() {
    if (!qrCode) return;
    try {
      const blob = await qrCode.getRawData("png");
      if (!blob) throw new Error("no blob");
      if (!navigator.clipboard || !window.ClipboardItem) {
        toast("A böngésző nem támogatja a vágólapra másolást.");
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast("QR kód a vágólapra másolva ✓");
    } catch (e) {
      console.error(e);
      toast("A másolás nem sikerült (próbáld a letöltést).");
    }
  }

  /* ---------------- tabs ---------------- */
  function activateTab(type) {
    activeType = type;
    tabs.forEach((t) => {
      const on = t.dataset.type === type;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    forms.forEach((fm) => fm.classList.toggle("is-active", fm.dataset.form === type));
    // start fresh so styling re-applies cleanly
    qrCode = null;
    canvasEl.innerHTML = "";
    render();
  }

  /* ---------------- logo ---------------- */
  function handleLogo(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Csak képfájl tölthető fel logónak.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      logoDataUrl = reader.result;
      removeLogoBtn.hidden = false;
      qrCode = null;
      canvasEl.innerHTML = "";
      render();
    };
    reader.readAsDataURL(file);
  }

  /* ---------------- theme ---------------- */
  function initTheme() {
    const toggle = $("#theme-toggle");
    const icon = $(".theme-icon", toggle);
    const stored = localStorage.getItem("qr-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersDark ? "dark" : "light");
    apply(theme);

    toggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(next);
      localStorage.setItem("qr-theme", next);
    });

    function apply(t) {
      document.documentElement.setAttribute("data-theme", t);
      icon.textContent = t === "dark" ? "☀️" : "🌙";
    }
  }

  /* ---------------- wire up ---------------- */
  function init() {
    if (typeof QRCodeStyling === "undefined") {
      emptyMsg.textContent = "A QR-könyvtár nem töltött be. Frissítsd az oldalt.";
      return;
    }

    initTheme();

    tabs.forEach((t) => t.addEventListener("click", () => activateTab(t.dataset.type)));

    // any input in the data forms triggers a re-render
    $(".forms").addEventListener("input", render);
    // style changes re-render too
    styleBody.addEventListener("input", (e) => {
      if (e.target.name === "logo") return; // handled separately
      render();
    });

    dlButtons.png.addEventListener("click", () => download("png"));
    dlButtons.svg.addEventListener("click", () => download("svg"));
    dlButtons.jpg.addEventListener("click", () => download("jpeg"));
    copyBtn.addEventListener("click", copyPng);

    logoInput.addEventListener("change", (e) => handleLogo(e.target.files[0]));
    removeLogoBtn.addEventListener("click", () => {
      logoDataUrl = null;
      logoInput.value = "";
      removeLogoBtn.hidden = true;
      qrCode = null;
      canvasEl.innerHTML = "";
      render();
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
