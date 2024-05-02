import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { jsonReply, prisma } from "..";
import { Leaderboard } from "@prisma/client";

const perPage = 25;

declare interface RequestBody {
  score: number;
  duration: number;
  name: string;
}

declare interface LeaderboardWithRank extends Leaderboard {
  rank: number;
}

declare interface LeaderboardRecord {
  name: string;
  rank: number;
  score: number;
}

export async function leaderboard(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const ip =
    request.headers && request.headers["x-forwarded-for"]
      ? request.headers["x-forwarded-for"].replace(/:[0-9]+/, "")
      : "";

  let newRecordId = 0;
  if (request.method === "POST") {
    const body = (await request.json()) as RequestBody;
    const leaderboard = await prisma.leaderboard.create({
      data: {
        name: body.name,
        score: body.score,
        duration: body.duration,
        ip,
      },
    });
    newRecordId = leaderboard.id;
  }

  const leaderboardScores = await prisma.leaderboard.findMany({
    orderBy: { score: "desc" },
  });
  const leaderboardRanks = leaderboardScores.map((game, index) => ({
    ...game,
    rank: index + 1,
  }));

  const rank = newRecordId
    ? leaderboardRanks.find((record) => record.id === newRecordId).rank
    : 0;

  const leaderboardRecords = leaderboardRanks.map((game) => ({
    name: game.name,
    score: game.score,
    rank: game.rank,
  }));

  let startOffset = rank - Math.ceil(perPage / 2);
  if (startOffset < 1) {
    startOffset = 1;
  }
  const records = leaderboardRecords.length
    ? [
        leaderboardRecords[0],
        ...leaderboardRecords.slice(startOffset, startOffset + perPage - 1),
      ]
    : [];

  return jsonReply({ rank, records });
}

app.http("leaderboard", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: leaderboard,
});
