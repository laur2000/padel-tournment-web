import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMatches } from '../../lib/matchmaking';
import { prisma } from '../../lib/prisma';
import { ParticipationStatus } from '@prisma/client';

// Mock the prisma client
vi.mock('../../lib/prisma', () => ({
  prisma: {
    participation: {
      findMany: vi.fn(),
    },
    match: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('matchmaking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not generate matches if no participants joined', async () => {
    vi.mocked(prisma.participation.findMany).mockResolvedValue([]);

    await generateMatches('meeting-123');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should generate matches for a group of 4', async () => {
    const mockParticipants: any[] = [
      { userId: 'u1', status: ParticipationStatus.JOINED },
      { userId: 'u2', status: ParticipationStatus.JOINED },
      { userId: 'u3', status: ParticipationStatus.JOINED },
      { userId: 'u4', status: ParticipationStatus.JOINED },
    ];
    vi.mocked(prisma.participation.findMany).mockResolvedValue(mockParticipants);

    await generateMatches('meeting-123');

    expect(prisma.$transaction).toHaveBeenCalled();
    // Verify the structure of the transaction
    const transactionArgs = vi.mocked(prisma.$transaction).mock.calls[0][0];
    expect(Array.isArray(transactionArgs)).toBe(true);
    expect(transactionArgs).toHaveLength(1);
  });
});
