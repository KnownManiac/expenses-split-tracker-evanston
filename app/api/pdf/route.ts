import { NextResponse } from "next/server";
import { listExpenses } from "@/lib/db";
import { generateExpensePdf } from "@/lib/pdf";
import { getIdentity } from "@/lib/session";

export async function GET() {
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expenses = await listExpenses();
  const pdfBytes = await generateExpensePdf(expenses);

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="expense-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
