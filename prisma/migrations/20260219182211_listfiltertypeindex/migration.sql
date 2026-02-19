/*
  Warnings:

  - The primary key for the `ListFilterType` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "ListFilterType" DROP CONSTRAINT "ListFilterType_pkey",
ADD CONSTRAINT "ListFilterType_pkey" PRIMARY KEY ("entityConfigId", "listConfigId");

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceListConfig" (
    "workspaceId" UUID NOT NULL,
    "listConfigId" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceListConfig_workspaceId_listConfigId_key" ON "WorkspaceListConfig"("workspaceId", "listConfigId");

-- AddForeignKey
ALTER TABLE "WorkspaceListConfig" ADD CONSTRAINT "WorkspaceListConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceListConfig" ADD CONSTRAINT "WorkspaceListConfig_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
