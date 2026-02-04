"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ParticipationStatus, Meeting } from "@prisma/client";
import { sendWaitlistPromotionEmail } from "@/lib/email";
import { sendNotificationToUser } from "@/lib/notifications";

export async function createMeeting(data: {
  place: string;
  startTime: Date;
  numCourts: number;
  latitude?: number;
  longitude?: number;
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
      latitude: data.latitude,
      longitude: data.longitude,
      createdByUserId: session.user.id,
    },
  });

  revalidatePath("/meetings");
  redirect("/meetings");
}

export async function deleteMeeting(meetingId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.is_admin) {
    throw new Error("Unauthorized");
  }

  await prisma.meeting.delete({
    where: { id: meetingId },
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
  const result = await prisma.$transaction(
    async (tx) => {
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
          return {
            status: existingParticipation.status,
            message: "Already participating",
          };
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
          joinedAt:
            newStatus === ParticipationStatus.JOINED ? new Date() : null,
          waitlistedAt:
            newStatus === ParticipationStatus.WAITLISTED ? new Date() : null,
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
    },
    {
      isolationLevel: "Serializable",
    },
  );

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
      // 0. Check Leave Constraints
      const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) throw new Error("Meeting not found");

      const now = new Date();
      // Cannot leave if meeting has already started
      if (now >= meeting.startTime) {
        throw new Error("Cannot leave: meeting has already started.");
      }
      
      // Cannot leave if matchmaking has been generated
      if (meeting.matchmakingGeneratedAt) {
        throw new Error("Cannot leave: matchmaking has already been generated.");
      }

      const minutesUntilStart = (meeting.startTime.getTime() - now.getTime()) / (1000 * 60);

      // "once all players are confirmed and there is less than 15min before the match"
      if (minutesUntilStart < 15 && minutesUntilStart > 0) {
        const joinedParticipants = await tx.participation.findMany({
          where: { meetingId, status: ParticipationStatus.JOINED },
        });
        const allConfirmed = joinedParticipants.every((p) => p.confirmedAt);
        if (allConfirmed) {
            throw new Error("Cannot leave: match is locked (less than 15m and all confirmed).");
        }
      }

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
    },
  );

  if (promotionEmailData) {
    await sendWaitlistPromotionEmail(
      // @ts-ignore
      promotionEmailData.email,
      // @ts-ignore
      promotionEmailData.meetingId,
      // @ts-ignore
      promotionEmailData.place,
      // @ts-ignore
      promotionEmailData.startTime,
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

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new Error("Meeting not found");

  const now = new Date();
  const timeDiff = meeting.startTime.getTime() - now.getTime();
  const hoursUntilStart = timeDiff / (1000 * 60 * 60);

  if (hoursUntilStart > 24) {
     throw new Error("Confirmation only available 24h before match");
  }
  if (timeDiff < 0) {
      throw new Error("Match already started");
  }

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

export async function adminRemovePlayer(meetingId: string, userId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || !session.user.is_admin) {
    throw new Error("Unauthorized");
  }

  // We reuse logic similar to leaveMeeting but without time constraints for admins
  // However, we still need to handle promotion if a JOINED player is removed.
  
  const promotionData = await prisma.$transaction(
    async (tx) => {
      let data: {
        userId: string;
        email: string | null;
        meetingId: string;
        place: string;
        startTime: Date;
      } | null = null;

      // 0. Check meeting exists
      const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) throw new Error("Meeting not found");

      // Note: we purposefully SKIP the "too late to leave" checks for admins.
      // Admins should be able to kick players even last minute.
      
      const participation = await tx.participation.findUnique({
        where: {
          meetingId_userId: {
            meetingId,
            userId,
          },
        },
      });

      if (!participation || participation.status === ParticipationStatus.LEFT) {
        return null; // Nothing to do
      }

      const wasJoined = participation.status === ParticipationStatus.JOINED;

      // 1. Mark user as REMOVED (or LEFT) - logic implies they are out.
      // We'll use LEFT status but maybe add a note? For now std LEFT is fine.
      await tx.participation.update({
        where: { id: participation.id },
        data: {
          status: ParticipationStatus.LEFT,
          leftAt: new Date(),
          confirmedAt: null,
          // We could add a 'removedBy' field if schema supported it, but it doesn't.
        },
      });

      // 2. Promotion Logic (Same as leaveMeeting)
      if (wasJoined) {
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

         data = {
            userId: firstWaitlisted.userId,
            email: firstWaitlisted.user.email,
            meetingId,
            place: meeting.place,
            startTime: meeting.startTime,
            };
        }
      }
      return data;
    },
    { isolationLevel: "Serializable" }
  );

  if (promotionData) {
    if (promotionData.email) {
        await sendWaitlistPromotionEmail(
        promotionData.email,
        promotionData.meetingId,
        promotionData.place,
        promotionData.startTime,
        );
    }
    
    // Push Notification
    await sendNotificationToUser(promotionData.userId, {
        title: "¡Has entrado al partido!",
        body: `Una plaza se ha liberado en ${promotionData.place}. Ahora estás dentro.`,
        url: `/meetings/${promotionData.meetingId}`
    });
  }

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
}

export async function adminConfirmPlayer(meetingId: string, userId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || !session.user.is_admin) {
    throw new Error("Unauthorized");
  }

  await prisma.participation.updateMany({
    where: {
        meetingId,
        userId,
        status: ParticipationStatus.JOINED
    },
    data: {
        confirmedAt: new Date()
    }
  });

  revalidatePath(`/meetings/${meetingId}`);
}

