// Generate ZenReader extension icons using sharp
// Icon: Boy reading an open book - transparent bg, larger/bolder for visibility
const sharp = require('sharp');
const path = require('path');

const sizes = [16, 48, 128];

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Page background - subtle, just gives context -->
  <rect x="20" y="44" width="88" height="78" rx="5" ry="5"
        fill="#eef3fb" stroke="#a8c4e8" stroke-width="3"/>

  <!-- Text lines on page (subtle) -->
  <g stroke="#c0d4eb" stroke-width="5" stroke-linecap="round">
    <line x1="34" y1="68" x2="94" y2="68"/>
    <line x1="34" y1="82" x2="86" y2="82"/>
    <line x1="34" y1="96" x2="78" y2="96"/>
    <line x1="34" y1="110" x2="68" y2="110"/>
  </g>

  <!-- Reading glasses - large, bold, dominant element -->
  <g fill="none" stroke="#1a73e8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <!-- Left lens -->
    <circle cx="42" cy="34" r="18"/>
    <!-- Right lens -->
    <circle cx="86" cy="34" r="18"/>
    <!-- Bridge -->
    <path d="M60,34 Q64,42 68,34"/>
    <!-- Left temple arm -->
    <line x1="24" y1="30" x2="12" y2="20"/>
    <!-- Right temple arm -->
    <line x1="104" y1="30" x2="116" y2="20"/>
  </g>

  <!-- Lens fill for weight -->
  <circle cx="42" cy="34" r="14" fill="#1a73e820"/>
  <circle cx="86" cy="34" r="14" fill="#1a73e820"/>
</svg>
`;

async function generate() {
  for (const size of sizes) {
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, 'icons', `icon${size}.png`));
    console.log(`Generated icon${size}.png`);
  }
}

generate().catch(console.error);
