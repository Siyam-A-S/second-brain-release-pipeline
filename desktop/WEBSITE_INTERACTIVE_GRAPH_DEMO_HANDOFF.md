# Website Interactive Graph Demo Handoff

This handoff is for the agent working on `www.downloadsecondbrain.com`. Build a standalone marketing/demo section that gives visitors a tactile preview of the Second Brain desktop app: dropping mock files into a Drop Zone turns them into a small animated knowledge graph.

The section is visual-only. It must not upload files, parse real documents, call Graphify, call AI, or touch user accounts.

## Goal

Add a separate component, for example:

```text
InteractiveGraphDropDemo
```

The component should show:

- A single-line shelf/grid of mock source files: PDF, Excel, DOCX, Markdown, and Image.
- A prominent Drop Zone styled like the desktop app's tactile/keycap surface.
- A mock graph canvas that appears after a mock file is dropped.
- A graph animation inspired by the desktop Board: force-style settling, directional particles along links, mint/teal highlight color, green-purple node palette, warm cream graph background, and node labels that stay restrained.

## Desktop App Visual Reference

Use the desktop Board behavior as the reference:

- Graph background: warm cream similar to `#f7f1d8`.
- Highlight color: deep teal, currently `--color-highlight` / `#006666`.
- Node palette: greenish-purple variants, not a single hue.
- Selected/active node and connected edges use the highlight color.
- Links are soft and low-contrast until active.
- Directional particles move along links.
- Labels should not clutter the graph. Show labels only for active nodes, important nodes, or when the graph is small.
- Containers should feel like frosted plastic/keycaps: rounded corners, subtle inset highlights, soft shadows, and tactile pressed states.

Do not copy desktop IPC, Electron APIs, local files, Graphify services, or app state. This is a website-only animation component.

## Suggested Component Contract

```ts
type DemoFileKind = "pdf" | "xlsx" | "docx" | "md" | "image";

type DemoFile = {
  id: string;
  kind: DemoFileKind;
  label: string;
  accent: string;
};

type DemoNode = {
  id: string;
  label: string;
  type: "source" | "concept" | "entity" | "question" | "insight";
  community: number;
  degree: number;
};

type DemoLink = {
  source: string;
  target: string;
  relation: string;
  weight: number;
};
```

The component should own all demo state locally:

```ts
type DemoState = "idle" | "dragging" | "building" | "ready" | "limit_reached" | "unsupported";
```

No server state is required.

## UX Flow

1. Initial state:
   - Show a compact file shelf in a single horizontal line.
   - Each mock file appears as a draggable/tappable keycap tile.
   - Show the Drop Zone and an empty warm graph panel.

2. Drag/drop or tap:
   - Desktop: drag a mock file tile into the Drop Zone.
   - Mobile/touch: tapping a mock file should trigger the same demo.
   - Keyboard: file tiles should be buttons; Enter/Space should trigger the demo.

3. Building state:
   - Show a short visual pulse, not a long loading spinner.
   - Suggested copy: `Mapping connections...`
   - Limit this phase to about `650-1200ms`.

4. Ready state:
   - Render a mock graph generated from the chosen file kind.
   - Animate nodes from near the drop zone into their graph positions.
   - Add link particles once nodes have settled.
   - Show a small status line such as `12 concepts · 18 relationships`.

5. Re-drop:
   - Allow the user to drop a different mock file and replace the graph.
   - Keep the graph size bounded. Do not accumulate infinite graphs.

## Mock File Shelf

Use five file types:

```text
Research.pdf
Budget.xlsx
Proposal.docx
Notes.md
Whiteboard.png
```

Use mock icons. Do not load operating system icons and do not require real files.

Suggested visual treatment:

- `pdf`: red/rose accent
- `xlsx`: green accent
- `docx`: blue accent
- `md`: slate/mono accent
- `image`: purple accent

Keep the shelf single-line on desktop. On narrow screens, use horizontal scroll rather than wrapping into a tall block.

## Mock Graph Generation

Generate deterministic mock graphs from the selected file kind. Deterministic output keeps the animation stable and avoids hydration mismatch.

Recommended limits:

```ts
const MAX_DEMO_DROPS_PER_SESSION = 8;
const MAX_DEMO_NODES = 18;
const MAX_DEMO_LINKS = 28;
const BUILD_ANIMATION_MS = 900;
const GRAPH_SETTLE_MS = 1800;
```

Suggested node counts:

- PDF: 14 nodes, 22 links
- XLSX: 12 nodes, 18 links
- DOCX: 13 nodes, 19 links
- Markdown: 10 nodes, 14 links
- Image: 9 nodes, 12 links

Each graph should include:

- 1 source node named after the mock file.
- 3-5 concept nodes.
- 3-6 entity nodes.
- 1-2 insight/question nodes.
- Cross-community edges so the graph feels richer than a simple hub-and-spoke.

Example labels:

