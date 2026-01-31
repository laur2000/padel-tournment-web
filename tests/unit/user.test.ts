import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateProfileImage } from '@/lib/actions/user';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Actions: updateProfileImage', () => {
  const mockUserId = 'user-123';
  const smallImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const hugeImage = 'data:image/jpeg;base64,' + 'a'.repeat(3 * 1024 * 1024); // ~3MB

  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue({
      user: { id: mockUserId },
    });
  });

  it('should update image if valid', async () => {
    await updateProfileImage(smallImage);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: mockUserId },
        data: { image: smallImage }
    }));
  });

  it('should throw error if image is too large (>2MB)', async () => {
    await expect(updateProfileImage(hugeImage)).rejects.toThrow('Image too large');
  });

  it('should throw error if user not authenticated', async () => {
    (getServerSession as any).mockResolvedValue(null);
    await expect(updateProfileImage(smallImage)).rejects.toThrow('Unauthorized');
  });
});
