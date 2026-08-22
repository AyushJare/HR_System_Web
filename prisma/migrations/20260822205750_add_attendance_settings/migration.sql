-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" TEXT NOT NULL,
    "weeklyOffDays" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);
