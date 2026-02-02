import { useState, useEffect } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Register SW
      navigator.serviceWorker.register("/sw.js")
        .then(async (registration) => {
             const sub = await registration.pushManager.getSubscription();
             setSubscription(sub);
        })
        .catch((err) => console.error("SW registration failed", err));
    }
  }, []);

  const subscribeToNotifications = async () => {
    if (!isSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });

      setSubscription(sub);
      setPermission(Notification.permission);

      // Send to server
      await fetch("/api/web-push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });
      
      alert("Notificaciones activadas!");
    } catch (error) {
      console.error("Error subscribing to push", error);
      alert("Error al activar notificaciones. Verifica permisos.");
    }
  };

  const unsubscribeFromNotifications = async () => {
    if (!subscription) return;

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      
      // Optional: Inform server to delete subscription
      // await fetch("/api/web-push/unsubscribe", { ... }) 

      alert("Notificaciones desactivadas.");
    } catch (error) {
      console.error("Error unsubscribing", error);
      alert("Error al desactivar notificaciones.");
    }
  };

  return { isSupported, permission, subscription, subscribeToNotifications, unsubscribeFromNotifications };
}
