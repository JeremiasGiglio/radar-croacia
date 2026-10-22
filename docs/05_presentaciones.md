# Presentaciones y textos listos

## A. IV Encuentro IMIN: resumen (vence el 21/10/2026) · Jira ZL-39
- **Formulario:** https://croacialatam.com.hr/iv-encuentro-internacional/
- **Eje:** 25, Migración de retorno (alternativa: 24, Comunidades diaspóricas virtuales).
- **Participa como:** Descendiente de croata + Otro (desarrollador de software).
- **Institución (opcional):** «Zustro Labs / Ateneo Croata de Rosario» si Camila lo confirma antes del 21/10; si no, «Zustro Labs».
- **Título:** Radar Croacia: un mapa digital de oportunidades oficiales para descendientes croatas en Sudamérica.
- **Palabras clave:** diáspora croata; migración de retorno; acceso a la información; herramientas digitales; inteligencia artificial.

**Resumen (293 palabras, actualizado el 15/10/2026):**
Croacia viene ampliando sus políticas hacia la diáspora: ciudadanía por origen, residencia para descendientes, becas de lengua, ayudas al retorno y programas municipales de integración. Sin embargo, de los 11.054 sudamericanos que obtuvieron la ciudadanía entre 2020 y agosto de 2024, solo 342 viven en Croacia, y en el censo digital de la diáspora de 2022 muchos participantes pidieron más información y mejor comunicación. Esa información existe, pero está dispersa en decenas de sitios de ministerios, condados y municipios, casi siempre en croata, y sin distinguir qué corresponde a cada situación (sin ciudadanía, con residencia de diáspora o con ciudadanía).

Esta ponencia presenta Radar Croacia, una herramienta gratuita y de código abierto desarrollada por Zustro Labs con el Ateneo Croata de Rosario como socio, que reúne en un mapa interactivo, en español, las oportunidades oficiales para descendientes: becas, cursos, trámites, ayudas para emprender y programas locales. Cada ficha indica quién la otorga, monto, plazo y si aplica según la situación de quien consulta, con enlace a la fuente oficial. Un proceso automatizado revisa a diario seis fuentes oficiales; la inteligencia artificial redacta borradores en español que una persona verifica antes de publicarlos, y un asistente conversacional responde consultas solo con información verificada.

El proyecto nace de la experiencia del autor como descendiente de un emigrante de Plomin (Istria) que tramita su ciudadanía y prepara su retorno. Se expone la plataforma en funcionamiento y se discuten tres cuestiones: la brecha entre las políticas de retorno y el acceso efectivo a la información, los riesgos de automatizar contenidos sensibles y los controles que impiden publicar montos o plazos ausentes en la fuente, y la sostenibilidad de iniciativas digitales comunitarias. Finalmente, se propone articularla con guías de retorno, medios en español y asociaciones de la región.

## B. 9.º Encuentro de Córdoba (5–8/11/2026)
**Presentación de 30 segundos:**
> Soy Jeremías Giglio, de Rosario, descendiente de Jakov Žustović, de Plomin. Soy QA senior y trabajo con IA en Zustro Labs: hacemos IA que funciona porque está testeada. Con el Ateneo Croata como socio armamos Radar Croacia: todas las oportunidades oficiales de Croacia para descendientes, en español y según tu situación, con un robot que revisa las fuentes todos los días y un asistente al que le podés preguntar. Una persona revisa todo antes de publicar. En marzo me mudo a Rijeka con la residencia de diáspora.

**Demo de 3 minutos:**
1. Elegir un perfil: "Vivo en Argentina, sin ciudadanía".
2. El mapa muestra lo que te sirve.
3. Abrir una ficha.
4. Cambiar el perfil a "residencia en Croacia": todo se reordena.
5. «Preguntale al Radar»: «Vivo en Rosario y quiero estudiar croata, ¿qué hay?» → responde con las fichas y ofrece WhatsApp.
6. Mostrar el PR diario del robot: la IA propone el borrador en castellano y una persona aprueba.
7. Mostrar los evals: la IA no inventa montos (caso HZZ) y no se deja engañar (caso de inyección).
8. Cierre: QR a la web + "dejá tu mail si estás pensando en volver".

**Kit:**
- volante en castellano y croata con QR;
- **modo offline:** `prototype/radar-offline.html`, un solo archivo que se abre con doble clic, sin internet, con todas las fichas (sin el chat con IA). Se regenera con `npm run offline` y el test falla si quedó viejo. Llevarlo en el celular y en un pendrive;
- **video de respaldo:** el promo del Radar (60 s) en castellano, inglés y croata, con los subtítulos en la imagen y en `.srt`/`.vtt` (`media/Radar_Croacia_promo_{es,en,hr}_v1.mp4`, ZL-91, ZL-94 y ZL-97). Muestra el mapa, la web con «abiertas a todos» y una ficha con su fuente, el chat con una respuesta real, el WhatsApp con PERSONA y el robot diario. Las fuentes del video están en la Mac (`Zustro Labs/landing/fuentes/promos/`);
- tarjetas;
- pedir **certificado de asistencia**.

**Preguntas para el MDU y la Oficina** (sin pedir favores por la postulación):
- ¿Cuándo sale el fondo para asociaciones 2027?
- ¿Cuánto tarda hoy la Potvrda?
- Vivienda del art. 44 en Primorje-Gorski kotar.
- ¿La beca de croata es compatible con un obrt?
- ¿Cuándo sale la resolución de 2026 y qué esperan del informe final?
