-- CreateTable
CREATE TABLE "BooleanSetting" (
    "settingId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "value" BOOLEAN NOT NULL,

    CONSTRAINT "BooleanSetting_pkey" PRIMARY KEY ("settingId")
);

-- CreateTable
CREATE TABLE "NumberSetting" (
    "settingId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "NumberSetting_pkey" PRIMARY KEY ("settingId")
);

-- CreateTable
CREATE TABLE "TextSetting" (
    "settingId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "value" VARCHAR(255) NOT NULL,

    CONSTRAINT "TextSetting_pkey" PRIMARY KEY ("settingId")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" UUID NOT NULL,
    "listConfigId" UUID NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("listConfigId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_id_key" ON "Setting"("id");

-- AddForeignKey
ALTER TABLE "BooleanSetting" ADD CONSTRAINT "BooleanSetting_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSetting" ADD CONSTRAINT "NumberSetting_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextSetting" ADD CONSTRAINT "TextSetting_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
