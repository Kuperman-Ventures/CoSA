import { getReconnectDashboardData } from "@/lib/reconnect/data";
import { ReconnectClient } from "@/components/jasonos/reconnect/reconnect-client";

export const metadata = { title: "Reconnect · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ReconnectPage() {
  const data = await getReconnectDashboardData();
  return <ReconnectClient data={data} />;
}
