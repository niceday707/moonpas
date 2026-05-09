// Firebase Cloud Messaging 백그라운드 메시지 핸들러
// 앱이 포그라운드가 아닐 때 수신된 푸시 알림을 OS 알림으로 표시한다.

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBPW-LSSLtvZPW2nNhYS6G5K3FWhDddpzM",
  authDomain: "moonpas.firebaseapp.com",
  projectId: "moonpas",
  storageBucket: "moonpas.firebasestorage.app",
  messagingSenderId: "87096316994",
  appId: "1:87096316994:web:c143540037e79305a349db"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? '문파스';
  const body  = payload.notification?.body  ?? '새 알림이 있습니다';
  const link  = payload.data?.link ?? '/dashboard';

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { link },
    tag: 'moonpas-push',
    renotify: true,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
