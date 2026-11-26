const webUrl = new URL('/api/health', process.env.E2E_BASE_URL)
const apiUrl = new URL('/health', process.env.E2E_API_URL)
const expected = process.env.E2E_EXPECTED_SHA
const deadline = Date.now() + 15 * 60_000

async function identity(url) {
  const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.json()
}

while (Date.now() < deadline) {
  try {
    const [web, api] = await Promise.all([identity(webUrl), identity(apiUrl)])
    console.log(JSON.stringify({ expected, web: web.release_sha, api: api.release_sha }))
    if (web.release_sha === expected && api.release_sha === expected) process.exit(0)
  } catch (error) {
    console.log(`Deployment identity not ready: ${error instanceof Error ? error.message : String(error)}`)
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000))
}

throw new Error(`Web and API did not both reach ${expected} within 15 minutes`)
