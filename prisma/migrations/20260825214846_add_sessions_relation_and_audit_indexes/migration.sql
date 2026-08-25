-- CreateIndex
CREATE INDEX "audit_logs_employeeId_idx" ON "audit_logs"("employeeId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
