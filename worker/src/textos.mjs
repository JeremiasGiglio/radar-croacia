// Textos fijos del bot de WhatsApp en cada idioma (ZL-78): castellano, croata, inglés y portugués.
// La IA responde en el idioma elegido; estos son los mensajes que no pasan por la IA.
// Las traducciones al croata las revisa una persona nativa (Ivan o Camila) antes de Córdoba.

export const IDIOMAS = ["es", "hr", "en", "pt"];
export const NOMBRE_IDIOMA = { es: "Español", hr: "Hrvatski", en: "English", pt: "Português" };

/** Para el prompt: en qué idioma tiene que responder la IA. */
export const IDIOMA_PROMPT = {
  es: "castellano rioplatense",
  hr: "croata estándar (hrvatski), con trato de «ti»",
  en: "inglés claro y simple",
  pt: "portugués de Brasil",
};

/** Primer mensaje: lista para elegir idioma (Meta: botón de hasta 20 caracteres, filas de hasta 24). */
export const SALUDO_IDIOMA = [
  "¡Hola! Soy el asistente automático del Radar Croacia.",
  "Bok! Ja sam automatski asistent Radara Croacia.",
  "Hi! I'm the Radar Croacia automated assistant.",
  "Olá! Sou o assistente automático do Radar Croacia.",
  "",
  "Elegí tu idioma · Odaberi jezik · Choose your language · Escolha seu idioma",
].join("\n");
export const BOTON_IDIOMA = "Idioma · Jezik";
export const SECCION_IDIOMA = "Idiomas · Languages";

