-- CreateTable
CREATE TABLE "ListFilterTime" (
    "id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,

    CONSTRAINT "ListFilterTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterText" (
    "id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "subStr" VARCHAR(255) NOT NULL,

    CONSTRAINT "ListFilterText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterTagging" (
    "id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,

    CONSTRAINT "ListFilterTagging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterTaggingTag" (
    "tag" VARCHAR(255) NOT NULL,
    "taggingId" UUID NOT NULL,

    CONSTRAINT "ListFilterTaggingTag_pkey" PRIMARY KEY ("taggingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterTaggingTag_taggingId_tag_key" ON "ListFilterTaggingTag"("taggingId", "tag");

-- AddForeignKey
ALTER TABLE "ListFilterTime" ADD CONSTRAINT "ListFilterTime_id_fkey" FOREIGN KEY ("id") REFERENCES "ListFilter"("listId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterText" ADD CONSTRAINT "ListFilterText_id_fkey" FOREIGN KEY ("id") REFERENCES "ListFilter"("listId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterTagging" ADD CONSTRAINT "ListFilterTagging_id_fkey" FOREIGN KEY ("id") REFERENCES "ListFilter"("listId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterTaggingTag" ADD CONSTRAINT "ListFilterTaggingTag_taggingId_fkey" FOREIGN KEY ("taggingId") REFERENCES "ListFilterTagging"("id") ON DELETE CASCADE ON UPDATE CASCADE;
