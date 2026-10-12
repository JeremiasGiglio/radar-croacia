/* Radar Croacia — lógica de la página. Los datos son texto no confiable: todo pasa por esc(). */
"use strict";
function esc(x) {
  return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function safeUrl(u) {
  return /^https:\/\//.test(u || "") ? esc(u) : "#";
}
function fmt(iso) {
  var p = String(iso || "").split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
}
var WA_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';
function waNumber(C) {
  var n = String((C && C.whatsapp) || "").replace(/\D/g, "");
  return n.length >= 8 ? n : "";
}
function currentProfile() {
  var b = document.querySelector('#profile button[aria-pressed="true"]');
  return b ? b.dataset.p : "ar";
}
function waHref(C, text) {
  return "https://wa.me/" + waNumber(C) + "?text=" + encodeURIComponent(text);
}
function waLink(C, DB, d) {
  if (!waNumber(C)) return "";
  var p = currentProfile(),
    perfil = (DB.profiles && DB.profiles[p]) || p;
  var text =
    "Hola, vengo del Radar Croacia. Quiero consultar sobre: «" +
    d.t +
    "». Mi situación: " +
    perfil +
    ". (ficha " +
    d.id +
    ")";
  return (
    '<a class="wa" data-wa="' +
    esc(d.id) +
    '" href="' +
    esc(waHref(C, text)) +
    '" target="_blank" rel="noopener" title="' +
    esc(C.nota || "") +
    '">' +
    WA_ICON +
    "Consultar por WhatsApp</a>"
  );
}
function waGeneral(C, DB) {
  var a = document.getElementById("wa-general");
  if (!waNumber(C)) {
    a.hidden = true;
    return;
  }
  var p = currentProfile(),
    perfil = (DB.profiles && DB.profiles[p]) || p;
  a.href = waHref(C, "Hola, vengo del Radar Croacia y tengo una consulta. Mi situación: " + perfil + ".");
  a.innerHTML = WA_ICON + "¿Dudas? Escribinos";
  a.title = C.nota || "";
  a.hidden = false;
}
function renderExtras(DB) {
  var ev = document.getElementById("events");
  ev.innerHTML = (DB.events || [])
    .map(function (e) {
      return (
        "<li><time>" +
        esc(e.date) +
        '</time><span class="t"><b>' +
        esc(e.t) +
        "</b>, " +
        esc(e.where) +
        ". " +
        esc(e.note) +
        ' <a href="' +
        safeUrl(e.src[1]) +
        '" target="_blank" rel="noopener">' +
        esc(e.src[0]) +
        "</a></span></li>"
      );
    })
    .join("");
  document.getElementById("note").textContent = DB.note + " Última revisión: " + fmt(DB.verified_at) + ".";
}

function start(DB, CONTACT) {
  var K = Math.cos((44.5 * Math.PI) / 180),
    SX = 1000 / ((19.8 - 13) * K);
  function P(lon, lat) {
    return [(lon - 13) * K * SX, (46.8 - lat) * SX];
  }

  var CATS = DB.categories;
  var CITIES = [
    ["Zagreb", 15.98, 45.81],
    ["Rijeka", 14.44, 45.33],
    ["Split", 16.44, 43.51],
    ["Osijek", 18.69, 45.55],
    ["Zadar", 15.23, 44.12],
    ["Pula", 13.85, 44.87],
  ];

  var DATA = DB.opportunities;

  var profile = "ar",
    active = {};
  Object.keys(CATS).forEach(function (k) {
    active[k] = true;
  });
  var sel = null;

  function status(d) {
    if (d.deadline) {
      var ms = new Date(d.deadline) - Date.now();
      if (ms < 0) return { cls: "p-next", txt: "Cerrada" };
      var days = Math.ceil(ms / 864e5);
      return {
        cls: days <= 10 ? "p-urg" : "p-open",
        txt: "Cierra en " + days + (days === 1 ? " día" : " días"),
        cd: true,
      };
    }
    return { cls: "p-next", txt: d.next };
  }
  var EL = { ok: ["p-ok", "Te sirve"], cond: ["p-warn", "Con condiciones"], no: ["p-no", "No aplica"] };

  // cities
  var gc = document.getElementById("cities"),
    NS = "http://www.w3.org/2000/svg";
  function el(n, a) {
    var e = document.createElementNS(NS, n);
    for (var k in a) e.setAttribute(k, a[k]);
    return e;
  }
  CITIES.forEach(function (c) {
    var p = P(c[1], c[2]);
    gc.appendChild(el("circle", { cx: p[0], cy: p[1], r: 3.5, class: "cdot" }));
    var dx = c[0] === "Zagreb" ? 44 : c[0] === "Pula" ? -52 : 8,
      dy = c[0] === "Zagreb" ? 28 : c[0] === "Pula" ? 22 : -8;
    var t = el("text", { x: p[0] + dx, y: p[1] + dy, class: "city" });
    t.textContent = c[0];
    gc.appendChild(t);
  });
  var pp = P(14.18, 45.14),
    gp = document.getElementById("plomin");
  gp.setAttribute("class", "plomin");
  gp.appendChild(el("circle", { cx: pp[0], cy: pp[1], r: 13 }));
  var pt = el("text", { x: pp[0] + 18, y: pp[1] + 30 });
  pt.textContent = "Plomin";
  gp.appendChild(pt);

  // legend + chips
  var lg = document.getElementById("legend"),
    cats = document.getElementById("cats");
  Object.keys(CATS).forEach(function (k) {
    var s = document.createElement("span");
    s.innerHTML = '<b style="background:' + CATS[k].c + '"></b>' + CATS[k].n;
    lg.appendChild(s);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.id = "cat-" + k;
    b.setAttribute("aria-pressed", "true");
    b.textContent = CATS[k].n;
    b.onclick = function () {
      active[k] = !active[k];
      b.setAttribute("aria-pressed", active[k]);
      render();
    };
    cats.appendChild(b);
  });
  document.querySelectorAll("#profile button").forEach(function (b) {
    b.onclick = function () {
      profile = b.dataset.p;
      document.querySelectorAll("#profile button").forEach(function (x) {
        x.setAttribute("aria-pressed", x === b);
      });
      render();
    };
  });

  function rank(d) {
    var e = d.el[profile][0],
      ms = d.deadline ? new Date(d.deadline).getTime() - Date.now() : 9e12;
    if (ms < 0) return 4e13 - ms;
    return (e === "ok" ? 0 : e === "cond" ? 1 : 2) * 1e13 + ms;
  }

  function render() {
    var shown = DATA.filter(function (d) {
      return active[d.cat];
    }).sort(function (a, b) {
      return rank(a) - rank(b);
    });
    var useful = shown.filter(function (d) {
      return d.el[profile][0] !== "no";
    }).length;
    document.getElementById("count").textContent = useful + " de " + shown.length + " te sirven";
    // markers
    var gm = document.getElementById("markers");
    gm.innerHTML = "";
    var groups = {};
    shown.forEach(function (d) {
      d.pts.forEach(function (p) {
        var k = p[0].toFixed(2) + "," + p[1].toFixed(2);
        (groups[k] = groups[k] || []).push([d, p]);
      });
    });
    Object.keys(groups).forEach(function (k) {
      var arr = groups[k],
        n = arr.length;
      arr.forEach(function (it, i) {
        var d = it[0],
          p = it[1],
          e = d.el[profile][0],
          col = CATS[d.cat].c,
          xy = P(p[0], p[1]);
        var R = n > 1 ? (n > 4 ? 38 : 28) : 0,
          a = -Math.PI / 2 + (i * 2 * Math.PI) / n,
          x = xy[0] + R * Math.cos(a),
          y = xy[1] + R * Math.sin(a);
        var g = el("g", {
          class: "mk" + (e === "no" ? " dim" : "") + (sel === d.id ? " sel" : ""),
          tabindex: "0",
          role: "button",
          "aria-label": d.t,
        });
        g.appendChild(el("circle", { class: "ring", cx: x, cy: y, r: 16, stroke: col }));
        g.appendChild(el("circle", { class: "core", cx: x, cy: y, r: 10, fill: col }));
        g.onclick = function () {
          pick(d.id, true);
        };
        g.onkeydown = function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            pick(d.id, true);
          }
        };
        gm.appendChild(g);
      });
    });
    // list
    var L = document.getElementById("list");
    L.innerHTML = "";
    shown.forEach(function (d) {
      var st = status(d),
        e = d.el[profile],
        c = document.createElement("article");
      c.className = "card" + (sel === d.id ? " sel" : "");
      c.id = "card-" + d.id;
      c.innerHTML =
        '<div class="top"><span class="cat"><b style="background:' +
        CATS[d.cat].c +
        '"></b>' +
        esc(CATS[d.cat].n) +
        "</span>" +
        '<span class="pill ' +
        st.cls +
        (st.cd ? " cd" : "") +
        '">' +
        esc(st.txt) +
        '</span><span class="pill ' +
        EL[e[0]][0] +
        '">' +
        EL[e[0]][1] +
        "</span></div>" +
        "<h3>" +
        esc(d.t) +
        "</h3>" +
        (d.t_hr ? '<p class="who" lang="hr">' + esc(d.t_hr) + "</p>" : "") +
        '<p class="who">' +
        esc(d.who) +
        "</p><p>" +
        esc(d.what) +
        "</p>" +
        '<dl class="facts"><div><dt>Monto</dt><dd>' +
        esc(d.amount) +
        "</dd></div></dl>" +
        '<p class="why">' +
        esc(e[1]) +
        "</p>" +
        (d.flag ? '<p class="flag">' + esc(d.flag) + "</p>" : "") +
        '<div class="src"><span>Fuente: <a href="' +
        safeUrl(d.src[1]) +
        '" target="_blank" rel="noopener">' +
        esc(d.src[0]) +
        "</a></span><span>Revisado " +
        fmt(d.verified_at || DB.verified_at) +
        "</span>" +
        waLink(CONTACT, DB, d) +
        "</div>";
      c.onclick = function (ev) {
        if (ev.target.tagName !== "A") pick(d.id, false);
      };
      L.appendChild(c);
    });
  }
  function pick(id, scroll) {
    sel = sel === id ? null : id;
    render();
    if (sel && scroll) {
      var c = document.getElementById("card-" + id);
      if (c)
        c.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "nearest",
        });
    }
  }
  render();
  setInterval(render, 60000);
  renderExtras(DB);
  waGeneral(CONTACT, DB);
  document.getElementById("profile").addEventListener("click", function () {
    waGeneral(CONTACT, DB);
  });
}

Promise.all([
  fetch("data/opportunities.json", { cache: "no-cache" }).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }),
  fetch("data/contact.json", { cache: "no-cache" })
    .then(function (r) {
      return r.ok ? r.json() : {};
    })
    .catch(function () {
      return {};
    }),
])
  .then(function (res) {
    start(res[0], res[1]);
  })
  .catch(function (err) {
    document.getElementById("list").innerHTML =
      '<p class="note" role="alert">No se pudieron cargar las oportunidades (' +
      esc(err.message) +
      "). Si abriste el archivo desde tu computadora, usá la versión de <code>prototype/</code> o un servidor local.</p>";
  });
