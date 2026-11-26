// Páginas por tema (ZL-169): cada una junta fichas de una o más categorías, o las que nombran algo en el título.
// Se usan en el build (hubs y sitemap) y en los tests.

export const TEMAS = [
  {
    slug: "becas",
    nombre: "Becas",
    titulo: "Becas para estudiar en Croacia",
    intro:
      "Becas, cupos y ayudas económicas para estudiar croata, una carrera o una maestría en Croacia, con su fuente oficial.",
    incluye: (o) => /\bbecas?\b/i.test(o.t),
  },
  {
    slug: "estudiar",
    nombre: "Estudiar",
    titulo: "Estudiar en Croacia: carreras, cursos y becas",
    intro:
      "Carreras (también en inglés), maestrías, cursos de croata y escuelas de verano en Croacia, explicados en español.",
    incluye: (o) => o.cat === "beca",
  },
  {
    slug: "aprender-croata",
    nombre: "Aprender croata",
    titulo: "Aprender croata: cursos online y presenciales",
    intro: "Cursos de croata online y en Croacia, escuelas de verano y becas para estudiar el idioma.",
    incluye: (o) => o.cat === "beca" && /croata|lengua/i.test(o.t) && !/carrera|STEM|maestr/i.test(o.t),
  },
  {
    slug: "trabajar",
    nombre: "Trabajar",
    titulo: "Trabajar en Croacia: empleo, permisos y formación",
    intro:
      "Bolsas de empleo oficiales, concursos públicos, formación y permisos para trabajar en Croacia, con su fuente oficial.",
    incluye: (o) => o.cat === "trab" || ["dozvola_trabajo", "plava_karta", "nomada_digital"].includes(o.id),
  },
  {
    slug: "tramites",
    nombre: "Ciudadanía y trámites",
    titulo: "Ciudadanía, residencia y trámites en Croacia",
    intro:
      "Ciudadanía croata para descendientes, residencia de diáspora, permisos, OIB y otros trámites, explicados en español.",
    incluye: (o) => o.cat === "res",
  },
  {
    slug: "emprender",
    nombre: "Emprender",
    titulo: "Emprender en Croacia: ayudas y fondos",
    intro: "Ayudas, fondos e incubadoras para abrir un negocio o llevar una idea al mercado en Croacia.",
    incluye: (o) => o.cat === "emp" || /emprend/i.test(o.t),
  },
  {
    slug: "ayudas-locales",
    nombre: "Ayudas locales",
    titulo: "Ayudas de ciudades y regiones de Croacia",
    intro: "Lo que ofrecen municipios y regiones croatas a quienes viven ahí o llegan: becas, pagos y programas.",
    incluye: (o) => o.cat === "loc",
  },
  {
    slug: "proyectos",
    nombre: "Proyectos comunitarios",
    titulo: "Fondos para asociaciones y proyectos de la diáspora croata",
    intro: "Convocatorias para asociaciones, proyectos culturales y comunitarios de la diáspora croata.",
    incluye: (o) => o.cat === "proy",
  },
];

/** Fichas de un tema, en el orden del JSON. */
export const fichasDe = (tema, db) => db.opportunities.filter((o) => tema.incluye(o));

/** Temas a los que pertenece una ficha (para las migas y «más fichas de…»). */
export const temasDe = (o) => TEMAS.filter((t) => t.incluye(o));
