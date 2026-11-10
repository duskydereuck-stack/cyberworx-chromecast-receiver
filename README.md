# CyberWorx Chromecast Media Hub — v0.6.0

An experimental **Google Cast Custom Web Receiver** and browser remote for the original first-generation Chromecast. This is an application that runs *on top of* Google's signed Cast firmware; it is not Android TV, a new firmware image, or a way to install native Android APKs.

## Open

- [CyberWorx TV receiver](https://duskydereuck-stack.github.io/cyberworx-chromecast-receiver/)
- [Browser remote](https://duskydereuck-stack.github.io/cyberworx-chromecast-receiver/controller.html)
- [Browser preview](https://duskydereuck-stack.github.io/cyberworx-chromecast-receiver/?preview=1)
- [Media-screen preview](https://duskydereuck-stack.github.io/cyberworx-chromecast-receiver/?preview=1&section=media)

Registered Google Cast application ID: `A35768E5`.

## Architecture

- **Home Assistant** is the local control hub. It provides a Media dashboard, guarded automatic Cast launching and native Plex media browsing.
- **Plex on Tower** stores/transcodes personal movies, television and music. The official Plex Cast receiver plays those streams directly; they are not proxied through our custom receiver.
- **CyberWorx receiver** is a lightweight startup/landing interface for Google Cast and a custom H.264 test-video receiver.
- **Netflix and YouTube** use their official mobile/Chrome Cast senders and their own registered receiver applications. This custom receiver cannot implement their protected media players or authenticate to their services.

Google's [supported Cast media profiles](https://developers.google.com/cast/docs/media) limit the first-generation Chromecast to H.264 High Profile up to level 4.1 (1080p/30fps) or VP8; it cannot decode native 4K HEVC. Individual Plex files may require server transcoding. This device's older 2.4GHz Wi-Fi can also buffer on high-bitrate streams.

## Safety and maintenance

- Never flash or alter Google firmware. The original Chromecast remains factory resettable.
- The receiver contains no Home Assistant or Plex tokens, passwords, private LAN IPs, user data, or remote code-execution endpoints.
- No automatic Netflix or YouTube startup: launch those services from their official apps.
- The browser remote requires a compatible Cast sender browser and a user-initiated Cast session.
- The Home Assistant auto-start control is guarded and designed not to interrupt other Cast apps.
- DHCP addresses may change; development QA scripts locate the receiver by its permanent Cast UUID through mDNS rather than embedding an IP.

Reference: https://developers.google.com/cast/docs/web_receiver/core_features
