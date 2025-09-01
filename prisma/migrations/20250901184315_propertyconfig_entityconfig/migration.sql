-- CreateTable
CREATE TABLE "PropertyConfig" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "type" VARCHAR(128) NOT NULL,
    "repeat" INTEGER NOT NULL DEFAULT 0,
    "allowed" INTEGER NOT NULL DEFAULT 0,
    "required" INTEGER NOT NULL DEFAULT 0,
    "entityConfigId" UUID NOT NULL,

    CONSTRAINT "PropertyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityConfig" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "EntityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityConfig_id_name_key" ON "EntityConfig"("id", "name");

-- AddForeignKey
ALTER TABLE "PropertyConfig" ADD CONSTRAINT "PropertyConfig_entityConfigId_fkey" FOREIGN KEY ("entityConfigId") REFERENCES "EntityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