```text
Research.pdf:
  Source, Methods, Dataset, Claim, Result, Citation, Open Question, Summary

Budget.xlsx:
  Source, Revenue, Costs, Forecast, Risk, Vendor, Quarter, Runway

Proposal.docx:
  Source, Goal, Timeline, Stakeholder, Constraint, Milestone, Decision

Notes.md:
  Source, Idea, Todo, Reference, Topic, Follow-up, Insight

Whiteboard.png:
  Source, Diagram, Component, Flow, Question, Pattern, Next Step
```

## Animation Implementation Options

Preferred path if the website already uses React:

- Use `react-force-graph-2d` if acceptable for bundle size and consistency with the desktop app.
- Otherwise use a lightweight custom `<canvas>` with a small force simulation loop.
- Avoid heavy graph libraries for this section. This should not dominate the website bundle.

If using `react-force-graph-2d`, mirror the desktop app conceptually:

- `cooldownTicks`: around `60-90`.
- `linkDirectionalParticles`: `1`.
- `linkDirectionalParticleSpeed`: around `0.002-0.004`.
- Use custom `nodeCanvasObject` for keycap-style nodes and restrained labels.
- Use `ResizeObserver` or a parent-size hook.
- Pause or reduce animation when offscreen.

If using custom canvas:

- Use `requestAnimationFrame`.
- Stop the simulation after `GRAPH_SETTLE_MS`.
- Continue only low-cost particle animation if the section is visible.
- Cancel animation frames on unmount.

## Edge Cases And Safety

Handle these explicitly:

- **Repeated drops:** replace the previous graph, do not append.
- **Drop limit reached:** after `MAX_DEMO_DROPS_PER_SESSION`, show a small message: `Demo limit reached. Refresh to play again.` This prevents accidental hot loops.
- **Unsupported real file drop:** if a user drags an actual desktop file onto the website demo, do not read it. Show: `This website demo uses mock files only.`
- **Large drag payloads:** call `event.preventDefault()` and ignore payload contents.
- **Missing canvas size:** render a static fallback card instead of an animation.
- **Reduced motion:** respect `prefers-reduced-motion`. Show a quick fade-in static graph with no force settling or particles.
- **Mobile:** support tap-to-generate and horizontal file shelf scrolling.
- **Background tab/offscreen:** pause animation using `document.visibilityState` and/or `IntersectionObserver`.
- **Hydration:** generate initial graph only after mount, or use deterministic data with no random `Date.now()` values during SSR.

## Performance Budget

Keep this section comfortably under website marketing-page budgets:

- Maximum 18 nodes and 28 links.
- No real file parsing.
- No network request.
- No AI request.
- No Web Workers needed for v1.
- Canvas should render at device pixel ratio capped to `2`.
- Stop force simulation after settle.
- Do not keep multiple historical graph objects alive.

## Accessibility

- File tiles are buttons with accessible labels such as `Preview graph from Research PDF`.
- Drop Zone has `aria-label="Second Brain demo drop zone"`.
- The graph canvas should have a text summary nearby, for example: `Demo graph with 12 concepts and 18 relationships`.
- Provide a keyboard-only path: tab to a file tile, press Enter, graph appears.
- Respect reduced motion.

## Suggested Copy

Headline:

```text
Drop files. Watch your knowledge connect.
```

Supporting copy:

```text
Second Brain turns notes, PDFs, spreadsheets, documents, and images into a local graph you can explore.
```

Drop Zone idle:

```text
Drop a mock file
```

Build state:

```text
Mapping connections...
```

Ready state:

```text
Mock graph generated
```

Unsupported real-file drop:

```text
This website demo uses mock files only.
```

## Acceptance Criteria

- The feature is implemented as a separate reusable component.
- It can be placed on the landing page without coupling to auth, checkout, download, or desktop APIs.
- The user can drag a mock PDF/XLSX/DOCX/MD/image tile into the Drop Zone.
- Tapping a mock file on mobile triggers the same graph.
- A bounded mock graph appears with app-like animation.
- The graph never exceeds the configured node/link limits.
- Repeated drops do not make the website slower over time.
- Real files are ignored and never read.
- Reduced-motion users get a static/fade graph.
- The page remains responsive on mid-range phones and laptops.

## Validation Checklist

- `npm run build`
- Manual desktop browser test:
  - drag each mock file into the Drop Zone;
  - drop an actual local file and confirm it is ignored;
  - repeat drops more than the configured limit;
  - resize the browser;
  - switch tabs and return.
- Manual mobile/touch test:
  - tap each mock file;
  - horizontal shelf scroll works;
  - no layout overflow.
- Accessibility spot check:
  - keyboard-only generation works;
  - reduced-motion mode renders without continuous animation.

## Non-Goals

- Do not ingest or upload files.
- Do not call the production desktop API.
- Do not call the managed AI proxy.
- Do not require user sign-in.
- Do not run real Graphify in the browser.
- Do not show raw graph JSON or debug output.

