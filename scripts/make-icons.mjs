import sharp from 'sharp'

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#172033"/>
  <circle cx="256" cy="256" r="164" fill="#14b8a6"/>
  <path d="M92 256h328M256 92c55 63 78 116 78 164s-23 101-78 164M256 92c-55 63-78 116-78 164s23 101 78 164" fill="none" stroke="#fffaf0" stroke-width="28" stroke-linecap="round"/>
  <path d="M142 174c65 42 163 42 228 0M142 338c65-42 163-42 228 0" fill="none" stroke="#facc15" stroke-width="28" stroke-linecap="round"/>
  <circle cx="365" cy="146" r="44" fill="#f97316" stroke="#fffaf0" stroke-width="18"/>
</svg>`

const sizes = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]

await Promise.all(
  sizes.map(([file, size]) =>
    sharp(Buffer.from(svg)).resize(size, size).png().toFile(file),
  ),
)
