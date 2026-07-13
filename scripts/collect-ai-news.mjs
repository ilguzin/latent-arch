// Сбор AI-новостей: фиды → кандидаты → LLM отбирает топ и пишет саммари → карточки в content/ai-news/.
// Запуск: node scripts/collect-ai-news.mjs [--dry-run]
//   --dry-run — только напечатать кандидатов (без LLM и записи файлов).
// Env: OPENROUTER_API_KEY (обязателен без --dry-run), OPENROUTER_MODEL=anthropic/claude-opus-4.8,
//      WINDOW_HOURS=48, MAX_PICKS=5, MAX_CARDS=50.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content", "ai-news");
const SOURCES_FILE = path.join(ROOT, "scripts", "ai-news-sources.json");

// Все ручки скрипта в одном месте: env-переменные (со значениями по умолчанию) + флаги CLI.
const CONFIG = {
  // OpenRouter
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "", // обязателен без --dry-run
  openrouterModel: process.env.OPENROUTER_MODEL ?? "anthropic/claude-opus-4.8", // слаг из openrouter.ai/models
  // Сбор
  windowHours: Number(process.env.WINDOW_HOURS ?? 48), // брать статьи не старше N часов
  maxPicks: Number(process.env.MAX_PICKS ?? 5), // сколько новостей модель отбирает за тик
  maxCards: Number(process.env.MAX_CARDS ?? 50), // retention: максимум карточек в content/ai-news/
  maxPerSource: 15, // не тащить весь бэклог фида
  // CLI
  dryRun: process.argv.includes("--dry-run"),
};

const parser = new Parser();

function slugify(title, url) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 8);
  return `${base || "item"}-${hash}`;
}

function readExistingCards() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md") && f !== "_index.md")
    .map((f) => {
      const text = fs.readFileSync(path.join(CONTENT_DIR, f), "utf8");
      const url = text.match(/^link:\s*"(.*)"\s*$/m)?.[1] ?? "";
      const date = text.match(/^date:\s*(\S+)\s*$/m)?.[1] ?? "";
      return { file: path.join(CONTENT_DIR, f), url, date };
    });
}

