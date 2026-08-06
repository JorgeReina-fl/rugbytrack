// @ts-nocheck
/**
 * seed-demo.ts — Seed idempotente del club demo "Urbanova Rugby Club".
 *
 * Identifica los datos demo por:
 *   - Coach: email demo@rugbytrack.es
 *   - Jugadores: emails que terminan en @demo.rugbytrack
 *   - Equipos: slug con prefijo "urbanova-"
 *
 * Uso:
 *   npm run db:seed-demo
 */

import { PrismaClient, Role, RugbyPosition, EventType, AttendanceStatus } from "@prisma/client";
import * as argon2 from "argon2";
import mongoose from "mongoose";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const COACH_EMAIL = "demo@rugbytrack.es";
const COACH_PASSWORD = "rugby2026demo";
const COACH_NAME = "Coach Demo";
const CLUB_NAME = "Urbanova Rugby Club";
const PLAYER_EMAIL_DOMAIN = "@demo.rugbytrack";
const TEAM_SLUG_PREFIX = "urbanova-";

// ---------------------------------------------------------------------------
// EQUIPOS
// ---------------------------------------------------------------------------

type TeamSpec = {
  name: string;
  slug: string;
  category: "senior" | "s23" | "femenino" | "s18" | "s16" | "s14" | "s12" | "s10" | "s8" | "veteranos";
  female?: boolean;
  ageMin?: number;
  ageMax?: number;
  main?: boolean;
};

const TEAMS: TeamSpec[] = [
  { name: "Senior Masculino A", slug: "senior-masc-a", category: "senior", ageMin: 20, ageMax: 34, main: true },
  { name: "Senior Masculino B", slug: "senior-masc-b", category: "senior", ageMin: 19, ageMax: 32, main: true },
  { name: "Sub-23", slug: "s23", category: "s23", ageMin: 20, ageMax: 22, main: true },
  { name: "Femenino A", slug: "fem-a", category: "femenino", female: true, ageMin: 19, ageMax: 32, main: true },
  { name: "Femenino B", slug: "fem-b", category: "femenino", female: true, ageMin: 18, ageMax: 30 },
  { name: "Sub-18", slug: "s18", category: "s18", ageMin: 16, ageMax: 17 },
  { name: "Sub-16", slug: "s16", category: "s16", ageMin: 14, ageMax: 15 },
  { name: "Sub-14", slug: "s14", category: "s14", ageMin: 12, ageMax: 13 },
  { name: "Sub-12", slug: "s12", category: "s12", ageMin: 10, ageMax: 11 },
  { name: "Sub-10", slug: "s10", category: "s10", ageMin: 8, ageMax: 9 },
  { name: "Sub-8", slug: "s8", category: "s8", ageMin: 6, ageMax: 7 },
  { name: "Veteranos", slug: "veteranos", category: "veteranos", ageMin: 35, ageMax: 55 },
];

// ---------------------------------------------------------------------------
// NOMBRES
// ---------------------------------------------------------------------------

const NOMBRES_M = [
  "Marcos", "Lucas", "Mateo", "Hugo", "Álvaro", "Diego", "Pablo", "Adrián", "Daniel", "David",
  "Javier", "Sergio", "Alejandro", "Carlos", "Rubén", "Jorge", "Iván", "Óscar", "Raúl", "Manuel",
  "Antonio", "José", "Miguel", "Nicolás", "Rodrigo", "Guillermo", "Andrés", "Fernando", "Pedro", "Ignacio",
  "Gonzalo", "Iker", "Marc", "Aitor", "Bruno", "Enzo", "Leo", "Martín", "Samuel", "Unai",
  "Gabriel", "Ismael", "Julio", "Cristian", "Víctor", "Roberto", "Tomás", "Ramón", "Emilio", "Luis",
  "Sebastián", "Alberto", "Joaquín", "Vicente", "Eduardo", "Ricardo", "Héctor", "Jaime", "Nacho", "Álex",
];

