// หนีฝน AI — service worker (PWA install + Web Push)

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A push arrives from the server → show a system notification.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "หนีฝน AI", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "หนีฝน AI";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "neefon-rain",
    renotify: true,
    data: { url: "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification opens/focuses the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
