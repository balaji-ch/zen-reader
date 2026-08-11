// Generate ZenReader extension icons using sharp
// Icon: Boy reading an open book - transparent bg, larger/bolder for visibility
const sharp = require('sharp');
const path = require('path');

const sizes = [16, 48, 128];

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Scaled up and centered for better visibility at small sizes -->
  <g fill="#2d2d2d" transform="translate(10, 2) scale(1.15)">
    <!-- Head -->
    <circle cx="54" cy="30" r="14"/>

    <!-- Body/torso -->
    <path d="M43,44 Q41,56 43,72 L65,72 Q67,56 65,44 Z"/>

    <!-- Arms reaching toward book -->
    <path d="M43,50 Q33,56 36,66 L41,66 Q40,58 46,52 Z"/>
    <path d="M65,50 Q75,56 72,66 L67,66 Q68,58 62,52 Z"/>
  </g>

  <!-- Open book - larger and bolder -->
  <g fill="none" stroke="#2d2d2d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
     transform="translate(10, 2) scale(1.15)">
    <!-- Book spine -->
    <path d="M54,68 L54,96"/>
    <!-- Left page -->
    <path d="M54,68 Q40,65 28,70 L28,96 Q40,91 54,96"/>
    <!-- Right page -->
    <path d="M54,68 Q68,65 80,70 L80,96 Q68,91 54,96"/>
  </g>

  <!-- Text lines on left page -->
  <g stroke="#2d2d2d" stroke-width="2" opacity="0.5" stroke-linecap="round"
     transform="translate(10, 2) scale(1.15)">
    <line x1="34" y1="76" x2="49" y2="74"/>
    <line x1="34" y1="82" x2="48" y2="80"/>
    <line x1="34" y1="88" x2="49" y2="86"/>
  </g>

  <!-- Text lines on right page -->
  <g stroke="#2d2d2d" stroke-width="2" opacity="0.5" stroke-linecap="round"
     transform="translate(10, 2) scale(1.15)">
    <line x1="59" y1="74" x2="74" y2="76"/>
    <line x1="59" y1="80" x2="74" y2="82"/>
    <line x1="59" y1="86" x2="74" y2="88"/>
  </g>
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
