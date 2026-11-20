// Trigger upload and publish for a finished video (default Video #11)
import { sql } from "@aihot/backend/db";
import { reviewVideo, getVideo } from "../modules/video/backend/videos.ts";
import { uploadPrivate, publishPublic, youtubeRecord } from "../modules/video/backend/youtube.ts";

const id = Number(process.argv[2] || 11);
console.log(`[push-video] Starting push for Video #${id}...`);

const video = await getVideo(id);
if (!video) {
  console.error(`[push-video] Video #${id} not found!`);
  process.exit(1);
}

console.log(`[push-video] Title: ${video.title}`);
console.log(`[push-video] Status: ${video.status}`);

if (video.status === "ready") {
  console.log(`[push-video] Approving Video #${id}...`);
  await reviewVideo(id, "approved");
}

console.log(`[push-video] Uploading to YouTube (long video, thumbnail, short with auto-link)...`);
const uploadRes = await uploadPrivate(id, "dev:Dev Admin");
console.log(`[push-video] Upload finished!`);
console.log(`  Long Video: https://youtu.be/${uploadRes.longId}`);
console.log(`  Short Video: https://youtu.be/${uploadRes.shortId}`);
if (uploadRes.notes?.length) {
  console.log(`  Notes: ${JSON.stringify(uploadRes.notes)}`);
}

console.log(`[push-video] Setting privacy to Public...`);
const pubRes = await publishPublic(id, "dev:Dev Admin");
console.log(`[push-video] Public publishing finished!`);
console.log(`  Public IDs: ${JSON.stringify(pubRes.publicIds)}`);
console.log(`  Published At: ${pubRes.publishedAt}`);

await sql.end();
process.exit(0);
