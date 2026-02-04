-- AlterTable
ALTER TABLE "Participation" ADD COLUMN     "addedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
