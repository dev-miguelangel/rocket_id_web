/** Textos de la landing. Todo en un lugar para editarlos sin tocar el diseño. */

export const HERO = {
  eyebrow: 'Para quienes salen a la montaña, al río y al mar',
  title: 'Tu identidad outdoor, lista para cuando más importa.',
  subtitle:
    'Guarda tu ficha de emergencia, acredita tus cursos y organiza salidas seguras con tu cordada. Todo en una app gratis que abres desde el navegador.',
  primary: 'Crear mi rocketId gratis',
  secondary: 'Ver cómo funciona',
  trust: ['Gratis', 'Sin descargar de una tienda', 'Tu ficha de salud solo la ves tú'],
}

export const PAINS = [
  {
    icon: '💬',
    title: 'La planilla de siempre',
    pain: 'Antes de cada salida alguien pide RUT, contacto de emergencia y alergias por WhatsApp… y todo se pierde en el chat.',
    fix: 'Con rocketId tu ficha ya está lista. La compartes con un toque, solo con quien organiza.',
  },
  {
    icon: '🩹',
    title: '¿Quién sabe primeros auxilios?',
    pain: 'Nadie lo pregunta hasta que hace falta, y en terreno no hay tiempo para averiguarlo.',
    fix: 'rocketId muestra qué formación tiene tu grupo, qué está vigente y qué está verificado.',
  },
  {
    icon: '⏳',
    title: 'El curso que venció',
    pain: 'Tu WFA venció hace meses y no te diste cuenta. Tampoco tu cordada.',
    fix: 'Te avisamos antes de que venza y te sugerimos dónde renovarlo.',
  },
]

export const STEPS = [
  {
    n: 1,
    title: 'Completa tu ficha',
    text: 'Identificación, contacto de emergencia, previsión, grupo sanguíneo, alergias y medicamentos. Una vez, y siempre a mano.',
  },
  {
    n: 2,
    title: 'Arma tu cordada',
    text: 'Busca a tus compañeros por nombre, correo o rocketId, o comparte tu perfil por WhatsApp.',
  },
  {
    n: 3,
    title: 'Sal con tu grupo',
    text: 'Crea la salida, invita a tu cordada y revisa antes de partir que todo el grupo esté preparado.',
  },
]

export const FEATURES = [
  {
    id: 'ficha',
    eyebrow: 'Ficha de emergencia',
    title: 'La información que salva minutos',
    text: 'Contacto de emergencia con botón para llamar, grupo sanguíneo, alergias, condiciones médicas y dónde llevas tus medicamentos en la mochila.',
    bullets: ['Funciona sin señal una vez abierta', 'Solo tú la ves hasta que confirmas una salida', 'Avisa qué datos te faltan'],
  },
  {
    id: 'formacion',
    eyebrow: 'Conocimientos y experiencia',
    title: 'Tus cursos, con respaldo',
    text: 'Registra tus certificaciones de primeros auxilios, rescate, navegación y formación técnica. Las instituciones emisoras pueden verificarlas con una insignia que no se puede falsificar.',
    bullets: ['Vigente, vencido o en curso, siempre claro', 'Aviso antes del vencimiento', 'Perfil público de deportista para compartir'],
  },
  {
    id: 'cordada',
    eyebrow: 'Cordada',
    title: 'Tu grupo de confianza, en un lugar',
    text: 'Encuentra a tus compañeros y mira de un vistazo qué saben hacer. Comparte tu perfil con un enlace y suma gente nueva sin pasar tu número.',
    bullets: ['Búsqueda por nombre, correo o rocketId', 'Tú decides si apareces en búsquedas', 'Perfil sin datos de contacto ni de salud'],
  },
  {
    id: 'eventos',
    eyebrow: 'Eventos',
    title: 'Salidas organizadas, grupos preparados',
    text: 'Crea la salida, define requisitos e invita. Antes de partir, una revisión te dice quién confirmó, quién no tiene la ficha completa y quién no cumple los requisitos.',
    bullets: ['Privados por enlace o públicos', 'Ficha del grupo para el organizador, con aviso al participante', 'Notificaciones de cambios y confirmaciones'],
  },
  {
    id: 'cursos',
    eyebrow: 'Cursos',
    title: 'Fórmate donde más falta hace',
    text: 'Descubre cursos según lo que te vence, lo que piden tus salidas y lo que le falta a tu cordada. Postula compartiendo tus datos solo con tu consentimiento.',
    bullets: ['Recomendaciones con el motivo a la vista', 'La institución te contacta directamente', 'Seguimiento del estado de tu postulación'],
  },
] as const

