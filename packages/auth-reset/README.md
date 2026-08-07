# @mivia/auth-reset

Framework-agnostic toolkit para recuperación de contraseña en las apps de mivia.es.

- Sin dependencia de Prisma, Next.js ni frontend concreto.
- Tokens HMAC-SHA256 firmados con expiración (mismo patrón que los tokens RSVP).
- Envío por SMTP (nodemailer), plantilla HTML parametrizable por app.
- La app consumidora aporta persistencia (marcar single-use), rate limiting y rutas.

## API

```ts
import { createResetToken, verifyResetToken, sendResetEmail } from "@mivia/auth-reset";

const token = createResetToken({ email, secret: process.env.AUTH_RESET_SECRET!, expiresInMinutes: 60 });
const check = verifyResetToken({ token, secret: process.env.AUTH_RESET_SECRET! });
// { valid, email, expired, iat, exp }

await sendResetEmail({
  to: email,
  resetUrl: `https://miapp/reset-password/${token}`,
  smtp: { host: "mail.jorgereina.com", port: 587, user: "app@mivia.es", pass: process.env.SMTP_PASS! },
  from: "MiApp <app@mivia.es>",
  appName: "MiApp",
  appLogoUrl: "https://miapp/logo.png",
  primaryColor: "#0f172a",
  expiresInMinutes: 60,
});
```

## Single-use

`verifyResetToken` NO comprueba unicidad. Patrón recomendado: guardar `passwordResetAt` en el usuario y rechazar tokens cuyo `iat < passwordResetAt`.

## Limitación conocida: sesiones activas y strategy `jwt`

En NextAuth v5 con `session.strategy = "jwt"` (patrón por defecto y el que usa RugbyTrack), los JWT están firmados y no se guardan en BD. Por tanto, tras un reset **NO** podemos invalidar sesiones ya emitidas: seguirán siendo válidas hasta su expiración natural. Mitigaciones:

- Si necesitas invalidación inmediata, cambia a `session.strategy = "database"` (requiere adaptador Prisma) y borra las filas de `Session` del usuario dentro del handler de reset.
- O reduce la vida útil del JWT (p. ej. `session.maxAge = 60*60`) para limitar la ventana de riesgo.

Este paquete es agnóstico del storage; la app consumidora decide la estrategia.
