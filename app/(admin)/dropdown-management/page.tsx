import { redirect } from "next/navigation"

function redirectTab(raw: string | undefined): string {
  if (raw === "tags") return "tags"
  if (raw === "groups") return "groups"
  if (raw === "departments") return "departments"
  if (
    raw === "suppliers" ||
    raw === "supplier-names" ||
    raw === "supplier-contacts"
  ) {
    return "suppliers"
  }
  return "brands"
}

export default async function DropdownManagementRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  redirect(`/manage-dropdown?tab=${redirectTab(params.tab)}`)
}
