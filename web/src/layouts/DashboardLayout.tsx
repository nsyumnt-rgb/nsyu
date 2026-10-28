import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-[#F4F7FB]">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 p-5 md:p-6 w-full max-w-[1750px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
