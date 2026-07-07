import { NextResponse } from "next/server";
import { getPaperTrades } from "@/lib/db-queries";
export async function GET() { try { return NextResponse.json(await getPaperTrades()); } catch { return NextResponse.json([]); } }