export const USE_CASES = [
  {
    icon: '🥾',
    who: 'Deportistas',
    title: 'Sales los fines de semana',
    text: 'Trekking, escalada, kayak o nieve. Tu ficha y tu formación viajan contigo, y tu cordada sabe con quién cuenta.',
    points: ['Ficha de emergencia siempre lista', 'Perfil para sumarte a grupos nuevos', 'Avisos de vencimiento de tus cursos'],
  },
  {
    icon: '🧭',
    who: 'Organizadores y clubes',
    title: 'Armas salidas para tu grupo',
    text: 'Deja atrás las planillas y los chats eternos. Invita, define requisitos y revisa que todo esté en orden antes de partir.',
    points: ['Confirmaciones y cupos en un lugar', 'Ficha del grupo en caso de emergencia', 'Requisitos claros para cada salida'],
  },
  {
    icon: '🎓',
    who: 'Guías e instructores',
    title: 'Tu trayectoria, a la vista',
    text: 'Muestra un perfil profesional con tus certificaciones vigentes y verificadas, listo para compartir con clientes y grupos.',
    points: ['Perfil público de deportista', 'Insignias de verificación', 'Publicación de cursos (próximamente)'],
  },
  {
    icon: '🏛️',
    who: 'Instituciones',
    title: 'Formas y acreditas',
    text: 'Verifica las certificaciones que emites y recibe postulaciones a tus cursos con los datos que necesitas, con consentimiento.',
    points: ['Verificación de certificaciones', 'Postulaciones ordenadas', 'Panel para instituciones (próximamente)'],
  },
]

export const STORIES = [
  {
    id: 'alergia',
    scene: 'glaciar',
    tag: 'Ficha de emergencia',
    title: 'La alergia que nadie conocía',
    place: 'Sendero al glaciar El Morado · sábado, 11:40',
    body: [
      'Ignacio empezó a sentirse mal minutos después de una picadura. Daniela, que había organizado la salida, abrió el evento en rocketId y tocó “Ver ficha de emergencia”.',
      'Ahí estaba: alergia severa a picaduras de abeja, EpiPen en el bolsillo superior de la mochila. En dos minutos el autoinyector estaba aplicado y su hermana, su contacto de emergencia, ya había recibido la llamada.',
      'Ignacio bajó caminando. Esa tarde vio la notificación: “Daniela vio tu ficha de emergencia”. Sabía exactamente por qué.',
    ],
    outcome: 'Información crítica en segundos, y transparencia para quien la compartió.',
  },
  {
    id: 'curso',
    scene: 'escalada',
    tag: 'Recomendaciones',
    title: 'El curso que llegó a tiempo',
    place: 'Las Chilcas · un lunes cualquiera',
    body: [
      'Matías llevaba años escalando con el mismo grupo y, sin darse cuenta, su RCP había vencido. Un lunes abrió rocketId y vio el aviso: “RCP básico está vencida”.',
      'Justo abajo había una recomendación con un motivo claro: “Nadie en tu cordada tiene primeros auxilios vigentes”. Postuló al curso en un minuto.',
      'Hoy es el primero al que llaman cuando arman una salida.',
    ],
    outcome: 'Una brecha de seguridad del grupo, detectada antes de que importara.',
  },
  {
    id: 'kayak',
    scene: 'rio',
    tag: 'Eventos',
    title: 'Siete kayaks y una sola lista',
    place: 'Río Trancura, Pucón · domingo',
    body: [
      'Valentina quería sumar gente nueva a su salida de kayak, pero le inquietaba no saber con quién iba. Publicó el evento con un requisito: rescate en aguas blancas.',
      'Antes de salir, la revisión le mostró todo: siete confirmados, dos sin ficha completa y uno sin el requisito. Les escribió a tiempo.',
      'El domingo bajaron el río sabiendo quién podía ayudar a quién.',
    ],
    outcome: 'Un grupo nuevo, preparado y sin caos en el chat.',
  },
  {
    id: 'cordada',
    scene: 'cumbre',
    tag: 'Cordada',
    title: 'Del chat a la cordada',
    place: 'Cerro Provincia, Santiago · su primera cumbre en Chile',
    body: [
      'Tomás se mudó a Santiago sin conocer a nadie que hiciera montaña. En un curso básico conoció a Fernanda y, en vez de pasarle su número, le envió su enlace de rocketId.',
      'Fernanda vio su perfil, con el curso básico aprobado y un WFR en curso, y lo agregó a su cordada. Esa misma semana le llegó la invitación: ascenso al cerro Provincia.',
      'Fue su primera cumbre en Chile, y la primera de muchas con ese grupo.',
    ],
    outcome: 'Confianza desde el primer encuentro, sin compartir datos personales.',
  },
] as const

