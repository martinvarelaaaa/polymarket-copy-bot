import { NextResponse } from "next/server";
import { getObservations } from "@/lib/db-queries";
export async function GET() { try { return NextResponse.json(await getObservations()); } catch { return NextResponse.json([]); } }
