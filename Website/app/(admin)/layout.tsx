import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AdminAuthGuard } from "@/components/admin-auth-guard"
import { AccountModeDataRoot, AccountModeProvider } from "@/components/account-mode-provider"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AdminAuthGuard>
        <AccountModeProvider>
          <AdminSidebar />
          <AccountModeDataRoot>
            <SidebarInset>
              <AdminHeader />
              <main className="flex-1 p-4 md:p-6">{children}</main>
            </SidebarInset>
          </AccountModeDataRoot>
        </AccountModeProvider>
      </AdminAuthGuard>
    </SidebarProvider>
  )
}