export const PRIVACY = [
  { icon: '🔒', title: 'Tu ficha de salud es privada', text: 'Nadie la ve: ni otros usuarios ni tu cordada.' },
  { icon: '✍️', title: 'Compartir es tu decisión', text: 'Solo se comparte al confirmar una salida, con tu consentimiento y únicamente con quien organiza.' },
  { icon: '🔔', title: 'Siempre sabrás quién la vio', text: 'Te notificamos cada vez que el organizador abre tu ficha. El acceso vence dos días después del evento.' },
  { icon: '👁️', title: 'Perfil público mínimo', text: 'Nombre, foto, rocketId y formación. Nunca correo, documento, teléfono ni datos de salud.' },
  { icon: '✅', title: 'Verificaciones reales', text: 'Las insignias las otorgan las instituciones emisoras y no se pueden falsificar.' },
]

export const FAQ = [
  {
    q: '¿Cuánto cuesta?',
    a: 'Nada. rocketId es gratis para deportistas y organizadores de salidas.',
  },
  {
    q: '¿Tengo que descargarla de una tienda?',
    a: 'No. Se abre desde el navegador y puedes instalarla en tu pantalla de inicio como cualquier app. En Android toca “Instalar app”; en iPhone, Compartir → “Agregar a pantalla de inicio”.',
  },
  {
    q: '¿Funciona sin señal?',
    a: 'Sí. Lo que ya abriste queda disponible sin conexión, y los cambios se sincronizan cuando vuelve la señal. Abre tu salida antes de partir para tenerla a mano.',
  },
  {
    q: '¿Quién puede ver mis datos de salud?',
    a: 'Solo tú. Cuando confirmas una salida, compartes una copia con quien la organiza, con tu consentimiento. Recibes una notificación cada vez que la abre, y el acceso vence dos días después del evento.',
  },
  {
    q: '¿Cómo se verifica una certificación?',
    a: 'La institución que emitió el curso la valida. Si después cambias el nombre, la institución o las fechas, la insignia desaparece, así que siempre refleja lo que realmente se verificó.',
  },
  {
    q: '¿rocketId reemplaza un curso o a los servicios de emergencia?',
    a: 'No. rocketId te ayuda a estar preparado y a tener la información a mano, pero no reemplaza la formación ni la ayuda profesional. Ante una emergencia en Chile, llama al 131 (SAMU).',
  },
]
