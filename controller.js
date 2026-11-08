/* CyberWorx Google Cast sender v0.5 (custom app A35768E5).
 * No device firmware operations. All commands use an allowlisted custom
 * namespace and are sent only after a valid user-initiated Cast session.
 */
(function () {
  "use strict";
  var APP_ID = "A35768E5";
  var NS = "urn:x-cast:com.cyberworx.chromecast";
  var castReady = false;
  var context = null;
  var observedSession = null;
  var remotePlayer = null;
  var remotePlayerController = null;
  var DEMO_URL = "https://duskydereuck-stack.github.io/cyberworx-chromecast-receiver/cyberworx-demo.mp4";

  function formatSeconds(value) {
    var seconds = Math.max(0, Math.floor(Number(value) || 0));
    return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  }
  function updatePlaybackStatus() {
    if (!remotePlayer) return;
    var loaded = !!remotePlayer.isMediaLoaded;
    var state = loaded ? (remotePlayer.isPaused ? "Paused" : "Playing") : "No media loaded";
    var p = document.getElementById("playbackStatus");
    if (p) p.textContent = state;
    var progress = document.getElementById("mediaProgress");
    var total = Number(remotePlayer.duration) || 0;
    var current = Number(remotePlayer.currentTime) || 0;
    if (progress) progress.value = total > 0 ? Math.min(100, Math.round(current / total * 100)) : 0;
    var label = document.getElementById("mediaTime");
    if (label) label.textContent = formatSeconds(current) + " / " + formatSeconds(total || 12);
  }
  var status = document.getElementById("status");
  var logBox = document.getElementById("log");
  function setStatus(s) { status.textContent = s; }
  function appendLog(s) {
    var stamp = new Date().toLocaleTimeString();
    var value = stamp + "  " + s;
    logBox.textContent = logBox.textContent === "No commands sent." ? value : value + "\n" + logBox.textContent;
    if (logBox.textContent.length > 4000) logBox.textContent = logBox.textContent.slice(0, 4000);
  }
  function session() {
    var current = context ? context.getCurrentSession() : null;
    if (!current) {
      observedSession = null;
      return null;
    }
    if (current !== observedSession) {
      observedSession = current;
      if (typeof current.addMessageListener === "function") {
        try {
          current.addMessageListener(NS, function (namespace, raw) {
            var data;
            try {
              data = typeof raw === "string" ? JSON.parse(raw) : raw;
            } catch (err) {
              appendLog("Ignored malformed receiver response");
              return;
            }
            if (!data || data.type !== "STATE" ||
                ["home", "media", "devices", "settings"].indexOf(data.section) < 0) return;
            setStatus("TV confirmed: " + data.section);
            appendLog("Receiver confirmed: " + data.section + " · " + data.commands + " commands");
          });
        } catch (err) {
          appendLog("Receiver message listener unavailable");
        }
      }
    }
    return current;
  }
  function onCastReady(available) {
    if (!available || !window.cast || !window.cast.framework || !window.chrome) {
      setStatus("Google Cast unavailable in this browser");
      return;
    }
    try {
      context = cast.framework.CastContext.getInstance();
      context.setOptions({ receiverApplicationId:APP_ID, autoJoinPolicy:chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
      if (cast.framework.RemotePlayer && cast.framework.RemotePlayerController) {
        remotePlayer = new cast.framework.RemotePlayer();
        remotePlayerController = new cast.framework.RemotePlayerController(remotePlayer);
        if (remotePlayerController.addEventListener && cast.framework.RemotePlayerEventType) {
          remotePlayerController.addEventListener(cast.framework.RemotePlayerEventType.ANY_CHANGE, updatePlaybackStatus);
        }
      }
      context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, function (event) {
        appendLog("Cast session: " + event.sessionState);
        setStatus(session() ? "Chromecast session connected" : "Ready to connect");
      });
      castReady = true;
      setStatus(session() ? "Chromecast session connected" : "Ready to connect");
      appendLog("Google Cast SDK initialized for " + APP_ID);
    } catch (err) {
      setStatus("Cast setup error");
      appendLog("Setup failed: " + String(err));
    }
  }
  window.__onGCastApiAvailable = onCastReady;

  document.getElementById("connect").addEventListener("click", function () {
    if (!castReady || !context) {
      appendLog("Cast is not ready. Use Chrome on the same Wi-Fi network.");
      return;
    }
    setStatus("Connecting…");
    context.requestSession().then(
      function () { setStatus("Chromecast session connected"); appendLog("Session launched"); },
      function (err) { setStatus("Launch blocked"); appendLog("Could not launch " + APP_ID + ": " + String(err)); }
    );
  });
  document.getElementById("disconnect").addEventListener("click", function () {
    var current = session();
    if (!current) return appendLog("No active session");
    current.endSession(true);
    setStatus("Disconnected");
  });
  function send(type, tab) {
    var current = session();
    if (!current) {
      appendLog("Not connected — open a Cast session first.");
      return;
    }
    var data = {type:type};
    if (type === "OPEN") data.tab = tab;
    current.sendMessage(NS, data).then(
      function () { appendLog("Sent " + type + (tab ? ": " + tab : "")); },
      function (err) { appendLog("Command failed: " + String(err)); }
    );
  }
  var nav = document.querySelectorAll("[data-open]");
  for (var i = 0; i < nav.length; i++) {
    nav[i].addEventListener("click", function () { send("OPEN", this.getAttribute("data-open")); });
  }
  var acts = document.querySelectorAll("[data-action]");
  for (var j = 0; j < acts.length; j++) {
    acts[j].addEventListener("click", function () { send(this.getAttribute("data-action")); });
  }
  document.addEventListener("keydown", function (ev) {
    var type = {"ArrowLeft":"LEFT","ArrowRight":"RIGHT","Enter":"SELECT","Escape":"HOME"}[ev.key];
    if (type && session()) {ev.preventDefault();send(type);}
  });
  document.getElementById("playDemo").addEventListener("click", function () {
    var active = session();
    if (!active) return appendLog("Connect to Chromecast before playing media.");
    if (!window.chrome || !chrome.cast || !chrome.cast.media) {
      return appendLog("Chrome Cast Media SDK is not available.");
    }
    try {
      var info = new chrome.cast.media.MediaInfo(DEMO_URL, "video/mp4");
      info.streamType = chrome.cast.media.StreamType.BUFFERED;
      if (chrome.cast.media.GenericMediaMetadata) {
        info.metadata = new chrome.cast.media.GenericMediaMetadata();
        info.metadata.title = "CyberWorx original playback test";
      }
      var request = new chrome.cast.media.LoadRequest(info);
      request.autoplay = true;
      var label = document.getElementById("playbackStatus");
      if (label) label.textContent = "Loading demo clip...";
      active.loadMedia(request).then(
        function () { appendLog("Video LOAD accepted by Chromecast"); updatePlaybackStatus(); },
        function (err) { appendLog("Video LOAD failed: " + String(err)); if (label) label.textContent = "Playback failed"; }
      );
    } catch (err) { appendLog("Could not create media request: " + String(err)); }
  });
  document.getElementById("pauseResume").addEventListener("click", function () {
    if (!session()) return appendLog("Connect to Chromecast before controlling media.");
    if (!remotePlayerController || !remotePlayer || !remotePlayer.isMediaLoaded) {
      return appendLog("No media loaded to pause or resume.");
    }
    try { remotePlayerController.playOrPause(); appendLog("Sent Pause / Resume"); }
    catch (err) { appendLog("Pause / Resume failed: " + String(err)); }
  });
  document.getElementById("stopMedia").addEventListener("click", function () {
    if (!session()) return appendLog("Connect to Chromecast before controlling media.");
    if (!remotePlayerController || !remotePlayer || !remotePlayer.isMediaLoaded) {
      return appendLog("No media loaded to stop.");
    }
    try { remotePlayerController.stop(); appendLog("Sent Stop playback"); }
    catch (err) { appendLog("Stop failed: " + String(err)); }
  });

  document.getElementById("clear").addEventListener("click", function () {
    logBox.textContent = "No commands sent.";
  });
  setStatus("Waiting for Google Cast SDK");
})();