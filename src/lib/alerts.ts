import { Vehicle, Alert } from './types';

function registrationDeadline(month: number, year: number): Date {
  // Last day of manufacture month, one year later
  return new Date(year + 1, month, 0); // day 0 of next month = last day of this month
}

export function calculateAlerts(vehicles: (Vehicle & { doc_count?: number })[]): Alert[] {
  const alerts: Alert[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const vehicle of vehicles) {
    if (vehicle.status === 'הגיע') continue;
    const name = `${vehicle.make} ${vehicle.model}`;

    if (vehicle.status === 'שולם וממתין לניירת' && !vehicle.doc_count) {
      const created = new Date(vehicle.created_at);
      created.setHours(0, 0, 0, 0);
      const daysSince = Math.floor((today.getTime() - created.getTime()) / 86400000);
      if (daysSince > 30) {
        alerts.push({
          vehicle_id: vehicle.id,
          vehicle_name: name,
          vin: vehicle.vin,
          type: 'waiting_docs',
          message: `ממתין לניירת מזה ${daysSince} ימים — לא הועלו מסמכים`,
          days_remaining: -daysSince,
          severity: daysSince > 60 ? 'critical' : 'warning',
        });
      }
    }

    if (vehicle.import_license_expiry) {
      const expiry = new Date(vehicle.import_license_expiry);
      expiry.setHours(0, 0, 0, 0);
      const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
      if (days <= 30) {
        alerts.push({
          vehicle_id: vehicle.id,
          vehicle_name: name,
          vin: vehicle.vin,
          type: 'import_license',
          message: days <= 0 ? 'רישיון ייבוא פג תוקף!' : `רישיון ייבוא פג בעוד ${days} ימים`,
          days_remaining: days,
          severity: days <= 7 ? 'critical' : days <= 14 ? 'warning' : 'info',
        });
      }
    }

    if (vehicle.manufacture_month && vehicle.manufacture_year) {
      const deadline = registrationDeadline(vehicle.manufacture_month, vehicle.manufacture_year);
      deadline.setHours(0, 0, 0, 0);
      const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
      if (days <= 60) {
        const deadlineStr = getRegistrationDeadline(vehicle.manufacture_month, vehicle.manufacture_year)!;
        alerts.push({
          vehicle_id: vehicle.id,
          vehicle_name: name,
          vin: vehicle.vin,
          type: 'registration',
          message: days <= 0
            ? `מועד רישום הרכב עבר! (${deadlineStr})`
            : `מועד רישום מתקרב — ${days} ימים נותרו (${deadlineStr})`,
          days_remaining: days,
          severity: days <= 14 ? 'critical' : days <= 30 ? 'warning' : 'info',
        });
      }
    }
  }

  return alerts.sort((a, b) => a.days_remaining - b.days_remaining);
}

export function getRegistrationDeadline(month?: number, year?: number): string | null {
  if (!month || !year) return null;
  const lastDay = new Date(year + 1, month, 0).getDate();
  return `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 1}`;
}

export function getDaysToRegistration(month?: number, year?: number): number | null {
  if (!month || !year) return null;
  const deadline = registrationDeadline(month, year);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
}
