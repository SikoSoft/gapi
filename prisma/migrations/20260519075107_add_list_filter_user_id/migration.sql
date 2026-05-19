-- CreateTable
CREATE TABLE "ListFilterUserId" (
    "listConfigId" UUID NOT NULL,
    "userId" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterUserId_listConfigId_userId_key" ON "ListFilterUserId"("listConfigId", "userId");

-- AddForeignKey
ALTER TABLE "ListFilterUserId" ADD CONSTRAINT "ListFilterUserId_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;
