import { getDashboardData } from "@/lib/data/dashboard";
import { DashboardClient } from "@/components/jasonos/dashboard-client";

export const revalidate = 300;

export default async function Dashboard() {
  const data = await getDashboardData();
  return <DashboardClient data={data} />;
}
