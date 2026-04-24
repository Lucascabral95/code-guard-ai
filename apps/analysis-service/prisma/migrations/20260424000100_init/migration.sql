CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "FindingType" AS ENUM ('TEST', 'LINT', 'SECURITY', 'COVERAGE', 'DEPENDENCY', 'STACK_DETECTION', 'SYSTEM');
CREATE TYPE "Severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

CREATE TABLE "Analysis" (
  "id" TEXT NOT NULL,
  "repoUrl" TEXT NOT NULL,
  "branch" TEXT NOT NULL DEFAULT 'main',
  "status" "AnalysisStatus" NOT NULL,
  "riskScore" INTEGER,
  "riskLevel" "RiskLevel",
  "summary" TEXT,
  "detectedStack" TEXT,
  "safeMode" BOOLEAN NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Finding" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "type" "FindingType" NOT NULL,
  "severity" "Severity" NOT NULL,
  "tool" TEXT NOT NULL,
  "file" TEXT,
  "line" INTEGER,
  "message" TEXT NOT NULL,
  "recommendation" TEXT,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisLog" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "level" "LogLevel" NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalysisLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Analysis_createdAt_idx" ON "Analysis"("createdAt");
CREATE INDEX "Analysis_status_idx" ON "Analysis"("status");
CREATE INDEX "Finding_analysisId_idx" ON "Finding"("analysisId");
CREATE INDEX "Finding_severity_idx" ON "Finding"("severity");
CREATE INDEX "AnalysisLog_analysisId_idx" ON "AnalysisLog"("analysisId");

ALTER TABLE "Finding" ADD CONSTRAINT "Finding_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisLog" ADD CONSTRAINT "AnalysisLog_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
