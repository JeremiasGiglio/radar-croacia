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
  return b ? b.dataset.p : null;
}
function waHref(C, text) {
  return "https://wa.me/" + waNumber(C) + "?text=" + encodeURIComponent(text);
}
// La situación solo va en el mensaje si la persona la eligió (ZL-193: la página arranca sin situación).
function situacionTexto(DB) {
  var p = currentProfile();
  return p ? " Mi situación: " + ((DB.profiles && DB.profiles[p]) || p) + "." : "";
}
function waLink(C, DB, d) {
  if (!waNumber(C)) return "";
  var text =
    "Hola, vengo del Radar Croacia. Quiero consultar sobre: «" +
    d.t +
    "»." +
    situacionTexto(DB) +
    " (ficha " +
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
  a.href = waHref(C, "Hola, vengo del Radar Croacia y tengo una consulta." + situacionTexto(DB));
  a.innerHTML = WA_ICON + "¿Dudas? Escribinos";
  a.title = C.nota || "";
  a.hidden = false;
}
function hoyIso() {
  var d = new Date();
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
}
// Eventos que todavía no terminaron (ZL-169): los vencidos se ocultan solos, sin tocar los datos.
function proximosEventos(DB) {
  var hoy = hoyIso();
  return (DB.events || []).filter(function (e) {
    return !e.end || e.end >= hoy;
  });
}
function renderExtras(DB) {
  var ev = document.getElementById("events"),
    lista = proximosEventos(DB);
  ev.innerHTML = lista
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
  var vacio = document.getElementById("events-vacio");
  if (vacio) vacio.hidden = lista.length > 0;
  // Últimas revisiones: salen de la fecha de revisión de cada ficha, no de ejemplos fijos.
  var ul = document.getElementById("ultimas");
  if (ul)
    ul.innerHTML = DB.opportunities
      .slice()
      .sort(function (a, b) {
        return String(b.verified_at || "").localeCompare(String(a.verified_at || ""));
      })
      .slice(0, 5)
      .map(function (o) {
        return (
          "<li><time>" +
          fmt(o.verified_at) +
          '</time><span class="t"><button type="button" class="link" data-ficha="' +
          esc(o.id) +
          '">' +
          esc(o.t) +
          "</button></span></li>"
        );
      })
      .join("");
  // El build ya la escribe con la cantidad de fuentes; si no está (demo sin conexión), va la cantidad de fichas.
  var intro = document.getElementById("intro");
  if (intro && !intro.textContent.trim()) intro.textContent = DB.opportunities.length + " fichas revisadas a mano.";
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
  var OFF = !!window.RADAR_OFFLINE;

  var FUENTES = DB.fuentes || { oficial: "Fuente oficial" };
  var PAGINA = 10; // fichas que se ven de entrada; el resto con «Ver más» (ZL-169)
  var profile = null,
    soloAbiertas = false,
    expanded = {},
    abiertas = {},
    limite = PAGINA,
    active = {};
  Object.keys(CATS).forEach(function (k) {
    active[k] = true;
  });
  var sel = null;
  var celular = matchMedia("(max-width: 860px)");

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

  // En el celular, los filtros y el mapa arrancan plegados para que lo primero que se vea sean las fichas.
  var filtros = document.getElementById("filtros"),
    mapa = document.getElementById("mapa");
  function plegar() {
    filtros.open = !celular.matches;
    mapa.open = !celular.matches;
  }
  plegar();
  if (celular.addEventListener) celular.addEventListener("change", plegar);

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
    // Rijeka y Zagreb tienen el círculo de grupo encima: el nombre va corrido para que no lo tape.
    var dx = c[0] === "Zagreb" ? 44 : c[0] === "Pula" ? -52 : c[0] === "Rijeka" ? 30 : 8,
      dy = c[0] === "Zagreb" ? 28 : c[0] === "Pula" ? 22 : c[0] === "Rijeka" ? -18 : -8;
    var t = el("text", { x: p[0] + dx, y: p[1] + dy, class: "city" });
    t.textContent = c[0];
    gc.appendChild(t);
  });

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
      limite = PAGINA;
      render();
    };
    cats.appendChild(b);
  });
  // Tocar la situación elegida la saca: se vuelve a ver todo, con lo que sirve a cada situación (ZL-193).
  function elegirPerfil(p) {
    profile = p;
    document.querySelectorAll("#profile button").forEach(function (x) {
      x.setAttribute("aria-pressed", String(x.dataset.p === p));
    });
  }
  document.querySelectorAll("#profile button").forEach(function (b) {
    b.onclick = function () {
      elegirPerfil(profile === b.dataset.p ? null : b.dataset.p);
      limite = PAGINA;
      render();
    };
  });
  // Los filtros quedan en la dirección para poder compartirlos: ?perfil=res&temas=beca,trab&sinasc=1
  function leerUrl() {
    var q = new URLSearchParams(location.search);
    if (["ar", "cit", "res"].indexOf(q.get("perfil")) >= 0) elegirPerfil(q.get("perfil"));
    var t = (q.get("temas") || "").split(",").filter(function (k) {
      return CATS[k];
    });
    if (t.length)
      Object.keys(CATS).forEach(function (k) {
        active[k] = t.indexOf(k) >= 0;
        document.getElementById("cat-" + k).setAttribute("aria-pressed", String(active[k]));
      });
    if (q.get("sinasc") === "1") {
      soloAbiertas = true;
      var b = document.getElementById("solo-abiertas");
      if (b) b.setAttribute("aria-pressed", "true");
    }
  }
  function escribirUrl() {
    if (!window.history || !history.replaceState || OFF) return;
    var q = new URLSearchParams(location.search);
    ["perfil", "temas", "sinasc"].forEach(function (k) {
      q.delete(k);
    });
    if (profile) q.set("perfil", profile);
    var on = Object.keys(CATS).filter(function (k) {
      return active[k];
    });
    if (on.length !== Object.keys(CATS).length) q.set("temas", on.join(","));
    if (soloAbiertas) q.set("sinasc", "1");
    var s = q.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s.replace(/%2C/g, ",") : "") + location.hash);
  }

  function rank(d) {
    var e = profile ? d.el[profile][0] : "ok",
      ms = d.deadline ? new Date(d.deadline).getTime() - Date.now() : 9e12;
    if (ms < 0) return 4e13 - ms;
    return (e === "ok" ? 0 : e === "cond" ? 1 : 2) * 1e13 + ms;
  }

  var ab = document.getElementById("solo-abiertas");
  if (ab)
    ab.onclick = function () {
      soloAbiertas = !soloAbiertas;
      ab.setAttribute("aria-pressed", soloAbiertas);
      limite = PAGINA;
      render();
    };
  var mas = document.getElementById("ver-mas");
  mas.onclick = function () {
    var primera = limite;
    limite += 20;
    render();
    var c = document.querySelectorAll("#list article")[primera];
    var t = c && c.querySelector(".card-t");
    if (t) t.focus();
  };

  // Más de MAX_GRUPO fichas en el mismo lugar (Zagreb): un solo círculo con el número; al tocarlo se abre (ZL-81).
  var MAX_GRUPO = 6;
  function cluster(gm, k, xy, n, abierto) {
    var g = el("g", {
      class: "mk cluster" + (abierto ? " open" : ""),
      tabindex: "0",
      role: "button",
      "aria-expanded": String(abierto),
      "aria-label": n + " fichas en este lugar. " + (abierto ? "Tocá para cerrar." : "Tocá para verlas."),
      "data-grupo": k,
    });
    g.appendChild(el("circle", { class: "core", cx: xy[0], cy: xy[1], r: abierto ? 16 : 24 }));
    var t = el("text", { x: xy[0], y: xy[1] + 7, class: "num" });
    t.textContent = abierto ? "×" : String(n);
    g.appendChild(t);
    function toggle() {
      expanded[k] = !expanded[k];
      render();
      var again = document.querySelector('[data-grupo="' + k + '"]');
      if (again) again.focus();
    }
    g.onclick = toggle;
    g.onkeydown = function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggle();
      }
    };
    gm.appendChild(g);
  }

  function resumenFiltros(n) {
    var r = document.getElementById("filtros-res");
    if (!r) return;
    var b = document.getElementById("pf-" + profile),
      on = Object.keys(CATS).filter(function (k) {
        return active[k];
      }).length,
      total = Object.keys(CATS).length;
    r.textContent =
      (b ? b.textContent : "Sin situación elegida") +
      " · " +
      (on === total ? "todos los temas" : on + (on === 1 ? " tema" : " temas")) +
      (soloAbiertas ? " · sin requisito de ascendencia" : "") +
      " · " +
      n +
      (n === 1 ? " ficha" : " fichas");
  }

  // Sin situación elegida, cada ficha dice para quién sirve en las tres (ZL-193).
  function el3(d) {
    return (
      '<ul class="el3">' +
      Object.keys(DB.profiles)
        .map(function (p) {
          var x = d.el[p];
          return (
            '<li><span class="pill ' +
            EL[x[0]][0] +
            '">' +
            EL3[x[0]] +
            "</span><span><b>" +
            esc(DB.profiles[p]) +
            ".</b> " +
            esc(x[1]) +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }
  var EL3 = { ok: "Sirve", cond: "Con condiciones", no: "No aplica" };
  function card(d) {
    var st = status(d),
      e = profile ? d.el[profile] : null,
      abierta = !!abiertas[d.id],
      c = document.createElement("article");
    c.className = "card" + (sel === d.id ? " sel" : "") + (abierta ? " abierta" : "");
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
      "</span>" +
      (e ? '<span class="pill ' + EL[e[0]][0] + '">' + EL[e[0]][1] + "</span>" : "") +
      (d.abierta ? '<span class="pill p-abierta">Abierta a todos</span>' : "") +
      "</div>" +
      '<h3><button type="button" class="card-t" aria-expanded="' +
      abierta +
      '" aria-controls="det-' +
      esc(d.id) +
      '">' +
      esc(d.t) +
      '<span class="card-mas" aria-hidden="true"></span></button></h3>' +
      '<p class="who">' +
      esc(d.who) +
      "</p>" +
      '<div class="card-det" id="det-' +
      esc(d.id) +
      '"' +
      (abierta ? "" : " hidden") +
      ">" +
      (d.t_hr ? '<p class="who" lang="hr">' + esc(d.t_hr) + "</p>" : "") +
      "<p>" +
      esc(d.what) +
      "</p>" +
      '<dl class="facts"><div><dt>Monto</dt><dd>' +
      esc(d.amount) +
      "</dd></div></dl>" +
      (e ? '<p class="why">' + esc(e[1]) + "</p>" : el3(d)) +
      (d.flag ? '<p class="flag">' + esc(d.flag) + "</p>" : "") +
      '<div class="src"><span class="src-tipo src-' +
      esc(d.fuente || "oficial") +
      '">' +
      esc(FUENTES[d.fuente] || "Fuente") +
      ': <a href="' +
      safeUrl(d.src[1]) +
      '" target="_blank" rel="noopener">' +
      esc(d.src[0]) +
      "</a></span><span>Revisado " +
      fmt(d.verified_at || DB.verified_at) +
      "</span></div>" +
      '<div class="acciones">' +
      waLink(CONTACT, DB, d) +
      (OFF ? "" : '<a class="btn" href="f/' + esc(d.id) + '.html">Ficha completa y para compartir</a>') +
      "</div></div>";
    return c;
  }

  function render() {
    var shown = DATA.filter(function (d) {
      return active[d.cat] && (!soloAbiertas || d.abierta === true);
    }).sort(function (a, b) {
      return rank(a) - rank(b);
    });
    // Un solo número (ZL-193): con situación, cuántas le sirven; sin situación, cuántas hay.
    var useful = profile
      ? shown.filter(function (d) {
          return d.el[profile][0] !== "no";
        }).length
      : shown.length;
    document.getElementById("count").textContent = profile
      ? useful + " de " + shown.length + " te sirven"
      : shown.length + (shown.length === 1 ? " ficha" : " fichas") + ". Elegí tu situación para ver cuáles te sirven.";
    escribirUrl();
    resumenFiltros(shown.length);
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
        n = arr.length,
        grande = n > MAX_GRUPO,
        abierto =
          grande &&
          (expanded[k] ||
            arr.some(function (it) {
              return it[0].id === sel;
            }));
      if (grande && !abierto) return cluster(gm, k, P(arr[0][1][0], arr[0][1][1]), n, false);
      arr.forEach(function (it, i) {
        var d = it[0],
          p = it[1],
          e = profile ? d.el[profile][0] : "ok",
          col = CATS[d.cat].c,
          xy = P(p[0], p[1]);
        // Grupo abierto: dos anillos (hasta 9 adentro y el resto afuera) para que no se salga tanto del lugar.
        var anillo = grande && i >= 9 ? 1 : 0,
          enAnillo = grande ? (anillo ? n - 9 : Math.min(n, 9)) : n,
          j = anillo ? i - 9 : i,
          R = n > 1 ? (grande ? (anillo ? 88 : 52) : n > 4 ? 38 : 28) : 0,
          a = -Math.PI / 2 + (anillo ? Math.PI / enAnillo : 0) + (j * 2 * Math.PI) / enAnillo,
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
      if (grande) cluster(gm, k, P(arr[0][1][0], arr[0][1][1]), n, true);
    });
    // list: todas las fichas están en la página (para buscar con Ctrl+F y para los lectores de pantalla al
    // pedir «Ver más»), pero solo las primeras se muestran.
    var idx = sel
      ? shown.findIndex(function (d) {
          return d.id === sel;
        })
      : -1;
    if (idx >= limite) limite = idx + 1;
    var L = document.getElementById("list");
    L.innerHTML = "";
    shown.forEach(function (d, i) {
      var c = card(d);
      if (i >= limite) c.hidden = true;
      L.appendChild(c);
    });
    L.setAttribute("data-render", "js");
    var resto = shown.length - limite;
    mas.hidden = resto <= 0;
    mas.textContent =
      "Ver " + Math.min(resto, 20) + " más · mostrando " + Math.min(limite, shown.length) + " de " + shown.length;
  }
  document.getElementById("list").addEventListener("click", function (ev) {
    if (ev.target.closest("a")) return;
    var c = ev.target.closest("article.card");
    if (!c) return;
    var id = c.id.slice(5);
    // Dentro del detalle se puede seleccionar texto sin que la ficha se cierre.
    if (ev.target.closest(".card-det")) return;
    pick(id, false);
  });
  function pick(id, scroll) {
    if (sel === id) {
      sel = null;
      abiertas[id] = false;
    } else {
      sel = id;
      abiertas[id] = true;
    }
    render();
    var c = document.getElementById("card-" + id);
    if (c && document.activeElement === document.body) {
      var t = c.querySelector(".card-t");
      if (t) t.focus({ preventScroll: true });
    }
    if (sel && scroll && c)
      c.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
      });
  }
  document.getElementById("ultimas").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-ficha]");
    if (!b) return;
    mostrar(b.dataset.ficha);
  });
  // Mostrar una ficha desde afuera (chat, «Últimas revisiones», ?f=…): sin cerrarla si ya estaba abierta.
  function mostrar(id) {
    if (
      !DATA.some(function (d) {
        return d.id === id;
      })
    )
      return;
    if (sel === id) sel = null;
    pick(id, true);
    var c = document.getElementById("card-" + id),
      t = c && c.querySelector(".card-t");
    if (t) t.focus({ preventScroll: true });
  }
  leerUrl();
  render();
  setInterval(render, 60000);
  renderExtras(DB);
  waGeneral(CONTACT, DB);
  document.getElementById("profile").addEventListener("click", function () {
    waGeneral(CONTACT, DB);
  });
  var chat = initChat(CONTACT, DB, mostrar);
  // Links de afuera: /?f=<id> abre esa ficha; /?chat=1 abre el chat (desde las páginas de cada ficha).
  var q = new URLSearchParams(location.search);
  if (q.get("f")) mostrar(q.get("f"));
  if (q.get("chat") === "1" && chat) chat.open();
}

