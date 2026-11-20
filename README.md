# rocketId

PWA mobile-first con login de Google (Firebase Auth) y datos en Firestore. Es 100% cliente, sin backend, y se despliega en Vercel Hobby.

**Stack:** Vite, React 19, TypeScript, Tailwind 4, React Router, Firebase y vite-plugin-pwa.

## Desarrollo local

```bash
cp .env.example .env.local   # completar con la config web de Firebase
npm install
npm run dev
```

## Configurar Firebase (plan Spark, gratis)

1. Crear el proyecto en https://console.firebase.google.com.
2. Ir a **Authentication > Método de acceso** y activar **Google**.
3. Ir a **Firestore Database**, crear la base en modo producción y pegar en la pestaña **Reglas** el contenido de `firestore.rules`.
4. Ir a **Configuración del proyecto > Tus apps**, agregar una app **Web** y copiar sus valores a `.env.local`.
5. En **Authentication > Configuración > Dominios autorizados**, agregar el dominio de Vercel (por ejemplo `rocketid.vercel.app`).

## Deploy en Vercel

1. En `vercel.json`, reemplazar `FIREBASE_PROJECT_ID` por el ID real del proyecto.
2. Importar el repo en Vercel. El framework se detecta solo como Vite.
3. Cargar las variables `VITE_FIREBASE_*` en el proyecto de Vercel. En producción, **`VITE_FIREBASE_AUTH_DOMAIN` debe ser el dominio de Vercel**, no `*.firebaseapp.com`.
4. En Google Cloud Console, ir a **APIs y servicios > Credenciales > cliente OAuth "Web client (auto created by Google Service)"** y agregar en *URIs de redirección autorizados*: `https://<tu-dominio>/__/auth/handler`.

Los pasos 3 y 4, junto con el rewrite de `/__/auth/*` en `vercel.json`, hacen que el login funcione en iOS Safari y en la PWA instalada, que bloquean las cookies de terceros.

## Estructura

```
src/                         app de deportistas (móvil)
apps/formadores/             app de formadores (PWA de escritorio)
shared/                      código compartido por ambas apps: firebase, tipos (cursos, certificaciones, formadores), tokens de estilo, URLs
shared/firebase.ts           init de Auth + Firestore (caché offline); src/lib/firebase.ts lo reexporta
src/features/auth/           AuthProvider, guards de rutas, LoginPage, perfil en Firestore
src/features/dashboard/      Layout (top bar + bottom nav), Inicio, Mis datos, Eventos
src/components/              Logo, Splash, aviso de actualización PWA
firestore.rules              cada usuario solo accede a users/{suUid}
```

## App de formadores (`apps/formadores`)

PWA de escritorio para que los formadores publiquen cursos, gestionen postulaciones y verifiquen certificaciones. Usa el mismo proyecto Firebase y las mismas dependencias del `package.json` raíz.

```bash
npm run dev:formadores       # http://localhost:5174 (usa el mismo .env.local)
npm run build:formadores     # genera apps/formadores/dist
```

**Deploy (segundo proyecto de Vercel, mismo repositorio):**

1. En Vercel, **Add New → Project** e importar este mismo repositorio. Nombre del proyecto: `rocketid-formadores`, para obtener `rocketid-formadores.vercel.app`.
2. En **Root Directory**, elegir `apps/formadores` y dejar activado *Include files outside the root directory*. Los comandos de instalación y build ya están en `apps/formadores/vercel.json`.
3. Cargar las mismas variables `VITE_FIREBASE_*`, pero con **`VITE_FIREBASE_AUTH_DOMAIN=rocketid-formadores.vercel.app`**. Opcional: `VITE_APP_URL` y `VITE_FORMADORES_URL`, si cambian las direcciones.
4. En Firebase, **Authentication → Configuración → Dominios autorizados**: agregar `rocketid-formadores.vercel.app`.
5. En Google Cloud, en el cliente OAuth web: agregar `https://rocketid-formadores.vercel.app/__/auth/handler`.

`apps/formadores/vercel.json` solo compila esta app cuando cambian `apps/formadores/`, `shared/` o las dependencias.

## Probar con emuladores (sin tocar producción)

```bash
npx --prefix tests/rules firebase emulators:start --only auth,firestore --project demo-rocketid
VITE_FIREBASE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-rocketid VITE_FIREBASE_AUTH_DOMAIN=localhost npm run dev:formadores
VITE_FIREBASE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-rocketid VITE_FIREBASE_AUTH_DOMAIN=localhost npm run dev -- --port 5180
```

Con `VITE_FIREBASE_EMULATORS=true` (solo en `npm run dev`), ambas apps usan los emuladores de Auth (puerto 9099) y Firestore (8089), con las reglas de `firestore.rules`. El login de Google abre una cuenta ficticia del emulador.

## Datos de prueba

Usuarios ficticios para probar Cordada: ver [`scripts/mock/README.md`](scripts/mock/README.md).

```bash
npm run mock:seed -- --yes    # crear
npm run mock:purge -- --yes   # eliminar todo lo mock
```
