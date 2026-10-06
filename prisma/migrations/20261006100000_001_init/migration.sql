-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'FACULTY', 'ADMIN');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('WEEKLY', 'DATE', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('LAB', 'ROOM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL DEFAULT 'LAB',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "ownerId" INTEGER,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" SERIAL NOT NULL,
    "kind" "AvailabilityKind" NOT NULL,
    "ownerUserId" INTEGER,
    "ownerResourceId" INTEGER,
    "termId" INTEGER,
    "days" INTEGER[],
    "date" DATE,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "note" TEXT,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 30,
    "beforeBuffer" INTEGER NOT NULL DEFAULT 0,
    "afterBuffer" INTEGER NOT NULL DEFAULT 0,
    "minNoticeMins" INTEGER NOT NULL DEFAULT 0,
    "seatsPerSlot" INTEGER NOT NULL DEFAULT 1,
    "hostId" INTEGER,
    "resourceId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "serviceTypeId" INTEGER NOT NULL,
    "hostId" INTEGER,
    "resourceId" INTEGER,
    "studentId" INTEGER NOT NULL,
    "slotStart" TIMESTAMPTZ NOT NULL,
    "slotEnd" TIMESTAMPTZ NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'RESERVED',
    "resourcesNeeded" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCommitment" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "slotStart" TIMESTAMPTZ NOT NULL,
    "slotEnd" TIMESTAMPTZ NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "StudentCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hold" (
    "id" SERIAL NOT NULL,
    "hostId" INTEGER,
    "resourceId" INTEGER,
    "studentId" INTEGER NOT NULL,
    "slotStart" TIMESTAMPTZ NOT NULL,
    "slotEnd" TIMESTAMPTZ NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" SERIAL NOT NULL,
    "termId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "bookingId" INTEGER,
    "policy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Resource_kind_active_idx" ON "Resource"("kind", "active");

-- CreateIndex
CREATE INDEX "Term_startsOn_endsOn_idx" ON "Term"("startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "AvailabilityRule_ownerUserId_kind_idx" ON "AvailabilityRule"("ownerUserId", "kind");

-- CreateIndex
CREATE INDEX "AvailabilityRule_ownerResourceId_kind_idx" ON "AvailabilityRule"("ownerResourceId", "kind");

-- CreateIndex
CREATE INDEX "AvailabilityRule_date_idx" ON "AvailabilityRule"("date");

-- CreateIndex
CREATE INDEX "ServiceType_hostId_active_idx" ON "ServiceType"("hostId", "active");

-- CreateIndex
CREATE INDEX "ServiceType_resourceId_active_idx" ON "ServiceType"("resourceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Booking_hostId_slotStart_idx" ON "Booking"("hostId", "slotStart");

-- CreateIndex
CREATE INDEX "Booking_resourceId_slotStart_idx" ON "Booking"("resourceId", "slotStart");

-- CreateIndex
CREATE INDEX "Booking_studentId_slotStart_idx" ON "Booking"("studentId", "slotStart");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "StudentCommitment_studentId_slotStart_idx" ON "StudentCommitment"("studentId", "slotStart");

-- CreateIndex
CREATE INDEX "Hold_expiresAt_idx" ON "Hold"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Hold_studentId_slotStart_slotEnd_key" ON "Hold"("studentId", "slotStart", "slotEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Allocation_bookingId_key" ON "Allocation"("bookingId");

-- CreateIndex
CREATE INDEX "Allocation_termId_policy_idx" ON "Allocation"("termId", "policy");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_ownerResourceId_fkey" FOREIGN KEY ("ownerResourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceType" ADD CONSTRAINT "ServiceType_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceType" ADD CONSTRAINT "ServiceType_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCommitment" ADD CONSTRAINT "StudentCommitment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
