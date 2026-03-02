import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import QueryProvider from "@/components/providers/QueryProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main
          className="flex-1 overflow-y-auto"
          style={{
            backgroundColor: "var(--bg-secondary)",
            padding: "28px 32px",
          }}
        >
          <QueryProvider>{children}</QueryProvider>
        </main>
      </div>
    </div>
  );
}
