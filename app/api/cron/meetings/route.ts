import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateMatches } from "@/lib/matchmaking";
import { ParticipationStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

  // Find target meetings
  const meetings = await prisma.meeting.findMany({
    where: {
      startTime: {
        lte: fifteenMinutesFromNow,
      },
      matchmakingGeneratedAt: null,
    },
  });

  for (const meeting of meetings) {
    try {
      // Step 1: Auto-Confirm
      // Confirm participants who are JOINED but not confirmed
      await prisma.participation.updateMany({
        where: {
          meetingId: meeting.id,
          status: ParticipationStatus.JOINED,
          confirmedAt: null,
        },
        data: {
          confirmedAt: new Date(),
        },
      });

      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { autoConfirmProcessedAt: new Date() },
      });

      // Step 2: Truncation
      const joinedCount = await prisma.participation.count({
        where: {
          meetingId: meeting.id,
          status: ParticipationStatus.JOINED,
        },
      });

      const remainder = joinedCount % 4;
      if (remainder > 0) {
        // Find last 'remainder' participants (last joined)
        const participantsToRemove = await prisma.participation.findMany({
          where: {
            meetingId: meeting.id,
            status: ParticipationStatus.JOINED,
          },
          orderBy: {
            joinedAt: "desc",
          },
          take: remainder,
        });

        const idsToRemove = participantsToRemove.map((p) => p.id);

        if (idsToRemove.length > 0) {
          await prisma.participation.updateMany({
            where: {
              id: { in: idsToRemove },
            },
            data: {
              status: ParticipationStatus.REMOVED_BY_TRUNCATION,
              removedAt: new Date(),
            },
          });
        }
      }

      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { truncationAppliedAt: new Date() },
      });

      // Step 3: Matchmaking
      // We re-fetch inside generateMatches, which selects only JOINED.
      // Since we just truncated, we should have a multiple of 4.
      await generateMatches(meeting.id);

      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { matchmakingGeneratedAt: new Date() },
      });

    } catch (error) {
      console.error(`Error processing meeting ${meeting.id}:`, error);
      // We continue to the next meeting even if one fails
    }
  }

  return NextResponse.json({ success: true, processedCount: meetings.length });
}
