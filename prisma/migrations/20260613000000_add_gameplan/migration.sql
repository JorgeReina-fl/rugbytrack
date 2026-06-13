-- CreateEnum
CREATE TYPE "PlayCategory" AS ENUM ('ATTACK', 'DEFENSE', 'SET_PIECE', 'TRANSITION');

-- CreateTable
CREATE TABLE "Play" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "PlayCategory" NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "positions" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Play_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Play_teamId_idx" ON "Play"("teamId");

-- AddForeignKey
ALTER TABLE "Play" ADD CONSTRAINT "Play_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Play" ADD CONSTRAINT "Play_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
