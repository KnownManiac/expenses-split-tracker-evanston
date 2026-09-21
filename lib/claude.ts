import Anthropic from "@anthropic-ai/sdk";
import type {
  ImageBlockParam,
  MessageParam,
  TextBlockParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
  type Identity,
  type SplitType,
} from "./db";
import { computeBalance } from "./balance";

const MODEL = "claude-haiku-4-5-20251001";

const tools: Tool[] = [
  {
    name: "add_expense",
    description:
      "Record a new shared household expense. Use this whenever the user says they paid for or bought something.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Short description of the expense, e.g. 'Groceries'" },
        amount: { type: "number", description: "Total amount of the expense" },
        paid_by: { type: "string", enum: ["G", "B"], description: "Who actually paid for it" },
        split_type: {
          type: "string",
          enum: ["equal", "percentage", "manual"],
          description:
            "How to split the cost between G and B. 'equal' = 50/50. 'percentage' = use split_g_percent/split_b_percent. 'manual' = use split_g_amount/split_b_amount for exact dollar shares.",
        },
        split_g_percent: { type: "number", description: "G's percentage share, only for split_type=percentage" },
        split_b_percent: { type: "number", description: "B's percentage share, only for split_type=percentage" },
        split_g_amount: { type: "number", description: "G's exact dollar share, only for split_type=manual" },
        split_b_amount: { type: "number", description: "B's exact dollar share, only for split_type=manual" },
        expense_date: { type: "string", description: "Date of the expense in YYYY-MM-DD format, defaults to today" },
      },
      required: ["description", "amount", "paid_by", "split_type"],
    },
  },
  {
    name: "edit_expense",
    description: "Edit an existing expense by id. Only include fields that should change.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number" },
        description: { type: "string" },
        amount: { type: "number" },
        paid_by: { type: "string", enum: ["G", "B"] },
        split_type: { type: "string", enum: ["equal", "percentage", "manual"] },
        split_g_percent: { type: "number" },
        split_b_percent: { type: "number" },
        split_g_amount: { type: "number" },
        split_b_amount: { type: "number" },
        expense_date: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_expense",
    description: "Delete an expense by id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "number" } },
      required: ["id"],
    },
  },
  {
    name: "list_expenses",
    description: "List recent expenses. Use this if the user asks what has been logged.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number", description: "Max number of expenses to return, defaults to 20" } },
    },
  },
  {
    name: "get_balance",
    description: "Get the current running balance between G and B (who owes whom, and how much).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "generate_pdf",
    description:
      "Generate a downloadable PDF report of all expenses and the current balance. Use this when the user asks for a PDF, report, summary document, or export.",
    input_schema: { type: "object", properties: {} },
  },
];

function toSplitArgs(input: Record<string, unknown>) {
  return {
    split_g:
      (input.split_g_percent as number | undefined) ?? (input.split_g_amount as number | undefined),
    split_b:
      (input.split_b_percent as number | undefined) ?? (input.split_b_amount as number | undefined),
  };
}

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ result: unknown; pdfRequested: boolean }> {
  switch (name) {
    case "add_expense": {
      const { split_g, split_b } = toSplitArgs(input);
      const expense = await createExpense({
        description: String(input.description),
        amount: Number(input.amount),
        paid_by: input.paid_by as Identity,
        split_type: input.split_type as SplitType,
        split_g,
        split_b,
        expense_date: input.expense_date as string | undefined,
      });
      return { result: expense, pdfRequested: false };
    }
    case "edit_expense": {
      const { split_g, split_b } = toSplitArgs(input);
      const expense = await updateExpense(Number(input.id), {
        description: input.description as string | undefined,
        amount: input.amount as number | undefined,
        paid_by: input.paid_by as Identity | undefined,
        split_type: input.split_type as SplitType | undefined,
        split_g,
        split_b,
        expense_date: input.expense_date as string | undefined,
      });
      return { result: expense ?? { error: "Expense not found" }, pdfRequested: false };
    }
    case "delete_expense": {
      const ok = await deleteExpense(Number(input.id));
      return { result: { deleted: ok }, pdfRequested: false };
    }
    case "list_expenses": {
      const limit = (input.limit as number | undefined) ?? 20;
      const expenses = await listExpenses();
      return { result: expenses.slice(0, limit), pdfRequested: false };
    }
    case "get_balance": {
      const expenses = await listExpenses();
      return { result: computeBalance(expenses), pdfRequested: false };
    }
    case "generate_pdf": {
      return { result: { ready: true, url: "/api/pdf" }, pdfRequested: true };
    }
    default:
      return { result: { error: `Unknown tool ${name}` }, pdfRequested: false };
  }
}

