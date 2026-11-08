// O login novo da Globo (OIDC) usa um access_token enviado como "Authorization: Bearer ..."
// pelo próprio site do Cartola à API. Aqui só observamos esse cabeçalho (não alteramos nada)
// e guardamos o último token em memória de sessão do navegador.
const API_URLS = ["https://api.cartola.globo.com/*", "https://api.cartolafc.globo.com/*"];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function jwtExp(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ? payload.exp * 1000 : null;
  } catch { return null; }
}

chrome.webRequest.onSendHeaders.addListener(details => {
  const h = (details.requestHeaders || []).find(x => x.name.toLowerCase() === "authorization");
  if (h && /^Bearer\s+\S+/i.test(h.value)) {
    const token = h.value.replace(/^Bearer\s+/i, "").trim();
    chrome.storage.session.set({ bearer: { token, exp: jwtExp(token), at: Date.now() } });
  }
}, { urls: API_URLS }, ["requestHeaders", "extraHeaders"]);

async function freshBearer() {
  const { bearer } = await chrome.storage.session.get("bearer");
  return bearer && (!bearer.exp || bearer.exp > Date.now() + 30000) ? bearer : null;
}

// Faz o site do Cartola refazer suas chamadas (recarrega a aba aberta ou abre uma em segundo plano).
async function triggerCartolaRequests() {
  const tabs = await chrome.tabs.query({ url: "https://cartola.globo.com/*" });
  if (tabs.length) { chrome.tabs.reload(tabs[0].id); return null; }
  const tab = await chrome.tabs.create({ url: "https://cartola.globo.com/", active: false });
  return tab.id;
}

async function getAuth() {
  let bearer = await freshBearer(), openedTab = null;
  if (!bearer) {
    openedTab = await triggerCartolaRequests();
    for (let i = 0; i < 24 && !bearer; i++) { await sleep(500); bearer = await freshBearer(); }
    if (openedTab) chrome.tabs.remove(openedTab).catch(() => {});
  }
  const cookies = await chrome.cookies.getAll({ name: "GLBID" });
  const c = cookies.find(x => x.domain.replace(/^\./, "").endsWith("globo.com") && x.value);
  if (!bearer && !c) return { error: "Não encontrei sua sessão da Globo. Entre em cartola.globo.com neste navegador e tente de novo." };
  return { bearer: bearer ? bearer.token : null, exp: bearer ? bearer.exp : null, glbid: c ? c.value : null };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "GET_AUTH") {
    getAuth().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true; // resposta assíncrona
  }
});
