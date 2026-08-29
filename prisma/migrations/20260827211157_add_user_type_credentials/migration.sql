/*
  Warnings:

  - A unique constraint covering the columns `[loginEmail]` on the table `user_types` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user_types" ADD COLUMN     "loginEmail" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_types_loginEmail_key" ON "user_types"("loginEmail");
