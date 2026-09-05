// Streaming AI Financial Assistant Chat
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context, model } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENAI_API_KEY || LOVABLE_API_KEY;

    if (!apiKey) {
      throw new Error("Neither OPENAI_API_KEY nor LOVABLE_API_KEY is configured");
    }

    // Direct OpenAI or gateway endpoint
    const endpoint = OPENAI_API_KEY
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    const defaultModel = OPENAI_API_KEY ? "gpt-4o-mini" : "openai/gpt-5-mini";
    const selectedModel = model || defaultModel;

    const systemPrompt = `You are KhaataKitab AI — a friendly, concise financial assistant for an Indian small-business bookkeeping app.

Speak in plain, simple English (or Hinglish if the user does). Use ₹ for all currency. Format numbers in Indian style (lakhs/crores when relevant). Use markdown sparingly: short paragraphs, bullets when listing.

You have access to the user's recent transactions and stats below. Use them to give specific, actionable answers — never invent numbers. If you don't have data to answer, say so honestly.

USER FINANCIAL CONTEXT:
${context ?? "No transaction context provided."}

Keep responses under 150 words unless the user asks for detail.`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
