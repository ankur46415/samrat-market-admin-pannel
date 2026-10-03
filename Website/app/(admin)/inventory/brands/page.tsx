import { redirect } from "next/navigation"

export default function InventoryBrandsRedirectPage() {
  redirect("/manage-dropdown?tab=brands")
}