async function fetchCandidates(knownUrls) {
  const { sources } = JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8"));
  const cutoff = Date.now() - CONFIG.windowHours * 3600 * 1000;
  const candidates = [];
  const seen = new Set(knownUrls);

  for (const source of sources) {
    let feed;
    try {
      const res = await fetch(source.url, {
        signal: AbortSignal.timeout(20000),
        headers: { "user-agent": "latent-arch-ai-news/1.0 (+https://latent-arch.com)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      feed = await parser.parseString(await res.text());
    } catch (err) {
      // Одна упавшая лента не должна ронять весь тик
      console.warn(`WARN: фид ${source.id} недоступен: ${err.message}`);
      continue;
    }
    let taken = 0;
    for (const item of feed.items ?? []) {
      if (taken >= CONFIG.maxPerSource) break;
      const link = (item.link ?? "").trim();
      const pubDate = item.isoDate ?? item.pubDate;
      if (!link || !item.title || !pubDate) continue;
      const ts = Date.parse(pubDate);
      if (Number.isNaN(ts) || ts < cutoff) continue;
      if (seen.has(link)) continue;
      seen.add(link);
      candidates.push({
        title: item.title.trim(),
        url: link,
        date: new Date(ts).toISOString(),
        source: source.name,
        snippet: (item.contentSnippet ?? "").replace(/\s+/g, " ").slice(0, 500),
      });
      taken++;
    }
  }
  return candidates;
}

async function curate(candidates) {
  if (!CONFIG.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY не задан (для запуска без LLM используй --dry-run)");
  }

  const list = candidates
    .map((c, i) => `[${i}] (${c.source}, ${c.date.slice(0, 10)}) ${c.title}\n${c.snippet}`)
    .join("\n\n");

  const schema = {
    type: "object",
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            summary: { type: "string" },
          },
          required: ["index", "summary"],
          additionalProperties: false,
        },
      },
    },
    required: ["picks"],
    additionalProperties: false,
  };

  const post = (body) =>
    fetch("https://openrouter.ai/api/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(180000),
      headers: {
        authorization: `Bearer ${CONFIG.openrouterApiKey}`,
        "content-type": "application/json",
        "http-referer": "https://latent-arch.com",
        "x-title": "latent-arch ai-news",
      },
      body: JSON.stringify(body),
    });

  const body = {
    model: CONFIG.openrouterModel,
    max_output_tokens: 8000,
    input: [
      {
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You curate an AI news section on a personal engineering blog (latent-arch.com). " +
              "The audience is software engineers following AI progress. Respond with JSON only " +
              "(no code fences), matching this shape: {\"picks\": [{\"index\": number, \"summary\": string}]}.",
          },
        ],
      },
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Below are ${candidates.length} candidate news items collected from RSS feeds. ` +
              `Select up to ${CONFIG.maxPicks} of the most significant ones: model releases, major product/tool launches, ` +
              `notable research, and important industry news. Skip minor updates, marketing fluff, and listicles. ` +
              `If several items cover the same story, pick one (prefer the primary source). ` +
              `If fewer than ${CONFIG.maxPicks} items are genuinely significant, pick fewer — an empty list is acceptable. ` +
              `For each pick write a neutral 1-2 sentence English summary of what happened and why it matters.\n\n${list}`,
          },
        ],
      },
    ],
    // Structured output в OpenAI-совместимом формате Responses API. В доках OpenRouter
    // для этой беты text.format не описан — при 400 на это поле повторяем без него
    // (схема ответа продублирована в system-инструкции выше).
    text: { format: { type: "json_schema", name: "picks", strict: true, schema } },
  };

  let res = await post(body);
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 500);
    if (res.status === 400 && /\btext\b|format|json_schema/i.test(errText)) {
      console.warn(`WARN: text.format не принят (${errText}), повтор без structured output`);
      delete body.text;
      res = await post(body);
    }
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`OpenRouter error: ${JSON.stringify(data.error).slice(0, 500)}`);

  const message = (data.output ?? []).find((o) => o.type === "message");
  const text =
    (message?.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text)
      .join("") || data.output_text || "";
  if (!text) throw new Error(`OpenRouter: пустой ответ (status=${data.status})`);
  // На случай, если модель всё же обернёт JSON в code fence
  const { picks } = JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  return picks.filter((p) => Number.isInteger(p.index) && candidates[p.index] && p.summary?.trim());
}

function writeCard(candidate, summary) {
  const slug = slugify(candidate.title, candidate.url);
  const file = path.join(CONTENT_DIR, `${slug}.md`);
  const fm = [
    "---",
    `title: ${JSON.stringify(candidate.title)}`,
    `date: ${candidate.date}`,
    `source: ${JSON.stringify(candidate.source)}`,
    // «link», не «url»: url в Hugo front matter зарезервирован (переопределяет адрес страницы)
    `link: ${JSON.stringify(candidate.url)}`,
    "---",
    "",
    summary.trim(),
    "",
  ].join("\n");
  fs.writeFileSync(file, fm);
  return file;
}

function applyRetention() {
  const cards = readExistingCards()
    .filter((c) => c.date)
    .sort((a, b) => a.date.localeCompare(b.date)); // старые первыми
  const excess = cards.length - CONFIG.maxCards;
  for (let i = 0; i < excess; i++) {
    fs.unlinkSync(cards[i].file);
    console.log(`retention: удалена старая карточка ${path.basename(cards[i].file)}`);
  }
}

const existing = readExistingCards();
const candidates = await fetchCandidates(existing.map((c) => c.url));
console.log(`Кандидатов после дедупа и окна ${CONFIG.windowHours}ч: ${candidates.length}`);

if (CONFIG.dryRun) {
  console.log(JSON.stringify(candidates, null, 2));
  process.exit(0);
}

if (candidates.length > 0) {
  const picks = await curate(candidates);
  console.log(`LLM отобрал: ${picks.length}`);
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  for (const pick of picks) {
    const file = writeCard(candidates[pick.index], pick.summary);
    console.log(`+ ${path.basename(file)}`);
  }
}

applyRetention();
console.log("Готово");
