import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:bogdan.lorenzo11@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url?: string }
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload)
    );
  } catch (error) {
    console.error('Error sending push notification', error);
    // In a real app, you might want to delete invalid subscriptions here
    // e.g. if error.statusCode === 410 (Gone)
  }
}
