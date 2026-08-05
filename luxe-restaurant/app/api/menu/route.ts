import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { menuItemQuerySchema, parseOrThrow } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const query = parseOrThrow(menuItemQuerySchema, {
    category: req.nextUrl.searchParams.get("category") ?? undefined,
    onlyAvailable: req.nextUrl.searchParams.get("onlyAvailable") ?? undefined,
  });

  const items = await prisma.menuItem.findMany({
    where: {
      ...(query.category ? { category: query.category } : {}),
      ...(query.onlyAvailable ? { isAvailable: true } : {}),
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json({ items });
}
