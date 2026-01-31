import { test, expect } from './fixtures';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const adminEmail = 'e2e-admin@padel.test';
const adminPassword = 'password123';

test.describe('Admin Create Meeting Flow', () => {
    let userId: string;

    test.beforeAll(async () => {
        const hashedPassword = await argon2.hash(adminPassword);
        
        const user = await prisma.user.upsert({
            where: { email: adminEmail },
            update: { 
                is_admin: true,
                hashedPassword 
            },
            create: {
                email: adminEmail,
                name: 'E2E Admin',
                is_admin: true,
                hashedPassword
            }
        });
        userId = user.id;
    });

    test.afterAll(async () => {
        // Cleanup
        if (userId) {
            await prisma.meeting.deleteMany({ where: { createdByUserId: userId } });
            await prisma.user.delete({ where: { id: userId } });
        }
        await prisma.$disconnect();
    });

    test('should allow admin to create a new meeting', async ({ page }) => {
        // 1. Login
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', adminEmail);
        await page.fill('input[name="password"]', adminPassword);
        await page.click('button[type="submit"]');

        // Wait for redirect to home or dashboard
        // Note: It might redirect to / or /meetings depending on implementation. 
        // Just waiting for URL change or specific element is safer.
        await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/meetings');

        // 2. Navigate to Create Meeting
        await page.goto('/admin/meetings/new');

        // 3. Fill Form
        const place = 'Madrid'; // Using a real place for nominatim (though not strictly required if we ignore suggestion)
        await page.fill('input[name="place"]', place);
        
        // Wait for debounce/fetch if necessary, or just proceed. 
        // If we don't click suggestion, form submits text value. API handles it.
        
        // Date must be in future.
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().slice(0, 16);
        await page.fill('input[name="startTime"]', dateStr);

        await page.fill('input[name="numCourts"]', '4');
        
        // 4. Submit
        await page.click('button[type="submit"]');

        // 5. Verification
        // The app redirects to /meetings on success
        await expect(page).toHaveURL(/.*\/meetings/);
        
        // Optional: Check if meeting is listed
        // await expect(page.getByText(place)).toBeVisible(); 
    });
});
