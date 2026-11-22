// /admin/journal: a reserved placeholder for the video module's operation log. There is no
// recording module behind it yet (see specs/001-operation-log in this repo), so the page says
// exactly that — no fabricated entries. The engine's own actions are already recorded in the
// central Audit Log (/admin/audit), linked below. When the logging module lands, the real page
// replaces this one at the same slug and sidebar position.
import { data } from "react-router";
import { useTranslation } from "react-i18next";
import { SITE } from "@aihot/site";
import { adminPageGet, GRAY_HEADERS } from "../../../apps/web/app/lib/admin.server";
import { AdminPage } from "../../../apps/web/app/features/admin/ui";

// Follows the module admin-page pattern (session check + envelope) like the sibling pages;
// the payload is not used — the placeholder has no data of its own to show.
export async function loader({ request }: { request: Request }) {
  const payload = await adminPageGet<Record<string, unknown>>(request, "/api/admin/video/overview");
  return data(payload, { headers: GRAY_HEADERS });
}

export const headers = () => GRAY_HEADERS;

export const meta = () => [{ title: `Journal · ${SITE.name} Admin` }];

const CHIP_WAITING = "inline-flex items-center whitespace-nowrap rounded-full border border-[#A8742C] bg-[rgba(244,160,64,0.14)] px-2 py-1 text-[12px] font-medium leading-none text-[#FFD28A]";
const NAVY_BTN = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#30428A] bg-[#0B1435] px-3 py-2 text-[13px] font-medium text-[#FFF3E0] transition hover:border-[#F4A040]";

export default function JournalAdmin() {
  const { t } = useTranslation();
  return (
    <AdminPage title={t("journal.title")} subtitle={t("journal.subtitle")}>
      <div className="rounded-xl border border-[#263678] bg-[#0C1538] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold text-white">{t("journal.heading")}</h2>
          <span className={CHIP_WAITING}>{t("journal.badge")}</span>
        </div>
        <p className="mt-3 max-w-[720px] text-[13.5px] leading-relaxed text-white/65">{t("journal.body")}</p>
        <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-white/45">{t("journal.positionNote")}</p>
        <div className="mt-4">
          <a className={NAVY_BTN} href="/admin/audit">{t("journal.openAudit")}</a>
        </div>
      </div>
    </AdminPage>
  );
}
