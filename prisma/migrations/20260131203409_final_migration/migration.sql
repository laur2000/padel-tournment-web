-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Participation" ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false;
