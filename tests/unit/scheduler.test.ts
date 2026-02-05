import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processReminders, processMeetingsFinalization } from '@/lib/scheduler';
import { prisma } from '@/lib/prisma';
import { sendReminderEmail, sendMatchmakingNotification } from '@/lib/email';
import { generateMatches } from '@/lib/matchmaking';
import { ParticipationStatus, TeamSide } from '@prisma/client';

// Mock Dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    meeting: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    participation: {
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    match: {
      findMany: vi.fn(),
    },
    pushSubscription: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendReminderEmail: vi.fn(),
  sendMatchmakingNotification: vi.fn(),
}));

vi.mock('@/lib/matchmaking', () => ({
  generateMatches: vi.fn(),
}));

describe('Scheduler Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('processReminders', () => {
    it('should send reminders to confirm unreminded joined participants', async () => {
      // Mock Meeting
      (prisma.meeting.findMany as any).mockResolvedValue([
        {
          id: 'meeting-1',
          place: 'Court 1',
          startTime: new Date('2024-01-02T10:00:00Z'), // 24h from now
          participations: [
            {
              id: 'p1',
              user: { email: 'user@test.com' },
            },
          ],
        },
      ]);

      await processReminders();

      expect(sendReminderEmail).toHaveBeenCalledWith(
        'user@test.com',
        'meeting-1',
        'Court 1',
        expect.any(Date)
      );
      expect(prisma.participation.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { reminderSent: true },
      });
    });
  });

  describe('processMeetingsFinalization', () => {
    const mockMeeting = {
      id: 'meeting-final',
      place: 'Court Final',
      startTime: new Date('2024-01-01T10:10:00Z'), // Starts in 10 mins
    };

    it('should auto-confirm participants for imminent meetings', async () => {
       (prisma.meeting.findMany as any).mockResolvedValue([mockMeeting]);
       (prisma.participation.count as any).mockResolvedValue(4); // Divisible by 4
       (prisma.match.findMany as any).mockResolvedValue([]);
       (prisma.participation.findMany as any).mockResolvedValue([]); // For emails

       await processMeetingsFinalization();

       expect(prisma.participation.updateMany).toHaveBeenCalledWith({
         where: {
           meetingId: mockMeeting.id,
           status: ParticipationStatus.JOINED,
           confirmedAt: null,
         },
         data: { confirmedAt: expect.any(Date) },
       });
    });

    it('should truncate participants if not divisible by 4', async () => {
        (prisma.meeting.findMany as any).mockResolvedValue([mockMeeting]);
        
        // 5 Participants joined
        (prisma.participation.count as any).mockResolvedValue(5);
        
        // Return last joined to remove
        const pToRemove = [{ id: 'p-remove' }];
        (prisma.participation.findMany as any).mockResolvedValueOnce(pToRemove); 
        // Note: findMany is called multiple times. 
        // 1. Truncation check (if mocked to return list) or just findMany based on args.
        // We can check calls by arguments.

       // Mock finding participants to remove 
       // We need to implement default mock behavior carefully or rely on call checks.
       // The code calls count -> findMany (take remainder) -> updateMany -> generateMatches
       
       // Setup specific findMany response for truncation
       vi.mocked(prisma.participation.findMany).mockImplementation((async (args: any) => {
           if (args?.take === 1) { // 5 % 4 = 1
               return pToRemove as any; 
           }
           return [] as any;
       }) as any);

        await processMeetingsFinalization();

        expect(prisma.participation.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ['p-remove'] } },
            data: { 
                status: ParticipationStatus.REMOVED_BY_TRUNCATION,
                removedAt: expect.any(Date)
            }
        });
        
        expect(generateMatches).toHaveBeenCalledWith(mockMeeting.id);
    });

    it('should send final notifications after matchmaking', async () => {
        (prisma.meeting.findMany as any).mockResolvedValue([mockMeeting]);
        (prisma.participation.count as any).mockResolvedValue(4);
        
        // Mock generated matches
        const mockMatches = [{
            courtNumber: 1,
            teams: [
                { side: TeamSide.A, members: [{ user: { name: 'Player A' } }] },
                { side: TeamSide.B, members: [{ user: { name: 'Player B' } }] }
            ]
        }];
        (prisma.match.findMany as any).mockResolvedValue(mockMatches);

        // Mock confirmed participants to receive email
        (prisma.participation.findMany as any).mockImplementation(async (args: any) => {
            if (args?.where?.status === ParticipationStatus.JOINED && !args?.orderBy) {
                return [{ user: { email: 'player@test.com' } }] as any;
            }
            return [];
        });

        await processMeetingsFinalization();

        expect(sendMatchmakingNotification).toHaveBeenCalledWith(
            'player@test.com',
            mockMeeting.place,
            mockMeeting.startTime,
            expect.arrayContaining([
                expect.objectContaining({ courtNumber: 1 })
            ])
        );
    });
  });
});
