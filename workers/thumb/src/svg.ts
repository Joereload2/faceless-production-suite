export function thumbSvg(overlayText: string): string {
  const escaped = overlayText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0b0b10"/>
  <text x="640" y="360" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial" font-size="72" fill="white" stroke="black" stroke-width="8">${escaped}</text>
</svg>`;
}
