-- CreateEnum
CREATE TYPE "RoomKind" AS ENUM ('REGISTRAR', 'DEPARTMENTAL', 'NATIONALITY');

-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('EVENT', 'CLOSED');

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "formalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "capacity" INTEGER,
    "kind" "RoomKind" NOT NULL,
    "features" TEXT[],
    "buildingId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" BIGSERIAL NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "kind" "BlockKind" NOT NULL,
    "title" TEXT,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "roomCount" INTEGER,
    "blockCount" INTEGER,
    "dates" TEXT[],
    "error" TEXT,
    "warnings" TEXT[],

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_buildingId_idx" ON "Room"("buildingId");

-- CreateIndex
CREATE INDEX "Room_active_idx" ON "Room"("active");

-- CreateIndex
CREATE INDEX "Block_date_roomId_idx" ON "Block"("date", "roomId");

-- CreateIndex
CREATE INDEX "SyncRun_ok_finishedAt_idx" ON "SyncRun"("ok", "finishedAt");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
