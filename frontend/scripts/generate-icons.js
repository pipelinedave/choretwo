import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const publicDir = join(__dirname, '../public')

async function generateIcons() {
  const sizes = [
    { input: join(publicDir, 'icon-192.svg'), output: join(publicDir, 'icon-192.png'), size: 192 },
    { input: join(publicDir, 'icon-512.svg'), output: join(publicDir, 'icon-512.png'), size: 512 },
    { input: join(publicDir, 'apple-touch-icon.svg'), output: join(publicDir, 'apple-touch-icon.png'), size: 180 }
  ]

  for (const { input, output, size } of sizes) {
    try {
      await sharp(input)
        .resize(size, size)
        .png()
        .toFile(output)
      console.log(`✓ Generated ${output}`)
    } catch (error) {
      console.error(`✗ Failed to generate ${output}:`, error.message)
    }
  }

  // Create favicon.ico from 512 icon
  try {
    await sharp(join(publicDir, 'icon-512.png'))
      .resize(32, 32)
      .toFile(join(publicDir, 'favicon.ico'))
    console.log('✓ Generated favicon.ico')
  } catch (error) {
    console.error('✗ Failed to generate favicon.ico:', error.message)
  }
}

generateIcons()
