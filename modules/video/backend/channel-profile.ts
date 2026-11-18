// The channel this checkout is (industry/channel.json): its kind, subject, brand, trusted official sites and the video
// styles it uses. Plain code (node:fs only): the renderer imports it too, pointed at the channel's own industry folder
// by VIDEO_INDUSTRY_DIR (the pipeline sets it), else this checkout's.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ChannelProfile {
  type: string;
  label: string;
  /** What the channel covers, as prompts say it: "a news video about <subject>". */
  subject: string;
  /** Who watches: "why this matters to <audience>". */
  audience: string;
  brand: { name: string; label: string; tagline: string };
  tags: string[];
  hashtags: string[];
  officialSites: string[];
  paywalled: string[];
  styles: { allowed: string[]; byCategory: Record<string, string> };
  /** The YouTube upload: category, language, the line asking to subscribe and the channel's disclaimer (if any). */
  youtube?: { category: string; language: string; subscribe?: string; disclaimer?: string };
}

export const industryDir = () => process.env.VIDEO_INDUSTRY_DIR || fileURLToPath(new URL("../../../industry/", import.meta.url));

let cached: { dir: string; profile: ChannelProfile } | null = null;
export function channelProfile(): ChannelProfile {
  const dir = industryDir();
  if (cached?.dir !== dir) cached = { dir, profile: JSON.parse(readFileSync(path.join(dir, "channel.json"), "utf8")) as ChannelProfile };
  return cached.profile;
}
