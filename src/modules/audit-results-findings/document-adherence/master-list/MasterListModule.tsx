'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubsystemList } from './hooks/useSubsystemList';
import { SubsystemFilterBar } from './components/FilterBar';
import { SubsystemAnalyticsChart } from './components/SubsystemChart';
import { SubsystemDocTypeChart } from './components/DocTypeChart';
import { SubsystemUserChart } from './components/UserChart';
import { DocTypeDetailModal } from './components/DocTypeDetailModal';
import { UserDetailModal } from './components/UserDetailModal';

export default function MasterListModule() {
  const router = useRouter();
  const {
    rows,
    subsystemChart,
    docTypeChart,
    userChart,
    loading,
    docTypes,
    userNames,
    filters,
    setFilters,
    refresh,
  } = useSubsystemList();

  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  if (loading) return (
    <div className="p-8 space-y-6">
      <div>
        <Skeleton className="h-8 w-1/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[350px] w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  );

  return (
    <div className="p-8 bg-background text-foreground min-h-screen space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Master List</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">
          Track document adherence and compliance status across all subsystems
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <SubsystemFilterBar
          filters={filters}
          setFilters={setFilters}
          docTypes={docTypes}
          userNames={userNames}
          onClear={() => setFilters(prev => ({
            ...prev,
            dateFrom: undefined,
            dateTo:   undefined,
            docType:  '',
            user:     '',
            search:   '',
          }))}
        />
      </div>

      {/* Charts Grid */}
      <div className="space-y-6">
        {/* Top Row: Subsystem compliance (Full Width) */}
        <div className="w-full">
          <SubsystemAnalyticsChart 
            data={subsystemChart} 
            onBarClick={(subsystem) => {
              router.push(`/arf/document-adherence/${subsystem.toLowerCase()}`);
            }}
          />
        </div>

        {/* Bottom Row: Doc Type Chart & User Chart (2 Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SubsystemDocTypeChart 
            data={docTypeChart} 
            onBarClick={(docType) => setSelectedDocType(docType)}
          />
          <SubsystemUserChart 
            data={userChart} 
            onUserClick={(userName) => setSelectedUser(userName)}
          />
        </div>
      </div>

      {/* Modals */}
      {selectedDocType && (
        <DocTypeDetailModal
          open={!!selectedDocType}
          onOpenChange={(open) => { if (!open) setSelectedDocType(null); }}
          docType={selectedDocType}
          rows={rows}
          onSuccess={refresh}
        />
      )}

      {selectedUser && (
        <UserDetailModal
          open={!!selectedUser}
          onOpenChange={(open) => { if (!open) setSelectedUser(null); }}
          userName={selectedUser}
          rows={rows}
          onSuccess={refresh}
        />
      )}

    </div>
  );
}