export async function adminAddPlayer(meetingId: string, data: { userId?: string; name: string }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || !session.user.is_admin) {
    throw new Error("Unauthorized");
  }

  let targetUserId = data.userId;

  if (!targetUserId) {
    // Create Guest User
    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        isGuest: true,
      }
    });
    targetUserId = newUser.id;
  }

  // Add to participation
  await prisma.participation.upsert({
    where: {
        meetingId_userId: {
            meetingId,
            userId: targetUserId!
        }
    },
    create: {
        meetingId,
        userId: targetUserId!,
        status: ParticipationStatus.JOINED,
        joinedAt: new Date(),
        confirmedAt: new Date(),
    },
    update: {
        status: ParticipationStatus.JOINED,
        joinedAt: new Date(),
        confirmedAt: new Date(),
        leftAt: null,
        waitlistedAt: null,
        removedAt: null,
    }
  });

  revalidatePath(`/meetings/${meetingId}`);
}

export async function addGuest(meetingId: string, name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new Error("Meeting not found");

  const now = new Date();
  const timeDiff = meeting.startTime.getTime() - now.getTime();
  const hoursUntilStart = timeDiff / (1000 * 60 * 60);

  // 72h rule: Only allowed if less than 72h AND match hasn't started
  if (hoursUntilStart > 72) {
    throw new Error("Guests can only be added 72 hours before the match");
  }
  if (timeDiff < 0) {
    throw new Error("Cannot add guest to past meetings");
  }

  // Transaction to manage guest creation and participation
  await prisma.$transaction(async (tx) => {
    // Create Guest User
    const guestUser = await tx.user.create({
      data: {
        name: name,
        isGuest: true,
      }
    });

    // Determine status (JOINED or WAITLISTED)
    const joinedCount = await tx.participation.count({
      where: {
        meetingId,
        status: ParticipationStatus.JOINED,
      },
    });
    const maxParticipants = meeting.numCourts * 4;

    const status = joinedCount < maxParticipants ? ParticipationStatus.JOINED : ParticipationStatus.WAITLISTED;
    const joinedAt = status === ParticipationStatus.JOINED ? new Date() : null;
    const waitlistedAt = status === ParticipationStatus.WAITLISTED ? new Date() : null;

    // Create Participation
    await tx.participation.create({
      data: {
        meetingId,
        userId: guestUser.id,
        status,
        joinedAt,
        waitlistedAt,
        addedByUserId: session.user.id,
      },
    });
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
}

export async function removeGuest(meetingId: string, guestUserId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  
  const promotionData = await prisma.$transaction(async (tx) => {
    const participation = await tx.participation.findUnique({
      where: {
        meetingId_userId: {
          meetingId,
          userId: guestUserId,
        },
      },
    });

    if (!participation) throw new Error("Guest not found in meeting");

    if (participation.addedByUserId !== session.user.id) {
        throw new Error("You can only remove guests you added");
    }

    const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new Error("Meeting not found");

    const now = new Date();
    const minutesUntilStart = (meeting.startTime.getTime() - now.getTime()) / (1000 * 60);
    
    // 15min lock if confirmed (following general leaveMeeting logic)
    if (minutesUntilStart < 15 && minutesUntilStart > 0 && participation.status === ParticipationStatus.JOINED && participation.confirmedAt) {
       // Logic for strict lock could be here if needed, consistent with leaveMeeting
    }

    // Mark as LEFT
    await tx.participation.update({
      where: { id: participation.id },
      data: {
        status: ParticipationStatus.LEFT,
        leftAt: new Date(),
        confirmedAt: null,
      },
    });

    if (participation.status === ParticipationStatus.JOINED) {
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
          
           return {
            email: firstWaitlisted.user.email,
            meetingId,
            place: meeting.place,
            startTime: meeting.startTime,
            userId: firstWaitlisted.userId
          };
        }
    }
    return null;
  });

  if (promotionData && promotionData.email) {
      await sendWaitlistPromotionEmail(
        promotionData.email,
        promotionData.meetingId,
        promotionData.place,
        promotionData.startTime,
      );
      await sendNotificationToUser(promotionData.userId, {
        title: "¡Has entrado al partido!",
        body: `Una plaza se ha liberado en ${promotionData.place}. Ahora estás dentro.`,
        url: `/meetings/${promotionData.meetingId}`
      });
  }

  revalidatePath(`/meetings/${meetingId}`);
}

export async function confirmGuest(meetingId: string, guestUserId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const participation = await prisma.participation.findUnique({
    where: {
      meetingId_userId: {
        meetingId,
        userId: guestUserId,
      },
    },
  });

  if (!participation) throw new Error("Participation not found");

  if (participation.addedByUserId !== session.user.id) {
    throw new Error("You can only confirm guests you added");
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new Error("Meeting not found");

  const now = new Date();
  const timeDiff = meeting.startTime.getTime() - now.getTime();
  const hoursUntilStart = timeDiff / (1000 * 60 * 60);

  if (hoursUntilStart > 24) {
    throw new Error("Confirmation only available 24h before match");
  }
  if (timeDiff < 0) {
      throw new Error("Match already started");
  }

  await prisma.participation.update({
    where: { id: participation.id },
    data: {
      confirmedAt: new Date(),
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
}