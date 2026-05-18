'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubsystemList } from '../master-list/hooks/useSubsystemList';
import { SubsystemFilterBar } from '../master-list/components/FilterBar';
import { SubsystemDocTypeChart } from '../master-list/components/DocTypeChart';
import { SubsystemUserChart } from '../master-list/components/UserChart';
import { SubsystemTable } from '../master-list/components/Table';
import { DocTypeDetailModal } from '../master-list/components/DocTypeDetailModal';
import { UserDetailModal } from '../master-list/components/UserDetailModal';

interface Props {
  subsystemCode: string;
}

export default function SubsystemDetailModule({ subsystemCode }: Props) {
  const router = useRouter();
  const {
    rows,
    docTypeChart,
    userChart,
    loading,
    docTypes,
    userNames,
    filters,
    setFilters,
    refresh,
  } = useSubsystemList(subsystemCode);

  // Modal state
  const [docTypeModalOpen, setDocTypeModalOpen] = useState(false);
  const [selectedDocType, setSelectedDocType]   = useState('');

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser]   = useState('');

  const handleDocTypeClick = (docType: string) => {
    setSelectedDocType(docType);
    setDocTypeModalOpen(true);
  };

  const handleUserClick = (userName: string) => {
    setSelectedUser(userName);
    setUserModalOpen(true);
  };

  if (loading) return (
    <div className="p-8 space-y-6">
      <div>
        <Skeleton className="h-8 w-1/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );

  return (
    <div className="p-8 bg-background text-foreground min-h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => router.push('/arf/document-adherence/master-list')}
          className="shrink-0"
          title="Back to Master List"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Subsystem Adherence Report: {subsystemCode}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Showing document adherence and compliance metrics exclusively for the {subsystemCode} subsystem
          </p>
        </div>
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

      {/* Charts Row — ONLY Doc Type and Prepared By as requested */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SubsystemDocTypeChart
          data={docTypeChart}
          onBarClick={handleDocTypeClick}
        />
        <SubsystemUserChart
          data={userChart}
          userNames={userNames}
          onUserClick={handleUserClick}
        />
      </div>

      {/* Table List */}
      <SubsystemTable
        rows={rows}
        loading={loading}
        search={filters.search ?? ''}
        isUserFilterActive={!!filters.user}
        onSuccess={refresh}
      />

      {/* Modals */}
      <DocTypeDetailModal
        open={docTypeModalOpen}
        onOpenChange={setDocTypeModalOpen}
        docType={selectedDocType}
        rows={rows}
      />

      <UserDetailModal
        open={userModalOpen}
        onOpenChange={setUserModalOpen}
        userName={selectedUser}
        rows={rows}
        onSuccess={refresh}
      />
    </div>
  );
}
