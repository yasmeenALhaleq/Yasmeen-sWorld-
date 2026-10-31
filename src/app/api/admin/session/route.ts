import { NextResponse } from "next/server";
import { assertAdmin, destroySession, UnauthorizedError } from "@/server/auth/session";
import { isSameOrigin } from "@/server/request";

// Keep-alive (POST ?action=ping) and sign-out (POST ?action=logout) used by the
// inactivity timer in the admin area. Both require a same-origin request.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const action = new URL(request.url).searchParams.get("action");

  if (action === "logout") {
    await destroySession();
    return NextResponse.json({ ok: true });
  }
  try {
    await assertAdmin(); // also slides the idle window forward
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ ok: false }, { status: 401 });
    throw err;
  }
}
