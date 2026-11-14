// Screenshots of the answering flow for the UX review of Issue #168. Run from the worktree root:
// bun <this file> <worktree> <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [worktree, out] = process.argv.slice(2) as [string, string];
const H = join(worktree, "packages/view/test/browser/harness");
const { startSession } = await import(join(H, "session.ts"));
const { BoardContext, launchEngine } = await import(join(H, "browser.ts"));
const { readViewBuild } = await import(join(H, "view-build.ts"));
const { lifecycleScenario } = await import(join(H, "lifecycle-test.ts"));
const { boardOf } = await import(join(H, "dom.ts"));

mkdirSync(out, { recursive: true });
const dist = await readViewBuild();
const browser = await launchEngine("chromium");
const notes: Record<string, unknown> = {};

const q = (id: string, text: string, header: string, opts: [string, string, boolean?][]) => ({
  type: "question",
  id,
  props: {
    text,
    header,
    options: opts.map(([label, description, recommended]) => ({
      label,
      description,
      ...(recommended ? { recommended: true } : {}),
    })),
  },
});

const formQ = {
  type: "question",
  id: "service",
  props: {
    text: "Come registriamo il nuovo servizio nel catalogo?",
    header: "Catalogo",
    items: [
      {
        type: "text-field",
        id: "service-name",
        props: { label: "Nome del servizio", required: true, minLength: 2, maxLength: 80 },
      },
      {
        type: "text-field",
        id: "service-ticket",
        props: {
          label: "Ticket",
          description: "Due maiuscole, un trattino e quattro cifre.",
          pattern: "^[A-Z]{2}-\\d{4}$",
        },
      },
    ],
  },
};

const area = (id: string, title: string, items: unknown[]) => ({
  type: "area",
  id,
  props: { title, items },
});

const items = () => [
  area("arch", "Architettura", [
    q("db", "Quale database usa il servizio ordini?", "Database", [
      ["PostgreSQL", "Relazionale, con gli strumenti che il team usa già.", true],
      ["SQLite", "Incorporato, un solo file."],
      ["DynamoDB", "Chiave-valore gestito."],
    ]),
    q("cache", "Il servizio ordini deve mettere in cache le letture?", "Cache", [
      ["Sì, Redis", "Cache condivisa con scadenza di 60 secondi.", true],
      ["No", "Ogni lettura va al database."],
    ]),
    q("queue", "Quale coda usiamo per gli eventi d'ordine?", "Coda", [
      ["Kafka", "Già in produzione per i pagamenti."],
      ["SQS", "Gestita, nessun cluster da mantenere."],
    ]),
  ]),
  area("release", "Rilascio", [
    formQ,
    q("rollout", "Come distribuiamo la prima versione?", "Rollout", [
      ["Canary al 5%", "Un'ora di osservazione prima del 100%.", true],
      ["Tutto subito", "Nessuna fase intermedia."],
    ]),
    q("flag", "Teniamo la funzione dietro un feature flag?", "Flag", [
      ["Sì", "Il flag si rimuove dopo due settimane."],
      ["No", "Nessun flag."],
    ]),
  ]),
  area("cost", "Costi", [
    q("budget", "Quale tetto di spesa mensile fissiamo?", "Budget", [
      ["500 EUR", "Copre il traffico previsto."],
      ["1000 EUR", "Margine per i picchi."],
    ]),
    q("monitor", "Quale livello di monitoraggio attiviamo?", "Monitoraggio", [
      ["Standard", "Metriche e allarmi di base.", true],
      ["Esteso", "Tracce distribuite su ogni richiesta."],
    ]),
    q("region", "In quale regione gira il servizio?", "Regione", [
      ["eu-west-1", "Vicina agli utenti."],
      ["eu-central-1", "Dove gira già il database."],
    ]),
  ]),
];

const IDS = ["db", "cache", "queue", "service", "rollout", "flag", "budget", "monitor", "region"];

type Opts = {
  presentation?: string;
  delivery?: string;
  language?: string;
  scheme?: "light" | "dark";
};

