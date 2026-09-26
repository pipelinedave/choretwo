/**
 * Erzeugt die KI-Illustrationen fuer die ChoreCards.
 *
 * WARUM DIESES SCRIPT
 * -------------------
 * Die Vektor-Motive aus `utils/choreVisual.js` liegen schon im Repo. Der
 * Wunsch war "pro Chore ein eigenes Bild". Mit echten KI-Bildern ist das
 * nur moeglich, wenn die Bilder VORHER erzeugt werden — zur Laufzeit
 * braeuchte es einen API-Key im Browser, was Credential-Leak und Kosten pro
 * Kartenaufbau bedeutet. Also: Offline-Batch, Ergebnis im Repo.
 *
 * DIE ENTSCHEIDUNG, DIE ALLES WEITERE BESTIMMT: POOL STATT PRO CHORE
 * ---------------------------------------------------------------
 * Chore-Namen sind unbegrenzt. Man kann also nicht "ein Bild pro Name"
 * vorproduzieren. Loesbar ist das ueber einen POOL je Kategorie:
 *
 *   30 Kategorien x 7 Varianten = 210 Bilder
 *   210 x 43,2 Neurone          = 9.072 Neurone
 *   Cloudflare Free-Tier        = 10.000 Neurone/Tag
 *
 * Das passt in EINEN Tag und kostet null Euro. Die Variante waehlt
 * `hashString(name) % 7` — derselbe Name ergibt dasselbe Bild (Cache-Friend-
 * lich, reload-stabil), verschiedene Namen landen mit hoher Wahrschein-
 * lichkeit auf verschiedenen Bildern. Zwei aehnliche Chores in derselben
 * Kategorie sehen also unterschiedlich aus, was genau die Anforderung war.
 *
 * Mit 8 Varianten waeren es 240 Bilder = 10.368 Neurone und damit ETWAS
 * UEBER dem Tageskontingent. Deshalb 7. Wer mehr Diversitaet will, raises
 * --variants und braucht dann zwei Tage.
 *
 * STIL-VORGABEN
 * -------------
 * Alle Bilder teilen sich einen Stil-Suffix, sonst sieht die Menge aus wie
 * 30 fremde Bilder. Weisser Hintergrund ist Absicht: die Karten sind farbig
 * und das Motiv soll die Kartfarbe durchscheinen lassen. Das passiert im
 * CSS per `mix-blend-mode: multiply` (bzw. invert + screen im Dark Mode) —
 * damit verhaelt sich ein KI-Bild genauso wie der aktuelle
 * `fill: var(--color-text)`-Vektor und die bestehende Deckkraft-/Masken-Logik
 * in ChoreVisual.vue gilt unveraendert weiter.
 *
 * AUFruf
 * ------
 *   node scripts/generate-chore-images.mjs --dry-run
 *   node scripts/generate-chore-images.mjs --category waesche --limit 3
 *   node scripts/generate-chore-images.mjs            # alles, resumable
 *
 * Benoetigt CLOUDFLARE_API_TOKEN (Permission "Workers AI: Read") und
 * CLOUDFLARE_ACCOUNT_ID in der Umgebung.
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { CATEGORIES, buildPrompt, keyOf } from "./chore-image-prompts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/chore-images");
const MANIFEST = path.resolve(
  __dirname,
  "../src/assets/icons/chore-images.generated.js",
);

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const API = (account) =>
  `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`;

/**
 * FLUX.1-schnell kennt nur `prompt` und `steps` (max 8, Default 4) — keine
 * width/height. Die Ausgabe ist immer 512x512 JPEG; die Groesse machen wir
 * danach mit sharp.
 */
const STEPS = 4;

/**
 * Neuronen-Kosten laut Cloudflare-Preistabelle (Stand 2026-09-17):
 *   4,80 Neurone pro 512x512-Tile + 9,60 Neurone pro Schritt
 * Unsere 512x512-Ausgabe ist genau ein Tile.
 */
// Gerundet, damit die Anzeige nicht `43.199999999999996` sagt.
const NEURONS_PER_IMAGE = Math.round((4.8 + 9.6 * STEPS) * 100) / 100; // = 43,2

/** Sicherheitsgrenze: 10.000/Tag gratis, wir bleiben darunter. */
const NEURON_BUDGET = Number(process.env.NEURON_BUDGET || 9500);

/** Kantenlaenge der fertigen WebP. Anzeigegroesse ist 72px, 192 = ~2,7x. */
const OUT_SIZE = 192;
const WEBP_QUALITY = 78;

