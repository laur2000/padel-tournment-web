import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addGuest, removeGuest, confirmGuest } from '@/lib/actions/meetings';
import { prisma } from '@/lib/prisma';
import { ParticipationStatus } from '@prisma/client';
import { getServerSession } from 'next-auth';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((callback) => callback(prisma)),
    meeting: {
      findUnique: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    participation: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
    sendWaitlistPromotionEmail: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
  }));

describe('Guest Actions', () => {
  const userAId = 'user-A';
  const userBId = 'user-B';
  const meetingId = 'meeting-123';
  const guestUserAId = 'guest-A-1'; // Guest added by A
  const guestUserBId = 'guest-B-1'; // Guest added by B

  // Helper to set current user
  const mockUser = (userId: string) => {
    (getServerSession as any).mockResolvedValue({
      user: { id: userId, is_admin: false },
    });
    (prisma.user.findUnique as any).mockResolvedValue({ id: userId });
  };

  const within72h = new Date();
  within72h.setHours(within72h.getHours() + 48); // 48h from now

  const over72h = new Date();
  over72h.setHours(over72h.getHours() + 100); // 100h from now

  const within24h = new Date();
  within24h.setHours(within24h.getHours() + 12); // 12h from now

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('removeGuest & confirmGuest (Ownership Checks)', () => {
    it('UserA should be able to remove their own guest', async () => {
        mockUser(userAId);

        // Mock participation found
        (prisma.participation.findUnique as any).mockResolvedValue({
            id: 'part-1',
            meetingId,
            userId: guestUserAId,
            addedByUserId: userAId, // Matches UserA
            status: ParticipationStatus.JOINED
        });

        (prisma.meeting.findUnique as any).mockResolvedValue({
            id: meetingId,
            startTime: within72h,
        });

        await removeGuest(meetingId, guestUserAId);

        expect(prisma.participation.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'part-1' },
            data: expect.objectContaining({ status: ParticipationStatus.LEFT })
        }));
    });

    it('UserB should NOT be able to remove guest added by UserA', async () => {
        mockUser(userBId); // User B logged in

        // Mock participation found (But added by User A)
        (prisma.participation.findUnique as any).mockResolvedValue({
            id: 'part-1',
            meetingId,
            userId: guestUserAId,
            addedByUserId: userAId, // Matches UserA
            status: ParticipationStatus.JOINED
        });

        await expect(removeGuest(meetingId, guestUserAId)).rejects.toThrow(/You can only remove guests you added/);
        
        // Ensure NO update happened
        expect(prisma.participation.update).not.toHaveBeenCalled();
    });

    it('UserA should be able to confirm their own guest (within 24h)', async () => {
        mockUser(userAId);

        (prisma.participation.findUnique as any).mockResolvedValue({
            id: 'part-1',
            meetingId,
            userId: guestUserAId,
            addedByUserId: userAId,
            status: ParticipationStatus.JOINED
        });

        (prisma.meeting.findUnique as any).mockResolvedValue({
            id: meetingId,
            startTime: within24h,
        });

        await confirmGuest(meetingId, guestUserAId);

        expect(prisma.participation.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'part-1' },
            data: expect.objectContaining({ confirmedAt: expect.any(Date) })
        }));
    });

    it('UserB should NOT be able to confirm guest added by UserA', async () => {
        mockUser(userBId);

        (prisma.participation.findUnique as any).mockResolvedValue({
            id: 'part-1',
            meetingId,
            userId: guestUserAId,
            addedByUserId: userAId, // Owned by A
            status: ParticipationStatus.JOINED
        });

        await expect(confirmGuest(meetingId, guestUserAId)).rejects.toThrow(/You can only confirm guests you added/);
        expect(prisma.participation.update).not.toHaveBeenCalled();
    });
  });
});
