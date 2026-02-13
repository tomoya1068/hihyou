import { NextResponse } from "next/server";
import { postRandomBotReview } from "@/app/review/actions";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-vercel-cron");
  const secret = process.env.CRON_SECRET;

  const authedBySecret = secret && auth === `Bearer ${secret}`;
  const authedByVercelCron = Boolean(cronHeader);

  if (!authedBySecret && !authedByVercelCron) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const result = await postRandomBotReview();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}