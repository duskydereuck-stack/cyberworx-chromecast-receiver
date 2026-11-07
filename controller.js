/* CyberWorx Google Cast sender (custom app A35768E5).
 * No device firmware operations. All commands use an allowlisted custom
 * namespace and are sent only after a valid user-initiated Cast session.
 */
(function () {
  "use strict";
  var APP_ID = "A35768E5";
  var NS = "urn:x-cast:com.cyberworx.chromecast";
  var castReady = false;
  var context = null;
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
    return context ? context.getCurrentSession() : null;
  }
  function onCastReady(available) {
    if (!available || !window.cast || !window.cast.framework || !window.chrome) {
      setStatus("Google Cast unavailable in this browser");
      return;
    }
    try {
      context = cast.framework.CastContext.getInstance();
      context.setOptions({ receiverApplicationId:APP_ID, autoJoinPolicy:chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
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
  document.getElementById("clear").addEventListener("click", function () {
    logBox.textContent = "No commands sent.";
  });
  setStatus("Waiting for Google Cast SDK");
})();
