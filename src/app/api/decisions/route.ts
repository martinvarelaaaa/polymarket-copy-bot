import { NextResponse } from "next/server";
import { getDecisions } from "@/lib/db-queries";
export async function GET() { try { return NextResponse.json(await getDecisions()); } catch { return NextResponse.json([]); } }
