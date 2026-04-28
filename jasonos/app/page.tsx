import { getDashboardData } from "@/lib/data/dashboard";
import { getWhatNowAdvice } from "@/lib/server-actions/what-now";
import { getPinnedTodayCards } from "@/lib/server-actions/pin";
import { DashboardClient } from "@/components/jasonos/dashboard-client";

export const revalidate = 0;

export default async function Dashboard() {
  const [data, whatNow, pinned] = await Promise.all([
    getDashboardData(),
    getWhatNowAdvice(),
    getPinnedTodayCards(),
  ]);
  return <DashboardClient data={data} whatNow={whatNow} pinned={pinned} />;
}
