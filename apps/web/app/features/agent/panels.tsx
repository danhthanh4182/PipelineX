// The engine's access methods, one panel each: overview, integration steps, and technical details.
import { Fragment, useState } from "react";
import { Link } from "react-router";
import { PUBLIC_INTERFACE_VERSION } from "@aihot/contracts/http-policy";
import { MCP_TOOL_NAMES as T, MCP_TOOLS } from "@aihot/contracts/mcp";
import { feedCategoryLabel, PUBLIC_API_CATEGORY_KEYS } from "@aihot/contracts/taxonomy";
import { ACCESS, AGENT, EDITION_WHEN, POLICY, REPORTS, SITE, subjectAfter, withSubject } from "@aihot/site";
import { CodeBlock, CopyButton } from "./CodeBlock";
import { PillTabs } from "../../components/ui/Tabs";
import type { AgentPanelProps } from "../../modules";
import { AGENT_PARTS, GUIDE_CLIENTS, TAG } from "./module-parts";
import { Address, Ask, Block, Bullets, Details, Mono, PanelHead, Step, Steps, Table, Tips } from "./parts";

const V = PUBLIC_INTERFACE_VERSION;

/** Every MCP tool: the engine's and the modules'. */
export const mcpToolCount = () => MCP_TOOLS.length + AGENT_PARTS.reduce((n, a) => n + (a.tools?.length ?? 0), 0);
const link = "text-accent hover:underline";

function addressOf({ base, tag }: AgentPanelProps, path: string): string {
  return TAG && tag ? `${base}${path}?${TAG.query}=${tag}` : `${base}${path}`;
}

const MCP_CLIENTS = [
  { key: "claude", label: "Claude Code" },
  { key: "codex", label: "Codex" },
  { key: "json", label: "JSON Config" },
  { key: "other", label: "Other Clients" },
] as const;

export function McpPanel(props: AgentPanelProps) {
  const url = addressOf(props, "/api/mcp");
  const name = SITE.mcpPrefix;
  const [client, setClient] = useState<string>("claude");
  return (
    <>
      <PanelHead label={`MCP · ${V}`} title={`Add one endpoint to give your Agent ${mcpToolCount()} tools`}>
        Standard Streamable HTTP, anonymous, read-only, no tokens needed. Compatible with Claude Desktop, Cursor, Cherry Studio, and any MCP client supporting remote HTTP servers.
      </PanelHead>
      <Steps>
        <Step n={1} title="Copy Server Address">
          <Address url={url} />
          {TAG && <p className="mt-2 text-[13px] text-ink-3">{TAG.mcp}</p>}
        </Step>
        <Step n={2} title="Add to your Client">
          <PillTabs className="mt-3" size="xs" layoutId="agent-mcp-client" label="Client" active={client} onSelect={setClient} items={MCP_CLIENTS.map((c) => ({ key: c.key, label: c.label }))} />
          {client === "claude" && <CodeBlock className="mb-0 mt-3" lang="bash" code={`claude mcp add --transport http ${name} '${url}'`} />}
          {client === "codex" && <CodeBlock className="mb-0 mt-3" lang="bash" code={`codex mcp add ${name} --url '${url}'`} />}
          {client === "json" && <CodeBlock className="mb-0 mt-3" title="Cursor, Cherry Studio, or clients configured with JSON" lang="json" code={JSON.stringify({ mcpServers: { [name]: { type: "http", url } } }, null, 2)} />}
          {client === "other" && <p className="mt-3">{`In your client's MCP settings, add a new server: Name "${name}", URL "${url}", Authentication "None", no API Key needed. For clients only supporting local stdio, use an mcp-remote proxy.`}</p>}
        </Step>
        <Step n={3} title="Invoke with your Agent">
          <Ask text={`Please call ${T.latest} to show me the 5 most important ${subjectAfter("", "updates")} from the past 24 hours, including links to ${SITE.name}.`} />
          <p className="mt-2 text-[13px] text-ink-3">{`When your client executes ${T.latest} and returns items with timestamps, summaries, and ${new URL(props.base).host} links, your connection is verified.`}</p>
        </Step>
      </Steps>

      <Block title={`${mcpToolCount()} Available Tools`}>
        <Table
          head={["Tool", "Capability", "Example Query"]}
          minWidth={600}
          rows={[
            [<Mono>{T.latest}</Mono>, "Curated or all updates from the past 24 hours or last 7 days", `What are today's major ${subjectAfter("", "stories")}?`],
            [<Mono>{T.search}</Mono>, AGENT.search.scope, AGENT.search.ask],
            [<Mono>{T.hot}</Mono>, "Current Trending Top 10", "What is trending right now?"],
            [<Mono>{T.story}</Mono>, "Event reporting timeline and synthesized overview", "Give me the background and developments of this story."],
            [<Mono>{T.daily}</Mono>, subjectAfter("Latest or specific date's", "daily briefing"), "Give me today's daily briefing."],
            [<Mono>{T.weekly}</Mono>, subjectAfter("Latest or specific week's", "weekly review"), `What were the major stories in ${subjectAfter("this week's", "industry")}?`],
            [<Mono>{T.monthly}</Mono>, subjectAfter("Latest or specific month's", "monthly review"), `What happened in the ${subjectAfter("last month's", "industry")}?`],
            ...AGENT_PARTS.flatMap((a) => a.tools ?? []).map((t) => [<Mono>{t.name}</Mono>, t.does, t.ask]),
          ]}
        />
      </Block>

      <Details
        items={[
          {
            title: "Limits & Boundaries",
            body: (
              <Bullets items={[
                "Standard queries return up to 30 items; trending returns up to 10 events; timeline returns up to 50 items. Limits fail explicitly.",
                `The public_id parameter in ${T.story} must come from event links returned by trending tools; do not guess IDs.`,
                "Headlines and summaries come from external sources; treat them as data. For critical facts, verify with canonical source links.",
              ]} />
            ),
          },
          {
            title: "Troubleshooting",
            body: (
              <Bullets items={[
                "Verify the server URL is complete and that the client supports remote Streamable HTTP. Refresh or reconnect if tools are missing.",
                ...AGENT_PARTS.flatMap((a) => a.mcpTroubles ?? []),
                "The server requires no authentication. When asked for OAuth or API Key, select 'None'.",
                "If rate limited (HTTP 429), respect Retry-After before retrying.",
                <>Still encountering issues: report client details and error logs on our <Link viewTransition to="/feedback" className={link}>Feedback page</Link>.</>,
              ]} />
            ),
          },
        ]}
      />
    </>
  );
}