let n = 0;
const open = async (o: Opts) => {
  n += 1;
  const ask = {
    askId: `ux-review-${n}-k${n}q9`,
    title: o.language === "en-US" ? "Order service: launch decisions" : "Servizio ordini: decisioni di lancio",
    language: o.language ?? "it-IT",
    ...(o.presentation ? { presentation: o.presentation } : {}),
    ...(o.delivery ? { delivery: o.delivery } : {}),
    items: items(),
  };
  const session = await startSession(lifecycleScenario(ask, dist));
  const context = await BoardContext.open(browser, { colorScheme: o.scheme ?? "light" });
  const page = await context.newTab(session.link);
  const board = boardOf(page);
  await board.view
    .locator('[data-askboard-question="db"]:not([aria-busy="true"])')
    .waitFor({ state: "attached", timeout: 15000 });
  await page.waitForTimeout(600);
  // A newly opened board ignores keys until clicked: click a neutral spot.
  return { session, context, page, board };
};

const card = (b: { board: any }, id: string) => b.board.view.locator(`[data-askboard-question="${id}"]`);
const shot = async (b: { page: any }, name: string) => {
  await b.page.waitForTimeout(400);
  await b.page.screenshot({ path: join(out, `${name}.png`) });
};
const focusInfo = async (b: { board: any; page: any }) => {
  const frame = await b.board.viewFrame();
  return frame.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const scroller = document.scrollingElement;
    return {
      active: el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.textContent ?? "").trim().slice(0, 60)}"` : null,
      scrollY: scroller?.scrollTop ?? window.scrollY,
      liveRegions: [...document.querySelectorAll("[aria-live],[role=status],[role=alert]")].map(
        (e) => `${e.getAttribute("role") ?? ""}${e.getAttribute("aria-live") ?? ""}: ${(e.textContent ?? "").trim().slice(0, 60)}`,
      ),
    };
  });
};
const choose = (b: any, id: string, label: string) =>
  card(b, id).getByRole("radio", { name: label, exact: true }).click();
const answerBtn = (b: any, id: string, name = "Rispondi") =>
  card(b, id).getByRole("button", { name, exact: true });
const close = async (b: any) => {
  await b.context.close();
  await b.session.close();
};

