// Nestopia parent portal: lets phones install it like an app. Pages always come fresh from the internet.
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => self.clients.claim());
self.addEventListener("fetch", () => {});
