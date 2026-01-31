import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestPasswordReset, resetPassword } from '@/lib/actions/password-reset';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import * as argon2 from 'argon2';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((arg) => {
        // Just execute promises if array
        if (Array.isArray(arg)) return Promise.all(arg);
        return arg;
    }),
  },
}));

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('argon2', () => ({
  hash: vi.fn(),
  verify: vi.fn(),
}));

describe('Actions: Password Reset', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });
    
  describe('requestPasswordReset', () => {
    it('should send email if user exists', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
      
      const res = await requestPasswordReset('test@test.com');
      
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalled();
      expect(res.success).toBe(true);
    });

    it('should return success even if user does not exist (prevention of enumeration)', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      
      const res = await requestPasswordReset('ghost@test.com');
      
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(res.success).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const future = new Date();
      future.setHours(future.getHours() + 1);

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue({
        id: 'token-id',
        userId: 'u1',
        tokenHash: 'hashed',
        expiresAt: future
      });

      await resetPassword('valid-token', 'newPass123');

      expect(argon2.hash).toHaveBeenCalledWith('newPass123');
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.passwordResetToken.delete).toHaveBeenCalled();
    });

    it('should fail with invalid/expired token', async () => {
      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(null);
      
      const res = await resetPassword('bad-token', 'newPass');
      
      expect(res.success).toBe(false);
      expect(res.message).toContain('Invalid or expired');
    });
  });
});
