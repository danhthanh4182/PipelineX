import { sql } from "@aihot/backend/db";
import { createVideo } from "../modules/video/backend/videos.ts";
import { makeVideo } from "../modules/video/backend/pipeline.ts";

console.log("[create-vietnam-video] Creating Vietnam K-shaped economy story and reports...");

// 1. Create Story
const [story] = await sql<{ id: number }[]>`
  INSERT INTO stories (public_id, title, digest, origin, version, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Vietnam''s K-Shaped Economic Boom: The Reality Behind the GDP Numbers',
    'Vietnam''s headline GDP growth continues to outpace regional peers, driven by massive foreign direct investment and high-tech export volumes following the China-plus-one realignment. However, analysts warn of an intensifying K-shaped divergence: foreign-invested multinationals and government-favored domestic conglomerates capture outsized benefits, while domestic small and medium-sized enterprises, informal household businesses, and everyday factory workers struggle with stagnant real wages, surging urban housing costs, and limited supply chain integration.',
    'manual',
    1,
    now(),
    now()
  )
  RETURNING id
`;

const storyId = story!.id;
console.log(`[create-vietnam-video] Created story #${storyId}`);

// 2. Create Fact
const [fact] = await sql<{ id: number }[]>`
  INSERT INTO facts (public_id, story_id, title, created_at, updated_at)
  VALUES (
    gen_random_uuid()::text,
    ${storyId},
    'Vietnam K-shaped economic expansion and structural divergence',
    now(),
    now()
  )
  RETURNING id
`;
const factId = fact!.id;

