"""Aplica los cambios de docs/04_datos_actualizados_oct2026.md y escribe site/data/opportunities.json."""
import json, pathlib, copy
ROOT = pathlib.Path(__file__).resolve().parents[1]
src = json.loads((ROOT / "prototype/data/opportunities.json").read_text())
d = copy.deepcopy(src)
OLD, NEW = "2026-09-28", "2026-10-10"
ZAG = [15.98, 45.81]; RI = [14.44, 45.33]

d["version"] = NEW
d["verified_at"] = NEW
d["note"] = ("Beta. Fichas revisadas por Jeremías Giglio con fuentes oficiales; falta la revisión del Ateneo. "
             "Los montos y plazos pueden cambiar: la fuente oficial manda.")
d["schema"] = "docs/03_arquitectura.md"

ops = {o["id"]: o for o in d["opportunities"]}
for o in d["opportunities"]:
    o.setdefault("verified_at", OLD)

def upd(i, **kw):
    ops[i].update(kw); ops[i]["verified_at"] = NEW

upd("conv26",
    what="Financia proyectos que fortalecen la identidad, la lengua y los vínculos con Croacia. Pueden presentarse asociaciones y personas. "
         "La edición 2026 estuvo abierta del 7/9 al 7/10; el resultado se espera entre fines de noviembre de 2026 y enero de 2027.",
    next="Próxima edición: septiembre de 2027 (estimado)")
upd("pgz",
    t="Primorje-Gorski kotar: ayuda para negocios nuevos (Mjera 2.7)",
    deadline="2026-10-19T23:59:00+02:00",
    amount="80 % de los gastos, de €1.000 a €8.000 (mínimo €665 por ítem)",
    what="Reintegra gastos de un obrt de hasta 36 meses con sede en la región de Rijeka. Es parte del programa 2026–2029. "
         "Se pide solo por la app SOM y hay una medida por solicitante.",
    flag="Revisar: el texto 2026 ya no dice que el autoempleo cuente como persona empleada.")
upd("rijeka",
    amount="PP: 80 % de €500 a €4.000 · SUIT: 50 % de €300 a €2.700",
    next="En 2025 salió el 10/10 y cerró el 31/10; la de 2026 está sin confirmar",
    what="Dos programas de la ciudad para negocios con sede en Rijeka, que se pueden combinar. Se piden online con firma digital del banco.",
    flag="El tope total al combinar las dos medidas está sin confirmar.")
upd("biram",
    next="Condiciones 2027 en enero (se anunció un \"Biram Hrvatsku 2.0\")")
upd("potpora",
    amount="Hasta €10.000 (€5.000 fijos + €5.000 contra factura) para un pequeño negocio con impuesto fijo (paušalni obrt)")
upd("hmi",
    what=ops["hmi"]["what"] + " Las becas suelen cerrar entre el 17/4 y el 1/6.")

