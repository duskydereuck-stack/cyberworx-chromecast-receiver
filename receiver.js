/* CyberWorx Chromecast Cast receiver v0.5.
 * All inputs are allowlisted. There is no firmware, shell or device-control API.
 * Google Cast CAF custom-message API:
 * https://developers.google.com/cast/docs/web_receiver/core_features
 */
(function () {
  "use strict";
  var namespace = "urn:x-cast:com.cyberworx.chromecast";
  var tabs = ["home", "media", "devices", "settings"];
  var tabIndex = 0;
  var tileIndex = 0;
  var messagesHandled = 0;
  var context = null;
  var mediaVisible = false;
  function setMediaVisible(visible) {
    mediaVisible = !!visible;
    var overlay = document.getElementById("mediaPlayer");
    var home = document.getElementById("interface");
    if (overlay) overlay.style.display = mediaVisible ? "block" : "none";
    if (home) home.style.display = mediaVisible ? "none" : "flex";
  }
  function mediaStatus(event) {
    var status = event && event.mediaStatus ? event.mediaStatus : null;
    if (!status) return;
    var playing = !!(status.media && status.playerState !== "IDLE");
    // The player may report mediaPlayerState independently of status.playerState.
    if (status.playerState === "IDLE" || status.idleReason) playing = false;
    setMediaVisible(playing);
    text("playerStatus", playing ? "Media " + String(status.playerState || "loaded") : "No media loaded");
  }

  function text(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
  }
  function each(selector, callback) {
    var items = document.querySelectorAll(selector);
    for (var i = 0; i < items.length; i++) callback(items[i], i);
  }
  function navigate(where) {
    var index = tabs.indexOf(String(where || "").toLowerCase());
    if (index < 0) return false;
    tabIndex = index;
    each("[data-tab]", function (element) {
      element.className = "tab" + (element.getAttribute("data-tab") === tabs[tabIndex] ? " active" : "");
    });
    each("[data-view]", function (element) {
      element.className = "view" + (element.getAttribute("data-view") === tabs[tabIndex] ? " active" : "");
    });
    text("sectionState", tabs[tabIndex].charAt(0).toUpperCase() + tabs[tabIndex].slice(1));
    text("activity", "Viewing " + tabs[tabIndex] + " · " + messagesHandled + " remote commands");
    return true;
  }
  function selectTile(index) {
    tileIndex = ((index % 3) + 3) % 3;
    each("button.tile[data-open]", function (el, i) {
      el.className = "tile" + (i === tileIndex ? " selected" : "");
    });
  }
  function action(type, data) {
    switch (type) {
      case "HOME": navigate("home"); return true;
      case "OPEN": return navigate(data.tab);
      case "NEXT": navigate(tabs[(tabIndex + 1) % tabs.length]); return true;
      case "PREVIOUS": navigate(tabs[(tabIndex + tabs.length - 1) % tabs.length]); return true;
      case "LEFT": if (tabIndex === 0) selectTile(tileIndex - 1); else navigate(tabs[(tabIndex + tabs.length - 1) % tabs.length]); return true;
      case "RIGHT": if (tabIndex === 0) selectTile(tileIndex + 1); else navigate(tabs[(tabIndex + 1) % tabs.length]); return true;
      case "SELECT":
        if (tabIndex === 0) return navigate(["media", "devices", "settings"][tileIndex]);
        return true;
      case "PING": return true;
      default: return false;
    }
  }
  function receiverMessage(event) {
    var data = event && event.data;
    if (!data || typeof data !== "object" || typeof data.type !== "string") return;
    var type = data.type.toUpperCase();
    if (type.length > 24) return;
    var accepted = action(type, data);
    if (!accepted) return;
    // A status request also reconciles the UI with the actual CAF player
    // state. It fixes a stale overlay if an older Chromecast missed a
    // final MEDIA_STATUS broadcast.
    if (type === "PING" && context && context.getPlayerManager) {
      try {
        var currentState = context.getPlayerManager().getPlayerState();
        if (currentState === "IDLE") setMediaVisible(false);
      } catch (err) { /* older CAF versions may not expose state here */ }
    }
    messagesHandled++;
    text("activity", "Viewing " + tabs[tabIndex] + " · " + messagesHandled + " remote commands");
    if (context && event.senderId) {
      try {
        context.sendCustomMessage(namespace, event.senderId, {
          type: "STATE", section: tabs[tabIndex], commands: messagesHandled, version: "0.5.1", mediaVisible: mediaVisible
        });
      } catch (err) { /* older Cast receivers may not support state replies */ }
    }
  }

  each("[data-tab]", function (el) {
    el.addEventListener("click", function () { navigate(el.getAttribute("data-tab")); });
  });
  each("button.tile[data-open]", function (el, index) {
    el.addEventListener("click", function () { selectTile(index); navigate(el.getAttribute("data-open")); });
  });
  document.addEventListener("keydown", function (event) {
    var name = {"ArrowLeft":"LEFT","ArrowRight":"RIGHT","ArrowUp":"PREVIOUS","ArrowDown":"NEXT","Enter":"SELECT","Escape":"HOME"}[event.key];
    if (name) { event.preventDefault(); action(name, {}); }
  });
  navigate("home");

  window.CyberWorxTest = { navigate:navigate, action:action, getSection:function(){return tabs[tabIndex];} };
  if (window.location && /(?:\?|&)preview=1(?:&|$)/.test(window.location.search)) {
    var previewSection = window.location.search.match(/[?&]section=(home|media|devices|settings)(?:&|$)/);
    if (previewSection) navigate(previewSection[1]);
    text("castStatus", "Browser preview"); text("sdkState", "Preview only"); return;
  }
  if (!window.cast || !window.cast.framework || !window.cast.framework.CastReceiverContext) {
    text("castStatus", "Preview only — Cast SDK unavailable");
    text("sdkState", "Not loaded");
    return;
  }
  try {
    context = window.cast.framework.CastReceiverContext.getInstance();
    context.addCustomMessageListener(namespace, receiverMessage);
    var playerManager = context.getPlayerManager();
    var fw = window.cast.framework;
    if (playerManager && fw.events && fw.events.EventType) {
      playerManager.addEventListener(fw.events.EventType.MEDIA_STATUS, mediaStatus);
      // MEDIA_STATUS alone is not guaranteed to be emitted with a final
      // IDLE status on older Cast firmware. MEDIA_FINISHED is the primary
      // completion signal for normal end, STOP and playback errors.
      if (fw.events.EventType.MEDIA_FINISHED) {
        playerManager.addEventListener(fw.events.EventType.MEDIA_FINISHED, function () {
          setMediaVisible(false);
          text("playerStatus", "Playback ended — ready for another video");
        });
      }
    }
    if (playerManager && fw.messages && fw.messages.MessageType) {
      playerManager.setMessageInterceptor(fw.messages.MessageType.LOAD, function (request) {
        if (request && request.media) {
          setMediaVisible(true);
          text("playerStatus", "Loading media...");
        }
        return request;
      });
    }
    context.start();
    text("castStatus", "Receiver online");
    text("sdkState", "Ready");
  } catch (err) {
    text("castStatus", "Cast SDK failed");
    text("sdkState", "Initialization error");
  }
})();