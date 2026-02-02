import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/web-push";

export async function sendNotificationToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await sendPushNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Deleting invalid subscription for user ${userId}: ${sub.endpoint}`);
            await prisma.pushSubscription.delete({
              where: { endpoint: sub.endpoint },
            });
          } else {
            console.error(`Error sending push to ${sub.endpoint}:`, error);
          }
        }
      })
    );
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
  }
}