export const TEXTOS_I18N = {
  es: {
    bienvenida:
      "¡Hola! Soy el asistente del Radar Croacia: te ayudo a encontrar programas, becas y oportunidades en Croacia, para la diáspora sudamericana y para quien quiera ir a Croacia. Respondo con las fichas verificadas del Radar y no doy asesoramiento legal. Para empezar, contame tu situación:",
    aviso:
      "Soy un asistente automático: es información, no asesoramiento legal. Guardamos tu perfil por 90 días, pero no lo que escribís (salvo que pidas hablar con una persona). Escribí PERSONA para hablar con alguien del equipo o BORRAR para que lo olvidemos.",
    perfilPedir: "Contame tu situación:",
    perfilListo: {
      ar: "Listo: vivís en Argentina y no tenés la ciudadanía croata. ¿Qué estás buscando? Por ejemplo becas, cursos de croata o ayudas para mudarte.",
      cit: "Listo: vivís en Argentina y tenés la ciudadanía croata. ¿Qué estás buscando? Por ejemplo becas, trabajo o ayudas para mudarte.",
      res: "Listo: vivís en Croacia con residencia de diáspora. ¿Qué estás buscando? Por ejemplo ayudas para emprender, cursos o trámites.",
    },
    botones: ["Sin ciudadanía", "Con ciudadanía", "Vivo en Croacia"],
    idiomaCambiado: "Listo, seguimos en castellano. ¿En qué te ayudo?",
    personaSinMemoria: "Listo, le avisamos al equipo y te va a responder una persona en cuanto pueda.",
    personaMail:
      "Para hablar con una persona del equipo, escribinos a contact@zustrolabs.com contando tu consulta y te respondemos. Mientras tanto, acá sigo para lo que necesites del Radar.",
    persona:
      "Listo, le avisamos al equipo y te va a responder una persona en cuanto pueda. Escribí acá tu consulta: para que el equipo la lea, guardamos lo que escribas desde ahora por 30 días (BORRAR lo borra antes). Mientras tanto, el asistente no contesta en esta charla.",
    borrado:
      "Listo, borramos lo que teníamos de vos (tu perfil, el estado y los mensajes guardados para el equipo). Si volvés a escribir, empezamos de cero.",
    soloTexto: "Por ahora solo puedo leer mensajes de texto. Escribime tu pregunta, por favor.",
    falla: "El asistente no está disponible en este momento. Escribí PERSONA y te responde alguien del equipo.",
    derivar: "Si querés que lo vea una persona del equipo, escribí PERSONA.",
    devuelta: "Listo, te vuelve a atender el asistente del Radar. Si necesitás una persona de nuevo, escribí PERSONA.",
    fuente: "Fuente oficial",
    montos: "Para montos exactos, mirá la fuente oficial.",
    sinRespuesta:
      "No tengo una respuesta segura para eso. Si querés que te ayude una persona del equipo, escribí PERSONA.",
    // Chat de la web: no hay PERSONA, se ofrece WhatsApp (ZL-106).
    sinRespuestaWeb:
      "No tengo una respuesta segura para eso. Si querés, escribinos por WhatsApp y te ayuda una persona.",
  },
  hr: {
    bienvenida:
      "Bok! Ja sam asistent Radara Croacia: pomažem ti pronaći programe, stipendije i prilike u Hrvatskoj, za iseljenike iz Južne Amerike i za sve koji žele doći u Hrvatsku. Odgovaram na temelju provjerenih kartica Radara (napisane su na španjolskom, a ja ti ih objašnjavam na hrvatskom) i ne dajem pravne savjete. Za početak, reci mi svoju situaciju:",
    aviso:
      "Ja sam automatski asistent: ovo su informacije, a ne pravni savjet. Tvoj profil čuvamo 90 dana, ali ne i ono što pišeš (osim ako zatražiš razgovor s osobom). Napiši OSOBA za razgovor s nekim iz tima ili OBRIŠI da te zaboravimo.",
    perfilPedir: "Reci mi svoju situaciju:",
    perfilListo: {
      ar: "U redu: živiš izvan Hrvatske i nemaš hrvatsko državljanstvo. Što tražiš? Na primjer stipendije, tečajeve hrvatskog ili pomoć za preseljenje.",
      cit: "U redu: živiš izvan Hrvatske i imaš hrvatsko državljanstvo. Što tražiš? Na primjer stipendije, posao ili pomoć za preseljenje.",
      res: "U redu: živiš u Hrvatskoj s dozvolom boravka. Što tražiš? Na primjer potpore za pokretanje posla, tečajeve ili upravne postupke.",
    },
    botones: ["Bez državljanstva", "S državljanstvom", "Živim u Hrvatskoj"],
    idiomaCambiado: "U redu, nastavljamo na hrvatskom. Kako ti mogu pomoći?",
    personaSinMemoria: "U redu, javili smo timu i netko će ti odgovoriti čim bude mogao.",
    personaMail:
      "Za razgovor s nekim iz tima piši nam na contact@zustrolabs.com i opiši svoje pitanje pa ćemo ti odgovoriti. U međuvremenu sam tu za sve što trebaš o Radaru.",
    persona:
      "U redu, javili smo timu i netko će ti odgovoriti čim bude mogao. Napiši ovdje svoje pitanje: da bi ga tim mogao pročitati, ono što napišeš od sada čuvamo 30 dana (OBRIŠI to briše ranije). U međuvremenu asistent ne odgovara u ovom razgovoru.",
    borrado:
      "Gotovo, obrisali smo ono što smo imali o tebi (profil, stanje razgovora i poruke spremljene za tim). Ako ponovno pišeš, krećemo ispočetka.",
    soloTexto: "Za sada mogu čitati samo tekstualne poruke. Molim te, napiši mi svoje pitanje.",
    falla: "Asistent trenutno nije dostupan. Napiši OSOBA i odgovorit će ti netko iz tima.",
    derivar: "Ako želiš da to pogleda netko iz tima, napiši OSOBA.",
    devuelta: "U redu, opet ti odgovara asistent Radara. Ako ponovno trebaš osobu, napiši OSOBA.",
    fuente: "Službeni izvor",
    montos: "Za točne iznose pogledaj službeni izvor.",
    sinRespuesta: "Nemam pouzdan odgovor na to. Ako želiš da ti pomogne netko iz tima, napiši OSOBA.",
    // Chat de la web: no hay PERSONA, se ofrece WhatsApp (ZL-106).
    sinRespuestaWeb: "Nemam pouzdan odgovor na to. Ako želiš, piši nam na WhatsApp i pomoći će ti netko iz tima.",
  },
  en: {
    bienvenida:
      "Hi! I'm the Radar Croacia assistant: I help you find programs, scholarships and opportunities in Croatia, for the South American diaspora and for anyone who wants to go to Croatia. I answer with the Radar's verified cards (they're written in Spanish; I'll explain them in English) and I don't give legal advice. To start, tell me your situation:",
    aviso:
      "I'm an automated assistant: this is information, not legal advice. We keep your profile for 90 days, but not what you write (unless you ask to talk to a person). Write PERSON to talk to someone on the team or DELETE so we forget you.",
    perfilPedir: "Tell me your situation:",
    perfilListo: {
      ar: "Got it: you live outside Croatia and don't have Croatian citizenship. What are you looking for? For example scholarships, Croatian courses or help to move.",
      cit: "Got it: you live outside Croatia and have Croatian citizenship. What are you looking for? For example scholarships, jobs or help to move.",
      res: "Got it: you live in Croatia with a residence permit. What are you looking for? For example grants to start a business, courses or paperwork.",
    },
    botones: ["No citizenship", "Croatian citizen", "I live in Croatia"],
    idiomaCambiado: "Done, we'll continue in English. How can I help?",
    personaSinMemoria: "Done, we've let the team know and a person will reply as soon as they can.",
    personaMail:
      "To talk to someone on the team, email us at contact@zustrolabs.com with your question and we'll get back to you. Meanwhile, I'm here for anything about the Radar.",
    persona:
      "Done, we've let the team know and a person will reply as soon as they can. Write your question here: so the team can read it, we keep what you write from now on for 30 days (DELETE erases it sooner). Meanwhile, the assistant won't reply in this chat.",
    borrado:
      "Done, we deleted what we had about you (your profile, the chat status and any messages saved for the team). If you write again, we start from scratch.",
    soloTexto: "For now I can only read text messages. Please write your question.",
    falla: "The assistant isn't available right now. Write PERSON and someone on the team will reply.",
    derivar: "If you'd like someone on the team to look at it, write PERSON.",
    devuelta: "Done, the Radar assistant is back. If you need a person again, write PERSON.",
    fuente: "Official source",
    montos: "For exact amounts, check the official source.",
    sinRespuesta: "I don't have a reliable answer for that. If you'd like help from someone on the team, write PERSON.",
    // Chat de la web: no hay PERSONA, se ofrece WhatsApp (ZL-106).
    sinRespuestaWeb:
      "I don't have a reliable answer for that. If you like, message us on WhatsApp and a person will help you.",
  },
  pt: {
    bienvenida:
      "Olá! Sou o assistente do Radar Croacia: ajudo você a encontrar programas, bolsas e oportunidades na Croácia, para a diáspora sul-americana e para quem quer ir para a Croácia. Respondo com as fichas verificadas do Radar (estão em espanhol; eu explico em português) e não dou orientação jurídica. Para começar, conte sua situação:",
    aviso:
      "Sou um assistente automático: isto é informação, não orientação jurídica. Guardamos seu perfil por 90 dias, mas não o que você escreve (a menos que peça para falar com uma pessoa). Escreva PESSOA para falar com alguém da equipe ou APAGAR para que a gente esqueça você.",
    perfilPedir: "Conte sua situação:",
    perfilListo: {
      ar: "Certo: você mora fora da Croácia e não tem cidadania croata. O que está procurando? Por exemplo bolsas, cursos de croata ou ajuda para se mudar.",
      cit: "Certo: você mora fora da Croácia e tem cidadania croata. O que está procurando? Por exemplo bolsas, trabalho ou ajuda para se mudar.",
      res: "Certo: você mora na Croácia com autorização de residência. O que está procurando? Por exemplo apoios para abrir um negócio, cursos ou trâmites.",
    },
    botones: ["Sem cidadania", "Com cidadania", "Moro na Croácia"],
    idiomaCambiado: "Pronto, seguimos em português. Como posso ajudar?",
    personaSinMemoria: "Pronto, avisamos a equipe e uma pessoa vai responder assim que puder.",
    personaMail:
      "Para falar com alguém da equipe, escreva para contact@zustrolabs.com contando sua dúvida e respondemos. Enquanto isso, estou aqui para o que precisar do Radar.",
    persona:
      "Pronto, avisamos a equipe e uma pessoa vai responder assim que puder. Escreva aqui sua dúvida: para que a equipe possa ler, guardamos o que você escrever a partir de agora por 30 dias (APAGAR apaga antes). Enquanto isso, o assistente não responde nesta conversa.",
    borrado:
      "Pronto, apagamos o que tínhamos de você (seu perfil, o estado da conversa e as mensagens guardadas para a equipe). Se escrever de novo, começamos do zero.",
    soloTexto: "Por enquanto só consigo ler mensagens de texto. Escreva sua pergunta, por favor.",
    falla: "O assistente não está disponível agora. Escreva PESSOA e alguém da equipe vai responder.",
    derivar: "Se quiser que alguém da equipe veja isso, escreva PESSOA.",
    devuelta: "Pronto, o assistente do Radar volta a atender você. Se precisar de uma pessoa de novo, escreva PESSOA.",
    fuente: "Fonte oficial",
    montos: "Para valores exatos, veja a fonte oficial.",
    sinRespuesta: "Não tenho uma resposta segura para isso. Se quiser ajuda de alguém da equipe, escreva PESSOA.",
    // Chat de la web: no hay PERSONA, se ofrece WhatsApp (ZL-106).
    sinRespuestaWeb:
      "Não tenho uma resposta segura para isso. Se quiser, escreva para nós no WhatsApp e uma pessoa vai te ajudar.",
  },
};