// 3. Define Sources & Articles
const articles = [
  {
    id: `art-vietnam-eaf-${storyId}`,
    sourceId: 'src-eastasiaforum',
    sourceName: 'East Asia Forum',
    tier: 'T1',
    url: 'https://eastasiaforum.org/2026/09/11/vietnams-k-shaped-economic-boom/',
    title: 'Vietnam’s K-Shaped Economic Boom',
    author: 'Khoi Dang',
    publishedAt: new Date('2026-09-11T08:00:00Z'),
    body: `Vietnam’s rapid headline economic growth is frequently celebrated by multilateral lenders and international investors as one of the world's standout success stories. With annual GDP expansion exceeding 6.5 to 7 percent and foreign direct investment (FDI) inflows surging, the Southeast Asian nation has positioned itself as an indispensable manufacturing hub in the global supply chain. 

Yet underneath this macroeconomic triumph lies an increasingly pronounced K-shaped divergence. The fruits of Vietnam’s boom are overwhelmingly concentrated at the top tier—spearheaded by foreign-invested enterprises (FIEs) and government-favored domestic conglomerates, colloquially regarded as "national champions." In sharp contrast, domestic small-to-medium enterprises (SMEs), informal household businesses, and everyday factory workers are being systematically squeezed and left behind.

Foreign-invested enterprises now account for over 70 percent of Vietnam’s total merchandise exports and dominate high-value sectors such as smartphones, consumer electronics, and computer hardware. However, these multinationals operate largely as isolated export-processing enclaves that rely on cheap, low-wage assembly labor. Because most sophisticated components—such as semiconductors, high-density printed circuit boards, and advanced optical modules—are imported directly from China, South Korea, and Taiwan, the domestic economy captures only a narrow fraction of total value add. Crucially, genuine technology transfer remains severely limited, and Vietnamese domestic suppliers remain largely relegated to low-margin packaging, corrugated paper, and basic plastic molding.

Simultaneously, the domestic economic landscape has suffered under asymmetric policy incentives. State-directed credit, preferential land allocations, and regulatory exemptions have disproportionately benefited large domestic conglomerates and state-linked real estate developers. Meanwhile, the informal economy and micro-enterprises—which employ more than 40 percent of Vietnam's non-agricultural workforce—confront rising operational costs, burdensome regulatory compliance, and a persistent liquidity crunch as commercial banks prioritize lending to mega-projects. The result is a dual economy where headline export figures surge while domestic purchasing power and household balance sheets face mounting structural headwinds.`
  },
  {
    id: `art-vietnam-ft-${storyId}`,
    sourceId: 'src-ft-vietnam',
    sourceName: 'Financial Times',
    tier: 'T1',
    url: 'https://www.ft.com/content/vietnam-supply-chain-assembly-trap',
    title: 'Vietnam’s Supply Chain Conundrum: High Export Volumes, Low Domestic Integration',
    author: 'FT Asia Correspondent',
    publishedAt: new Date('2026-09-12T09:30:00Z'),
    body: `Over the past decade, Vietnam has been the primary geopolitical and corporate winner of the "China-plus-one" supply chain diversification wave. Tech titans like Samsung Electronics, which manufactures half of its worldwide smartphones across northern provinces like Bac Ninh and Thai Nguyen, alongside key Apple contract manufacturers including Foxconn, Luxshare Precision, and Pegatron, have collectively invested tens of billions of dollars into Vietnamese assembly lines.

Yet international economists and industry observers are increasingly raising alarms regarding Vietnam's domestic value-add ceiling. In electronics and high-tech manufacturing, domestic Vietnamese value capture hovers around 15 to 20 percent, with the overwhelming bulk of export revenue merely covering assembly payroll, electricity, and local warehouse overhead. Domestic manufacturers face steep hurdles in achieving Tier-1 or Tier-2 supplier status, owing to capital shortages, inadequate precision engineering infrastructure, and prohibitive international quality accreditation standards.

This dynamic poses a severe risk of Vietnam falling into the classic "middle-income trap." As statutory minimum wages steadily rise and the country gradually approaches upper-middle-income classification, it will inevitably face intense low-cost manufacturing competition from emerging alternatives such as India, Indonesia, and Bangladesh. Without developing robust indigenous technology capabilities, homegrown component manufacturing, and higher-margin services, Vietnam risks remaining an assembly corridor whose prosperity remains fragile and dependent on foreign corporate goodwill.`
  },
  {
    id: `art-vietnam-bloomberg-${storyId}`,
    sourceId: 'src-bloomberg-vietnam',
    sourceName: 'Bloomberg Markets',
    tier: 'T1',
    url: 'https://www.bloomberg.com/news/articles/2026-09-13/vietnam-growth-paradox-real-estate-living-costs',
    title: 'Vietnam’s Growth Paradox: Record Inflows Clash With Urban Living Costs and Real Estate Surges',
    author: 'Bloomberg Economics',
    publishedAt: new Date('2026-09-13T10:15:00Z'),
    body: `A growing disconnect is emerging on the streets of Hanoi and Ho Chi Minh City between macroeconomic headlines and the day-to-day financial reality of average households. While national GDP metrics indicate a booming economy, domestic consumer confidence and retail turnover have exhibited sluggish momentum throughout 2026, as middle-class families and industrial workers prioritize precautionary savings over discretionary spending.

The central driver of this household pressure is acute asset inflation, particularly across residential property. Real estate price-to-income ratios in Vietnam's primary urban centers have surged past 25 to 30 times average annual household income, fueled by speculative capital flows and limited new affordable housing supply. For young urban professionals and factory workers earning typical manufacturing salaries of $350 to $500 per month, homeownership has become virtually unattainable. Furthermore, rising utility tariffs, healthcare expenses, and rental rates have steadily eroded real wage gains achieved over the previous three years.

Economists note that resolving this K-shaped dichotomy requires deliberate structural rebalancing. For Vietnam to achieve its long-term ambition of becoming a high-income nation by 2045, policy priorities must pivot from sheer volume-based FDI attraction toward comprehensive domestic supplier incubation, expanded technical vocational training, competitive financial access for SMEs, and aggressive land-use reforms to curb speculative real estate bubbles.`
  }
];

for (const art of articles) {
  await sql`
    INSERT INTO sources (id, name, kind, tier)
    VALUES (${art.sourceId}, ${art.sourceName}, 'rss', ${art.tier})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `;

  await sql`
    INSERT INTO articles (
      id, source_id, identity_key, url, title, author,
      discovered_at, timeline_at, published_at, body_text,
      body_status, media, revision, backfill, processing_state, grouping_status
    )
    VALUES (
      ${art.id}, ${art.sourceId}, ${art.id}, ${art.url}, ${art.title}, ${art.author},
      now(), ${art.publishedAt}, ${art.publishedAt}, ${art.body},
      'ok', '[]'::jsonb, 1, false, 'analyzed', 'complete'
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      body_text = EXCLUDED.body_text
  `;

  await sql`
    INSERT INTO fact_articles (fact_id, article_id)
    VALUES (${factId}, ${art.id})
    ON CONFLICT DO NOTHING
  `;
}

console.log("[create-vietnam-video] Articles and facts linked successfully.");

// 4. Create Video Job with style "macro"
const video = await createVideo(storyId, "user", sql, "macro");
console.log(`[create-vietnam-video] Created video job #${video.id} (style: ${video.style})`);

console.log(`[create-vietnam-video] Starting video production pipeline for video #${video.id}...`);
await makeVideo(video.id, "story");
console.log(`[create-vietnam-video] Video production pipeline completed for video #${video.id}!`);

await sql.end();
process.exit(0);
