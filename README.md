# CredIQ: evidence-driven corporate credit analysis

CredIQ turns a borrower's audited financial statements into a **verified spread, tie-out checks, ratios, bank-policy results and a draft credit memo**. Every figure in it can be clicked back to the exact cell on the source PDF page.

> **Python handles the numbers; the AI writes the words.** Python reads every figure from the PDF text layer with its page coordinates. The language model only (a) classifies rows into the template, cross-checked against a rules engine whose answer wins until the analyst decides, and (b) writes memo sentences with placeholders that Python fills in. A *number guard* then blocks any sentence whose figure, item name, year, sign, unit or direction doesn't match the source it cites.

Built for Capital Youth Expo Hackathon 04-HK (FinTech track).

## What it does

| Step | What happens | How |
|---|---|---|
| Locate | Finds the balance sheet, P&L and cash-flow statements inside a 200+ page annual report (standalone vs consolidated; skips the TOC, summaries and notes) | PyMuPDF, deterministic |
| Extract | Every line and figure with its bounding box; handles `Rupees in '000`, bracketed negatives, note columns and unlabelled subtotals | Deterministic |
| Re-compute | Re-adds every printed subtotal and grand total; flags totals that don't cast | Arithmetic |
| Classify | Rules engine (Pakistani terms: trade debts, stock-in-trade, accrued mark-up, running finance…) **and** an LLM map lines to the template; disagreements go to the analyst | Rules + Groq |
| Tie-out | A = E + L, section totals, gross profit, net profit, CFO + CFI + CFF, closing cash vs balance sheet (incl. running-finance netting) | Deterministic |
| Analyse | 19 ratios, configurable bank policy thresholds, trend-based risk signals | Deterministic |
| Stress | What-if sliders (sales, borrowing rate, late payment) re-run the ratios against the policy and find the exact point where a limit breaks; a scenario, never part of the memo | Deterministic, matches the Python engine at zero shock |
| Draft | Sentences with placeholders filled in by Python, then the number guard; sentences without figures are marked *qualitative*, not verified. Plus borrower clarification questions | Groq LLM, or deterministic template if no key |
| Review | Corrections need a reason and go to the audit trail; submission is blocked while blocked sentences, undecided mappings or an out-of-date memo remain | Human-in-the-loop |

## External APIs and services (disclosure)

| Service | Used for | Required? |
|---|---|---|
| **Groq API** (`openai/gpt-oss-120b`, falling back to `openai/gpt-oss-20b` when rate-limited; OpenAI-compatible endpoint) | Row classification + memo prose | Optional: without a key the app runs in rules + template mode |
| **Supabase** (Postgres REST + Storage) | Case data (`cases` table) and uploaded PDFs (private `documents` bucket) | Optional locally (falls back to local disk); required in production |
| **Vercel** | Hosts the Next.js frontend | Deployment |
| **Render** | Hosts the FastAPI backend | Deployment |
| Google Fonts via `next/font` | Rozha One, Plus Jakarta Sans, Spline Sans Mono | Build time |

Open-source libraries: FastAPI, PyMuPDF, httpx, pydantic, reportlab (sample generation only), Next.js, React, Tailwind CSS, Motion, three.js, React Three Fiber and drei.

**What leaves your server:** the PDF is never sent to the AI. When a key is set, Groq receives line labels with one printed value per row (classification), and a fact sheet of extracted figures, ratios and risk signals plus the facility text (memo). Without a key nothing is sent. Supabase, if configured, stores the PDF and the case.

## Run locally

```bash
# backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env                                # add GROQ_API_KEY (optional)
uvicorn app.main:app --port 8765

# frontend
cd frontend
npm install
echo NEXT_PUBLIC_API_URL=http://127.0.0.1:8765 > .env.local
npm run dev
```

- `http://localhost:3000` is the marketing site.
- `http://localhost:3000/app` is the product. Click **Run the sample**.


## Testing

| Type | Tool | What it covers |
|---|---|---|
| Unit | pytest, Vitest | number parsing, rules, ratios, policies, formatting, the "what next" guide |
| Integration | pytest + FastAPI TestClient | upload → analysis → corrections → memo → submission, and every refusal |
| Regression (golden) | pytest | exact results for the sample; every one of its 120 figures re-read from its stored PDF box |
| Property | Hypothesis | thousands of invented figures and swaps the number guard must block |
| Fuzz | Schemathesis | odd input to every endpoint; no 500s |
| AI / adversarial | pytest | a fake model that lies, breaks JSON, hits limits or injects instructions |
| Security | pytest, Bandit, pip-audit, npm audit | traversal, forged status, secrets, oversized input, vulnerable packages |
| Performance, concurrency | pytest, Lighthouse | parse time, 10 cases at once, simultaneous edits, page speed |
| Storage contract | pytest | Supabase REST, replaced by a fake |
| Mutation | `scripts/mutate.py` | 18 deliberate bugs; the tests must notice each one |
| End to end | Playwright | Chrome, Firefox, WebKit, phone |
| Accessibility | axe-core | WCAG 2.1 A/AA on every page and tab, keyboard, reduced motion |
| Visual regression | Playwright | stored screenshots |

```bash
cd backend  && pip install -r requirements-dev.txt && python -m pytest -q && python scripts/mutate.py
cd frontend && npm run lint && npm run typecheck && npm test && npx playwright install firefox webkit && npm run test:e2e
```

Not covered: usability tests with real bank analysts, the live Supabase project, and the hosted deployment.

## Deploy

1. **Supabase**: run `supabase/schema.sql` in the SQL editor. Copy the project URL and a **secret key** (`sb_secret_…`, or the legacy service-role key) into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Backend only, never the frontend. Check it with `python scripts/check_supabase.py`.
2. **Render**: create a Web Service from this repo (`render.yaml` is included). Set `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `CORS_ORIGINS=https://<your-vercel-app>.vercel.app`.
3. **Vercel**: import the repo, set the root directory to `frontend`, and set `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com`.

## Demo data

`backend/samples/sutlej_demo_textiles.pdf` is a **fictional** company generated by `backend/scripts/make_sample.py`. Its accounts are internally consistent (the cash flow is derived from balance-sheet movements), with deliberate issues for the demo: a casting error in the FY2026 current-liabilities subtotal, receivables up 48% against 9% sales growth, negative operating cash flow, falling interest cover, and an auditor's Emphasis of Matter paragraph.

The engine has also been tested on a real PSX-listed annual report (227 pages): it located the statements on pages 100–105 and re-computed all 20 printed totals it found there. That report is not included in this repository.

## Limitations (honest)

- The number guard checks figures. It can't judge whether a qualitative sentence is good analysis.
- Groq's free tier allows 200,000 tokens a day and 8,000 a minute per model; one case uses about 5,000.
- Scanned (image-only) statement pages are detected and reported but not OCR'd in this version.
- Policy thresholds are illustrative. SBP does not prescribe one universal minimum ratio; each bank configures its own policy (`backend/policies/*.json`).
- No authentication in the hackathon build. Production would add SSO, role separation (analyst/approver) and bank-approved hosting.
- CredIQ does not audit accounts, approve loans, or replace eCIB, Moody's or analyst judgement.