const NOMBRES_F = [
  "María", "Lucía", "Sofía", "Martina", "Paula", "Julia", "Daniela", "Valeria", "Alba", "Emma",
  "Noa", "Carla", "Sara", "Laura", "Elena", "Ana", "Marta", "Andrea", "Claudia", "Nerea",
  "Aitana", "Vega", "Adriana", "Carmen", "Rocío", "Cristina", "Beatriz", "Silvia", "Eva", "Raquel",
  "Alicia", "Ángela", "Sandra", "Nuria", "Isabel", "Miriam", "Patricia", "Natalia", "Irene", "Alejandra",
  "Blanca", "Berta", "Clara", "Diana", "Estela", "Fátima", "Gloria", "Helena", "Inés", "Judith",
  "Leire", "Manuela", "Nora", "Olivia", "Pilar", "Rebeca", "Susana", "Teresa", "Verónica", "Yolanda",
];

const APELLIDOS = [
  "García", "Rodríguez", "González", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Martín",
  "Jiménez", "Ruiz", "Hernández", "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero", "Alonso", "Gutiérrez",
  "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos", "Gil", "Ramírez", "Serrano", "Blanco", "Molina",
  "Morales", "Suárez", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marín", "Sanz", "Iglesias",
  "Núñez", "Medina", "Garrido", "Cortés", "Castillo", "Santos", "Lozano", "Guerrero", "Cano", "Prieto",
  "Méndez", "Cruz", "Calvo", "Gallego", "Vidal", "León", "Herrera", "Márquez", "Peña", "Flores",
  "Cabrera", "Campos", "Vega", "Fuentes", "Carrasco", "Diez", "Caballero", "Reyes", "Nieto", "Aguilar",
  "Pascual", "Santana", "Herrero", "Lorenzo", "Montero", "Hidalgo", "Giménez", "Ibáñez", "Ferrer", "Duran",
];

// ---------------------------------------------------------------------------
// POSICIONES (peso relativo por categoría)
// ---------------------------------------------------------------------------

const POSITIONS_SENIOR: RugbyPosition[] = [
  "PROP_LOOSEHEAD", "PROP_LOOSEHEAD",
  "HOOKER", "HOOKER",
  "PROP_TIGHTHEAD", "PROP_TIGHTHEAD",
  "LOCK", "LOCK", "LOCK",
  "FLANKER_BLINDSIDE", "FLANKER_BLINDSIDE",
  "FLANKER_OPENSIDE", "FLANKER_OPENSIDE",
  "NUMBER_EIGHT", "NUMBER_EIGHT",
  "SCRUM_HALF", "SCRUM_HALF",
  "FLY_HALF", "FLY_HALF",
  "CENTER_INSIDE", "CENTER_INSIDE",
  "CENTER_OUTSIDE", "CENTER_OUTSIDE",
  "WING_LEFT", "WING_LEFT",
  "WING_RIGHT", "WING_RIGHT",
  "FULLBACK", "FULLBACK",
];

// ---------------------------------------------------------------------------
// FORO — TEMAS
// ---------------------------------------------------------------------------

