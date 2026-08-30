/*
  Warnings:

  - The `weeklyOffDays` column on the `attendance_settings` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "attendance_settings" DROP COLUMN "weeklyOffDays",
ADD COLUMN     "weeklyOffDays" JSONB NOT NULL DEFAULT '{"0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": []}';
