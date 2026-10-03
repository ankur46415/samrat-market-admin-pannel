import { redirect } from "next/navigation"

export default function InventoryTagsRedirectPage() {
  redirect("/manage-dropdown?tab=tags")
}
