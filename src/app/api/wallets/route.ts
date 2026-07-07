import { NextResponse } from "next/server";
import { getWallets } from "@/lib/db-queries";

export async function GET() {
  try {
    const wallets = await getWallets();
    return NextResponse.json(wallets);
  } catch {
    return NextResponse.json([]);
  }
}
