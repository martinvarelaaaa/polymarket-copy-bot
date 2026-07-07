import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db-queries";

export async function GET() {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("API /stats error:", error);
    return NextResponse.json(
      {
        totalPnl: 0,
        winRate: 0,
        openPositions: 0,
        totalResolved: 0,
        trackingWallets: 0,
        todaySignals: 0,
        activeRuleVersion: 1,
      },
      { status: 200 }
    );
  }
}
