-- CreateTable
CREATE TABLE "ListConfigTheme" (
    "listConfigId" UUID NOT NULL,
    "theme" VARCHAR(64) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ListConfigTheme_listConfigId_theme_key" ON "ListConfigTheme"("listConfigId", "theme");

-- AddForeignKey
ALTER TABLE "ListConfigTheme" ADD CONSTRAINT "ListConfigTheme_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
