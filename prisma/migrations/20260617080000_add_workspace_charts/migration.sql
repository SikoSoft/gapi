-- CreateTable
CREATE TABLE "WorkspaceChart" (
    "id" SERIAL NOT NULL,
    "workspaceId" UUID NOT NULL,
    "chartId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceChart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceChart_workspaceId_chartId_key" ON "WorkspaceChart"("workspaceId", "chartId");

-- AddForeignKey
ALTER TABLE "WorkspaceChart" ADD CONSTRAINT "WorkspaceChart_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
