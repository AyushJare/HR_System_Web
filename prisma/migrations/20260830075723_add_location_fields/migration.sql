-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "distanceFromOffice" DOUBLE PRECISION,
ADD COLUMN     "gpsAccuracy" DOUBLE PRECISION,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "isMockLocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "user_types" ADD COLUMN     "locationMode" TEXT NOT NULL DEFAULT 'UNRESTRICTED';
