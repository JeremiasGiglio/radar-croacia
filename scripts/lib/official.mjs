// Dominios oficiales (Estado croata, región, ciudad y universidades públicas). Una nota de prensa, una
// universidad privada o un portal privado no cuentan como oficiales (se marcan como «institucion» o «portal»).
export const OFFICIAL_HOSTS = [
  "gov.hr",
  "pgz.hr",
  "rijeka.hr",
  "hzz.hr",
  "matis.hr",
  // Universidades públicas y la agencia estatal de movilidad (ZL-79)
  "uniri.hr",
  "unizg.hr",
  "unist.hr",
  "unios.hr",
  "unizd.hr",
  "unipu.hr",
  "ampeu.hr",
  "studyincroatia.hr",
];

/** true si la URL es https y su dominio es oficial (o un subdominio de uno oficial). */
export function isOfficial(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && OFFICIAL_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

/** true si la URL apunta a un documento o página concreta, no a la portada del sitio. */
export const isSpecific = (url) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") !== "";
  } catch {
    return false;
  }
};
