# RugbyTrack - Arquitectura y Seguridad

Este documento describe la arquitectura técnica, la distribución por módulos y las medidas de seguridad implementadas en RugbyTrack (Fase 4).

## Stack Tecnológico

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts (para gráficos y mapas de calor).
- **Backend:** Node.js (custom server `server.ts` con Next.js integrado), Prisma ORM, Socket.io acoplado con `@socket.io/redis-adapter`.
- **Bases de Datos:** PostgreSQL (con extensión `pgvector` para embeddings), MongoDB (vía Mongoose para logs de entrenamiento flexibles), Redis (para Pub/Sub y estado de sesiones en tiempo real).
- **Inteligencia Artificial:** Gemini text-embedding-004 (usado para búsquedas de similitud semántica y generación de vectores).
- **Autenticación:** NextAuth v5 (soporta GitHub OAuth y Credenciales clásicas con Argon2).
- **Infraestructura:** Docker Compose (orquestando db, redis, mongo), Nginx (Reverse proxy y terminación SSL), desplegado sobre Oracle Cloud ARM64.

---

## Arquitectura por Módulo

| Módulo | Tecnología / Herramienta | Responsabilidad Principal |
|--------|--------------------------|---------------------------|
| **Auth & Roles** | NextAuth v5, Argon2, Next.js Middleware | Proveer sesión segura mediante tokens JWT/Cookies, hashing de contraseñas y derivación de roles (COACH/PLAYER). |
| **Teams & Events** | Prisma (PostgreSQL), REST API | Gestión CRUD de plantillas, asignación de números y posiciones, programación de eventos (partidos/entrenamientos) y generación de links de invitación únicos. |
| **Live Attendance** | Socket.io, Redis, Prisma | Control de asistencia en tiempo real mediante namespaces dinámicos (`session:{eventId}`). Maneja el check-in síncrono sin recargar clientes. |
| **RPE & Analytics** | PostgreSQL, Recharts, Prisma Aggregation | Cálculo y visualización de la carga de entrenamiento (ACWR). Permite a los coaches detectar sobreentrenamiento usando mapas de calor y alertas. |
| **Semantic Similarity** | `pgvector`, Gemini Embeddings | Generar y almacenar embeddings vectoriales basados en estadísticas de los jugadores para buscar similitud y reemplazos ideales (Cosine Similarity query). |
| **Polls (Encuestas)** | Prisma, Socket.io (`team:{teamId}`) | Creación de encuestas por los coaches y votación en tiempo real por los jugadores con barras de progreso animadas. |
| **Proposals** | Prisma, Socket.io (`team:{teamId}`) | Permite a los jugadores proponer actividades (upvoting) y a los coaches aprobarlas/rechazarlas, autogenerando un `Event` tras la aprobación. |

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
  - `CRON_SECRET`
  - `NEXT_PUBLIC_WS_URL`
  - `RESEND_API_KEY`
  - `GEMINI_API_KEY`
- **CORS:** El servidor de Socket.io restringe los orígenes al valor especificado en `NEXT_PUBLIC_APP_URL`.
- **Restricciones de Base de Datos:** Uso de `@@unique` constraints en Prisma (ej. `[eventId, userId]`, `[pollOptionId, userId]`) previniendo duplicidad, doble check-in y votos duplicados.
- **Aislamiento Multi-Tenant:** Toda consulta en la API filtra los recursos asociándolos explícitamente al `teamId` del usuario actual.
- **Conexión Interna:** Las bases de datos (PostgreSQL, Mongo, Redis) solo son accesibles internamente mediante la red de Docker (`rugbytrack_net`).
- **HTTPS:** La aplicación se sirve mediante HTTPS utilizando Nginx como reverse proxy para encriptar la transmisión de datos.

---

## Diagrama de Flujo del Sistema

```text
       [ Cliente (Navegador) ]
                  |
             (HTTPS/WSS)
                  |
         [ Nginx Proxy ]
                  |
                  +--------------------------------+
                  |                                |
         (Peticiones HTTP)                   (WebSockets)
                  |                                |
        [ Next.js App (REST APIs/SSR) ]   [ Custom Server (Socket.io) ]
                  |                                |
                  |                                +--- [ Redis (Pub/Sub + Adapter) ]
                  |                                |
                  +--------------------------------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
    [ PostgreSQL/Prisma ]    [ MongoDB ]    [ External APIs (Gemini/Resend) ]
      (Relacional, pgvector)   (Training logs)

```
