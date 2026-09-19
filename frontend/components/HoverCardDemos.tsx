'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, Clock, Activity } from 'lucide-react';

const HOVER_CARD_SIDES = ['left', 'top', 'bottom', 'right'] as const;

export function HoverCardSides() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {HOVER_CARD_SIDES.map((side) => (
        <HoverCard key={side}>
          <HoverCardTrigger
            delay={100}
            closeDelay={100}
            render={
              <Button variant="outline" className="capitalize">
                {side}
              </Button>
            }
          />
          <HoverCardContent side={side}>
            <div className="flex flex-col gap-1">
              <h4 className="font-medium text-sm text-gray-900">Hover Card</h4>
              <p className="text-xs text-gray-500">This hover card appears on the {side} side of the trigger.</p>
            </div>
          </HoverCardContent>
        </HoverCard>
      ))}
    </div>
  );
}

// Healthcare-specific Clinical Risk Hover Card
interface ClinicalRiskCardProps {
  riskLevel: 'critical' | 'high' | 'moderate' | 'low' | 'routine' | string;
  side?: 'left' | 'top' | 'bottom' | 'right';
  children?: React.ReactNode;
}

export function ClinicalRiskHoverCard({ riskLevel, side = 'top', children }: ClinicalRiskCardProps) {
  const riskInfo: Record<string, { title: string; window: string; desc: string; icon: any; color: string; badge: string }> = {
    critical: {
      title: 'Critical Risk Level',
      window: 'Must be contacted within 24 hours',
      desc: 'High likelihood of post-op complications or acute cardiac events. Strict multi-agent consensus required.',
      icon: ShieldAlert,
      color: 'text-red-600',
      badge: 'bg-red-50 text-red-700 border-red-200',
    },
    high: {
      title: 'High Risk Level',
      window: 'Must be contacted within 48 hours',
      desc: 'Moderate to complex recovery trajectory. Automated symptom check against surgical protocol.',
      icon: AlertTriangle,
      color: 'text-orange-600',
      badge: 'bg-orange-50 text-orange-700 border-orange-200',
    },
    moderate: {
      title: 'Moderate Risk Level',
      window: 'Standard 72-hour outreach window',
      desc: 'Standard recovery monitoring. Routine check for pain medication adherence and wound healing.',
      icon: Info,
      color: 'text-amber-600',
      badge: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    },
    low: {
      title: 'Low Risk Level',
      window: 'Outreach within 3-5 days',
      desc: 'Uncomplicated discharge disposition. Wellness survey and appointment reminder.',
      icon: CheckCircle2,
      color: 'text-green-600',
      badge: 'bg-green-50 text-green-700 border-green-200',
    },
    routine: {
      title: 'Routine Risk Level',
      window: 'Standard post-discharge survey',
      desc: 'General outpatient follow-up and educational guidance verification.',
      icon: Clock,
      color: 'text-gray-600',
      badge: 'bg-gray-50 text-gray-700 border-gray-200',
    },
  };

  const levelKey = (riskLevel || 'routine').toLowerCase();
  const info = riskInfo[levelKey] || riskInfo.routine;
  const Icon = info.icon;

  return (
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger>
        {children || (
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-help ${info.badge}`}>
            {riskLevel}
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent side={side} align="center" className="w-80">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-gray-50 border border-gray-100 ${info.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">{info.title}</h4>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600">
              <Clock className="h-3 w-3" />
              {info.window}
            </div>
            <p className="text-xs text-gray-500 leading-snug pt-1">{info.desc}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
