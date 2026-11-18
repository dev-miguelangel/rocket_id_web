# Pruebas de reglas de Firestore

Verifican `firestore.rules` contra el emulador de Firestore. Cada suite cubre una parte de la app:

| Suite | Qué garantiza |
|---|---|
| `rocketid` | rocketId único, con formato válido e inmutable |
| `public-profile` | Perfil público legible uno a uno (no listable), índice de correo solo propio y verificado, verificaciones de solo lectura, cordada privada, datos privados protegidos (también sin sesión) |
| `search` | Búsqueda aproximada: solo perfiles `searchable`, máximo 10 por consulta |
| `events` | Crear (público exige aceptar responsabilidades), invitar, confirmar con consentimiento y leer fichas de emergencia **solo** tras notificar al participante, con acceso que vence |
| `events-edit` | Solo el organizador edita; no se puede cambiar el organizador ni volver público sin aceptar |
| `notifications` | Organizador → participantes y participante → organizador; sin suplantación ni tipos inventados; lotes de 15 |
| `mock-scripts` | `scripts/mock`: seed idempotente, búsqueda con reglas reales y purga completa sin tocar datos reales |

## Requisitos

- Java 11+ (lo usa el emulador de Firestore).
- Las dependencias se instalan solas en `tests/rules/node_modules` (aisladas de la app: `@firebase/rules-unit-testing` exige firebase 12 y la app usa firebase 13).

## Uso

```bash
npm run test:rules              # todas las suites (muestra solo lo que falla)
npm run test:rules -- -v        # todos los casos
npm run test:rules -- events    # solo las suites cuyo nombre contiene "events"
```

Las pruebas corren en un proyecto de demostración (`demo-rocketid`) dentro del emulador: **nunca tocan producción**.

> Cada vez que cambies `firestore.rules`, corre `npm run test:rules` antes de publicar.
