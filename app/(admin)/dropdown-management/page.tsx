import { redirect } from "next/navigation"

export default function DropdownManagementRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  return redirect(`/manage-dropdown?tab=${(await searchParams).tab === "tags" ? "tags" : "brands"}`)
}
