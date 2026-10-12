"""Genera site/index.html a partir de prototype/index.html: los datos salen de site/data/opportunities.json."""
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[1]
s = (ROOT / "prototype/index.html").read_text()

def must(old, new, count=1):
    global s
    assert s.count(old) >= 1, f"no encontré: {old[:60]}"
    s = s.replace(old, new, count)

# --- head ---
must('<!doctype html><html><head><meta charset=utf8>',
     '<!doctype html><html lang="es"><head><meta charset="utf-8">'
     '<title>Radar Croacia · Oportunidades oficiales para descendientes de croatas</title>'
     '<meta name="description" content="Becas, cursos, residencia de diáspora y ayudas de Croacia para descendientes de croatas, en español y filtradas según tu situación.">'
     '<meta property="og:title" content="Radar Croacia"><meta property="og:description" content="Oportunidades oficiales de Croacia para descendientes, en español y según tu situación.">'
     '<meta property="og:type" content="website"><meta name="theme-color" content="#1D5F8A">')
must('<body>\n<title>Radar Croacia</title>\n', '<body>\n')

# --- textos honestos para una URL pública ---
must('Ateneo Croata de Rosario · maqueta', 'Ateneo Croata de Rosario · beta')
must('<h2>Cómo funciona</h2>', '<h2>Cómo va a funcionar</h2>')
must('<p class="note">Cada ficha lleva el enlace a la fuente oficial y la fecha de revisión.',
     '<p class="note"><b>En construcción:</b> hoy las fichas se cargan y revisan a mano; el monitoreo automático llega en noviembre.</p>\n      <p class="note">Cada ficha lleva el enlace a la fuente oficial y la fecha de revisión.')

# eventos y pie salen del JSON
s = re.sub(r'(<h2>Eventos en Sudamérica</h2>\s*<ul class="feed")>.*?</ul>', r'\1 id="events"></ul>', s, flags=re.S)
s = re.sub(r'<footer>.*?</footer>',
           '<footer>\n    <span id="note"></span>\n    <span>Proyecto comunitario de Jeremías Giglio con el Ateneo Croata de Rosario. '
           'Es información, no asesoramiento legal. Código abierto: <a href="https://github.com/JeremiasGiglio/radar-croacia">GitHub</a>.</span>\n  </footer>',
           s, flags=re.S)

# --- script: datos desde el JSON ---
a = s.index('<script>'); b = s.index('</script>', a)
js = s[a + len('<script>'):b]
js = js.replace('(function(){', 'function start(DB){', 1)
js = re.sub(r'var CATS=\{.*?\n  \};', 'var CATS=DB.categories;', js, count=1, flags=re.S)
js = re.sub(r'// el: ok \| cond \| no.*?\n  var DATA=\[.*?\n  \];', 'var DATA=DB.opportunities;', js, count=1, flags=re.S)
assert 'var DATA=DB.opportunities;' in js and 'var CATS=DB.categories;' in js
js = js.replace("render();\n  setInterval(render,60000);\n})();",
 "render();\n  setInterval(render,60000);\n  renderExtras(DB);\n}")
# escapar texto de los datos (más adelante entran fichas generadas por IA)
card_old = js[js.index("c.innerHTML='<div class=\"top\">"):js.index("c.onclick=")]
card_new = ("c.innerHTML='<div class=\"top\"><span class=\"cat\"><b style=\"background:'+CATS[d.cat].c+'\"></b>'+esc(CATS[d.cat].n)+'</span>'+\n"
 "        '<span class=\"pill '+st.cls+(st.cd?' cd':'')+'\">'+esc(st.txt)+'</span><span class=\"pill '+EL[e[0]][0]+'\">'+EL[e[0]][1]+'</span></div>'+\n"
 "        '<h3>'+esc(d.t)+'</h3>'+(d.t_hr?'<p class=\"who\" lang=\"hr\">'+esc(d.t_hr)+'</p>':'')+'<p class=\"who\">'+esc(d.who)+'</p><p>'+esc(d.what)+'</p>'+\n"
 "        '<dl class=\"facts\"><div><dt>Monto</dt><dd>'+esc(d.amount)+'</dd></div></dl>'+\n"
 "        '<p class=\"why\">'+esc(e[1])+'</p>'+\n"
 "        (d.flag?'<p class=\"flag\">'+esc(d.flag)+'</p>':'')+\n"
 "        '<div class=\"src\"><span>Fuente: <a href=\"'+safeUrl(d.src[1])+'\" target=\"_blank\" rel=\"noopener\">'+esc(d.src[0])+'</a></span><span>Revisado '+fmt(d.verified_at||DB.verified_at)+'</span></div>';\n      ")
js = js.replace(card_old, card_new)
helpers = r'''
function esc(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function safeUrl(u){return /^https:\/\//.test(u||"")?esc(u):"#";}
function fmt(iso){var p=String(iso||"").split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:"";}
function renderExtras(DB){
  var ev=document.getElementById("events");
  ev.innerHTML=(DB.events||[]).map(function(e){return '<li><time>'+esc(e.date)+'</time><span class="t"><b>'+esc(e.t)+'</b>, '+esc(e.where)+'. '+esc(e.note)+' <a href="'+safeUrl(e.src[1])+'" target="_blank" rel="noopener">'+esc(e.src[0])+'</a></span></li>';}).join("");
  document.getElementById("note").textContent=DB.note+" Última revisión: "+fmt(DB.verified_at)+".";
}
'''
loader = r'''
fetch("data/opportunities.json",{cache:"no-cache"})
  .then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
  .then(start)
  .catch(function(err){
    document.getElementById("list").innerHTML='<p class="note" role="alert">No se pudieron cargar las oportunidades ('+esc(err.message)+'). Si abriste el archivo desde tu computadora, usá la versión de <code>prototype/</code> o un servidor local.</p>';
  });
'''
old_rank = 'function rank(d){var e=d.el[profile][0];return (e==="ok"?0:e==="cond"?1:2)*1e13+(d.deadline?new Date(d.deadline).getTime()-Date.now():9e12);}'
assert old_rank in js
js = js.replace(old_rank, 'function rank(d){var e=d.el[profile][0], ms=d.deadline?new Date(d.deadline).getTime()-Date.now():9e12; if(ms<0) return 4e13-ms; return (e==="ok"?0:e==="cond"?1:2)*1e13+ms;}')
s = s[:a] + '<script>' + helpers + js + loader + s[b:]
(ROOT / "site/index.html").write_text(s)
print("ok", len(s), "bytes")