/* ---------- Chat: asistente con IA sobre las fichas verificadas ---------- */
var CHAT_SUGS = [
  "Vivo fuera de Croacia, ¿qué me sirve?",
  "¿Hay becas para estudiar croata?",
  "¿Qué carreras hay en inglés?",
  "¿Cómo es la residencia de diáspora?",
];
function chatApi(C) {
  var u = String((C && C.chat_api) || "");
  return /^https:\/\/[^/]+\/chat$/.test(u) || /^http:\/\/localhost(:\d+)?\/chat$/.test(u) ? u : "";
}
function initChat(C, DB, show) {
  var api = chatApi(C);
  var fab = document.getElementById("chat-open"),
    box = document.getElementById("chat"),
    log = document.getElementById("chat-log"),
    form = document.getElementById("chat-form"),
    input = document.getElementById("chat-input"),
    send = document.getElementById("chat-send"),
    sugs = document.getElementById("chat-sugs");
  if (!api || !fab || !box) return;
  var history = [];
  var busy = false;
  var asked = 0;
  var LARGA = 12; // igual que LIMITES.charlaLarga en worker/src/policy.mjs
  var max = Number(input.getAttribute("maxlength")) || 800;
  var count = document.getElementById("chat-count");
  function updateCount() {
    if (!count) return;
    var n = input.value.length;
    count.textContent = n + "/" + max;
    count.classList.toggle("near", n >= max * 0.9);
  }
  input.addEventListener("input", updateCount);
  fab.hidden = false;

  function open() {
    box.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    if (!log.children.length) {
      bubble(
        "bot",
        "¡Hola! Contame tu situación o qué estás buscando y te digo qué oportunidades del Radar te pueden servir.",
      );
    }
    input.focus();
  }
  function close() {
    box.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    fab.focus();
  }
  fab.onclick = function () {
    box.hidden ? open() : close();
  };
  document.getElementById("chat-close").onclick = close;
  box.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") close();
  });

  function bubble(who, text, extra) {
    var d = document.createElement("div");
    d.className = "msg msg-" + who;
    d.innerHTML = "<p>" + esc(text).replace(/\n/g, "<br>") + "</p>" + (extra || "");
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function fichasHtml(list) {
    if (!list || !list.length) return "";
    return (
      '<div class="msg-fichas">' +
      list
        .map(function (f) {
          return '<button type="button" class="chat-ficha" data-id="' + esc(f.id) + '">' + esc(f.t) + "</button>";
        })
        .join("") +
      "</div>"
    );
  }
  function waHtml(question) {
    if (!waNumber(C)) return "";
    var text =
      "Hola, vengo del chat del Radar Croacia. Mi consulta: «" +
      String(question).slice(0, 300) +
      "»." +
      situacionTexto(DB);
    return (
      '<a class="wa msg-wa" href="' +
      esc(waHref(C, text)) +
      '" target="_blank" rel="noopener">' +
      WA_ICON +
      "Hablar con una persona</a>"
    );
  }
  log.addEventListener("click", function (ev) {
    var b = ev.target.closest(".chat-ficha");
    if (!b) return;
    show(b.dataset.id);
    if (matchMedia("(max-width: 700px)").matches) close();
  });

  sugs.innerHTML = CHAT_SUGS.map(function (s) {
    return '<button type="button" class="chip chat-sug">' + esc(s) + "</button>";
  }).join("");
  sugs.addEventListener("click", function (ev) {
    var b = ev.target.closest(".chat-sug");
    if (b) ask(b.textContent);
  });

  function ask(text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    sugs.hidden = true;
    input.value = "";
    updateCount();
    asked++;
    bubble("user", text);
    history.push({ role: "user", content: text.slice(0, 800) });
    var wait = bubble("bot", "Pensando…");
    wait.classList.add("msg-wait");
    log.setAttribute("aria-busy", "true");
    fetch(api, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-12), perfil: currentProfile() }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j.error || "Error " + r.status);
          return j;
        });
      })
      .then(function (j) {
        wait.remove();
        history.push({ role: "assistant", content: String(j.respuesta || "") });
        bubble("bot", j.respuesta || "", fichasHtml(j.fichas) + (j.derivar_whatsapp ? waHtml(text) : ""));
        if (asked === LARGA) {
          bubble(
            "bot",
            "La charla ya es larga y puedo perder lo que me contaste al principio. Si querés seguir, te conviene hablar con una persona.",
            waHtml(text),
          ).classList.add("msg-note");
        }
      })
      .catch(function (err) {
        wait.remove();
        history.pop();
        var m = bubble(
          "bot",
          err && err.message && !/Failed to fetch|NetworkError|Load failed/.test(err.message)
            ? err.message
            : "No me pude conectar. Revisá tu internet y probá de nuevo.",
          waHtml(text),
        );
        m.classList.add("msg-error");
      })
      .then(function () {
        busy = false;
        send.disabled = false;
        log.removeAttribute("aria-busy");
      });
  }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    ask(input.value);
  });
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      ask(input.value);
    }
  });
  return { open: open };
}

// Demo sin conexión (ZL-41): prototype/radar-offline.html trae los datos adentro y no pide nada a la red.
var OFFLINE = window.RADAR_OFFLINE;
(OFFLINE
  ? Promise.resolve([OFFLINE.db, OFFLINE.contact || {}])
  : Promise.all([
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
)
  .then(function (res) {
    start(res[0], res[1]);
  })
  .catch(function (err) {
    document.getElementById("list").innerHTML =
      '<p class="note" role="alert">No se pudieron cargar las oportunidades (' +
      esc(err.message) +
      "). Si abriste el archivo desde tu computadora, usá <code>prototype/radar-offline.html</code> o un servidor local.</p>";
  });
