import "dotenv/config";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

const schema = z.object({
  response: z.string()
});

async function main() {
  console.log("Testando com gemini-3-flash-preview...");
  try {
    const { object } = await generateObject({
      model: googleAI("gemini-3-flash-preview"),
      schema,
      prompt: "Responda apenas 'Olá'."
    });
    console.log("Sucesso com gemini-3-flash-preview:", object);
  } catch (err: any) {
    console.error("Erro com gemini-3-flash-preview:", err.message);
  }

  console.log("\nTestando com gemini-1.5-flash...");
  try {
    const { object } = await generateObject({
      model: googleAI("gemini-1.5-flash"),
      schema,
      prompt: "Responda apenas 'Olá'."
    });
    console.log("Sucesso com gemini-1.5-flash:", object);
  } catch (err: any) {
    console.error("Erro com gemini-1.5-flash:", err.message);
  }
}

main().catch(console.error);