const FORUM_TOPICS = [
  {
    title: "Convocatoria partido de este fin de semana",
    content: "Chicos, publico aquí la convocatoria del partido del sábado. Repasad las posiciones y confirmad asistencia antes del viernes a mediodía.",
    replies: [
      "Confirmo asistencia. ¿A qué hora quedamos en el club?",
      "Yo estaré, aunque llegaré 15 minutos tarde por curro.",
      "¿Vamos con la equipación blanca o la azul?",
      "Recordad traer el protector bucal, la última vez faltó gente.",
      "¿Alguien puede llevar botellas de agua extra?",
      "Voy con el coche, tengo 3 plazas libres desde el norte.",
      "Confirmado. ¡A por ellos!",
      "Yo no puedo, tengo boda. Suerte al equipo.",
    ],
  },
  {
    title: "Análisis post-partido: qué mejorar",
    content: "Dejo un par de puntos que vi el fin de semana. El scrum estuvo sólido pero perdimos varias touches por lanzamientos altos. En defensa, alineación demasiado plana en 22.",
    replies: [
      "Coincido con la touche, hay que trabajarlo en el próximo entreno.",
      "La salida de balón desde ruck la vi lenta, sobre todo segunda parte.",
      "El pack aguantó bien, pero la línea de tres cuartos se estiró demasiado.",
      "Falta comunicación en la placa, tenemos que hablar más.",
      "En el vídeo se ve claro cómo perdimos la organización tras el break del 8.",
      "Buen análisis, entrenador. Mañana lo repasamos.",
    ],
  },
  {
    title: "Logística desplazamiento partido fuera",
    content: "Para el partido en Valladolid: salida sábado 08:00 desde el club. Volvemos por la tarde. Comida cubierta por el club, cena por cuenta de cada uno.",
    replies: [
      "¿Cuántas plazas de bus quedan libres?",
      "Yo voy en coche particular, puedo llevar a 3.",
      "¿Se puede pedir descuento en el hotel para las parejas?",
      "Confirmado en el bus, ya he pagado a tesorería.",
      "¿A qué hora es el kick-off exactamente?",
      "Recordad DNI y ficha federativa, en el último viaje hubo lío.",
      "Yo me apunto, gracias por organizarlo.",
    ],
  },
  {
    title: "Dudas del entrenamiento del miércoles",
    content: "El ejercicio de rucks continuos con 4 estaciones no me quedó claro. ¿Alguien puede explicarme la rotación entre estaciones?",
    replies: [
      "Cada estación son 3 rucks y rotas en sentido horario.",
      "Sí, y en la 4ª se añade defensor pasivo.",
      "Mañana lo volvemos a hacer, aprovechá para preguntar in situ.",
      "Yo tampoco lo entendí bien al principio, dale un par de vueltas.",
      "Buena pregunta, yo también estaba perdido.",
    ],
  },
  {
    title: "Tercera parte del sábado",
    content: "Después del partido del sábado, tercera parte en el club. Habrá barbacoa. Cada uno pone 10€ y bebida a cargo de la barra.",
    replies: [
      "Cuenta conmigo y +1.",
      "¡Vamos, hace tiempo que no había una buena tercera parte!",
      "Yo llevo la playlist.",
      "¿Se puede traer familia?",
      "Confirmadme antes del viernes para calcular la carne.",
      "Yo con mi novia, gracias.",
      "Cuento con la mía y dos amigos, ¿problema?",
    ],
  },
  {
    title: "Nuevas botas: recomendaciones",
    content: "Se me han roto las botas y necesito comprar otras. Peso 95kg, juego de segunda línea. ¿Alguna recomendación de marca/modelo?",
    replies: [
      "Yo llevo Adidas Kakari, muy cómodas para pesos altos.",
      "Canterbury también van muy bien, mira las Phoenix.",
      "Evita las de fútbol, aunque parezcan iguales.",
      "Cómprate tacos de aluminio si vas a jugar mucho en barro.",
      "Yo uso Gilbert, calidad-precio bastante buena.",
    ],
  },
  {
    title: "Sesión de vídeo del último partido",
    content: "Voy a subir la sesión de vídeo el jueves 19:00 en la sala del club. Repasaremos las 20 primeras fases y los mauls defendidos.",
    replies: [
      "Ahí estaré.",
      "¿Se puede grabar la sesión para los que no podamos ir?",
      "Confirmo asistencia.",
      "Interesa mucho ver los mauls, en directo se me escaparon detalles.",
      "Yo llegaré tarde, empezad sin mí.",
    ],
  },
  {
    title: "Recomendación fisio para dolores lumbares",
    content: "Tras el partido del domingo tengo dolor lumbar bastante fuerte. ¿Alguien puede recomendar un fisio de confianza cerca del club?",
    replies: [
      "Yo voy al que está en la Avenida, muy bueno con deportistas.",
      "Prueba el fisio del club, hay convenio con descuento.",
      "Cuidado con los lumbares, no lo dejes pasar más de una semana.",
      "Descansá y hielo, y no fuerces esta semana.",
      "Yo tuve algo parecido, me fue muy bien pilates de rehab.",
    ],
  },
];

// ---------------------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)] as T;
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = randomInt(0, copy.length - 1);
    out.push(copy.splice(idx, 1)[0] as T);
  }
  return out;
}

