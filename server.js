import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3333;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.use(express.json({ limit: "50mb" }));

// Serveer de frontend
app.use(express.static(__dirname));

// Listing genereren
app.post("/generate", async (req, res) => {
  try {
    const { photos = [], form = {} } = req.body;

    const info = [
      form.cat   && `Categorie: ${form.cat}`,
      form.cond  && `Staat: ${form.cond}`,
      form.brand && `Merk: ${form.brand}`,
      form.size  && `Maat: ${form.size}`,
      form.color && `Kleur: ${form.color}`,
      form.extra && `Extra: ${form.extra}`,
    ].filter(Boolean).join(", ");

    const prompt = `Jij bent een expert Vinted verkoper. Analyseer de fotos en schrijf een geweldige Nederlandstalige Vinted listing.${info ? ` Extra info: ${info}.` : ""}

Antwoord ALLEEN met dit JSON-object, niets anders, geen markdown:
{"titel":"max 60 tekens","omschrijving":"meerdere zinnen eerlijk en aantrekkelijk","prijs":12,"prijsadvies":"waarom deze prijs","tags":["a","b","c","d","e"]}`;

    const content = [
      ...photos.map(p => ({
        type: "image",
        source: { type: "base64", media_type: p.mime, data: p.b64 }
      })),
      { type: "text", text: prompt }
    ];

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content }]
    });

    const txt = message.content.map(b => b.text || "").join("").trim();
    const s = txt.indexOf("{");
    const e = txt.lastIndexOf("}");

    if (s === -1 || e === -1) {
      return res.status(500).json({ error: "Geen JSON in antwoord", raw: txt });
    }

    res.json(JSON.parse(txt.slice(s, e + 1)));

  } catch (err) {
    console.error("Fout:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VintedHelper draait op poort ${PORT}`);
});
