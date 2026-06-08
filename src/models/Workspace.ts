import { z } from "zod";
import { Prisma } from "@prisma/client";

export const WorkspaceCreateBodySchema = z.object({
  name: z.string(),
  color: z.string(),
  theme: z.string(),
  showEverything: z.boolean(),
  listConfigs: z.array(z.string()),
});
export type WorkspaceCreateBody = z.infer<typeof WorkspaceCreateBodySchema>;

export const WorkspaceUpdateBodySchema = z.object({
  name: z.string(),
  color: z.string(),
  theme: z.string(),
  showEverything: z.boolean(),
  listConfigs: z.array(z.string()),
});
export type WorkspaceUpdateBody = z.infer<typeof WorkspaceUpdateBodySchema>;

const prismaWorkspaceValidator = Prisma.validator<Prisma.WorkspaceFindManyArgs>()({
  include: {
    workspaceListConfigs: true,
  },
});

export type PrismaWorkspace = Prisma.WorkspaceGetPayload<typeof prismaWorkspaceValidator>;