new = [
 {"id": "mdu_ocd", "cat": "proy", "t": "Fondo del MDU para asociaciones de la diáspora",
  "t_hr": "Javni poziv za udruge (povratak, useljavanje i integracija)",
  "who": "Ministerio de Demografía e Inmigración (MDU)", "pts": [ZAG],
  "next": "Próxima edición: julio de 2027 (estimado según 2026)",
  "amount": "€4.000 a €10.000 para proyectos de información (P2); hasta €40.000 en otras líneas",
  "what": "Financia al 100 % y por adelantado proyectos de asociaciones sobre retorno, inmigración e integración. "
          "En 2026 estuvo abierto del 9/7 al 10/8 con €1,2 millones. Incluye asociaciones del exterior, como las de Argentina.",
  "el": {"ar": ["cond", "Lo presenta una asociación (por ejemplo, el Ateneo), no una persona."],
         "cit": ["cond", "Lo presenta una asociación (por ejemplo, el Ateneo), no una persona."],
         "res": ["cond", "Lo presenta una asociación, no una persona."]},
  "src": ["mdu.gov.hr", "https://mdu.gov.hr/javni-pozivi/7595"], "verified_at": NEW},
 {"id": "vivienda44", "cat": "res", "t": "Vivienda del Estado para retornados (art. 44)",
  "t_hr": "Stambeno zbrinjavanje povratnika (čl. 44., NN 151/2025)",
  "who": "Ministerio de Demografía e Inmigración (MDU)", "pts": [ZAG],
  "next": "Todo el año", "amount": "Alquiler de una vivienda del Estado",
  "what": "Los retornados pueden pedir en alquiler una vivienda del Estado. Acepta a quienes tienen la residencia de diáspora (79.a). Se pide al MDU por mail: stambeno@mdu.hr.",
  "el": {"ar": ["cond", "Es para quienes vuelven a vivir en Croacia: consultá al MDU antes de mudarte."],
         "cit": ["cond", "Si volvés a vivir en Croacia."],
         "res": ["ok", "Acepta la residencia de diáspora (79.a)."]},
  "flag": "Faltan los requisitos detallados y el valor del alquiler.",
  "src": ["mdu.gov.hr", "https://mdu.gov.hr/"], "verified_at": NEW},
 {"id": "exencion", "cat": "res", "t": "Cinco años sin impuesto a la renta sobre el sueldo para retornados",
  "who": "Administración tributaria (Porezna uprava)", "pts": [ZAG],
  "next": "Al empezar a trabajar en Croacia", "amount": "100 % del impuesto sobre el sueldo, durante 5 años",
  "what": "Quienes vuelven a vivir y trabajar en Croacia no pagan impuesto a la renta sobre el sueldo durante 5 años. Incluye a quienes tienen la residencia de diáspora (79.a). Solo cubre ingresos por sueldo.",
  "el": {"ar": ["no", "Hay que vivir y trabajar en Croacia."],
         "cit": ["cond", "Si te mudás y trabajás en relación de dependencia en Croacia."],
         "res": ["ok", "Incluye la residencia 79.a; solo sobre el sueldo."]},
  "flag": "Falta enlazar el artículo exacto de la ley.",
  "src": ["porezna-uprava.gov.hr", "https://porezna-uprava.gov.hr/"], "verified_at": NEW},
 {"id": "mdu_diplomas", "cat": "res", "t": "Piloto: el MDU pagó la traducción de títulos universitarios",
  "who": "Ministerio de Demografía e Inmigración (MDU)", "pts": [ZAG],
  "next": "Sin edición 2027 confirmada", "amount": "€25.330 en total para 4 personas (2026)",
  "what": "En 2026 el MDU pagó la traducción de títulos universitarios extranjeros de descendientes, como prueba piloto. Hubo 4 beneficiarios, de Bolivia, Chile y Argentina.",
  "el": {"ar": ["cond", "Fue un piloto: consultá al MDU si se repite."],
         "cit": ["cond", "Fue un piloto: consultá al MDU si se repite."],
         "res": ["cond", "Fue un piloto: consultá al MDU si se repite."]},
  "src": ["mdu.gov.hr", "https://mdu.gov.hr/"], "verified_at": NEW},
]
d["opportunities"].extend(new)
d["events"] = [
 {"date": "05–08/11/2026", "t": "9.º Encuentro de la Diáspora Croata Sudamericana", "where": "Córdoba",
  "note": "Inscripción en credentia.com.ar.", "src": ["diasporacroata.com", "https://diasporacroata.com/"]},
 {"date": "30/11–02/12/2026", "t": "IV Encuentro \"Procesos migratorios entre Croacia y América del Sur\"", "where": "híbrido, con sede en Rosario",
  "note": "Resúmenes hasta el 21/10/2026.", "src": ["croacialatam.com.hr", "https://croacialatam.com.hr/iv-encuentro-internacional/"]},
]
out = ROOT / "site/data/opportunities.json"
out.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
print("ok", len(d["opportunities"]), "fichas ->", out)
