import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addGuest, setGuestsAllowed } from '@/lib/actions/meetings';
import { prisma } from '@/lib/prisma';
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
      update: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    participation: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
  }));

describe('Guest Access Control', () => {
    const adminId = 'admin-user';
    const userId = 'normal-user';
    const meetingId = 'meeting-123';
    const guestId = 'guest-1';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockSession = (id: string, isAdmin: boolean) => {
        (getServerSession as any).mockResolvedValue({
            user: { id, is_admin: isAdmin },
        });
        (prisma.user.findUnique as any).mockResolvedValue({ id });
    };

    describe('setGuestsAllowed (Admin Toggle)', () => {
        it('Admin should be able to toggle guest access', async () => {
            mockSession(adminId, true);
            
            await setGuestsAllowed(meetingId, true);

            expect(prisma.meeting.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: meetingId },
                data: { allowGuests: true }
            }));
        });

        it('Non-admin should NOT be able to toggle guest access', async () => {
            mockSession(userId, false);
            
            await expect(setGuestsAllowed(meetingId, true)).rejects.toThrow(/Unauthorized/);
            expect(prisma.meeting.update).not.toHaveBeenCalled();
        });
    });

    describe('addGuest (With Boolean Flag)', () => {
        it('Should ALLOW adding guest if meeting.allowGuests is TRUE', async () => {
            mockSession(userId, false);

            (prisma.meeting.findUnique as any).mockResolvedValue({
                id: meetingId,
                startTime: new Date(Date.now() + 10000000), // Future
                allowGuests: true, // OPEN
                numCourts: 1
            });
            (prisma.participation.count as any).mockResolvedValue(0);
            (prisma.user.create as any).mockResolvedValue({ id: guestId });

            await addGuest(meetingId, 'My Guest');

            expect(prisma.participation.create).toHaveBeenCalled();
        });

        it('Should DENY adding guest if meeting.allowGuests is FALSE', async () => {
            mockSession(userId, false);

            (prisma.meeting.findUnique as any).mockResolvedValue({
                id: meetingId,
                startTime: new Date(Date.now() + 10000000), // Future
                allowGuests: false, // CLOSED
                numCourts: 1
            });

            await expect(addGuest(meetingId, 'My Guest')).rejects.toThrow(/Añadir invitados no está permitido para este partido/);
            expect(prisma.participation.create).not.toHaveBeenCalled();
        });
    });
});
