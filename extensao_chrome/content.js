// Ponte entre a página do painel (localhost) e a extensão.
window.addEventListener("message", e => {
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data || {};
  if (d.type === "SF_PING") {
    window.postMessage({ type: "SF_PONG" }, location.origin);
  } else if (d.type === "SF_GET_TOKEN") {
    chrome.runtime.sendMessage({ type: "GET_AUTH" }, res => {
      const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : (res && res.error) || null;
      window.postMessage({ type: "SF_TOKEN", bearer: res && res.bearer || null, glbid: res && res.glbid || null, exp: res && res.exp || null, error: err }, location.origin);
    });
  }
});
