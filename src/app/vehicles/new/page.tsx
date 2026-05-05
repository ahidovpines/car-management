'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import VehicleForm from '@/components/VehicleForm';
import { Car } from 'lucide-react';
import Link from 'next/link';
import { Importer, IMPORTERS } from '@/lib/types';

function NewVehicleInner() {
  const searchParams = useSearchParams();
  const param = searchParams.get('importer');
  const importer: Importer = param === 'YOSEF' ? 'YOSEF' : 'AP';
  const importerLabel = IMPORTERS.find(i => i.value === importer)?.shortLabel || 'A.P';

  return (
    <div className="min-h-screen bg-[#f0f2f7]">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <Car className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium">ניהול רכבים</span>
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-bold text-gray-900">הוסף רכב חדש</span>
          <span className="text-xs text-gray-400 mr-auto">יבואן: <span className="font-semibold text-gray-700">{importerLabel}</span></span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-black text-gray-900 mb-6">הוסף רכב חדש</h1>
        <VehicleForm initial={{ importer }} />
      </main>
    </div>
  );
}

export default function NewVehiclePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">טוען...</div>}>
      <NewVehicleInner />
    </Suspense>
  );
}
