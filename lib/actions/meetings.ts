"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ParticipationStatus, Meeting } from "@prisma/client";
import { sendWaitlistPromotionEmail } from "@/lib/email";

export async function createMeeting(data: {
  place: string;
  startTime: Date;
  numCourts: number;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.is_admin) {
    throw new Error("Unauthorized");
  }

  await prisma.meeting.create({
    data: {
      place: data.place,
      startTime: data.startTime,
      numCourts: data.numCourts,
      createdByUserId: session.user.id,
    },
  });

  revalidatePath("/meetings");
  redirect("/meetings");
}

export async function joinMeeting(meetingId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const userId = session.user.id;

  // Transaction for concurrency safety
  const result = await prisma.$transaction(async (tx) => {
    // 1. Get Meeting Info
    const meeting = await tx.meeting.findUnique({
      where: { id: meetingId },
    });
    if (!meeting) throw new Error("Meeting not found");

    if (meeting.startTime < new Date()) {
      throw new Error("Cannot join past meetings");
    }

    const maxParticipants = meeting.numCourts * 4;

    // 2. Count JOINED Participants & Check current user status
    const joinedCount = await tx.participation.count({
      where: {
        meetingId,
        status: ParticipationStatus.JOINED,
      },
    });

    const existingParticipation = await tx.participation.findUnique({
      where: {
        meetingId_userId: {
          meetingId,
          userId,
        },
      },
    });

    // If user already has a participation entry
    if (existingParticipation) {
      if (
        existingParticipation.status === ParticipationStatus.JOINED ||
        existingParticipation.status === ParticipationStatus.WAITLISTED
      ) {
        return { status: existingParticipation.status, message: "Already participating" };
      }
      // If they were LEFT or REMOVED, we re-evaluate
    }

    let newStatus: ParticipationStatus = ParticipationStatus.WAITLISTED;
    let joinedAt: Date | null = null;
    let waitlistedAt: Date | null = null;

    if (joinedCount < maxParticipants) {
      newStatus = ParticipationStatus.JOINED;
      joinedAt = new Date();
    } else {
      newStatus = ParticipationStatus.WAITLISTED;
      waitlistedAt = new Date();
    }

    // Upsert Participation
    await tx.participation.upsert({
      where: {
        meetingId_userId: {
          meetingId,
          userId,
        },
      },
      update: {
        status: newStatus,
        joinedAt: newStatus === ParticipationStatus.JOINED ? new Date() : null,
        waitlistedAt: newStatus === ParticipationStatus.WAITLISTED ? new Date() : null,
        leftAt: null,
        removedAt: null,
        confirmedAt: null, // Reset confirmation on re-join
      },
      create: {
        meetingId,
        userId,
        status: newStatus,
        joinedAt: joinedAt,
        waitlistedAt: waitlistedAt,
      },
    });

    return { status: newStatus, message: `You are now ${newStatus}` };
  }, {
    isolationLevel: 'Serializable' 
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  return result;
}

export async function leaveMeeting(meetingId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const userId = session.user.id;

  let promotionEmailData: {
    email: string;
    meetingId: string;
    place: string;
    startTime: Date;
  } | null = null;

  await prisma.$transaction(
    async (tx) => {
      const participation = await tx.participation.findUnique({
        where: {
          meetingId_userId: {
            meetingId,
            userId,
          },
        },
      });

      if (!participation || participation.status === ParticipationStatus.LEFT) {
        return; // Nothing to do
      }

      const wasJoined = participation.status === ParticipationStatus.JOINED;

      // 1. Mark user as LEFT
      await tx.participation.update({
        where: { id: participation.id },
        data: {
          status: ParticipationStatus.LEFT,
          leftAt: new Date(),
          confirmedAt: null,
        },
      });

      // 2. Promotion Logic
      if (wasJoined) {
        // Find the first person on the waitlist
        const firstWaitlisted = await tx.participation.findFirst({
          where: {
            meetingId,
            status: ParticipationStatus.WAITLISTED,
          },
          orderBy: {
            waitlistedAt: "asc",
          },
          include: { user: true },
        });

        if (firstWaitlisted) {
          await tx.participation.update({
            where: { id: firstWaitlisted.id },
            data: {
              status: ParticipationStatus.JOINED,
              joinedAt: new Date(),
              waitlistedAt: null,
            },
          });

          // Prepare email data
          if (firstWaitlisted.user.email) {
            const meeting = await tx.meeting.findUnique({
              where: { id: meetingId },
            });
            if (meeting) {
              promotionEmailData = {
                email: firstWaitlisted.user.email,
                meetingId,
                place: meeting.place,
                startTime: meeting.startTime,
              };
            }
          }
        }
      }
    },
    {
      isolationLevel: "Serializable",
    }
  );

  if (promotionEmailData) {
    // @ts-ignore
    await sendWaitlistPromotionEmail(
      promotionEmailData.email,
      promotionEmailData.meetingId,
      promotionEmailData.place,
      promotionEmailData.startTime
    );
  }

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
}

export async function confirmAttendance(meetingId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const userId = session.user.id;

  await prisma.participation.updateMany({
    where: {
      meetingId,
      userId,
      status: ParticipationStatus.JOINED,
    },
    data: {
      confirmedAt: new Date(),
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
}
