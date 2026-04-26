import {
  getReconnectDashboardData,
  getReconnectTypeCounts,
} from "@/lib/reconnect/data";
import { getUntriagedReconnectCount } from "@/lib/server-actions/triage";
import { ReconnectClient } from "@/components/jasonos/reconnect/reconnect-client";

export const metadata = { title: "Reconnect · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ReconnectPage() {
  const [data, triageCount, typeCounts] = await Promise.all([
    getReconnectDashboardData(),
    getUntriagedReconnectCount(),
    getReconnectTypeCounts(),
  ]);

  return (
    <ReconnectClient
      data={data}
      triageCount={triageCount}
      typeCounts={typeCounts}
    />
  );
}
