# Olo Web

Static iPhone-friendly web client/PWA for the Olo messenger.

## GitHub Pages

Create a GitHub repository for this folder, push the default branch as `main`, then choose **Settings → Pages → GitHub Actions**. The workflow in `.github/workflows/pages.yml` publishes the static files on every push to `main`.

The app uses relative asset URLs and works from the repository Pages path. It calls the backend at `https://olo-chat.duckdns.org` unless another server URL is entered on the sign-in screen.

## iPhone installation and notifications

Open the HTTPS Pages URL in Safari, choose **Share → Add to Home Screen**, launch Olo from its Home Screen icon, sign in, and tap the bell to enable notifications. Web Push on iPhone requires iOS/iPadOS 16.4 or later and a Home Screen web app. The user must grant notification permission.

The backend must be deployed with a stable VAPID key pair set as `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY`, plus `CORS_ALLOWED_ORIGINS` set to the exact Pages origin (for example `https://OWNER.github.io`). Never commit the private VAPID key. Set `WEB_PUSH_SUBJECT` to a working `mailto:` contact or HTTPS contact URL.

## Limitations

GitHub Pages hosts only this static client. The backend, database, Redis, and WebSocket endpoint remain on the server. Push delivery also depends on iOS notification settings, network availability, and the browser push service.