// A: sections, immediate, light and dark.
{
  const b = await open({});
  await shot(b, "01-sections-immediate-initial-it-light");
  notes.sectionsInitial = await focusInfo(b);
  await choose(b, "db", "PostgreSQL");
  await shot(b, "02-sections-immediate-option-chosen-it-light");
  await answerBtn(b, "db").click();
  await card(b, "db").getByText("inviata", { exact: true }).waitFor({ timeout: 8000 }).catch(() => {});
  await shot(b, "03-sections-immediate-just-answered-it-light");
  notes.afterAnswerImmediateSections = await focusInfo(b);
  // Next open from the header.
  await b.board.view.getByRole("button", { name: "Prossima aperta ↓" }).click();
  await shot(b, "04-sections-after-next-open-it-light");
  notes.afterNextOpenSections = await focusInfo(b);
  // Header crop.
  await b.page.screenshot({ path: join(out, "05-header-row2-it-light.png"), clip: { x: 0, y: 0, width: 1280, height: 90 } });
  // Bottom bar crop.
  await b.page.screenshot({ path: join(out, "06-bottom-bar-immediate-it-light.png"), clip: { x: 0, y: 730, width: 1280, height: 70 } });
  // Postpone one question.
  await card(b, "cache").getByRole("button", { name: "Rinvia" }).click();
  await shot(b, "07-sections-postponed-warning-it-light");
  notes.afterPostpone = await focusInfo(b);
  await close(b);
}
{
  const b = await open({ scheme: "dark" });
  await shot(b, "08-sections-immediate-initial-it-dark");
  await choose(b, "db", "PostgreSQL");
  await answerBtn(b, "db").click();
  await b.page.waitForTimeout(800);
  await shot(b, "09-sections-immediate-just-answered-it-dark");
  await close(b);
}
// B: tabs, immediate.
{
  const b = await open({ presentation: "tabs" });
  await shot(b, "10-tabs-immediate-initial-it-light");
  await choose(b, "db", "PostgreSQL");
  await answerBtn(b, "db").click();
  await b.page.waitForTimeout(800);
  await shot(b, "11-tabs-immediate-just-answered-it-light");
  notes.afterAnswerTabs = await focusInfo(b);
  for (const id of ["cache", "queue"]) {
    await choose(b, id, id === "cache" ? "No" : "Kafka");
    await answerBtn(b, id).click();
    await b.page.waitForTimeout(600);
  }
  await shot(b, "12-tabs-area-completed-it-light");
  notes.afterAreaCompleteTabs = await focusInfo(b);
  await close(b);
}
// C: one question per view, immediate.
{
  const b = await open({ presentation: "one-per-view" });
  await shot(b, "13-one-per-view-immediate-initial-it-light");
  await choose(b, "db", "PostgreSQL");
  await answerBtn(b, "db").click();
  await b.page.waitForTimeout(800);
  await shot(b, "14-one-per-view-immediate-just-answered-it-light");
  notes.afterAnswerOnePerView = await focusInfo(b);
  await b.board.view.getByRole("button", { name: "Prossima aperta →" }).click();
  await shot(b, "15-one-per-view-after-next-open-it-light");
  notes.afterNextOpenOnePerView = await focusInfo(b);
  await close(b);
}
// D: sections, submitted: held answers, Select recommended.
{
  const b = await open({ delivery: "submitted" });
  await shot(b, "16-sections-submitted-initial-it-light");
  await b.page.screenshot({ path: join(out, "17-bottom-bar-submitted-it-light.png"), clip: { x: 0, y: 730, width: 1280, height: 70 } });
  await choose(b, "db", "SQLite");
  await answerBtn(b, "db").click();
  await b.page.waitForTimeout(500);
  await shot(b, "18-sections-submitted-one-ready-it-light");
  notes.afterAnswerSubmitted = await focusInfo(b);
  await b.board.view.getByRole("button", { name: "Seleziona le consigliate" }).click();
  await shot(b, "19-sections-submitted-after-select-recommended-it-light");
  notes.afterSelectRecommendedSubmitted = await focusInfo(b);
  await b.board.view.locator('[data-askboard-question="rollout"]').scrollIntoViewIfNeeded();
  await shot(b, "20-sections-submitted-recommended-held-card-it-light");
  await b.board.view.getByRole("button", { name: "Invia le risposte" }).click();
  await b.page.waitForTimeout(1200);
  await shot(b, "21-sections-submitted-after-submit-it-light");
  notes.afterSubmit = await focusInfo(b);
  await close(b);
}
// D2: immediate, Select recommended (fills drafts only).
{
  const b = await open({});
  await b.board.view.getByRole("button", { name: "Seleziona le consigliate" }).click();
  await shot(b, "22-sections-immediate-after-select-recommended-it-light");
  notes.afterSelectRecommendedImmediate = await focusInfo(b);
  await close(b);
}
// E: validation error on the form question.
{
  const b = await open({});
  const c = card(b, "service");
  await c.scrollIntoViewIfNeeded();
  await c.getByLabel("Ticket").fill("abc");
  await c.getByLabel(/Nome del servizio/).click();
  await shot(b, "23-validation-error-it-light");
  notes.validation = await focusInfo(b);
  notes.validationAnswerDisabled = await answerBtn(b, "service").isDisabled();
  await close(b);
}
// F: all answered, immediate.
{
  const b = await open({});
  const picks: Record<string, string> = {
    db: "PostgreSQL", cache: "No", queue: "Kafka", rollout: "Canary al 5%", flag: "Sì",
    budget: "500 EUR", monitor: "Standard", region: "eu-west-1",
  };
  for (const [id, label] of Object.entries(picks)) {
    await card(b, id).scrollIntoViewIfNeeded();
    await choose(b, id, label);
    await answerBtn(b, id).click();
    await b.page.waitForTimeout(400);
  }
  const c = card(b, "service");
  await c.scrollIntoViewIfNeeded();
  await c.getByLabel(/Nome del servizio/).fill("ordini");
  await answerBtn(b, "service").click();
  await b.page.waitForTimeout(1200);
  await shot(b, "24-all-answered-immediate-it-light");
  notes.allAnswered = await focusInfo(b);
  const frame = await b.board.viewFrame();
  await frame.evaluate(() => window.scrollTo(0, 0));
  await shot(b, "25-all-answered-top-it-light");
  await close(b);
}
// G: English, sections, immediate, for label comparison.
{
  const b = await open({ language: "en-US" });
  await shot(b, "26-sections-immediate-initial-en-light");
  await close(b);
}
// H: one question per view, submitted, dark.
{
  const b = await open({ presentation: "one-per-view", delivery: "submitted", scheme: "dark" });
  await choose(b, "db", "PostgreSQL");
  await answerBtn(b, "db").click();
  await b.page.waitForTimeout(500);
  await shot(b, "27-one-per-view-submitted-ready-it-dark");
  notes.afterAnswerOnePerViewSubmitted = await focusInfo(b);
  await close(b);
}

writeFileSync(join(out, "observations.json"), JSON.stringify(notes, null, 2));
await browser.close();
console.log(JSON.stringify(notes, null, 2));
