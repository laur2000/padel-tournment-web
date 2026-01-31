// tests/unit/email.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';

// Use vi.hoisted to initialize the mock before imports
const { sendMailMock } = vi.hoisted(() => {
  return { sendMailMock: vi.fn() };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockImplementation(() => ({
      sendMail: sendMailMock,
    })),
  },
  createTransport: vi.fn().mockImplementation(() => ({
      sendMail: sendMailMock,
  })),
}));

// Import after mocking
import { sendReminderEmail } from '@/lib/email';

describe('sendReminderEmail', () => {
  const MOCK_ENV = {
    NEXTAUTH_URL: 'http://localhost:3000',
    SMTP_FROM: 'test@example.com',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // mock environment variables needed for the link
    vi.stubEnv('NEXTAUTH_URL', MOCK_ENV.NEXTAUTH_URL);
    vi.stubEnv('SMTP_FROM', MOCK_ENV.SMTP_FROM);
  });

  it('should send an email with the correct meeting link in the HTML body', async () => {
    // Arrange
    const email = 'player@example.com';
    const meetingId = 'meeting-123';
    const place = 'Central Court';
    const startTime = new Date('2026-02-01T10:00:00Z');

    // Act
    await sendReminderEmail(email, meetingId, place, startTime);

    // Assert
    // createTransport is called at module load time, so we don't assert it here
    // as call history might be cleared by beforeEach if it was loaded earlier.
    
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    // Get the arguments passed to sendMail
    const callArgs = sendMailMock.mock.calls[0][0];

    // Verify basic fields
    expect(callArgs.to).toBe(email);
    expect(callArgs.subject).toBe('Recordatorio: Confirma tu asistencia');

    // Verify HTML content
    const expectedLink = `${MOCK_ENV.NEXTAUTH_URL}/meetings/${meetingId}`;
    expect(callArgs.html).toContain(expectedLink);
    expect(callArgs.html).toContain(place);
  });
});
