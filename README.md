# InScreens

No-code SDUI platform for publishing non-functional "filler" screens into mobile apps without an app-store release — with a Pre-publish Simulator and Compatibility Gate as the key differentiators.

## Structure

```
inscreens-prototype/
├── prototype/          Interactive clickable prototype (self-contained HTML artifact)
│   ├── src/             Source parts, concatenated to build the artifact
│   │   ├── part1.html     Root CSS tokens / theme
│   │   ├── fontfaces.css  Base64-embedded Unbounded + Golos Text fonts (Cyrillic support)
│   │   ├── part2.html     Component/page CSS
│   │   └── part3.html     HTML body + application script
│   ├── dist/             Build output
│   │   └── inscreens-prototype.html   Assembled single-file prototype — open directly in a browser
│   └── build.sh          Reassembles dist/ from src/
│
├── mvp-backend/         Earlier functional MVP: real client/server, not just a clickable mockup
│   ├── server.py          Stdlib Python HTTP server + small JSON API (screens, manifest, gate report)
│   ├── dashboard/         Editor/dashboard static app
│   ├── test-client/       Simulated end-user app that renders published screens
│   ├── shared/            Shared renderer used by both dashboard and test-client
│   └── data/              Manifest + published screen versions (file-based store)
│
└── docs/
    └── master_document.docx   Original product spec
```

## Prototype: what's in it

Five pages, one shared `screens[]` model driving canvas rendering, gate simulation, and live preview identically:

1. **Главная (Home)** — Canva-style landing: templates, search, placement picker
2. **Симулятор (Simulator)** — Figma+Canva-style screen builder: block palette, brand kit, multi-screen sequences, action/branching config
3. **Gate-отчёт (Gate report)** — compatibility testing, customer journey walkthrough, fix guidance
4. **Публикация (Publish)** — rollout settings, live preview
5. **Клиент (Client dashboard)** — analytics: KPIs, trend chart, SDK breakdown, funnel/abandonment, collected leads

### Rebuilding the prototype

```bash
cd prototype
./build.sh
```

Open `prototype/dist/inscreens-prototype.html` directly in a browser — it's fully self-contained (no external requests, fonts embedded as base64).

## MVP backend: running it

```bash
cd mvp-backend
python3 server.py
```

Serves the dashboard at `/dashboard/` and the test client at `/test-client/` on `http://localhost:8000`, backed by a small file-based JSON API.
