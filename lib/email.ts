import nodemailer from "nodemailer";
import type { Balance, Expense } from "./types";

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD environment variables are not set");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function recipients(): string[] {
  const list = [process.env.EMAIL_G, process.env.EMAIL_B].filter(
    (v): v is string => Boolean(v && v.trim())
  );
  if (list.length === 0) {
    throw new Error("EMAIL_G / EMAIL_B environment variables are not set");
  }
  return list;
}

function balanceLine(balance: Balance): string {
  if (!balance.owedBy) return "G and B are all settled up.";
  return `${balance.owedBy} owes ${balance.owedTo} $${balance.amount.toFixed(2)}.`;
}

export function buildWeeklySummaryEmail(allExpenses: Expense[], balance: Balance) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const recent = allExpenses.filter((e) => e.expense_date >= weekAgoStr);
  const weekTotal = recent.reduce((sum, e) => sum + e.amount, 0);

  const rows = recent
    .map(
      (e) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.expense_date}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(e.description)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.paid_by}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">$${e.amount.toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const table = recent.length
    ? `<table style="border-collapse:collapse;width:100%;font-size:14px;">
         <thead>
           <tr>
             <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333;">Date</th>
             <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333;">Description</th>
             <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333;">Paid by</th>
             <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #333;">Amount</th>
           </tr>
         </thead>
         <tbody>${rows}</tbody>
       </table>`
    : `<p style="color:#666;">No expenses were logged this week.</p>`;

  const subject = `Household expenses: ${balanceLine(balance)}`;
  const html = `
    <div style="font-family:sans-serif;color:#1e293b;max-width:560px;">
      <h2 style="margin-bottom:4px;">Weekly household expense summary</h2>
      <p style="color:#475569;margin-top:0;">${new Date().toLocaleDateString()}</p>
      <p style="font-size:16px;font-weight:600;">${balanceLine(balance)}</p>
      <p style="color:#475569;">This week's spending: $${weekTotal.toFixed(2)} · All-time total: $${balance.totalSpent.toFixed(2)}</p>
      <h3 style="margin-top:24px;">This week's expenses</h3>
      ${table}
    </div>
  `;
  const text = `Weekly household expense summary\n${balanceLine(balance)}\nThis week's spending: $${weekTotal.toFixed(
    2
  )} · All-time total: $${balance.totalSpent.toFixed(2)}\n\n${
    recent.length
      ? recent.map((e) => `${e.expense_date} - ${e.description} - paid by ${e.paid_by} - $${e.amount.toFixed(2)}`).join("\n")
      : "No expenses were logged this week."
  }`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendWeeklySummaryEmail(allExpenses: Expense[], balance: Balance): Promise<void> {
  const transporter = getTransporter();
  const { subject, html, text } = buildWeeklySummaryEmail(allExpenses, balance);
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: recipients(),
    subject,
    html,
    text,
  });
}
