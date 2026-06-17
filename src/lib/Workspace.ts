import { Result, err, ok } from "neverthrow";
import { v4 as uuidv4 } from "uuid";
import { Workspace as WorkspaceSpec } from "api-spec/models";
import { prisma } from "..";
import { PrismaWorkspace, WorkspaceUpdateBody } from "../models/Workspace";

export class Workspace {
  static async create(
    userId: string,
    name: string,
    color: string,
    theme: string,
    showEverything: boolean,
    listConfigs: string[]
  ): Promise<Result<WorkspaceSpec.Workspace, Error>> {
    try {
      const id = uuidv4();
      const created = await prisma.workspace.create({
        data: {
          id,
          name,
          color,
          theme,
          showEverything,
          userId,
          workspaceListConfigs: {
            create: listConfigs.map(listConfigId => ({ listConfigId })),
          },
        },
        include: {
          workspaceListConfigs: true,
          workspaceStreaks: true,
          workspaceFacts: true,
          workspaceCharts: true,
        },
      });

      return ok(Workspace.mapDataToSpec(created));
    } catch (error) {
      return err(new Error("Failed to create workspace", { cause: error }));
    }
  }

  static async update(
    userId: string,
    id: string,
    body: WorkspaceUpdateBody
  ): Promise<Result<WorkspaceSpec.Workspace, Error>> {
    try {
      if (body.listConfigs !== undefined) {
        await prisma.workspaceListConfig.deleteMany({ where: { workspaceId: id } });
      }
      if (body.streaks !== undefined) {
        await prisma.workspaceStreak.deleteMany({ where: { workspaceId: id } });
      }
      if (body.facts !== undefined) {
        await prisma.workspaceFact.deleteMany({ where: { workspaceId: id } });
      }
      if (body.charts !== undefined) {
        await prisma.workspaceChart.deleteMany({ where: { workspaceId: id } });
      }

      const updated = await prisma.workspace.update({
        where: { id, userId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.color !== undefined && { color: body.color }),
          ...(body.theme !== undefined && { theme: body.theme }),
          ...(body.showEverything !== undefined && { showEverything: body.showEverything }),
          ...(body.listConfigs !== undefined && {
            workspaceListConfigs: {
              create: body.listConfigs.map(listConfigId => ({ listConfigId })),
            },
          }),
          ...(body.streaks !== undefined && {
            workspaceStreaks: {
              create: body.streaks.map(streakId => ({ streakId, userId })),
            },
          }),
          ...(body.facts !== undefined && {
            workspaceFacts: {
              create: body.facts.map(factId => ({ factId, userId })),
            },
          }),
          ...(body.charts !== undefined && {
            workspaceCharts: {
              create: body.charts.map(chartId => ({ chartId, userId })),
            },
          }),
        },
        include: {
          workspaceListConfigs: true,
          workspaceStreaks: true,
          workspaceFacts: true,
          workspaceCharts: true,
        },
      });

      return ok(Workspace.mapDataToSpec(updated));
    } catch (error) {
      return err(new Error("Failed to update workspace", { cause: error }));
    }
  }

  static async delete(
    userId: string,
    id: string
  ): Promise<Result<boolean, Error>> {
    try {
      await prisma.workspace.delete({ where: { id, userId } });
      return ok(true);
    } catch (error) {
      return err(new Error("Failed to delete workspace", { cause: error }));
    }
  }

  static async getById(
    userId: string,
    id: string
  ): Promise<Result<WorkspaceSpec.Workspace, Error>> {
    try {
      const workspace = await prisma.workspace.findFirstOrThrow({
        where: { id, userId },
        include: {
          workspaceListConfigs: true,
          workspaceStreaks: true,
          workspaceFacts: true,
          workspaceCharts: true,
        },
      });

      return ok(Workspace.mapDataToSpec(workspace));
    } catch (error) {
      return err(new Error("Failed to get workspace", { cause: error }));
    }
  }

  static async getByUser(
    userId: string
  ): Promise<Result<WorkspaceSpec.Workspace[], Error>> {
    try {
      const workspaces = await prisma.workspace.findMany({
        where: { userId },
        include: {
          workspaceListConfigs: true,
          workspaceStreaks: true,
          workspaceFacts: true,
          workspaceCharts: true,
        },
        orderBy: { name: "asc" },
      });

      return ok(workspaces.map(Workspace.mapDataToSpec));
    } catch (error) {
      return err(new Error("Failed to retrieve workspaces", { cause: error }));
    }
  }

  static mapDataToSpec(data: PrismaWorkspace): WorkspaceSpec.Workspace {
    return {
      id: data.id,
      name: data.name,
      color: data.color,
      theme: data.theme as WorkspaceSpec.Theme,
      showEverything: data.showEverything,
      userId: data.userId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      listConfigs: data.workspaceListConfigs.map(wlc => wlc.listConfigId),
      streaks: data.workspaceStreaks.map(ws => ws.streakId),
      facts: data.workspaceFacts.map(wf => wf.factId),
      charts: data.workspaceCharts.map(wc => wc.chartId),
    };
  }
}
