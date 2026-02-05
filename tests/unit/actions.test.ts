import { describe, it, expect, vi, beforeEach } from 'vitest';
import { joinMeeting } from '@/lib/actions/meetings';
import { prisma } from '@/lib/prisma';
import { ParticipationStatus } from '@prisma/client';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock module imports (only prisma in actions.test.ts mainly, email is separate)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((callback) => callback(prisma)),
    meeting: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(), 
      update: vi.fn(),
    },
    participation: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    }
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

// Import mock to set implementation
import { getServerSession } from 'next-auth';
import { createMeeting, deleteMeeting, updateMeeting, leaveMeeting, confirmAttendance } from '@/lib/actions/meetings';
import { sendWaitlistPromotionEmail } from '@/lib/email';

describe('Actions: joinMeeting', () => {
  const mockUserId = 'user-123';
  const mockMeetingId = 'meeting-123';
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);

  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue({
      user: { id: mockUserId, is_admin: false },
    });
    // Mock user existence check
    (prisma.user.findUnique as any).mockResolvedValue({ id: mockUserId });
  });

  // ... (Existing joinMeeting tests remain unchanged) ...
  it('should join as JOINED if slots are available', async () => {
    // Setup Mocks
    (prisma.meeting.findUnique as any).mockResolvedValue({
      id: mockMeetingId,
      startTime: futureDate,
      numCourts: 1, // Capacity = 4
    });
    
    // 3 existing participants
    (prisma.participation.count as any).mockResolvedValue(3);
    
    // No existing participation for user
    (prisma.participation.findUnique as any).mockResolvedValue(null);

    const result = await joinMeeting(mockMeetingId);

    expect(result.status).toBe(ParticipationStatus.JOINED);
    expect(prisma.participation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        status: ParticipationStatus.JOINED
      })
    }));
  });

  it('should join as WAITLISTED if meeting is full', async () => {
    // Setup Mocks
    (prisma.meeting.findUnique as any).mockResolvedValue({
      id: mockMeetingId,
      startTime: futureDate,
      numCourts: 1, // Capacity = 4
    });
    
    // 4 existing participants (FULL)
    (prisma.participation.count as any).mockResolvedValue(4);
    
    (prisma.participation.findUnique as any).mockResolvedValue(null);

    const result = await joinMeeting(mockMeetingId);

    expect(result.status).toBe(ParticipationStatus.WAITLISTED);
    expect(prisma.participation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        status: ParticipationStatus.WAITLISTED
      })
    }));
  });

  it('should throw error if meeting is in the past', async () => {
     const pastDate = new Date();
     pastDate.setDate(pastDate.getDate() - 1);

    (prisma.meeting.findUnique as any).mockResolvedValue({
      id: mockMeetingId,
      startTime: pastDate,
      numCourts: 1,
    });

    await expect(joinMeeting(mockMeetingId)).rejects.toThrow('Cannot join past meetings');
  });

  it('should return existing status if user already joined', async () => {
     (prisma.meeting.findUnique as any).mockResolvedValue({
      id: mockMeetingId,
      startTime: futureDate,
      numCourts: 1,
    });
    
    (prisma.participation.count as any).mockResolvedValue(2);

    (prisma.participation.findUnique as any).mockResolvedValue({
        status: ParticipationStatus.JOINED
    });

    const result = await joinMeeting(mockMeetingId);
    expect(result.message).toBe('Already participating');
  });
});

describe('Actions: leaveMeeting', () => {
    const mockUserId = 'user-123';
    const mockMeetingId = 'meeting-123';
    
    beforeEach(() => {
        vi.clearAllMocks();
        (getServerSession as any).mockResolvedValue({
            user: { id: mockUserId },
        });
    });

    it('should promote first waitlisted user when a joined user leaves', async () => {
        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 2); // >15 mins

        (prisma.meeting.findUnique as any).mockResolvedValue({
            id: mockMeetingId,
            startTime: futureDate,
            place: 'Test Court'
        });

        // Current User is JOINED
        (prisma.participation.findUnique as any).mockResolvedValue({
            id: 'p-1',
            status: ParticipationStatus.JOINED
        });

        // Waitlisted User Exists
        const waitlistedUser = { 
            id: 'p-wait', 
            status: ParticipationStatus.WAITLISTED,
            user: { email: 'wait@test.com' }
        };
        (prisma.participation.findFirst as any).mockResolvedValue(waitlistedUser);

        await leaveMeeting(mockMeetingId);

        // Verify current user left
        expect(prisma.participation.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'p-1' },
            data: expect.objectContaining({ status: ParticipationStatus.LEFT })
        }));

        // Verify waitlisted user promoted
        expect(prisma.participation.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'p-wait' },
            data: expect.objectContaining({ status: ParticipationStatus.JOINED })
        }));

        // Verify Email Sent
        expect(sendWaitlistPromotionEmail).toHaveBeenCalledWith(
            'wait@test.com',
            mockMeetingId,
            'Test Court',
            futureDate
        );
    });

    it('should prevent leaving if matches are locked (<15min and all confirmed)', async () => {
        const imminentDate = new Date();
        imminentDate.setMinutes(imminentDate.getMinutes() + 10); // 10 mins from now

        (prisma.meeting.findUnique as any).mockResolvedValue({
            id: mockMeetingId,
            startTime: imminentDate
        });

        (prisma.participation.findMany as any).mockResolvedValue([
            { confirmedAt: new Date() },
            { confirmedAt: new Date() } 
        ]); // All confirmed

        await expect(leaveMeeting(mockMeetingId)).rejects.toThrow('Cannot leave: match is locked');
    });

    it('should prevent leaving if matchmaking is already generated', async () => {
        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 1);

        (prisma.meeting.findUnique as any).mockResolvedValue({
            id: mockMeetingId,
            startTime: futureDate,
            matchmakingGeneratedAt: new Date() // Matchmaking done
        });

        await expect(leaveMeeting(mockMeetingId)).rejects.toThrow('Cannot leave: matchmaking has already been generated');
    });

    it('should prevent leaving if game has started', async () => {
        const pastDate = new Date();
        pastDate.setMinutes(pastDate.getMinutes() - 1); // Started 1 min ago

        (prisma.meeting.findUnique as any).mockResolvedValue({
            id: mockMeetingId,
            startTime: pastDate
        });

        await expect(leaveMeeting(mockMeetingId)).rejects.toThrow('Cannot leave: meeting has already started');
    });
});

