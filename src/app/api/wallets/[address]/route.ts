import { NextRequest, NextResponse } from "next/server";
import { getWalletByAddress } from "@/lib/db-queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const wallet = await getWalletByAddress(address);
    if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(wallet);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
