"use client";

import React from "react";
import Link from "next/link";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { DistributorPlanConfig, hasDistributorFeature } from "@/config/plans";

interface PlanFeatureGateProps {
  currentPlan?: string | null;
  feature: keyof DistributorPlanConfig["flags"];
  title: string;
  description: string;
  minPlanName?: "Pro" | "Enterprise";
  upgradeHref?: string;
  children: React.ReactNode;
}

export function PlanFeatureGate({
  currentPlan,
  feature,
  title,
  description,
  minPlanName = "Pro",
  upgradeHref = "/checkout/distribuidora?plan=pro",
  children,
}: PlanFeatureGateProps) {
  const allowed = hasDistributorFeature(currentPlan, feature);

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#111827] via-[#161F30] to-[#0D1524] p-6 shadow-xl">
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#22C55E]/10 blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Lock size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#22C55E]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#22C55E]">
                Disponível no {minPlanName}
              </span>
              <span className="text-xs text-slate-500">Recurso exclusivo</span>
            </div>
            <h3 className="mt-1 text-base font-bold text-white flex items-center gap-2">
              {title}
              <Sparkles size={16} className="text-[#22C55E]" />
            </h3>
            <p className="mt-1 text-sm text-slate-400 max-w-xl leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <Link
          href={upgradeHref}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-[#22C55E] px-5 py-3 text-sm font-bold text-black shadow-lg shadow-[#22C55E]/20 transition hover:bg-[#1ea850] hover:scale-[1.02] active:scale-[0.98]"
        >
          Disponível no {minPlanName}
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
