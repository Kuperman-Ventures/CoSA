import { getReconnectDashboardData } from "@/lib/reconnect/data";
import { getUntriagedReconnectCount } from "@/lib/server-actions/triage";
import { ReconnectClient } from "@/components/jasonos/reconnect/reconnect-client";

export const metadata = { title: "Reconnect · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ReconnectPage() {
  const [data, triageCount] = await Promise.all([
    getReconnectDashboardData(),
    getUntriagedReconnectCount(),
  ]);

  return <ReconnectClient data={data} triageCount={triageCount} />;
}
