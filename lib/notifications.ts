import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/web-push";

export async function sendNotificationToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    await Promise.all(
      subscriptions.map((sub) =>
        sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
      )
    );
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
  }
}