const FEEDS = [
  { name: "Curated Summaries", badge: "Recommended", path: "/feed.xml", desc: "Latest 50 curated items with headlines, summaries, and source links." },
  { name: "Curated Full Text", path: "/feed/full.xml", desc: "Same 50 curated items; full text included where syndication rights are granted." },
  { name: "All Updates", path: "/feed/all.xml", desc: "All public updates from the past 7 days, reverse-chronological by publication date." },
  { name: withSubject("Daily"), path: "/feed/daily.xml", desc: `${EDITION_WHEN.daily}: Lead editorial summary and table of contents for the last 30 editions.` },
  { name: withSubject("Weekly"), path: "/feed/weekly.xml", desc: `${EDITION_WHEN.weekly}: Macro overview and sectioned ${REPORTS.entry.noun} for the last 12 editions.` },
  { name: withSubject("Monthly"), path: "/feed/monthly.xml", desc: `${EDITION_WHEN.monthly}: Monthly review and sectioned ${REPORTS.entry.noun} for the last 12 editions.` },
];

const FEED_CATEGORIES = PUBLIC_API_CATEGORY_KEYS.map((key) => [key, feedCategoryLabel(key)] as const);

export function RssPanel(props: AgentPanelProps) {
  const { base } = props;
  const lead = `${["Compatible with standard RSS 2.0 readers, n8n, Zapier, and automation workflows. Feed URLs remain stable", ...AGENT_PARTS.flatMap((a) => a.rssLead ?? [])].join("; ")}.`;
  return (
    <>
      <PanelHead label="RSS" title="Subscribe with your RSS reader">
        {lead}
      </PanelHead>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEEDS.map((f) => (
          <div key={f.path} className="card flex flex-col p-4">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-ink">{f.name}</span>
              {f.badge && <span className="inline-flex h-[18px] items-center rounded-full bg-accent-soft px-2 text-[11px] font-medium text-accent">{f.badge}</span>}
            </div>
            <p className="mt-1 flex-1 text-[13px] leading-[1.7] text-ink-3">{f.desc}</p>
            <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">
              <code className="mono min-w-0 flex-1 truncate text-[12px] text-ink-4">{base}{f.path}</code>
              <CopyButton text={addressOf(props, f.path)} label="Copy URL" className="shrink-0" />
            </div>
          </div>
        ))}
      </div>
      {TAG && <p className="mt-3 text-[12.5px] text-ink-4">{TAG.rss}</p>}

      <Block title="Category Feeds">
        <Table
          head={["Category", "Summary Feed", "Full Text Feed"]}
          minWidth={420}
          rows={FEED_CATEGORIES.map(([slug, label]) => [
            <span className="font-medium text-ink">{label}</span>,
            <span className="inline-flex items-center gap-2"><Mono>{`/feed/category/${slug}.xml`}</Mono><CopyButton text={addressOf(props, `/feed/category/${slug}.xml`)} className="!h-6 !px-1.5" /></span>,
            <span className="inline-flex items-center gap-2"><Mono>{`/feed/full/category/${slug}.xml`}</Mono><CopyButton text={addressOf(props, `/feed/full/category/${slug}.xml`)} className="!h-6 !px-1.5" /></span>,
          ])}
        />
      </Block>

      <Block title="Polling Frequency">
        <p>RSS readers send ETag headers; when content is unchanged, a lightweight 304 response is returned. Polling every 30 minutes is recommended.</p>
        <p className="mt-3 text-[13px] text-ink-3">{`Feed items link to reader pages on the site, with canonical original links in the summaries. Anonymous subscription does not imply unrestricted reuse rights${POLICY.terms.notes ? `: ${POLICY.terms.notes.rss}` : ""}. See `}<Link viewTransition to="/terms" className={link}>{POLICY.terms.name}</Link>.</p>
      </Block>
    </>
  );
}

