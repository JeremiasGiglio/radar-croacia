# Radar Croacia: ¿suma valor? Investigación del 28/9/2026
*Tres investigaciones en paralelo: qué existe, demanda y financiador, y factibilidad técnica y legal.*

## Veredicto
**Sí suma valor, si se enfoca en lo que nadie hace:**
- juntar las oportunidades nacionales y locales;
- en español;
- **filtradas por la situación del descendiente** (sin ciudadanía / con residencia 79.a / ciudadano);
- en un **mapa**;
- con **alertas cuando cambian las páginas oficiales**.

No conviene competir con las "noticias de Croacia en español": eso ya lo hacen CroLatam y La Voz de Croacia. Es barato (menos de €10/mes), legal y lo puede mantener una sola persona.

## 1. Qué existe
- **CroLatam** (crolatam.com, de la Cámara Argentino Croata, desde abril de 2025): portal en español con newsletter y una sección "Oportunidades en Croacia". Es **periodismo manual**: no tiene filtro de elegibilidad, ni mapa, ni alertas. → **Socio posible**, no rival.
- **La Voz de Croacia** (glashrvatske.hrt.hr/es): noticias diarias en español, con RSS. No lista oportunidades de forma sistemática.
- **Matica** (matis.hr): tiene sección en español, pero no newsletter.
- **Oficina para los Croatas fuera de Croacia:** solo en croata e inglés. Página de convocatorias con RSS no documentado; casi todo es para organizaciones.
- **MDU:** la información para retornados está repartida en páginas sueltas. Publica un **Excel con las medidas demográficas de los 576 municipios** (orientadas a familias), que sirve como fuente de datos.
- **Poticajnik.hr:** el antecedente técnico más parecido. Revisa más de 50 fuentes, tiene alertas, cuenta regresiva de plazos y chequeo de elegibilidad con IA. Pero es **solo para empresas, solo en croata y sin la diáspora**. Prueba que el enfoque funciona en Croacia.
- **Un mapa de incentivos municipales para retornados no existe**, ni oficial ni privado. Ejemplo: en julio de 2026 el MDU dio unos €509.000 a 13 municipios para integrar retornados, y eso solo aparece en notas de prensa.
- Otros: croatas.com, projekthrvatska.com (en croata), Expat in Croatia (en inglés, desactualizado).

## 2. Demanda y financiador
- **Descendientes** (estimaciones de la Oficina): Argentina unos 300.000, Chile 200.000, Perú 196.000; unos 822.000 en total en Sudamérica.
- **Sudamericanos naturalizados entre 2020 y agosto de 2024:** 11.054, de los cuales 5.581 son de Argentina. **Solo 342 viven en Croacia** (≈3 %). → El argumento no puede ser solo "mudarse": hay que apoyarse en las becas, la lengua y el vínculo.
- **Más del 90 % de las becas de idioma del MDU van a sudamericanos** (HRT, mayo de 2026).
- **Censo digital de la diáspora 2022:** muchos pidieron "más información sobre Croacia, mejor comunicación".
- **La Oficina ya financia proyectos digitales:**
  - radio por internet en Punta Arenas: €8.000;
  - digitalización de archivos: €2.000–2.500;
  - una "Guía práctica" de una persona de Córdoba: €1.500.
- **El Ateneo Croata de Rosario recibió €3.500 en 2025** por un proyecto histórico. El Radar no lo pisa: lo complementa.
- En 2025, la categoría B (personas) tuvo 56 aprobados en el 2.º llamado, con una mediana de €3.650.
- La Estrategia Demográfica hasta 2033 no menciona una ventanilla digital de información → **ese hueco lo puede llenar el proyecto**.

## 3. Factibilidad técnica y legal
**Fuentes:**
- Varias webs de gov.hr tienen RSS no documentado (`rss.aspx?ID=`): la Oficina (ID 574) y el MDU (ID 5923).
- **udruge.gov.hr** tiene una base de 3.314 convocatorias filtrable por županija; sirve como registro central.
- Rijeka y Osijek tienen RSS; pgz.hr es WordPress. En total hay unos 3–4 tipos de CMS.
- data.gov.hr tiene API CKAN, pero con pocos datos.
- **Playwright solo hace falta para las webs con JavaScript** (EU fondos, e-Savjetovanja).
- HAMAG bloquea bots (403): se revisa a mano.

**Legal:**
- La ley croata de acceso a la información (ZPPI, que traslada la Directiva 2019/1024) permite reutilizar la información pública, incluso con fines comerciales, en general gratis (arts. 27 y 32).
- Los textos oficiales no tienen derechos de autor (NN 111/21, art. 18).
- La Oficina permite reproducir su contenido citando la fuente.
- **Se enlazan los PDF, no se vuelven a alojar.** Se excluyen los datos personales de las resoluciones. Aviso: "resumen generado con IA y revisado".
- Se revisa robots.txt, con visitas espaciadas y un User-Agent identificable.

**Arquitectura:**
- GitHub Actions corre una vez por día y lee los RSS y las páginas, con Playwright donde haga falta.
- Guarda un JSON versionado en git; el git diff detecta los cambios.
- La IA trabaja solo sobre lo nuevo (unos US$2–4/mes).
- El mapa es estático (Leaflet en GitHub Pages).
- Playwright genera las placas PNG y el PDF del boletín.
- **Costo total: menos de €10/mes.**

**Riesgos:**
- Una web cambia su maquetación → un test por fuente que avise si trae 0 ítems.
- La IA se equivoca → sello de "verificado" + link oficial.
- El mantenimiento crece → pocos adaptadores, uno por tipo de CMS.

**MVP (12 fuentes):** hrvatiizvanrh (RSS), mdu (RSS), udruge.gov.hr, mjere.hzz.hr, eufondovi, hamagbicro, rijeka.hr, osijek.hr, zagreb.hr, split.hr, pgz.hr, data.gov.hr.

## 4. Cómo presentarlo
- **Enfoque:** oportunidades + elegibilidad + mapa + alertas. Las noticias del pueblo de origen quedan como capa emocional para una segunda etapa.
- **CroLatam como aliado:** el Radar le pasa datos verificados y CroLatam los difunde.
- **Ante la Oficina:** presentarlo desde la lengua, la identidad y el vínculo (becas, cursos, retorno), no solo desde "mudarse".
- **Ante el Ateneo:** encaja con el inciso 6 del estatuto (becas, concursos, anuncios). Para los trámites, se deriva a la gestoría.
