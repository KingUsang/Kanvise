import { createManifest, manifestPath, saveManifest } from './support/run-manifest'

export default async function globalSetup() {
  const file = manifestPath()
  const manifest = createManifest()
  await saveManifest(manifest, file)
  process.stdout.write(`Created staging run manifest ${file}\n`)
}
