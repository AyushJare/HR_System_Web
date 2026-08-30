/*
  Warnings:

  - The `locationMode` column on the `user_types` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "LocationMode" AS ENUM ('RESTRICTED_100M', 'UNRESTRICTED');

-- AlterTable
ALTER TABLE "user_types" DROP COLUMN "locationMode",
ADD COLUMN     "locationMode" "LocationMode" NOT NULL DEFAULT 'UNRESTRICTED';
