import { NextResponse } from "next/server";
import { getDailyReports } from "@/lib/db-queries";
export async function GET() { try { return NextResponse.json(await getDailyReports()); } catch { return NextResponse.json([]); } }