/** Idioma válido o castellano. */
export const idiomaDe = (x) => (IDIOMAS.includes(x) ? x : "es");
export const textos = (idioma) => TEXTOS_I18N[idiomaDe(idioma)];

// Palabras frecuentes de cada idioma, para adivinar en qué escribe la persona en el chat de la web (ZL-101).
// En WhatsApp el idioma lo elige la persona; en la web no hay selector, así que se mira el mensaje.
const PALABRAS = {
  es: "el la los las de del y que qué en un una es soy tengo quiero hay para por con mi me puedo cómo vivo busco algo ayuda estudiar trabajar",
  hr: "je sam i u li za što koje koji ima imam nemam možeš mogu želim trebam nešto kako gdje molim bok hvala posao stipendije studirati raditi hrvatsku hrvatskoj",
  en: "the is are what can you i i'm im have want there for how any my do does is anything recommend scholarships working study work please",
  pt: "você voce não nao tenho quero para morar trabalhar existe há como posso ajuda obrigado eu estou bolsas estudar uma",
};
const LISTAS = Object.fromEntries(Object.entries(PALABRAS).map(([k, v]) => [k, new Set(v.split(" "))]));

/**
 * Idioma del texto: "es", "hr", "en" o "pt"; null si no está claro.
 * Conservador: un idioma que no sea castellano tiene que sumar al menos 2 palabras y más que el castellano.
 */
export function detectarIdioma(texto) {
  const palabras =
    String(texto ?? "")
      .toLowerCase()
      .match(/[a-záéíóúñüãõçâêôàčćđšž']+/g) ?? [];
  if (!palabras.length) return null;
  const puntos = Object.fromEntries(
    Object.entries(LISTAS).map(([k, set]) => [k, new Set(palabras.filter((p) => set.has(p))).size]),
  );
  // Las letras propias del croata cuentan, salvo en nombres de lugares que se escriben igual en castellano.
  if (
    /[čćđšž]/.test(
      String(texto)
        .toLowerCase()
        .replace(/šahovnica|šibenik|žminj|kvarner/g, ""),
    )
  )
    puntos.hr += 1;
  const [mejor, p] = Object.entries(puntos).sort((a, b) => b[1] - a[1])[0];
  if (mejor === "es") return p > 0 ? "es" : null;
  return p >= 2 && p > puntos.es ? mejor : null;
}
