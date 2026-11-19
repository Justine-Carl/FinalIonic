import { Injectable } from '@angular/core';
import { registerPlugin } from '@capacitor/core';

interface MediAlarmPlugin { schedule(options: { id: number; triggerAt: number; medicineName: string }): Promise<{ scheduled: boolean }>; cancel(options: { id: number }): Promise<void>; canScheduleExact(): Promise<{ allowed: boolean }>; pickSound(): Promise<{ uri: string }>; clearSound(): Promise<void>; }
const MediAlarm = registerPlugin<MediAlarmPlugin>('MediAlarm');

@Injectable({ providedIn: 'root' })
export class AlarmService {
  schedule(id: number, triggerAt: number, medicineName: string) { return MediAlarm.schedule({ id, triggerAt, medicineName }); }
  cancel(id: number) { return MediAlarm.cancel({ id }); }
  canScheduleExact() { return MediAlarm.canScheduleExact(); }
  pickSound() { return MediAlarm.pickSound(); }
  clearSound() { return MediAlarm.clearSound(); }
}
