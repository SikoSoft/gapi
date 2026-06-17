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
  name: z.string().optional(),
  color: z.string().optional(),
  theme: z.string().optional(),
  showEverything: z.boolean().optional(),
  listConfigs: z.array(z.string()).optional(),
  streaks: z.array(z.number().int()).optional(),
  facts: z.array(z.number().int()).optional(),
});
export type WorkspaceUpdateBody = z.infer<typeof WorkspaceUpdateBodySchema>;

const prismaWorkspaceValidator = Prisma.validator<Prisma.WorkspaceFindManyArgs>()({
  include: {
    workspaceListConfigs: true,
    workspaceStreaks: true,
    workspaceFacts: true,
  },
});

export type PrismaWorkspace = Prisma.WorkspaceGetPayload<typeof prismaWorkspaceValidator>;
