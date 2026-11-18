// Personas FICTICIAS para pruebas. Instituciones verificadoras también ficticias
// (las mismas de src/features/courses/mockCourses.ts), para no atribuir verificaciones a organismos reales.

const cert = (id, category, name, issuer, year, expiresAt, status, verifiedBy = null) => ({
  id,
  category,
  name,
  issuer,
  year,
  expiresAt,
  status,
  verifiedBy,
})

export const MOCK_USERS = [
  {
    slug: 'camila_rojas',
    displayName: 'Camila Rojas Fuentes',
    email: 'camila.rojas',
    certs: [
      cert('m-cr-1', 'first_aid', 'WFR (Wilderness First Responder)', 'Patagonia Outdoor Medicine', '2025', '2028-03', 'active', 'Patagonia Outdoor Medicine'),
      cert('m-cr-2', 'guiding', 'Guía de montaña', 'Escuela Andina de Montaña', '2022', '', 'active', 'Escuela Andina de Montaña'),
      cert('m-cr-3', 'rescue', 'Rescate en avalanchas Nivel 1', 'Escuela Andina de Montaña', '2024', '2027-07', 'active'),
    ],
  },
  {
    slug: 'matias_soto',
    displayName: 'Matías Soto Pérez',
    email: 'matias.soto',
    certs: [
      cert('m-ms-1', 'technical', 'Iniciación a la escalada', 'Club Alpino Cordillera', '2023', '', 'active'),
      cert('m-ms-2', 'technical', 'Escalada deportiva', 'Club Alpino Cordillera', '2024', '', 'active'),
      cert('m-ms-3', 'first_aid', 'RCP básico', 'Cruz Roja', '2021', '2023-06', 'expired'),
    ],
  },
  {
    slug: 'valentina_munoz',
    displayName: 'Valentina Muñoz Díaz',
    email: 'valentina.munoz',
    certs: [
      cert('m-vm-1', 'technical', 'Kayak de río', 'Kayak Sur Pucón', '2024', '', 'active', 'Kayak Sur Pucón'),
      cert('m-vm-2', 'rescue', 'Rescate en aguas blancas', 'Kayak Sur Pucón', '2025', '2028-01', 'active', 'Kayak Sur Pucón'),
      cert('m-vm-3', 'first_aid', 'WFA (Wilderness First Aid)', 'Escuela Andina de Montaña', '2025', '2027-05', 'active'),
    ],
  },
  {
    slug: 'benjamin_araya',
    displayName: 'Benjamín Araya Castro',
    email: 'benjamin.araya',
    hasCertifications: 'no',
    certs: [],
  },
  {
    slug: 'fernanda_contreras',
    displayName: 'Fernanda Contreras Silva',
    email: 'fernanda.contreras',
    certs: [
      cert('m-fc-1', 'navigation', 'Lectura de mapas y brújula', 'Club Alpino Cordillera', '2023', '', 'active'),
      cert('m-fc-2', 'navigation', 'Meteorología de montaña', 'Escuela Andina de Montaña', '2024', '', 'active', 'Escuela Andina de Montaña'),
      cert('m-fc-3', 'ethics', 'No Deje Rastro (Leave No Trace)', 'Red Outdoor Responsable', '2022', '', 'active'),
    ],
  },
  {
    slug: 'tomas_espinoza',
    displayName: 'Tomás Espinoza Vidal',
    email: 'tomas.espinoza',
    certs: [
      cert('m-te-1', 'first_aid', 'WFR (Wilderness First Responder)', 'Patagonia Outdoor Medicine', '', '', 'in_progress'),
      cert('m-te-2', 'technical', 'Curso básico de montaña', 'Club Alpino Cordillera', '2024', '', 'active'),
    ],
  },
  {
    slug: 'isidora_reyes',
    displayName: 'Isidora Reyes Morales',
    email: 'isidora.reyes',
    certs: [
      cert('m-ir-1', 'technical', 'Buceo Open Water', 'Centro de Buceo Pacífico', '2023', '', 'active'),
      cert('m-ir-2', 'first_aid', 'RCP básico', 'Cruz Roja', '2025', '2027-02', 'active'),
    ],
  },
  {
    slug: 'joaquin_herrera',
    displayName: 'Joaquín Herrera Bravo',
    email: 'joaquin.herrera',
    hasCertifications: '',
    certs: [],
  },
]
