import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Expense } from "./db";
import { computeBalance } from "./balance";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;

export async function generateExpensePdf(expenses: Expense[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawText = (text: string, x: number, size: number, useBold = false) => {
    page.drawText(text, { x, y, size, font: useBold ? boldFont : font, color: rgb(0.1, 0.1, 0.1) });
  };

  const newPageIfNeeded = () => {
    if (y < MARGIN + 40) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  drawText("Household Expense Report", MARGIN, 20, true);
  y -= 22;
  drawText(`Generated ${new Date().toLocaleString()}`, MARGIN, 9);
  y -= 24;

  const balance = computeBalance(expenses);
  drawText("Summary", MARGIN, 13, true);
  y -= 18;
  drawText(`Total spent: $${balance.totalSpent.toFixed(2)}`, MARGIN, 11);
  y -= 16;
  const balanceText =
    balance.owedBy && balance.owedTo
      ? `${balance.owedBy} owes ${balance.owedTo}: $${balance.amount.toFixed(2)}`
      : "G and B are settled up.";
  drawText(balanceText, MARGIN, 11);
  y -= 26;

  drawText("Expenses", MARGIN, 13, true);
  y -= 18;

  const columns = [
    { label: "Date", x: MARGIN, width: 65 },
    { label: "Description", x: MARGIN + 65, width: 165 },
    { label: "Paid by", x: MARGIN + 230, width: 50 },
    { label: "Amount", x: MARGIN + 280, width: 60 },
    { label: "G share", x: MARGIN + 340, width: 55 },
    { label: "B share", x: MARGIN + 395, width: 55 },
  ];
  for (const col of columns) {
    page.drawText(col.label, { x: col.x, y, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  }
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 14;

  for (const e of expenses) {
    newPageIfNeeded();
    const values = [
      e.expense_date,
      e.description.length > 28 ? e.description.slice(0, 27) + "…" : e.description,
      e.paid_by,
      `$${e.amount.toFixed(2)}`,
      `$${e.split_g.toFixed(2)}`,
      `$${e.split_b.toFixed(2)}`,
    ];
    values.forEach((val, i) => {
      page.drawText(val, { x: columns[i].x, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    });
    y -= 16;
  }

  if (expenses.length === 0) {
    drawText("No expenses recorded yet.", MARGIN, 10);
  }

  return pdfDoc.save();
}
