# 🏉 RugbyTrack — Plataforma de Gestión Deportiva y Prevención de Lesiones

RugbyTrack es una aplicación web moderna (Next.js 15, TypeScript, Tailwind CSS, PostgreSQL, MongoDB, Redis) diseñada para cuerpos técnicos y jugadores de rugby. Facilita la planificación, la toma de asistencia en tiempo real, el registro de esfuerzo percibido (RPE), la analítica avanzada de prevención de sobreentrenamiento (ACWR) y la búsqueda inteligente de jugadores similares.

---

## 🚀 Características del Showcase (Fase 3)

### 1. 🔍 Búsqueda Semántica de Jugadores (IA + pgvector)
* **Tecnología**: Gemini Embeddings (`text-embedding-004`) + PostgreSQL `pgvector`.
* **Cómo funciona**: Genera un vector denso multidimensional basado en estadísticas históricas de asistencia, posición, y RPE medio de cada jugador. Permite al entrenador buscar perfiles similares mediante cálculo de similitud de coseno (`<=>`) directamente en base de datos.

### 2. 🔴 Dashboard de Asistencia en Tiempo Real (Socket.io)
* **Tecnología**: WebSockets (`Socket.io`) con adaptador Redis para escalabilidad horizontal.
* **Cómo funciona**: Grid interactivo donde los entrenadores ven el estado de asistencia de cada jugador en tiempo real (Confirmado / Pendiente / Rechazado). Se actualiza instantáneamente con animaciones fluidas al marcar check-in sin necesidad de recargar la página.

### 3. 📊 Heatmap de Analytics y Alertas ACWR
* **Tecnología**: Recharts, CSS Grid, PostgreSQL aggregations.
* **Cómo funciona**: Panel de control con un heatmap interactivo que muestra el promedio de RPE semanal de los jugadores durante las últimas 8 semanas. Calcula el **Acute:Chronic Workload Ratio (ACWR)** (carga de la semana vs promedio de últimas 4 semanas), emitiendo alertas visuales de sobreentrenamiento e inflamación si el ratio supera `1.5` (zona de peligro).

---

## 🛠️ Stack Tecnológico Completo

* **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
* **Bases de Datos**:
  * **PostgreSQL** (Datos principales, RPE, asistencia y pgvector)
  * **MongoDB** (Logs de entrenamiento no estructurados)
  * **Redis** (Pub/Sub para Socket.io y caché)
* **Comunicación**: Socket.io (servidor integrado en Next.js/custom Server)
* **ORM**: Prisma v5 (para relaciones PostgreSQL y extensiones vectoriales) + Mongoose (para MongoDB)
* **Estilos**: Tailwind CSS con diseño responsive y estética premium en modo oscuro/oscuro-militar.

---

## 🔑 Credenciales para Demo (Reclutadores)

Puedes iniciar sesión directamente en la plataforma usando las siguientes cuentas pre-configuradas con datos históricos de 8 semanas:

* **Cuenta de Entrenador (Coach)**:
  * **Email**: `coach@rugbytrack.demo`
  * **Password**: `password123`
  * *Permite acceder al panel de Analytics con alertas ACWR y a la búsqueda semántica.*

* **Cuenta de Jugador (Con alerta ACWR activa por sobreesfuerzo)**:
  * **Email**: `lucas@rugbytrack.demo`
  * **Password**: `password123`
  * *Permite probar la asistencia en vivo e ingresar RPE, y verás la alerta en el panel de control del coach.*

---

## 🚀 Setup Local de Desarrollo

### 1. Requisitos previos
* Node.js v20+ y `pnpm`
* Docker y Docker Compose instalados

### 2. Pasos de Instalación
1. Clona el repositorio e instala dependencias:
   ```bash
   pnpm install
   ```
2. Levanta la infraestructura (Postgres con pgvector, MongoDB y Redis):
   ```bash
   docker compose up -d
   ```
3. Ejecuta las migraciones de Prisma en la base de datos local:
   ```bash
   pnpm prisma migrate dev
   ```
4. Ejecuta el script de semilla (Seed) para crear los datos de la demo:
   ```bash
   pnpm db:seed
   ```
5. Arranca el servidor de desarrollo:
   ```bash
   pnpm dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🗄️ Volúmenes Docker (Producción)

| Volumen | Mount en contenedor | Propósito |
|---------|---------------------|-----------|
| `docker-lab_rugbytrack_uploads` | `/app/public/uploads` | Imágenes adjuntas en debates del foro. Persiste entre rebuilds y reinicios del contenedor. Definido en `/home/ubuntu/docker-lab/docker-compose.yml`. |

**Notas:**
- El volumen es gestionado por Docker Compose del docker-lab (`docker-lab_rugbytrack_uploads`).
- En desarrollo local, las imágenes se guardan directamente en `public/uploads/` del sistema de archivos (no se usa Docker volume).
- La API de subida (`POST /api/upload`) valida tipo (JPG/PNG/WEBP) y tamaño (máx. 5 MB) antes de escribir en el volumen.
- Para inspeccionar el contenido del volumen en producción: `docker exec rugbytrack-app ls /app/public/uploads/`
