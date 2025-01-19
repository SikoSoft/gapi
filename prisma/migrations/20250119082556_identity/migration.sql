-- CreateTable
CREATE TABLE "ListConfig" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "ListConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListSort" (
    "listId" UUID NOT NULL,
    "property" VARCHAR(64) NOT NULL,
    "direction" VARCHAR(64) NOT NULL,

    CONSTRAINT "ListSort_pkey" PRIMARY KEY ("listId")
);

-- CreateTable
CREATE TABLE "ListFilter" (
    "listId" UUID NOT NULL,
    "includeUntagged" BOOLEAN NOT NULL DEFAULT false,
    "includeAll" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ListFilter_pkey" PRIMARY KEY ("listId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "firstName" VARCHAR(64) NOT NULL,
    "lastName" VARCHAR(64) NOT NULL,
    "password" VARCHAR(255) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(128) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "userId" UUID NOT NULL,
    "authToken" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("authToken")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL,
    "ip" VARCHAR(128) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "ListSort" ADD CONSTRAINT "ListSort_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ListConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilter" ADD CONSTRAINT "ListFilter_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ListConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
