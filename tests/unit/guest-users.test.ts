import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminAddPlayer, adminConfirmPlayer, adminRemovePlayer } from '@/lib/actions/meetings';
import { processReminders } from '@/lib/scheduler';
import { prisma } from '@/lib/prisma';
import { sendReminderEmail, sendWaitlistPromotionEmail } from '@/lib/email';
import { ParticipationStatus } from '@prisma/client';

// Mock Dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((callback) => callback(prisma)),
    user: {
      create: vi.fn(),
    },
    participation: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    meeting: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    pushSubscription: {
      findMany: vi.fn().mockResolvedValue([]),
    }
  },
}));

vi.mock('@/lib/email', () => ({
    sendReminderEmail: vi.fn(),
    sendWaitlistPromotionEmail: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Import mock to set implementation
import { getServerSession } from 'next-auth';

describe('Guest User Functionality', () => {
    const mockAdminId = 'admin-123';
    const mockMeetingId = 'meeting-123';

    beforeEach(() => {
        vi.clearAllMocks();
        (getServerSession as any).mockResolvedValue({
            user: { id: mockAdminId, is_admin: true },
        });
    });

    describe('adminAddPlayer', () => {
        it('should create a guest user and add them to the meeting', async () => {
            const guestName = 'Invitado Juan';
            const mockNewUserId = 'guest-newUser';

            // Mock creating user
            (prisma.user.create as any).mockResolvedValue({
                id: mockNewUserId,
                name: guestName,
                isGuest: true,
            });

            // Mock upsert participation
            (prisma.participation.upsert as any).mockResolvedValue({});

            await adminAddPlayer(mockMeetingId, { name: guestName });

            // Expect User Creation
            expect(prisma.user.create).toHaveBeenCalledWith({
                data: {
                    name: guestName,
                    isGuest: true,
                }
            });

            // Expect Participation Upsert
            expect(prisma.participation.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    meetingId_userId: {
                        meetingId: mockMeetingId,
                        userId: mockNewUserId
                    }
                },
                create: expect.objectContaining({
                    status: ParticipationStatus.JOINED,
                    confirmedAt: expect.any(Date)
                }),
                update: expect.objectContaining({
                     status: ParticipationStatus.JOINED,
                     confirmedAt: expect.any(Date)
                })
            }));
        });

        it('should use existing user if userId is provided (not guest)', async () => {
            const existingUserId = 'user-existing';
            const userName = 'Pepe';

            await adminAddPlayer(mockMeetingId, { userId: existingUserId, name: userName });

            expect(prisma.user.create).not.toHaveBeenCalled();
            expect(prisma.participation.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    meetingId_userId: {
                        meetingId: mockMeetingId,
                        userId: existingUserId
                    }
                }
            }));
        });
    });

    describe('adminConfirmPlayer (Guest)', () => {
        it('should confirm a guest user', async () => {
             const guestUserId = 'guest-1';
             
             await adminConfirmPlayer(mockMeetingId, guestUserId);

             expect(prisma.participation.updateMany).toHaveBeenCalledWith({
                 where: {
                     meetingId: mockMeetingId,
                     userId: guestUserId,
                     status: ParticipationStatus.JOINED
                 },
                 data: {
                     confirmedAt: expect.any(Date)
                 }
             });
        });
    });

    describe('adminRemovePlayer (Guest)', () => {
        it('should remove a guest user and not promote if no waitlist', async () => {
             const guestUserId = 'guest-1';

             // Mock dependencies for adminRemovePlayer
             (prisma.meeting.findUnique as any).mockResolvedValue({ id: mockMeetingId });
             (prisma.participation.findUnique as any).mockResolvedValue({
                 id: 'part-1',
                 userId: guestUserId,
                 status: ParticipationStatus.JOINED
             });
             // Mock no waitlist
             (prisma.participation.findFirst as any).mockResolvedValue(null);

             await adminRemovePlayer(mockMeetingId, guestUserId);

             expect(prisma.participation.update).toHaveBeenCalledWith({
                 where: { id: 'part-1' },
                 data: expect.objectContaining({
                     status: ParticipationStatus.LEFT,
                 })
             });
        });

        it('should remove a guest user and promote waitlisted user', async () => {
             const guestUserId = 'guest-1';
             const waitlistedUser = {
                 id: 'part-wl',
                 userId: 'user-wl',
                 user: { email: 'wl@test.com' }
             };

             // Mock dependencies for adminRemovePlayer
             (prisma.meeting.findUnique as any).mockResolvedValue({ 
                 id: mockMeetingId, 
                 place: 'Court 1', 
                 startTime: new Date() 
             });
             (prisma.participation.findUnique as any).mockResolvedValue({
                 id: 'part-1',
                 userId: guestUserId,
                 status: ParticipationStatus.JOINED
             });
             
             // Mock waitlist existence
             (prisma.participation.findFirst as any).mockResolvedValue(waitlistedUser);

             await adminRemovePlayer(mockMeetingId, guestUserId);

             // 1. Guest removed
             expect(prisma.participation.update).toHaveBeenCalledWith({
                 where: { id: 'part-1' },
                 data: expect.objectContaining({
                     status: ParticipationStatus.LEFT,
                 })
             });

             // 2. Waitlist promoted
             expect(prisma.participation.update).toHaveBeenCalledWith({
                 where: { id: waitlistedUser.id },
                 data: {
                    status: ParticipationStatus.JOINED,
                    joinedAt: expect.any(Date),
                    waitlistedAt: null,
                }
             });

             // 3. Email sent to PROMOTED user (wl@test.com)
             expect(sendWaitlistPromotionEmail).toHaveBeenCalled();
        });
    });

    describe('Scheduler: processReminders with Guest Users', () => {
        it('should NOT attempt to send email for guest user without email', async () => {
            const now = new Date();
            
            // Mock meetings found
            (prisma.meeting.findMany as any).mockResolvedValue([{
                id: mockMeetingId,
                place: 'Padel Club',
                startTime: new Date(now.getTime() + 100000),
                participations: [
                    {
                        id: 'p1',
                        user: {
                            id: 'guest-1',
                            name: 'Guest',
                            email: null, // No email
                            isGuest: true
                        },
                        status: ParticipationStatus.JOINED,
                        reminderSent: false
                    },
                    {
                        id: 'p2',
                        user: {
                            id: 'user-2',
                            name: 'User',
                            email: 'user@example.com', // Has email
                            isGuest: false
                        },
                        status: ParticipationStatus.JOINED,
                        reminderSent: false
                    }
                ]
            }]);

            await processReminders();

            // Should have called sendReminderEmail ONLY once for user-2
            expect(sendReminderEmail).toHaveBeenCalledTimes(1);
            expect(sendReminderEmail).toHaveBeenCalledWith('user@example.com', expect.any(String), expect.any(String), expect.any(Date));
            
            // Should NOT have called for guest
            expect(sendReminderEmail).not.toHaveBeenCalledWith(null, expect.any(String), expect.any(String), expect.any(Date));

            // Should update reminderSent only for the one with email
            expect(prisma.participation.update).toHaveBeenCalledWith({
                where: { id: 'p2' },
                data: { reminderSent: true }
            });
            expect(prisma.participation.update).not.toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { reminderSent: true }
            });
        });
    });
});
