import { getDb } from "@/lib/db";
import { listProgramsForResearcher, listReports } from "@/lib/db/repo";
import { requireUser } from "@/lib/server/auth";
import { ProgramsClient } from "@/components/dashboard/programs-client";
import { OnboardingGuide, type OnboardingTarget } from "@/components/onboarding/onboarding-guide";

export const metadata = { title: "Programs" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ onboard?: string }>;
}) {
  const { onboard } = await searchParams;
  const user = await requireUser();
  const programs = listProgramsForResearcher(getDb(), user.id);

  const allCounts = {
    data: programs.reduce((n, p) => n + p.dataCount, 0),
    activities: programs.reduce((n, p) => n + p.activityCount, 0),
    findings: programs.reduce((n, p) => n + p.findingCount, 0),
    reports: programs.reduce((n, p) => n + p.reportCount, 0),
  };

  const flagship = programs.find((p) => p.patient.pid === "CB-P-0001") ?? null;
  let onboardingTarget: OnboardingTarget | null = null;
  if (flagship) {
    const reports = listReports(getDb(), flagship.program.id, user.id) ?? [];
    onboardingTarget = {
      patientId: flagship.patient.id,
      reportId: reports[0]?.id ?? null,
    };
  }

  return (
    <div className="page-container">
      <OnboardingGuide target={onboardingTarget} autoOpen={onboard === "1"} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight text-ink-900">Research programs</h1>
        <p className="text-[13px] text-ink-700/50">
          {allCounts.data} assets · {allCounts.activities} activities · {allCounts.findings} findings ·{" "}
          {allCounts.reports} reports
        </p>
      </div>

      <div className="mt-6">
        <ProgramsClient programs={programs} />
      </div>
    </div>
  );
}
