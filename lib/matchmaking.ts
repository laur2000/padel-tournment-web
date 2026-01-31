
import { prisma } from './prisma';
import { ParticipationStatus, TeamSide } from '@prisma/client';

export async function generateMatches(meetingId: string) {
  // 1. Fetch all JOINED participants
  const participants = await prisma.participation.findMany({
    where: {
      meetingId: meetingId,
      status: ParticipationStatus.JOINED,
    },
    include: {
      user: true,
    },
  });

  if (participants.length === 0) {
    return;
  }

  // 2. Shuffle array (Fisher-Yates)
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 3. Chunk into groups of 4
  const chunks = [];
  for (let i = 0; i < shuffled.length; i += 4) {
    chunks.push(shuffled.slice(i, i + 4));
  }

  // 4. Create Matches and Teams
  // We expect truncation to have happened, so chunks should be full 4-people groups.
  // But if there's a remainder < 4 at the end, we skip it (or handle it otherwise, but instructions implied truncation handled it).
  const validChunks = chunks.filter((chunk) => chunk.length === 4);

  if (validChunks.length === 0) {
    return;
  }

  // Calculate starting court number, or just iterate? 
  // We can assume court numbers start at 1 for each meeting's set of matches generated here.
  // If matches already exist, we might want to offset, but the requirement implies this is the one-time generation.
  
  const createMatchOperations = validChunks.map((chunk, index) => {
    const courtNumber = index + 1;
    const teamAMembers = [chunk[0], chunk[1]];
    const teamBMembers = [chunk[2], chunk[3]];

    return prisma.match.create({
      data: {
        meetingId: meetingId,
        courtNumber: courtNumber,
        teams: {
          create: [
            {
              side: TeamSide.A,
              members: {
                create: teamAMembers.map((p) => ({ userId: p.userId })),
              },
            },
            {
              side: TeamSide.B,
              members: {
                create: teamBMembers.map((p) => ({ userId: p.userId })),
              },
            },
          ],
        },
      },
    });
  });

  await prisma.$transaction(createMatchOperations);
}
