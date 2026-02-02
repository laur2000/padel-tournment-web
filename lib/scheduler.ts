import { prisma } from "@/lib/prisma";
import { generateMatches } from "@/lib/matchmaking";
import { ParticipationStatus, TeamSide } from "@prisma/client";
import { sendReminderEmail, sendMatchmakingNotification } from "@/lib/email";
import { sendNotificationToUser } from "@/lib/notifications";

export async function processReminders() {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const reminderMeetings = await prisma.meeting.findMany({
    where: {
      startTime: {
        gte: now,
        lte: twentyFourHoursFromNow,
      },
    },
    include: {
      participations: {
        where: {
          status: ParticipationStatus.JOINED,
          confirmedAt: null,
          reminderSent: false,
        },
        include: { user: true },
      },
    },
  });

  for (const meeting of reminderMeetings) {
    for (const p of meeting.participations) {
      if (p.user.email) {
        await sendReminderEmail(
          p.user.email,
          meeting.id,
          meeting.place,
          meeting.startTime,
        );

        // Send Push Notification
        await sendNotificationToUser(p.userId, {
            title: "Recordatorio de Partido",
            body: `Recuerda confirmar tu asistencia para el partido en ${meeting.place}`,
            url: `/meetings/${meeting.id}`
        });

        // Mark as sent
        await prisma.participation.update({
          where: { id: p.id },
          data: { reminderSent: true },
        });
      }
    }
  }
}

export async function processMeetingsFinalization() {
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

  const meetingsToFinalize = await prisma.meeting.findMany({
    where: {
      startTime: {
        lte: fifteenMinutesFromNow,
      },
      matchmakingGeneratedAt: null,
    },
  });

  for (const meeting of meetingsToFinalize) {
    try {
      // Step 1: Auto-Confirm
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
      await generateMatches(meeting.id);

      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { matchmakingGeneratedAt: new Date() },
      });

      // Step 4: Send Final Emails
      const matches = await prisma.match.findMany({
        where: { meetingId: meeting.id },
        include: {
          teams: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
        orderBy: { courtNumber: "asc" },
      });

      const formattedMatches = matches.map((m) => {
        const teamA =
          m.teams
            .find((t) => t.side === TeamSide.A)
            ?.members.map(
              (mem) => mem.user.name || mem.user.email || "Unknown",
            ) || [];
        const teamB =
          m.teams
            .find((t) => t.side === TeamSide.B)
            ?.members.map(
              (mem) => mem.user.name || mem.user.email || "Unknown",
            ) || [];
        return {
          courtNumber: m.courtNumber,
          teamA,
          teamB,
        };
      });

      const confirmedParticipants = await prisma.participation.findMany({
        where: {
          meetingId: meeting.id,
          status: ParticipationStatus.JOINED,
        },
        include: { user: true },
      });

      for (const p of confirmedParticipants) {
        if (p.user.email) {
          await sendMatchmakingNotification(
            p.user.email,
            meeting.place,
            meeting.startTime,
            formattedMatches,
          );
        }
        
        // Send Push Notification
        await sendNotificationToUser(p.userId, {
            title: "¡Partidos Generados!",
            body: `Los partidos para ${meeting.place} han sido organizados. Mira con quién juegas.`,
            url: `/meetings/${meeting.id}`
        });
      }
    } catch (error) {
      console.error(`Error processing meeting ${meeting.id}:`, error);
    }
  }
}
