-- CreateTable
CREATE TABLE "ToggleSetting" (
    "listConfigId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "value" BOOLEAN NOT NULL,

    CONSTRAINT "ToggleSetting_pkey" PRIMARY KEY ("listConfigId")
);

-- CreateTable
CREATE TABLE "NumberSetting" (
    "listConfigId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "NumberSetting_pkey" PRIMARY KEY ("listConfigId")
);

-- CreateTable
CREATE TABLE "TextSetting" (
    "listConfigId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "value" VARCHAR(255) NOT NULL,

    CONSTRAINT "TextSetting_pkey" PRIMARY KEY ("listConfigId")
);

-- CreateTable
CREATE TABLE "Setting" (
    "listConfigId" UUID NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("listConfigId")
);

-- AddForeignKey
ALTER TABLE "ToggleSetting" ADD CONSTRAINT "ToggleSetting_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "Setting"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSetting" ADD CONSTRAINT "NumberSetting_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "Setting"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextSetting" ADD CONSTRAINT "TextSetting_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "Setting"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
