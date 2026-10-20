# RugbyTrack - Arquitectura y Seguridad

Este documento describe la arquitectura técnica, la distribución por módulos y las medidas de seguridad implementadas en RugbyTrack (Fase 4).

## Stack Tecnológico

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts (para gráficos y mapas de calor).
- **Backend:** Next.js (App Router, `output: "standalone"`), Prisma ORM. Sin servidor propio ni WebSockets: la UI se mantiene al día con `router.refresh()`.
- **Bases de Datos:** PostgreSQL (con extensión `pgvector` para embeddings), MongoDB (vía Mongoose para logs de entrenamiento flexibles), Redis (rate limit y presupuesto de emails).
- **Inteligencia Artificial:** Gemini text-embedding-004 (usado para búsquedas de similitud semántica y generación de vectores).
- **Autenticación:** NextAuth v5 (soporta GitHub OAuth y Credenciales clásicas con Argon2).
- **Infraestructura:** Docker Compose (orquestando db, redis, mongo), Nginx (Reverse proxy y terminación SSL), desplegado sobre Oracle Cloud ARM64.

---

## Arquitectura por Módulo

| Módulo | Tecnología / Herramienta | Responsabilidad Principal |
|--------|--------------------------|---------------------------|
| **Auth & Roles** | NextAuth v5, Argon2, Next.js Middleware | Proveer sesión segura mediante tokens JWT/Cookies, hashing de contraseñas y derivación de roles (COACH/PLAYER). |
| **Teams & Events** | Prisma (PostgreSQL), REST API | Gestión CRUD de plantillas, asignación de números y posiciones, programación de eventos (partidos/entrenamientos) y generación de links de invitación únicos. |
| **Attendance** | Prisma, REST API | El RSVP del jugador (`status`, solo mientras `isRsvpOpen`) y la marca del coach (`checkedIn`) se guardan por separado; las reglas viven en `src/lib/attendance.ts`. El check-in es solo del coach, desde `/events/[id]/attendance`; el panel se refresca tras cada marca y cada 15 s con la pestaña visible. |
| **RPE & Analytics** | PostgreSQL, Recharts, Prisma Aggregation | Cálculo y visualización de la carga de entrenamiento (ACWR). Permite a los coaches detectar sobreentrenamiento usando mapas de calor y alertas. |
| **Semantic Similarity** | `pgvector`, Gemini Embeddings | Generar y almacenar embeddings vectoriales basados en estadísticas de los jugadores para buscar similitud y reemplazos ideales (Cosine Similarity query). |
| **Polls (Encuestas)** | Prisma, REST API | Creación de encuestas por los coaches y votación por los jugadores; los resultados se refrescan tras votar y cada 15 s con la pestaña visible. |
| **Proposals** | Prisma, REST API | Permite a los jugadores proponer actividades (upvoting) y a los coaches aprobarlas/rechazarlas, autogenerando un `Event` tras la aprobación. |

---

## Seguridad Implementada

- **Auth Guards:** Redirecciones HTTP 307 a `/login` si no hay sesión activa usando `NextAuth` middleware y validaciones exhaustivas de sesión en cada Server Component.
- **Autorización y Roles:** Diferenciación estricta entre `COACH` y `PLAYER`. Todas las mutaciones de equipo validan previamente la existencia de la membresía (`teamId` y `userId`) previniendo IDOR.
- **Validación de Inputs:** Se implementa validación de payloads en endpoints REST usando `zod`.
- **Gestión de Secretos (.env.local):** Los secretos no están versionados en el repositorio. Variables configuradas:
  - `DATABASE_URL`
  - `MONGODB_URI`
  - `REDIS_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `AUTH_TRUST_HOST`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `NEXT_PUBLIC_APP_URL`
  - `LOG_LEVEL`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DB`
  - `MONGO_USER`
  - `MONGO_PASSWORD`
  - `MONGO_DB`
  - `REDIS_PASSWORD`
  - `RESEND_API_KEY`
  - `GEMINI_API_KEY`
- **Restricciones de Base de Datos:** Uso de `@@unique` constraints en Prisma (ej. `[eventId, userId]`, `[pollOptionId, userId]`) previniendo duplicidad, doble check-in y votos duplicados.
- **Aislamiento Multi-Tenant:** Toda consulta en la API filtra los recursos asociándolos explícitamente al `teamId` del usuario actual.
- **Conexión Interna:** Las bases de datos (PostgreSQL, Mongo, Redis) solo son accesibles internamente mediante la red de Docker (`rugbytrack_net`).
- **HTTPS:** La aplicación se sirve mediante HTTPS utilizando Nginx como reverse proxy para encriptar la transmisión de datos.

---

## Diagrama de Flujo del Sistema

```text
       [ Cliente (Navegador) ]
                  |
              (HTTPS)
                  |
         [ Nginx Proxy ]
                  |
        [ Next.js App (REST APIs/SSR) ]
                  |
              +-------------------+-------------------+
              |                   |                   |
    [ PostgreSQL/Prisma ]    [ MongoDB ]    [ External APIs (Gemini/Resend) ]
      (Relacional, pgvector)   (Training logs)

```
