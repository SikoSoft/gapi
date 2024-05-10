-- CreateTable
CREATE TABLE "ActionTag" (
    "actionId" INTEGER NOT NULL DEFAULT 0,
    "tagId" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ActionTag_pkey" PRIMARY KEY ("actionId","tagId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(128) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ActionTag" ADD CONSTRAINT "ActionTag_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTag" ADD CONSTRAINT "ActionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
