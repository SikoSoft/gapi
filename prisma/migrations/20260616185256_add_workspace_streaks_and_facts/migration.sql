-- CreateTable
CREATE TABLE "WorkspaceStreak" (
    "id" SERIAL NOT NULL,
    "workspaceId" UUID NOT NULL,
    "streakId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceFact" (
    "id" SERIAL NOT NULL,
    "workspaceId" UUID NOT NULL,
    "factId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceStreak_workspaceId_streakId_key" ON "WorkspaceStreak"("workspaceId", "streakId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceFact_workspaceId_factId_key" ON "WorkspaceFact"("workspaceId", "factId");

-- AddForeignKey
ALTER TABLE "WorkspaceStreak" ADD CONSTRAINT "WorkspaceStreak_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFact" ADD CONSTRAINT "WorkspaceFact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
