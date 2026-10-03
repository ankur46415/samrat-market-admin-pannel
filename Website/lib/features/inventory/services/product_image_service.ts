import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { getAccountMode } from "@/lib/account-mode"
import { storage } from "@/lib/firebase"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/gif") return "gif"
  return "jpg"
}

export function validateProductImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Use JPG, PNG, WebP, or GIF"
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 5 MB or smaller"
  }
  return null
}

/** Upload optional product photo — returns public download URL. */
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const err = validateProductImageFile(file)
  if (err) throw new Error(err)

  const mode = getAccountMode()
  const ext = extensionForMime(file.type)
  const objectRef = ref(storage, `product-images/${mode}/${productId}.${ext}`)

  await uploadBytes(objectRef, file, { contentType: file.type })
  return getDownloadURL(objectRef)
}
