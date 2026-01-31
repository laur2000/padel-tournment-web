'use server';

import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';
import * as argon2 from 'argon2';

export async function requestPasswordReset(email: string) {
  const lowerEmail = email.toLowerCase();
  
  // 1. Check if user exists (but don't reveal it yet)
  const user = await prisma.user.findUnique({
    where: { email: lowerEmail },
  });

  if (user) {
    // 2. Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // 3. Store in DB
    // Expiry: 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // 4. Send email
    try {
      await sendPasswordResetEmail(lowerEmail, token);
    } catch (error) {
      console.error('Failed to send email:', error);
      // In a real app, you might want to log this or retry.
      // We still return success to the user to avoid enumeration, 
      // although if email fails systematically it might be an issue.
    }
  }

  // Always return success to prevent email enumeration
  return { success: true, message: 'If an account exists with this email, you will receive a reset link.' };
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetToken) {
    return { success: false, message: 'Invalid or expired token.' };
  }

  if (resetToken.expiresAt < new Date()) {
    return { success: false, message: 'Invalid or expired token.' };
  }

  // Hash new password
  const hashedPassword = await argon2.hash(newPassword);

  // Update user and delete token
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { hashedPassword },
    }),
    prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    }),
  ]);

  return { success: true, message: 'Password reset successfully. You can now login.' };
}
