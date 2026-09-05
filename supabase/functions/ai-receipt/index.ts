// AI Vision-based receipt extraction
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!OPENAI_API_KEY && !GEMINI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("No AI API key configured (set OPENAI_API_KEY, GEMINI_API_KEY, or LOVABLE_API_KEY)");
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure data URL format
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    // Determine endpoint, model and auth headers
    let endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let authHeader = `Bearer ${LOVABLE_API_KEY}`;
    let model = "google/gemini-2.5-flash";

    if (OPENAI_API_KEY) {
      endpoint = "https://api.openai.com/v1/chat/completions";
      authHeader = `Bearer ${OPENAI_API_KEY}`;
      model = "gpt-4o-mini";
    } else if (GEMINI_API_KEY) {
      // Google Gemini native OpenAI-compatible endpoint
      endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      authHeader = `Bearer ${GEMINI_API_KEY}`;
      model = "gemini-2.5-flash";
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You extract structured data from Indian receipts/bills. Be precise. Use ₹ values as numbers (no symbol).",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract receipt details. If a field is unclear, leave it null." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_receipt",
            description: "Extract structured data from a receipt image.",
            parameters: {
              type: "object",
              properties: {
                merchant: { type: ["string", "null"], description: "Store/merchant name" },
                totalAmount: { type: ["number", "null"], description: "Final total in INR" },
                date: { type: ["string", "null"], description: "Date in YYYY-MM-DD if visible" },
                category: {
                  type: "string",
                  enum: ["Food", "Groceries", "Shopping", "Transport", "Medical", "Bills", "Entertainment", "Other Expense"],
                },
                items: {
                  type: "array",
                  items: { type: "string" },
                  description: "Line items if visible (max 10)",
                },
                paymentMethod: { type: ["string", "null"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["merchant", "totalAmount", "date", "category", "items", "paymentMethod", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_receipt" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      if (status === 429 || status === 402) {
        return new Response(JSON.stringify({ error: status === 429 ? "Rate limit exceeded" : "AI credits exhausted" }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!args) {
      return new Response(JSON.stringify({ error: "Could not extract receipt" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-receipt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
