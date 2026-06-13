'use client';

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { RefundsManager } from '@/components/refunds/RefundsManager';

export default function OrganizerRefundsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Žiadosti o vrátenie</h1>
          <p className="text-sm text-gray-500">Schvaľujte alebo zamietajte žiadosti zákazníkov o vrátenie peňazí.</p>
        </div>
        <RefundsManager admin={false} />
      </main>
    </div>
  );
}
