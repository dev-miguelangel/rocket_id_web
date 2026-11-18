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
src/lib/firebase.ts          init de Auth + Firestore (caché offline)
src/features/auth/           AuthProvider, guards de rutas, LoginPage, perfil en Firestore
src/features/dashboard/      Layout (top bar + bottom nav), Inicio, Mis datos, Eventos
src/components/              Logo, Splash, aviso de actualización PWA
firestore.rules              cada usuario solo accede a users/{suUid}
```
