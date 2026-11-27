import { createECDH } from 'node:crypto'

function decode(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/** True when the private key derives the given public key on the P-256 curve (DEV-PSH-004). */
export function vapidKeysMatch(publicKey: string | undefined, privateKey: string | undefined): boolean {
  if (!publicKey || !privateKey) return false
  try {
    const priv = decode(privateKey)
    const pub = decode(publicKey)
    if (priv.length !== 32 || pub.length !== 65) return false
    const ecdh = createECDH('prime256v1')
    ecdh.setPrivateKey(priv)
    return ecdh.getPublicKey().equals(pub)
  } catch {
    return false
  }
}