// --- Argumente ----------------------------------------------------------

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    limit: Infinity,
    category: null,
    variants: 7,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--force") args.force = true;
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--category") args.category = argv[++i];
    else if (a === "--variants") args.variants = Number(argv[++i]);
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unbekanntes Argument: ${a}`);
  }
  if (args.variants < 1 || args.variants > 8) {
    throw new Error("--variants muss zwischen 1 und 8 liegen");
  }
  return args;
}

const USAGE = `
Erzeugt KI-Illustrationen fuer die ChoreCards (Cloudflare Workers AI,
${MODEL}).

  --dry-run           nur planen, keine API-Aufrufe
  --category <name>   nur diese Kategorie
  --limit <n>         hoechstens n Bilder in diesem Lauf
  --variants <1..8>   Varianten je Kategorie (Default 7 = 9.072 Neurone)
  --force             vorhandene Bilder neu erzeugen
  --help              diese Ausgabe

Umgebungsvariablen:
  CLOUDFLARE_API_TOKEN   Token mit Permission "Workers AI: Read"
  CLOUDFLARE_ACCOUNT_ID  Account-ID
  NEURON_BUDGET          Tageslimit (Default 9500 von 10.000 gratis)
`;

// --- API ----------------------------------------------------------------

/**
 * Ruft ein Bild ab. Bewusst mit Retry: bei 10.000 Neuronen/Tag und 210
 * Bildern ist ein einzelner 429 kein Fehler, sondern eine Pause.
 */
async function fetchImage(account, token, prompt, attempt = 1) {
  const res = await fetch(API(account), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, steps: STEPS }),
  });

  if (res.status === 429 || res.status >= 500) {
    if (attempt > 5) {
      throw new Error(`HTTP ${res.status} nach ${attempt} Versuchen`);
    }
    const wait = Math.min(60, 2 ** attempt * 3);
    process.stderr.write(`    HTTP ${res.status}, warte ${wait}s …\n`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return fetchImage(account, token, prompt, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data?.success || !data?.result?.image) {
    throw new Error(
      `Unerwartete Antwort: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  return Buffer.from(data.result.image, "base64");
}

