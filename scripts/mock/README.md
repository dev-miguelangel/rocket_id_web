# Datos de prueba (mock)

Usuarios **ficticios** para probar Cordada (búsqueda por correo o rocketId, perfiles, insignias de verificación).
Se crean y eliminan con Firebase Admin SDK.

## Trazabilidad

Todo lo que crean estos scripts es fácil de identificar y purgar:

| Marca | Dónde |
|---|---|
| Campo `_mock: { isMock: true, seed, createdAt }` | Cada documento creado |
| `uid` con prefijo `mock_` | `users/mock_*`, `publicProfiles/mock_*` |
| Correos `@rocketid.test` (dominio reservado, RFC 2606) | Índice de correo |
| Registro de cada ruta creada | `_mock/registry` |
| Etiqueta "🧪 Perfil de prueba" | Tarjeta de perfil en la app |

Las instituciones verificadoras también son ficticias (las de `src/features/courses/mockCourses.ts`).

## Requisito: clave de cuenta de servicio (una vez)

1. Firebase Console → ⚙️ Configuración del proyecto → **Cuentas de servicio** → **Generar nueva clave privada**.
2. Guarda el archivo en `~/.config/rocketid/service-account.json` (**fuera del repositorio**).
   O define `GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/la/clave.json`.

> La clave da acceso total al proyecto. Nunca la subas a git (`.gitignore` ya bloquea `*service-account*.json`).

## Comandos

```bash
npm run mock:seed -- --yes    # crea los usuarios mock (idempotente: no duplica)
npm run mock:list             # lista rocketIds y correos mock
npm run mock:purge -- --yes   # elimina TODO lo mock
```

Sin `--yes` los scripts no tocan producción. Con `FIRESTORE_EMULATOR_HOST` definido apuntan al emulador.

## Qué elimina `mock:purge`

1. Cada ruta listada en `_mock/registry`.
2. Cualquier documento con `_mock.isMock == true` en `rocketIds`, `publicProfiles`, `emailIndex` y `users` (respaldo si el registro faltara).
3. `users/mock_*/private/verifications`.
4. Referencias a usuarios mock en la cordada de personas reales (`users/*/contacts/mock_*`).
5. El propio registro.

## Antes de abrir la app a usuarios reales

- [ ] `npm run mock:purge -- --yes`
- [ ] Reemplazar `src/features/courses/mockCourses.ts` por la colección `courses` (y quitar el aviso "Cursos de demostración").
- [ ] Revisar postulaciones de prueba en `applications` (las de cursos `demo-*`).
- [ ] Borrar la verificación manual de prueba en `users/{tu uid}/private/verifications` (certificación "Test").
