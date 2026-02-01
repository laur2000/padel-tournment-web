import { NextRequest, NextResponse } from "next/server";
import { processReminders, processMeetingsFinalization } from "@/lib/scheduler";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // 1. Process Finalization (Auto-confirm, matchmake, notify)
  await processMeetingsFinalization();

  // 2. Process Reminders
  await processReminders();

  return NextResponse.json({
    success: true,
  });
}