function assignPosition(index: number, category: TeamSpec["category"]): RugbyPosition | null {
  if (category === "s8" || category === "s10") {
    // categorías muy inferiores: rugby de iniciación, posiciones simplificadas
    return null;
  }
  return POSITIONS_SENIOR[index % POSITIONS_SENIOR.length] ?? null;
}

// Distribución típica lun/mié/vie
function trainingDates(count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Recorremos días desde hace 3 meses hasta hoy, filtrando L/X/V
  const candidates: Date[] = [];
  const cursor = new Date(threeMonthsAgo);
  while (cursor < now) {
    const dow = cursor.getDay(); // 1=Mon, 3=Wed, 5=Fri
    if (dow === 1 || dow === 3 || dow === 5) {
      const d = new Date(cursor);
      d.setHours(19, 0, 0, 0);
      candidates.push(d);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Muestreamos "count" fechas distribuidas del pool
  const step = Math.max(1, Math.floor(candidates.length / count));
  for (let i = 0; i < count && i * step < candidates.length; i++) {
    dates.push(candidates[i * step]);
  }
  return dates;
}

function matchDates(count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    // Sábados en semanas pasadas, distribuidos
    const weeksAgo = 2 + i * Math.max(2, Math.floor(12 / count));
    d.setDate(d.getDate() - weeksAgo * 7);
    // Ajustar al sábado más cercano
    const dow = d.getDay();
    const diff = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
    d.setDate(d.getDate() + diff);
    d.setHours(17, 0, 0, 0);
    if (d < now) dates.push(d);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// MONGO — Schemas mínimos
// ---------------------------------------------------------------------------

const threadSchema = new mongoose.Schema(
  {
    teamId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    imageUrl: { type: String, required: false },
  },
  { timestamps: true, collection: "threads" }
);

const commentSchema = new mongoose.Schema(
  {
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: "Thread", required: true, index: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true, collection: "comments" }
);

const Thread = mongoose.models.Thread || mongoose.model("Thread", threadSchema);
const Comment = mongoose.models.Comment || mongoose.model("Comment", commentSchema);

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log("Conectando a Mongo...");
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("MONGODB_URI no definido");
  await mongoose.connect(MONGODB_URI);

  console.log("Limpiando datos demo previos...");

  // 1) Borrar hilos y comentarios de equipos demo previos (por slug prefix)
  const previousDemoTeams = await prisma.team.findMany({
    where: { slug: { startsWith: TEAM_SLUG_PREFIX } },
    select: { id: true },
  });
  const previousDemoTeamIds = previousDemoTeams.map((t) => t.id);

  if (previousDemoTeamIds.length > 0) {
    const previousThreads = await Thread.find({ teamId: { $in: previousDemoTeamIds } }).select("_id");
    const prevThreadIds = previousThreads.map((t: any) => t._id);
    if (prevThreadIds.length > 0) {
      await Comment.deleteMany({ threadId: { $in: prevThreadIds } });
    }
    await Thread.deleteMany({ teamId: { $in: previousDemoTeamIds } });
  }

  // 2) Borrar usuarios demo — cascada elimina memberships, attendances, callups, rpe, events
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: COACH_EMAIL },
        { email: { endsWith: PLAYER_EMAIL_DOMAIN } },
      ],
    },
  });

  // 3) Borrar equipos demo (por si quedaron sin usuarios)
  await prisma.team.deleteMany({
    where: { slug: { startsWith: TEAM_SLUG_PREFIX } },
  });

  console.log("Creando coach demo...");
  const coachHash = await argon2.hash(COACH_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const coach = await prisma.user.create({
    data: {
      name: COACH_NAME,
      email: COACH_EMAIL,
      passwordHash: coachHash,
      role: Role.COACH,
    },
  });

  // Hash único reutilizable para todos los jugadores (evita ~500 hashes lentos)
  const playerHash = await argon2.hash("player2026demo", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Contador global de jugadores para email correlativo
  let playerCounter = 0;

  // Contadores agregados
  const counters = {
    users: 1, // coach
    teams: 0,
    memberships: 0,
    events: 0,
    trainings: 0,
    matches: 0,
    attendances: 0,
    rpeEntries: 0,
    threads: 0,
    posts: 0,
  };

  console.log(`Creando ${TEAMS.length} equipos y jugadores...`);

  const teamsCreated: Array<{ id: string; spec: TeamSpec; players: Array<{ id: string; name: string }> }> = [];

  for (const spec of TEAMS) {
    const team = await prisma.team.create({
      data: {
        name: `${CLUB_NAME} — ${spec.name}`,
        slug: `${TEAM_SLUG_PREFIX}${spec.slug}`,
        inviteToken: `urbanova-demo-${spec.slug}-${Date.now()}-${randomInt(1000, 9999)}`,
        description: `${spec.name} del ${CLUB_NAME} (equipo demo).`,
      },
    });
    counters.teams++;

    // Coach como entrenador
    await prisma.teamMember.create({
      data: { userId: coach.id, teamId: team.id, isCoach: true },
    });
    counters.memberships++;

    // Jugadores
    const nombres = spec.female ? NOMBRES_F : NOMBRES_M;
    const nPlayers = randomInt(16, 30);
    const teamPlayers: Array<{ id: string; name: string }> = [];

    for (let i = 0; i < nPlayers; i++) {
      const nombre = pick(nombres);
      const apellido1 = pick(APELLIDOS);
      const apellido2 = pick(APELLIDOS);
      const fullName = `${nombre} ${apellido1} ${apellido2}`;
      playerCounter++;
      const email = `jugador${String(playerCounter).padStart(3, "0")}${PLAYER_EMAIL_DOMAIN}`;

      const player = await prisma.user.create({
        data: {
          name: fullName,
          email,
          passwordHash: playerHash,
          role: Role.PLAYER,
        },
      });
      counters.users++;

      await prisma.teamMember.create({
        data: {
          userId: player.id,
          teamId: team.id,
          isCoach: false,
          position: assignPosition(i, spec.category),
          jerseyNumber: i + 1,
        },
      });
      counters.memberships++;

      teamPlayers.push({ id: player.id, name: fullName });
    }

    teamsCreated.push({ id: team.id, spec, players: teamPlayers });
  }

  console.log(`Creando eventos, asistencias y RPE...`);

  for (const t of teamsCreated) {
    // Entrenamientos
    const nTrainings = randomInt(8, 15);
    const trainDates = trainingDates(nTrainings);

    for (let idx = 0; idx < trainDates.length; idx++) {
      const date = trainDates[idx];
      const event = await prisma.event.create({
        data: {
          teamId: t.id,
          title: `Entrenamiento ${t.spec.name} #${idx + 1}`,
          type: EventType.TRAINING,
          description: "Sesión de destrezas, contacto y acondicionamiento.",
          startDate: date,
          endDate: new Date(date.getTime() + 90 * 60 * 1000),
          createdById: coach.id,
        },
      });
      counters.events++;
      counters.trainings++;

      // Asistencia 75-95%
      const attendanceRate = 0.75 + Math.random() * 0.2;
      for (const p of t.players) {
        const present = Math.random() < attendanceRate;
        const status = present
          ? AttendanceStatus.CONFIRMED
          : Math.random() < 0.5
          ? AttendanceStatus.DECLINED
          : AttendanceStatus.PENDING;

        await prisma.attendance.create({
          data: {
            eventId: event.id,
            userId: p.id,
            status,
            checkedIn: present,
            checkedInAt: present ? date : null,
          },
        });
        counters.attendances++;

        // RPE sólo si presente
        if (present) {
          // Variabilidad por jugador y sesión: base 5-7, +/- ruido
          const base = 5 + (parseInt(p.id.slice(-2), 36) % 3);
          const noise = randomInt(-1, 2);
          const rpe = Math.min(9, Math.max(4, base + noise));
          const duration = randomInt(75, 105);
          await prisma.rpeEntry.create({
            data: {
              eventId: event.id,
              userId: p.id,
              rpe,
              duration,
              workload: rpe * duration,
            },
          });
          counters.rpeEntries++;
        }
      }
    }

    // Partidos
    const nMatches = randomInt(3, 5);
    const matchDs = matchDates(nMatches);
    for (let idx = 0; idx < matchDs.length; idx++) {
      const date = matchDs[idx];
      const event = await prisma.event.create({
        data: {
          teamId: t.id,
          title: `Partido ${t.spec.name} J${idx + 1}`,
          type: EventType.MATCH,
          location: idx % 2 === 0 ? "Campo Urbanova" : "Desplazamiento",
          description: "Partido oficial de liga regional.",
          startDate: date,
          endDate: new Date(date.getTime() + 120 * 60 * 1000),
          createdById: coach.id,
        },
      });
      counters.events++;
      counters.matches++;

      const attendanceRate = 0.8 + Math.random() * 0.15;
      for (const p of t.players) {
        const present = Math.random() < attendanceRate;
        const status = present
          ? AttendanceStatus.CONFIRMED
          : Math.random() < 0.5
          ? AttendanceStatus.DECLINED
          : AttendanceStatus.PENDING;

        await prisma.attendance.create({
          data: {
            eventId: event.id,
            userId: p.id,
            status,
            checkedIn: present,
            checkedInAt: present ? date : null,
          },
        });
        counters.attendances++;
      }
    }
  }

  console.log("Creando hilos de foro (MongoDB)...");

  for (const t of teamsCreated) {
    const nThreads = t.spec.main ? randomInt(4, 8) : randomInt(2, 3);
    const topicsToUse = pickN(FORUM_TOPICS, nThreads);

    for (let ti = 0; ti < topicsToUse.length; ti++) {
      const topic = topicsToUse[ti];
      // Fecha del hilo: entre hace 90 y hace 3 días
      const daysAgo = randomInt(3, 90);
      const threadDate = new Date();
      threadDate.setDate(threadDate.getDate() - daysAgo);
      threadDate.setHours(randomInt(9, 22), randomInt(0, 59), 0, 0);

      // Autor: coach o jugador al azar
      const authorIsCoach = Math.random() < 0.25;
      const author = authorIsCoach
        ? { id: coach.id, name: COACH_NAME }
        : pick(t.players);

      const thread = await Thread.create({
        teamId: t.id,
        authorId: author.id,
        authorName: author.name,
        title: topic.title,
        content: topic.content,
        createdAt: threadDate,
        updatedAt: threadDate,
      });
      counters.threads++;

      // Respuestas
      const nReplies = Math.min(topic.replies.length, randomInt(3, 10));
      const chosen = pickN(topic.replies, nReplies);
      const commenters = pickN(t.players, nReplies);
      let cursor = new Date(threadDate);
      for (let ri = 0; ri < chosen.length; ri++) {
        cursor = new Date(cursor.getTime() + randomInt(30 * 60 * 1000, 24 * 60 * 60 * 1000));
        const commenter = commenters[ri % commenters.length];
        await Comment.create({
          threadId: thread._id,
          authorId: commenter.id,
          authorName: commenter.name,
          content: chosen[ri],
          createdAt: cursor,
          updatedAt: cursor,
        });
        counters.posts++;
      }
    }
  }

  console.log("");
  console.log("=== RESUMEN ===");
  console.log(`Usuarios totales:    ${counters.users}`);
  console.log(`  - Coach:           1`);
  console.log(`  - Jugadores:       ${counters.users - 1}`);
  console.log(`Equipos:             ${counters.teams}`);
  console.log(`Membresías:          ${counters.memberships}`);
  console.log(`Eventos:             ${counters.events}`);
  console.log(`  - Entrenamientos:  ${counters.trainings}`);
  console.log(`  - Partidos:        ${counters.matches}`);
  console.log(`Asistencias:         ${counters.attendances}`);
  console.log(`Registros RPE:       ${counters.rpeEntries}`);
  console.log(`Hilos foro:          ${counters.threads}`);
  console.log(`Posts foro:          ${counters.posts}`);
  console.log("");
  console.log(`Coach demo: ${COACH_EMAIL} / ${COACH_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await mongoose.disconnect();
    process.exit(1);
  });
