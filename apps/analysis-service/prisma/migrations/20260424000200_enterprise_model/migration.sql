CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACCEPTED_RISK', 'FALSE_POSITIVE', 'FIXED');
CREATE TYPE "ToolRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE "ArtifactKind" AS ENUM ('NORMALIZED_JSON', 'SARIF', 'CYCLONEDX', 'MARKDOWN_REPORT', 'RAW_TOOL_OUTPUT');
CREATE TYPE "PolicyAction" AS ENUM ('WARN', 'FAIL');

ALTER TABLE "Finding"
  ADD COLUMN "scanId" TEXT,
  ADD COLUMN "fingerprint" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "cwe" TEXT,
  ADD COLUMN "cve" TEXT,
  ADD COLUMN "cvss" DOUBLE PRECISION,
  ADD COLUMN "epss" DOUBLE PRECISION,
  ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "fixedAt" TIMESTAMP(3),
  ADD COLUMN "acceptedUntil" TIMESTAMP(3);

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "riskScore" INTEGER,
  "riskLevel" "RiskLevel",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Repository" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'github',
  "repoUrl" TEXT NOT NULL,
  "defaultBranch" TEXT NOT NULL DEFAULT 'main',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Scan" (
  "id" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "analysisId" TEXT,
  "branch" TEXT NOT NULL DEFAULT 'main',
  "commitSha" TEXT,
  "status" "AnalysisStatus" NOT NULL,
  "currentStage" TEXT,
  "riskScore" INTEGER,
  "riskLevel" "RiskLevel",
  "summary" TEXT,
  "detectedStack" TEXT,
  "safeMode" BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolRun" (
  "id" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "tool" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "status" "ToolRunStatus" NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "exitCode" INTEGER,
  "summary" TEXT,
  "errorMessage" TEXT,
  "raw" JSONB,
  CONSTRAINT "ToolRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evidence" (
  "id" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "snippet" TEXT,
  "file" TEXT,
  "lineStart" INTEGER,
  "lineEnd" INTEGER,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Remediation" (
  "id" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "effort" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 3,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Remediation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Component" (
  "id" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT,
  "ecosystem" TEXT,
  "packageUrl" TEXT,
  "license" TEXT,
  "direct" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vulnerability" (
  "id" TEXT NOT NULL,
  "componentId" TEXT,
  "scanId" TEXT,
  "source" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "severity" "Severity" NOT NULL,
  "cvss" DOUBLE PRECISION,
  "epss" DOUBLE PRECISION,
  "fixedVersion" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vulnerability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseRisk" (
  "id" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "component" TEXT NOT NULL,
  "license" TEXT NOT NULL,
  "risk" TEXT NOT NULL,
  "policy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LicenseRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Policy" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "severity" "Severity" NOT NULL,
  "action" "PolicyAction" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskSnapshot" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "scanId" TEXT,
  "score" INTEGER NOT NULL,
  "level" "RiskLevel" NOT NULL,
  "critical" INTEGER NOT NULL DEFAULT 0,
  "high" INTEGER NOT NULL DEFAULT 0,
  "medium" INTEGER NOT NULL DEFAULT 0,
  "low" INTEGER NOT NULL DEFAULT 0,
  "info" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Artifact" (
  "id" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "kind" "ArtifactKind" NOT NULL,
  "name" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "path" TEXT,
  "content" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "projectId" TEXT,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");
CREATE UNIQUE INDEX "Repository_projectId_repoUrl_key" ON "Repository"("projectId", "repoUrl");
CREATE UNIQUE INDEX "Scan_analysisId_key" ON "Scan"("analysisId");
CREATE UNIQUE INDEX "Finding_scanId_fingerprint_key" ON "Finding"("scanId", "fingerprint");
CREATE UNIQUE INDEX "Remediation_findingId_key" ON "Remediation"("findingId");
CREATE UNIQUE INDEX "Component_scanId_name_version_ecosystem_key" ON "Component"("scanId", "name", "version", "ecosystem");

CREATE INDEX "Finding_scanId_idx" ON "Finding"("scanId");
CREATE INDEX "Finding_status_idx" ON "Finding"("status");
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");
CREATE INDEX "Project_riskLevel_idx" ON "Project"("riskLevel");
CREATE INDEX "Repository_projectId_idx" ON "Repository"("projectId");
CREATE INDEX "Scan_repositoryId_idx" ON "Scan"("repositoryId");
CREATE INDEX "Scan_status_idx" ON "Scan"("status");
CREATE INDEX "Scan_createdAt_idx" ON "Scan"("createdAt");
CREATE INDEX "ToolRun_scanId_idx" ON "ToolRun"("scanId");
CREATE INDEX "ToolRun_tool_idx" ON "ToolRun"("tool");
CREATE INDEX "ToolRun_status_idx" ON "ToolRun"("status");
CREATE INDEX "Evidence_findingId_idx" ON "Evidence"("findingId");
CREATE INDEX "Component_scanId_idx" ON "Component"("scanId");
CREATE INDEX "Component_ecosystem_idx" ON "Component"("ecosystem");
CREATE INDEX "Vulnerability_componentId_idx" ON "Vulnerability"("componentId");
CREATE INDEX "Vulnerability_scanId_idx" ON "Vulnerability"("scanId");
CREATE INDEX "Vulnerability_externalId_idx" ON "Vulnerability"("externalId");
CREATE INDEX "LicenseRisk_scanId_idx" ON "LicenseRisk"("scanId");
CREATE INDEX "LicenseRisk_risk_idx" ON "LicenseRisk"("risk");
CREATE INDEX "Policy_workspaceId_idx" ON "Policy"("workspaceId");
CREATE INDEX "Policy_category_idx" ON "Policy"("category");
CREATE INDEX "RiskSnapshot_projectId_idx" ON "RiskSnapshot"("projectId");
CREATE INDEX "RiskSnapshot_scanId_idx" ON "RiskSnapshot"("scanId");
CREATE INDEX "RiskSnapshot_createdAt_idx" ON "RiskSnapshot"("createdAt");
CREATE INDEX "Artifact_scanId_idx" ON "Artifact"("scanId");
CREATE INDEX "Artifact_kind_idx" ON "Artifact"("kind");
CREATE INDEX "AuditLog_workspaceId_idx" ON "AuditLog"("workspaceId");
CREATE INDEX "AuditLog_projectId_idx" ON "AuditLog"("projectId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolRun" ADD CONSTRAINT "ToolRun_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Remediation" ADD CONSTRAINT "Remediation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Component" ADD CONSTRAINT "Component_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vulnerability" ADD CONSTRAINT "Vulnerability_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseRisk" ADD CONSTRAINT "LicenseRisk_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskSnapshot" ADD CONSTRAINT "RiskSnapshot_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
