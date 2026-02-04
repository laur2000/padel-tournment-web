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
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; severity: "success" | "error" } | null>(null);

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
      setIsLoading(true);
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
      
      setFeedback({ message: "Notificaciones activadas.", severity: "success" });
    } catch (error) {
      console.error("Error subscribing to push", error);
      setFeedback({ message: "Error al activar notificaciones. Verifica permisos.", severity: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromNotifications = async () => {
    if (!subscription) return;

    try {
      setIsLoading(true);
      await subscription.unsubscribe();
      
      // Inform server to delete subscription
      await fetch("/api/web-push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      setSubscription(null);
      setFeedback({ message: "Notificaciones desactivadas.", severity: "success" });
    } catch (error) {
      console.error("Error unsubscribing", error);
      setFeedback({ message: "Error al desactivar notificaciones.", severity: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissFeedback = () => setFeedback(null);

  return {
    isSupported,
    permission,
    subscription,
    isLoading,
    feedback,
    dismissFeedback,
    subscribeToNotifications,
    unsubscribeFromNotifications,
  };
}
