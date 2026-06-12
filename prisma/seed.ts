import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clean existing RpeEntry, Attendance, Event, TeamMember, Team, User
  await prisma.rpeEntry.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("🧹 Cleaned existing data.");

  // Hash passwords
  const passwordHash = await argon2.hash("password123", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // 1. Create Coach
  const coachUser = await prisma.user.create({
    data: {
      name: "Coach Jorge Reina",
      email: "coach@rugbytrack.demo",
      passwordHash,
      role: "COACH",
    },
  });

  // 2. Create Players
  const player1 = await prisma.user.create({
    data: {
      name: "Marcos García (Prop)",
      email: "marcos@rugbytrack.demo",
      passwordHash,
      role: "PLAYER",
    },
  });

  const player2 = await prisma.user.create({
    data: {
      name: "Lucas Rodríguez (Hooker)",
      email: "lucas@rugbytrack.demo",
      passwordHash,
      role: "PLAYER",
    },
  });

  const player3 = await prisma.user.create({
    data: {
      name: "Mateo Fernández (Fly-Half)",
      email: "mateo@rugbytrack.demo",
      passwordHash,
      role: "PLAYER",
    },
  });

  console.log("👤 Users created.");

  // 3. Create Team
  const team = await prisma.team.create({
    data: {
      name: "Cobras Rugby Club",
      slug: "cobras-rugby-club",
      inviteToken: "cobras-demo-token",
      description: "Equipo demo para pruebas de reclutadores y analytics.",
    },
  });

  console.log("🏉 Team created.");

  // 4. Create Team Members
  await prisma.teamMember.create({
    data: {
      userId: coachUser.id,
      teamId: team.id,
      isCoach: true,
    },
  });

  await prisma.teamMember.create({
    data: {
      userId: player1.id,
      teamId: team.id,
      isCoach: false,
      position: "PROP_LOOSEHEAD",
      jerseyNumber: 1,
    },
  });

  await prisma.teamMember.create({
    data: {
      userId: player2.id,
      teamId: team.id,
      isCoach: false,
      position: "HOOKER",
      jerseyNumber: 2,
    },
  });

  await prisma.teamMember.create({
    data: {
      userId: player3.id,
      teamId: team.id,
      isCoach: false,
      position: "FLY_HALF",
      jerseyNumber: 10,
    },
  });

  console.log("👥 Team memberships established.");

  // 5. Create 8 weeks of historical events and RPE/Attendance records
  const now = new Date();
  const eventIds: string[] = [];

  for (let weekOffset = 0; weekOffset < 8; weekOffset++) {
    // Generate event date going back weekOffset weeks
    const eventDate = new Date();
    eventDate.setDate(now.getDate() - (7 * weekOffset) - 1); // 1 day ago in that week
    eventDate.setHours(19, 0, 0, 0);

    const event = await prisma.event.create({
      data: {
        teamId: team.id,
        title: `Entrenamiento Cobras S${8 - weekOffset}`,
        type: "TRAINING",
        description: `Sesión de destrezas y acondicionamiento.`,
        startDate: eventDate,
        endDate: new Date(eventDate.getTime() + 90 * 60 * 1000), // 90 min duration
        createdById: coachUser.id,
      },
    });

    eventIds.push(event.id);

    // Create Attendances
    const players = [player1, player2, player3];
    for (const p of players) {
      await prisma.attendance.create({
        data: {
          eventId: event.id,
          userId: p.id,
          status: "CONFIRMED",
          checkedIn: true,
          checkedInAt: eventDate,
        },
      });
    }

    // Create RPE Entries
    // Player 1 (Marcos): Stable/normal workloads (RPE ~5, Duration 80)
    await prisma.rpeEntry.create({
      data: {
        eventId: event.id,
        userId: player1.id,
        rpe: 5,
        duration: 80,
        workload: 400,
        notes: "Buen ritmo, sin molestias.",
      },
    });

    // Player 2 (Lucas): Low workload in weeks 1-7, massive workload spike in the latest week (weekOffset === 0)
    const isLatestWeek = weekOffset === 0;
    const lucasRpe = isLatestWeek ? 9 : 3;
    const lucasDuration = isLatestWeek ? 100 : 50;
    const lucasWorkload = lucasRpe * lucasDuration;
    await prisma.rpeEntry.create({
      data: {
        eventId: event.id,
        userId: player2.id,
        rpe: lucasRpe,
        duration: lucasDuration,
        workload: lucasWorkload,
        notes: isLatestWeek ? "Sesión brutal, muy fatigado." : "Acondicionamiento suave.",
      },
    });

    // Player 3 (Mateo): Light workouts
    await prisma.rpeEntry.create({
      data: {
        eventId: event.id,
        userId: player3.id,
        rpe: 4,
        duration: 60,
        workload: 240,
        notes: "Entrenamiento completado sin problemas.",
      },
    });
  }

  console.log("📊 Seeding of 8 weeks of events, attendance, and RPE workloads completed.");
  console.log(`
🚀 Demo Credentials:
--------------------
Coach Account:
- Email: coach@rugbytrack.demo
- Password: password123

Player 1 (Normal Load):
- Email: marcos@rugbytrack.demo
- Password: password123

Player 2 (ACWR Alert Spike!):
- Email: lucas@rugbytrack.demo
- Password: password123
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
