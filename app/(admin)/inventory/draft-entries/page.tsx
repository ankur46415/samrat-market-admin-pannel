import { redirect } from "next/navigation"

export default function LegacyDraftEntriesRedirect() {
  redirect("/draft-entries")
}
