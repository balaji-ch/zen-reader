// Generate ZenReader extension icons using sharp
// Icon: Reading glasses over an open book - sharp/modern geometric style
const sharp = require('sharp');
const path = require('path');

const sizes = [16, 48, 128];

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Open book - two angled pages meeting at spine -->
  <g>
    <!-- Left page -->
    <path d="M64,58 L64,118 L16,108 L16,48 Z" fill="#f0f4fa" stroke="#3b82f6" stroke-width="3" stroke-linejoin="round"/>
    <!-- Right page -->
    <path d="M64,58 L64,118 L112,108 L112,48 Z" fill="#f0f4fa" stroke="#3b82f6" stroke-width="3" stroke-linejoin="round"/>
    <!-- Spine line -->
    <line x1="64" y1="58" x2="64" y2="118" stroke="#2563eb" stroke-width="3"/>
  </g>

  <!-- Text lines on left page -->
  <g stroke="#94b8e8" stroke-width="3" stroke-linecap="round">
    <line x1="26" y1="68" x2="56" y2="72"/>
    <line x1="26" y1="80" x2="52" y2="83"/>
    <line x1="26" y1="92" x2="48" y2="94"/>
  </g>

  <!-- Text lines on right page -->
  <g stroke="#94b8e8" stroke-width="3" stroke-linecap="round">
    <line x1="72" y1="72" x2="102" y2="68"/>
    <line x1="72" y1="83" x2="98" y2="80"/>
    <line x1="72" y1="94" x2="94" y2="92"/>
  </g>

  <!-- Reading glasses - bold geometric, sitting on top of book -->
  <g fill="none" stroke="#1e40af" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <!-- Left lens (rounded rectangle shape) -->
    <rect x="22" y="16" width="30" height="28" rx="10" ry="10"/>
    <!-- Right lens -->
    <rect x="76" y="16" width="30" height="28" rx="10" ry="10"/>
    <!-- Bridge -->
    <path d="M52,30 L76,30"/>
    <!-- Left temple -->
    <line x1="22" y1="26" x2="10" y2="18"/>
    <!-- Right temple -->
    <line x1="106" y1="26" x2="118" y2="18"/>
  </g>

  <!-- Lens tint -->
  <rect x="26" y="20" width="22" height="20" rx="7" ry="7" fill="#3b82f615"/>
  <rect x="80" y="20" width="22" height="20" rx="7" ry="7" fill="#3b82f615"/>
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