describe('Actions: confirmAttendance', () => {
    const mockUserId = 'user-123';
    const mockMeetingId = 'meeting-123';

    beforeEach(() => {
        vi.clearAllMocks();
        (getServerSession as any).mockResolvedValue({ user: { id: mockUserId } });
    });

    it('should confirm attendance if within 24 hours', async () => {
        const nearFuture = new Date();
        nearFuture.setHours(nearFuture.getHours() + 12);

        (prisma.meeting.findUnique as any).mockResolvedValue({
            id: mockMeetingId,
            startTime: nearFuture
        });

        await confirmAttendance(mockMeetingId);

        expect(prisma.participation.updateMany).toHaveBeenCalledWith({
            where: { meetingId: mockMeetingId, userId: mockUserId, status: ParticipationStatus.JOINED },
            data: { confirmedAt: expect.any(Date) }
        });
    });

    it('should reject confirmation if > 24 hours before match', async () => {
        const farFuture = new Date();
        farFuture.setHours(farFuture.getHours() + 48);

        (prisma.meeting.findUnique as any).mockResolvedValue({
            id: mockMeetingId,
            startTime: farFuture
        });

        await expect(confirmAttendance(mockMeetingId)).rejects.toThrow('Confirmation only available 24h before match');
    });
});

describe('Actions: Admin', () => {
    const mockUserId = 'admin-123';
    const mockMeetingId = 'meeting-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow admin to create meeting', async () => {
        (getServerSession as any).mockResolvedValue({
             user: { id: mockUserId, is_admin: true } 
        });

        await createMeeting({
            place: 'Admin Court',
            startTime: new Date(),
            numCourts: 2
        });

        expect(prisma.meeting.create).toHaveBeenCalled();
    });

    it('should prevent non-admin from creating meeting', async () => {
        (getServerSession as any).mockResolvedValue({
             user: { id: 'user-123', is_admin: false } 
        });

        await expect(createMeeting({
            place: 'Admin Court',
            startTime: new Date(),
            numCourts: 2
        })).rejects.toThrow('Unauthorized');
    });

    it('should allow admin to delete meeting', async () => {
        (getServerSession as any).mockResolvedValue({
             user: { id: mockUserId, is_admin: true } 
        });

        await deleteMeeting(mockMeetingId);

        expect(prisma.meeting.delete).toHaveBeenCalledWith({ where: { id: mockMeetingId } });
    });

    describe('updateMeeting', () => {
        it('should allow admin to update meeting', async () => {
            (getServerSession as any).mockResolvedValue({
                 user: { id: mockUserId, is_admin: true } 
            });
    
            const updateData = {
                place: 'Updated Court',
                startTime: new Date('2024-01-02T10:00:00Z'),
                numCourts: 2,
                latitude: 40.0,
                longitude: 2.0
            };
    
            await updateMeeting(mockMeetingId, updateData);
    
            expect(prisma.meeting.update).toHaveBeenCalledWith({
                where: { id: mockMeetingId },
                data: expect.objectContaining(updateData)
            });
        });
    
        it('should prevent non-admin from updating meeting', async () => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'user-123', is_admin: false } 
           });
    
           await expect(updateMeeting(mockMeetingId, {
            place: 'Updated Court',
            startTime: new Date(),
            numCourts: 2
        })).rejects.toThrow('Unauthorized');
    
           expect(prisma.meeting.update).not.toHaveBeenCalled();
        });
    });
});

