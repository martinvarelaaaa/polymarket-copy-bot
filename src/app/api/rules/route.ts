import { NextResponse } from "next/server";
import { getRuleSets, getRuleChanges } from "@/lib/db-queries";
export async function GET() { try { const sets = await getRuleSets(); const changes = await getRuleChanges(); return NextResponse.json({ sets, changes }); } catch { return NextResponse.json({ sets: [], changes: [] }); } }
