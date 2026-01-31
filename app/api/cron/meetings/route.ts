import { NextRequest, NextResponse } from "next/server";
import { processReminders, processMeetingsFinalization } from "@/lib/scheduler";

export const dynamic = 'force-dynamic'; // Prevent static generation

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // 1. Process Reminders
  await processReminders();

  // 2. Process Finalization (Auto-confirm, matchmake, notify)
  await processMeetingsFinalization();

  return NextResponse.json({
    success: true
  });
}
