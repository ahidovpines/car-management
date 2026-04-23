'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Vehicle } from '@/lib/types';
import VehicleForm from '@/components/VehicleForm';
import { Car } from 'lucide-react';

export default function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/vehicles/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setVehicle(data); setLoading(false); });
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">טוען...</div>;
  if (!vehicle) return <div className="min-h-screen flex items-center justify-center text-gray-400">רכב לא נמצא</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <Car className="w-5 h-5 text-blue-600" />
            <span className="text-sm">ניהול רכבים</span>
          </Link>
          <span className="text-gray-300">/</span>
          <Link href={`/vehicles/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
            {vehicle.make} {vehicle.model}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">עריכה</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">ערוך רכב — {vehicle.make} {vehicle.model}</h1>
        <VehicleForm initial={vehicle} vehicleId={vehicle.id} />
      </main>
    </div>
  );
}