// --- Hauptprogramm ------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }

  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const needsApi = !args.dryRun;
  if (needsApi && (!account || !token)) {
    process.stderr.write(
      "FEHLER: CLOUDFLARE_ACCOUNT_ID und/oder CLOUDFLARE_API_TOKEN fehlen.\n" +
        USAGE,
    );
    process.exit(2);
  }

  const categories = args.category ? [args.category] : CATEGORIES;
  for (const c of categories) {
    if (!CATEGORIES.includes(c)) {
      process.stderr.write(`Unbekannte Kategorie: ${c}\n`);
      process.exit(2);
    }
  }

  // Arbeitsliste: alles, was noch fehlt (resumable).
  const plan = [];
  for (const category of categories) {
    for (let v = 0; v < args.variants; v++) {
      const key = keyOf(category, v);
      const file = path.join(OUT_DIR, `${key}.webp`);
      if (!args.force && (await exists(file))) continue;
      plan.push({ category, variant: v, key, file });
    }
  }

  const cost = plan.length * NEURONS_PER_IMAGE;
  process.stdout.write(
    `\nPlan: ${plan.length} Bilder x ${NEURONS_PER_IMAGE} Neurone = ` +
      `${cost.toFixed(0)} Neurone` +
      ` (Budget ${NEURON_BUDGET})\n` +
      `Kategorien: ${categories.length}, Varianten: ${args.variants}\n` +
      `Ausgabe: ${path.relative(process.cwd(), OUT_DIR)}\n\n`,
  );

  if (cost > NEURON_BUDGET && !args.dryRun) {
    process.stderr.write(
      `ABBRUCH: ${cost.toFixed(0)} Neurone ueberschreiten das Budget ` +
        `(${NEURON_BUDGET}). Ueber --limit begrenzen oder --variants senken.\n` +
        `Tipp: Der Free-Tier gibt 10.000/Tag — notfalls ueber Nacht in ` +
        `zwei Laeufen.\n`,
    );
    process.exit(3);
  }

  if (args.dryRun) {
    process.stdout.write("Dry-Run. Erste 5 Prompts:\n\n");
    for (const job of plan.slice(0, 5)) {
      process.stdout.write(
        `  ${job.key}\n    ${buildPrompt(job.category, job.variant)}\n`,
      );
    }
    const skipped = categories.length * args.variants - plan.length;
    if (skipped > 0) {
      process.stdout.write(
        `\n  ${skipped} bereits vorhanden (uebersprungen).\n`,
      );
    }
    process.stdout.write("\n");
    return;
  }

  if (plan.length === 0) {
    // Das Manifest wird TROTZDEM geschrieben. Der fruehere fruehe Return
    // liess es stehen, wenn sich der Generator geaendert hatte — ein
    // Syntaxfehler im Manifest blieb so unsichtbar, bis der Build
    // komplett brach. "Keine neuen Bilder" heisst nicht "nichts zu tun".
    process.stdout.write("Nichts zu erzeugen — alle Bilder vorhanden.\n");
    await writeManifest(args.variants);
    process.stdout.write(
      `Manifest aktualisiert: ${path.relative(process.cwd(), MANIFEST)}\n\n`,
    );
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  const queue = plan.slice(0, args.limit);
  let done = 0;
  const failed = [];
  const t0 = Date.now();

  for (const job of queue) {
    const prompt = buildPrompt(job.category, job.variant);
    try {
      const jpeg = await fetchImage(account, token, prompt);
      await sharp(jpeg)
        .resize(OUT_SIZE, OUT_SIZE, { fit: "cover" })
        .webp({ quality: WEBP_QUALITY })
        .toFile(job.file);
      done++;
      const perMin = ((Date.now() - t0) / 60000 / done).toFixed(1);
      process.stdout.write(
        `  [${String(done).padStart(3)}/${queue.length}] ${job.key}` +
          `  ${(done * NEURONS_PER_IMAGE).toFixed(0)} Neurone` +
          `  ~${perMin}/Bild\n`,
      );
    } catch (err) {
      failed.push({ key: job.key, error: err.message });
      process.stderr.write(`  FEHLER ${job.key}: ${err.message}\n`);
    }
  }

  process.stdout.write(
    `\nFertig: ${done}/${queue.length} erzeugt, ` +
      `${(done * NEURONS_PER_IMAGE).toFixed(0)} Neurone verbraucht, ` +
      `${failed.length} Fehler.\n`,
  );
  if (failed.length) {
    process.stdout.write(
      "Fehlgeschlagen (erneut laufen lassen, ist resumable):\n",
    );
    for (const f of failed) process.stdout.write(`  ${f.key}: ${f.error}\n`);
  }

  // Manifest nur schreiben, wenn mindestens ein neues Bild entstanden ist.
  if (done > 0) await writeManifest(args.variants);
  process.stdout.write(
    `Manifest: ${path.relative(process.cwd(), MANIFEST)}\n\n`,
  );
}

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Schreibt ein generiertes Manifest der Form
 *   export const CHORE_IMAGES = { bad: ["/chore-images/bad-0.webp", …], … }
 * plus die Kategorien-Liste als Konstante fuer den Test. Generiert und
 * git-be tracked wie `mdi-paths.generated.js` — damit gibt es keine
 * Handpflege und der Build bricht, wenn eine Datei fehlt.
 */
async function writeManifest(variants) {
  const entries = [];
  for (const category of CATEGORIES) {
    const list = [];
    for (let v = 0; v < variants; v++) {
      const file = path.join(OUT_DIR, `${keyOf(category, v)}.webp`);
      if (await exists(file))
        list.push(`/chore-images/${keyOf(category, v)}.webp`);
    }
    // Keys MUESSEN quotiert sein: `waesche-aufhaengen` ist kein gueltiger
    // JS-Bezeichner. Unquotiert erzeugt das einen Syntaxfehler im gesamten
    // Bundle — der erste Lauf lieferte genau das, nachdem `bad` als
    // gueltiger Name still durchgegangen war.
    if (list.length)
      entries.push(
        `  "${category}": [\n${list.map((u) => `    "${u}",`).join("\n")}\n  ],`,
      );
  }

  const out = `/**
 * GENERIERTE DATEI — nicht handpflegen.
 * Erzeugt von scripts/generate-chore-images.mjs.
 *
 * Je Kategorie ein Pool an Varianten. Die Auswahl der Variante passiert
 * zur Laufzeit deterministisch ueber den Namen (hashString % Laenge), damit
 * derselbe Chore-Name immer dasselbe Bild zeigt.
 */
export const CHORE_IMAGES = {
${entries.join("\n")}
};

export const CHORE_IMAGE_VARIANTS = ${variants};
`;
  await writeFile(MANIFEST, out, "utf8");
}

main().catch((err) => {
  process.stderr.write(`\nAbbruch: ${err.message}\n`);
  process.exit(1);
});