export interface ChatResult {
  reply: string;
  pdfReady: boolean;
  history: MessageParam[];
}

export interface ChatTurnInput {
  text?: string;
  image?: { mediaType: string; data: string };
}

const MAX_HISTORY_TURNS = 8;

function isToolResultMessage(message: MessageParam): boolean {
  return (
    message.role === "user" &&
    Array.isArray(message.content) &&
    message.content.length > 0 &&
    (message.content[0] as { type?: string }).type === "tool_result"
  );
}

// Keeps the most recent MAX_HISTORY_TURNS user turns, always cutting at a
// genuine new user turn (never inside a tool_use/tool_result exchange).
function trimHistory(messages: MessageParam[]): MessageParam[] {
  const turnStarts = messages.reduce<number[]>((acc, message, i) => {
    if (message.role === "user" && !isToolResultMessage(message)) acc.push(i);
    return acc;
  }, []);
  if (turnStarts.length <= MAX_HISTORY_TURNS) return messages;
  const cutIndex = turnStarts[turnStarts.length - MAX_HISTORY_TURNS];
  return messages.slice(cutIndex);
}

export async function runChat(
  input: ChatTurnInput,
  identity: Identity,
  history: MessageParam[] = []
): Promise<ChatResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  const anthropic = new Anthropic({ apiKey });

  const today = new Date().toISOString().slice(0, 10);
  const system = `You are the assistant inside a household expense-splitting app shared by two people, G and B. Today's date is ${today}. The person currently chatting with you is ${identity}. When they say "I paid" or "I" without naming who, assume they mean ${identity}. When an expense is split "equally" or they don't specify a split, use split_type "equal".

The user can attach a photo of a receipt or bill, sometimes with a caption. Read the total amount and merchant/description off the image. If the caption already says who paid and how to split it, use that directly. If required information is missing or ambiguous (who paid, or how the cost should be split), do NOT guess -- ask ONE short, specific clarifying question in plain text and stop, without calling any tool. Once the user's reply gives you what you need, use it together with the earlier image/receipt details already in this conversation to add the expense.

Use tools to actually make changes -- do not just describe what you would do. After using tools, reply with a short, friendly, natural-language confirmation of what happened (include amounts and who owes whom when relevant). Keep replies brief.`;

  const contentBlocks: Array<TextBlockParam | ImageBlockParam> = [];
  if (input.image) {
    contentBlocks.push({
      type: "image",
      source: { type: "base64", media_type: input.image.mediaType as "image/jpeg", data: input.image.data },
    });
  }
  const text = input.text?.trim();
  contentBlocks.push({ type: "text", text: text || (input.image ? "Here's a photo of the receipt." : "") });

  const messages: MessageParam[] = [...history, { role: "user", content: contentBlocks }];
  let pdfReady = false;

  for (let iteration = 0; iteration < 5; iteration++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
    if (toolUseBlocks.length === 0) {
      const replyText = response.content
        .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return { reply: replyText || "Done.", pdfReady, history: trimHistory(messages) };
    }

    const toolResults: ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const { result, pdfRequested } = await executeTool(
        block.name,
        (block.input as Record<string, unknown>) ?? {}
      );
      if (pdfRequested) pdfReady = true;
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    reply: "Sorry, I got a bit stuck processing that -- could you try rephrasing?",
    pdfReady,
    history: trimHistory(messages),
  };
}
