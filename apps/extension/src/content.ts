import { parseStudioHtml } from "./parseStudio";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "CAPTURE") return;
  const rows = parseStudioHtml(document.documentElement.outerHTML);
  sendResponse({ rows });
  return true;
});
