import { Prisma } from "@prisma/client";

export interface WorkspaceCreateBody {
  name: string;
  listConfigs: string[];
}

export interface WorkspaceUpdateBody {
  name: string;
  listConfigs: string[];
}

const prismaWorkspaceValidator = Prisma.validator<Prisma.WorkspaceFindManyArgs>()({
  include: {
    workspaceListConfigs: true,
  },
});

export type PrismaWorkspace = Prisma.WorkspaceGetPayload<typeof prismaWorkspaceValidator>;
