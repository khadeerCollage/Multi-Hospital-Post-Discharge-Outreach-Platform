'use client';
import React from 'react';
import { 
  FolderCode, 
  ArrowUpRight, 
  PhoneCall, 
  ShieldCheck, 
  Users, 
  RefreshCw,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

// Re-usable Healthcare Themed Empty State for Campaigns
export function CampaignsEmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <Empty className="my-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PhoneCall className="h-7 w-7 text-blue-600" />
        </EmptyMedia>
        <EmptyTitle>No Outreach Campaigns Yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t launched any post-discharge campaigns for this hospital. Get started by provisioning your first patient cohort.
        </EmptyDescription>
      </EmptyHeader>
      {onCreate && (
        <EmptyContent className="flex-row justify-center gap-2">
          <Button onClick={onCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Create Campaign
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

// Re-usable Healthcare Themed Empty State for Escalations
export function EscalationsEmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <Empty className="my-8 border-emerald-200/80 bg-emerald-50/30">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-emerald-100 text-emerald-700 border-emerald-200">
          <ShieldCheck className="h-7 w-7 text-emerald-600" />
        </EmptyMedia>
        <EmptyTitle className="text-emerald-950">All Discharged Patients Stable</EmptyTitle>
        <EmptyDescription className="text-emerald-800/80">
          There are currently no active clinical escalations. The autonomous outreach pipeline has not detected any acute red-flag symptoms.
        </EmptyDescription>
      </EmptyHeader>
      {onRefresh && (
        <EmptyContent className="flex-row justify-center gap-2">
          <Button variant="outline" onClick={onRefresh} className="flex items-center gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-100">
            <RefreshCw className="h-4 w-4" /> Refresh Clinical Feed
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

// Re-usable Healthcare Themed Empty State for Patient Search / Directory
export function PatientsEmptyState({ onReset }: { onReset?: () => void }) {
  return (
    <Empty className="my-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Users className="h-7 w-7 text-blue-600" />
        </EmptyMedia>
        <EmptyTitle>No Matching Patients</EmptyTitle>
        <EmptyDescription>
          No patient records matched your search query or risk filter. Try searching for a different MRN or name.
        </EmptyDescription>
      </EmptyHeader>
      {onReset && (
        <EmptyContent className="flex-row justify-center gap-2">
          <Button variant="outline" onClick={onReset}>
            Reset Filter
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

// Standard Shadcn EmptyDemo conforming to user specification
export function EmptyDemo({ onCreate, onImport }: { onCreate?: () => void; onImport?: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderCode className="h-7 w-7 text-blue-600" />
        </EmptyMedia>
        <EmptyTitle>No Projects Yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t created any projects yet. Get started by creating
          your first project.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button onClick={onCreate}>Create Project</Button>
        <Button variant="outline" onClick={onImport}>Import Project</Button>
      </EmptyContent>
      <Button
        variant="link"
        className="text-gray-500 hover:text-blue-600 mt-2 text-xs flex items-center gap-1"
        size="sm"
        nativeButton={false}
        render={
          <a href="/admin" className="flex items-center gap-1">
            Learn More <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        }
      />
    </Empty>
  );
}