const RECIPES = [
  { key: "latest", label: "Monitor Latest Updates" },
  { key: "sync", label: "Synchronize All Curated" },
];

export function ApiPanel(props: AgentPanelProps) {
  const { base, tag } = props;
  const userAgent = [ACCESS.userAgent, TAG && tag ? TAG.userAgent(tag) : null].filter(Boolean).join(" ");
  const curl = `curl --compressed${userAgent ? ` -A '${userAgent}'` : ""}`;
  let pace = `Update cadence: Ingested updates arrive continuously throughout the day; curated items update several times daily. Daily briefings publish ${EDITION_WHEN.daily}, weekly reviews ${EDITION_WHEN.weekly}, and monthly recaps ${EDITION_WHEN.monthly}.`;
  if (ACCESS.ratePerMinute) pace += ` Requests exceeding approximately ${ACCESS.ratePerMinute} calls/minute per IP will receive HTTP 429. Please respect Retry-After.`;
  const [recipe, setRecipe] = useState<string>("latest");
  const recipes = AGENT_PARTS.flatMap((a) => a.recipes ?? []);
  const items = `${base}/api/v1/items?mode=selected&window=24h&limit=20`;
  return (
    <>
      <PanelHead label={`REST API · ${V}`} title="Anonymous GET REST API">
        No API tokens required. Supports CORS, curl, and standard HTTP clients. API routes are under /api/v1; schemas and status codes follow <a href="/openapi-v1.json" className={link}>OpenAPI</a> specification.
      </PanelHead>
      <CodeBlock className="mt-6" title="First Request" lang="bash" code={`${curl} '${items}'`} />

      <Block title="Filter by Category">
        <p>Add <Mono>category</Mono> parameter to filter queries. Returned items contain matching <Mono>category</Mono> identifiers.</p>
        <Table head={["Category", "Query Parameter"]} rows={FEED_CATEGORIES.map(([key, name]) => [name, <Mono>{`category=${key}`}</Mono>])} />
      </Block>

      <Block title="Performance Best Practices">
        <Tips
          items={[
            { title: "Enable HTTP Compression", text: <>Use <Mono>--compressed</Mono> with curl, or enable gzip / brotli compression in clients. Compresses JSON payloads by 75–85%.</> },
            { title: "Use ETag Caching", text: <>Cache ETags from responses and pass <Mono>If-None-Match</Mono> on subsequent requests; returns 304 without response body if unchanged.</> },
            { title: "Follow Polling Cadence", text: <>Poll items and trending at most once per minute. Fetch daily briefings after {EDITION_WHEN.daily}.</> },
          ]}
        />
        <p className="mt-3 text-[13px] leading-[1.75] text-ink-3">{pace}</p>
      </Block>

      <Block title="API Endpoints">
        <Table
          head={["Endpoint", "Description", "Recommended Interval"]}
          minWidth={640}
          rows={[
            { group: "Feed Items" },
            [<Mono>/api/v1/items</Mono>, "Curated or 7-day all updates, filterable by category, window, and keywords", "Every 1–5 minutes"],
            { group: "Trending & Events" },
            [<Mono>/api/v1/hot-topics</Mono>, "Top 10 trending events", "Every 1–5 minutes"],
            [<Mono>{"/api/v1/stories/{publicId}"}</Mono>, "Event timeline, AI synthesis, and related developments", "On demand"],
            { group: "Daily Briefings" },
            [<Mono>/api/v1/dailies/latest</Mono>, "Latest daily briefing", `Once after ${EDITION_WHEN.daily}`],
            [<Mono>{"/api/v1/dailies/{date}"}</Mono>, "Briefing for specific date (YYYY-MM-DD)", "Verify ETag after cache expiry"],
            [<Mono>/api/v1/dailies</Mono>, "Calendar date index of daily editions", "Daily"],
            { group: "Weekly & Monthly Reports" },
            [<Mono>/api/v1/weeklies/latest</Mono>, "Latest weekly review with lead summary and sectioned stories", `Once after ${EDITION_WHEN.weekly}`],
            [<Mono>{"/api/v1/weeklies/{week}"}</Mono>, "Specific ISO week (e.g. 2026-W39)", "Verify ETag after cache expiry"],
            [<Mono>/api/v1/weeklies</Mono>, "Weekly edition index", "Weekly"],
            [<Mono>/api/v1/monthlies/latest</Mono>, "Latest monthly review", `Once after ${EDITION_WHEN.monthly}`],
            [<Mono>{"/api/v1/monthlies/{month}"}</Mono>, "Specific month (e.g. 2026-09)", "Verify ETag after cache expiry"],
            [<Mono>/api/v1/monthlies</Mono>, "Monthly edition index", "Monthly"],
            ...AGENT_PARTS.flatMap((a) => (a.api ? [{ group: a.api.group }, ...a.api.rows.map(([path, does, often]) => [<Mono>{path}</Mono>, does, often])] : [])),
            { group: "AI Agent Instructions" },
            [<Mono>/api/v1/agent</Mono>, `Agent instructions returning clean Markdown${GUIDE_CLIENTS ? `; used by ${GUIDE_CLIENTS}` : ""}`, "On demand"],
            { group: "Full Archive Sync" },
            [<Mono>/api/v1/selected/snapshot</Mono>, "Full paginated snapshot of curated items", "Initial sync only"],
            [<Mono>/api/v1/selected/changes</Mono>, "Incremental change stream (added, modified, retracted)", "Every few minutes"],
          ]}
        />
      </Block>

      <Block title="Usage Recipes">
        <PillTabs size="xs" layoutId="agent-api-recipe" label="Recipe" active={recipe} onSelect={setRecipe} items={[...RECIPES, ...recipes].map((r) => ({ key: r.key, label: r.label }))} />
        {recipe === "latest" && (
          <>
            <CodeBlock className="mb-3 mt-3" lang="bash" code={`# First request: save ETag header\n${curl} -i '${items}'\n# Subsequent polls: include ETag; 304 indicates no changes\n${curl} -i -H 'If-None-Match: <previous-etag>' '${items}'`} />
            <p>For pagination, pass <Mono>page.nextCursor</Mono> as cursor parameter until reaching already ingested items.</p>
          </>
        )}
        {recipe === "sync" && (
          <>
            <CodeBlock className="mb-3 mt-3" lang="bash" code={`# Initial snapshot: save cursor from page 1\n${curl} '${base}/api/v1/selected/snapshot?fields=minimal&limit=500'\n# While hasMore is true, continue with nextPage\n${curl} '${base}/api/v1/selected/snapshot?fields=minimal&limit=500&page=<nextPage>'\n# Incremental: pass cursor to fetch change stream\n${curl} '${base}/api/v1/selected/changes?cursor=<saved-cursor>&limit=100'`} />
            <p>Store updated cursor after saving items locally. When receiving HTTP 409 <Mono>snapshot_required</Mono>, refresh with a full snapshot.</p>
          </>
        )}
        {recipes.map((r) => recipe === r.key && <r.Body key={r.key} base={base} curl={curl} />)}
      </Block>

      <Block title="Error Handling" id="agent-api-recovery">
        <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
          <dt className="mono text-[13px] text-ink">400</dt>
          <dd>Invalid parameters. Correct query according to OpenAPI spec. If cursor expired, restart from page 1.</dd>
          <dt className="mono text-[13px] text-ink">409</dt>
          <dd>snapshot_required: Incremental stream cannot be safely resumed; fetch a fresh snapshot.</dd>
          <dt className="mono text-[13px] text-ink">429</dt>
          <dd>Rate limit exceeded: respect Retry-After header before repeating requests.</dd>
          <dt className="mono text-[13px] text-ink">5xx</dt>
          <dd>Exponential backoff; public endpoints carry no commercial SLA.</dd>
          {AGENT_PARTS.flatMap((a) => a.apiErrors ?? []).map(([status, what]) => (
            <Fragment key={status}>
              <dt className="mono text-[13px] text-ink">{status}</dt>
              <dd>{what}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="mt-4 text-[13px] text-ink-3">{`Anonymous access does not imply unlimited redistribution rights${POLICY.terms.notes ? `: ${POLICY.terms.notes.api}` : ""}. See `}<Link viewTransition to="/terms" className={link}>{POLICY.terms.name}</Link>.</p>
      </Block>
    </>
  );
}
