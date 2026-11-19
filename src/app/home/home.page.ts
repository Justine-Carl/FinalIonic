import { Component } from '@angular/core';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInput, IonItem, IonLabel, IonText, IonModal, IonList, IonRadioGroup, IonRadio } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward, add, settings } from 'ionicons/icons';
import { DatabaseService } from '../database.service';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AlarmService } from '../alarm.service';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar } from '@capacitor/status-bar';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInput, IonItem, IonLabel, IonText, IonModal, IonList, IonRadioGroup, IonRadio],
})
export class HomePage {
  currentTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  private readonly clockTimer = window.setInterval(() => { this.currentTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); this.cdr.detectChanges(); }, 30000);
  today = new Date();
  month = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
  selectedDate = this.toDateKey(this.today);
  weeks: (Date | null)[][] = [];
  reminders: { id?: number; name: string; date: string; time: string }[] = [];
  showForm = false; medicineName = ''; reminderDate = this.selectedDate; reminderTime = '08:00'; error = ''; editingId?: number; saving = false;

  showSettings = false; selectedSound = localStorage.getItem('medialarm.sound.mode') || 'default'; customSoundName = localStorage.getItem('medialarm.sound.name') || ''; customSoundUrl = ''; settingsStatus = ''; private previewAudio?: HTMLAudioElement;
  constructor(private readonly database: DatabaseService, private readonly alarm: AlarmService, private readonly cdr: ChangeDetectorRef, private readonly zone: NgZone) { addIcons({ chevronBack, chevronForward, add, settings }); void StatusBar.setOverlaysWebView({ overlay: false }); void StatusBar.setBackgroundColor({ color: '#0f8a4b' }); this.buildCalendar(); void this.initializeDatabase(); void App.addListener('appStateChange', ({ isActive }) => { if (isActive) void this.loadReminders(); }); }
  private async initializeDatabase() { await this.database.init(); await this.loadReminders(); }
  ionViewDidEnter() { void this.loadReminders(); }
  private async loadReminders() { const rows = await this.database.listByDate(this.selectedDate); this.zone.run(() => { this.reminders = rows.map(r => ({ id: r.id, name: r.medicine_name, date: r.reminder_date, time: r.reminder_time })); this.cdr.detectChanges(); }); }
  get monthLabel() { return this.month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
  buildCalendar() { const first = new Date(this.month.getFullYear(), this.month.getMonth(), 1); const start = first.getDay(); const days = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0).getDate(); const cells: (Date | null)[] = Array(start).fill(null); for (let d = 1; d <= days; d++) cells.push(new Date(this.month.getFullYear(), this.month.getMonth(), d)); while (cells.length % 7) cells.push(null); this.weeks = []; for (let i = 0; i < cells.length; i += 7) this.weeks.push(cells.slice(i, i + 7)); }
  previousMonth() { this.month = new Date(this.month.getFullYear(), this.month.getMonth() - 1, 1); this.buildCalendar(); }
  nextMonth() { this.month = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 1); this.buildCalendar(); }
  toDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  isPast(date: Date) { return this.toDateKey(date) < this.toDateKey(this.today); }
  select(date: Date | null) { if (date && !this.isPast(date)) { this.selectedDate = this.toDateKey(date); this.reminderDate = this.selectedDate; void this.loadReminders(); } }
  openForm() { this.error = ''; this.editingId = undefined; this.medicineName = ''; this.reminderDate = this.selectedDate; this.reminderTime = '08:00'; this.showForm = true; }
  editReminder(reminder: { id?: number; name: string; date: string; time: string }) { this.error = ''; this.editingId = reminder.id; this.medicineName = reminder.name; this.reminderDate = reminder.date; this.reminderTime = reminder.time; this.showForm = true; }
  cancelForm() { this.showForm = false; this.error = ''; }
  async saveReminder() { if (this.saving) return; this.saving = true; try { const name = this.medicineName.trim(); if (!name || !this.reminderDate || !this.reminderTime) { this.error = 'Complete all fields.'; return; } const chosen = new Date(`${this.reminderDate}T${this.reminderTime}`); if (isNaN(chosen.getTime()) || chosen <= new Date()) { this.error = 'Choose a future date and time.'; return; } let id = this.editingId; if (id) { await this.alarm.cancel(id); await this.database.update({ id, medicine_name: name, reminder_date: this.reminderDate, reminder_time: this.reminderTime }); } else { await this.database.insert({ medicine_name: name, reminder_date: this.reminderDate, reminder_time: this.reminderTime }); const savedRows = await this.database.listByDate(this.reminderDate); id = savedRows.find(row => row.medicine_name === name && row.reminder_time === this.reminderTime)?.id; } if (!id) throw new Error('Reminder saved but no database ID was returned.'); await this.alarm.schedule(id, chosen.getTime(), name); this.zone.run(() => { this.selectedDate = this.reminderDate; }); await this.loadReminders(); this.showForm = false; this.error = ''; } catch (e) { console.error('MediAlarm save/schedule failed', e); this.error = `Could not schedule reminder: ${e instanceof Error ? e.message : String(e)}`; } finally { this.saving = false; this.cdr.detectChanges(); } }
  async deleteReminder(id?: number) { if (!id || !confirm('Delete this reminder?')) return; this.zone.run(() => { this.reminders = this.reminders.filter(r => r.id !== id); this.cdr.detectChanges(); }); await this.database.remove(id); try { await this.alarm.cancel(id); } catch (e) { console.warn('Alarm cancel failed after database delete', e); } await this.loadReminders(); }
  remindersForSelectedDate() { return this.reminders.filter(r => r.date === this.selectedDate); }
  onSoundModeChange(mode: string) { this.selectedSound = mode; localStorage.setItem('medialarm.sound.mode', mode); }
  async chooseMp3() { this.settingsStatus = 'Opening Android sound picker…'; if (Capacitor.isNativePlatform()) { try { const picked = await this.alarm.pickSound(); this.selectedSound = 'custom'; this.customSoundName = picked.uri.split('/').pop() || 'Custom MP3'; this.settingsStatus = `Selected ${this.customSoundName}`; localStorage.setItem('medialarm.sound.mode', 'custom'); localStorage.setItem('medialarm.sound.name', this.customSoundName); this.cdr.detectChanges(); return; } catch { this.settingsStatus = 'Native picker unavailable; opening file picker…'; } } document.querySelector<HTMLInputElement>('#mp3-picker')?.click(); }
  chooseMp3File(input?: HTMLInputElement) { const file = input?.files?.[0]; if (!file) return; if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') { this.settingsStatus = 'Please choose an MP3 file.'; return; } if (this.customSoundUrl) URL.revokeObjectURL(this.customSoundUrl); this.customSoundUrl = URL.createObjectURL(file); this.customSoundName = file.name; this.selectedSound = 'custom'; this.settingsStatus = `Selected ${file.name}`; localStorage.setItem('medialarm.sound.mode', 'custom'); localStorage.setItem('medialarm.sound.name', file.name); }
  previewSound() { const src = this.selectedSound === 'custom' && this.customSoundUrl ? this.customSoundUrl : undefined; if (!src) { this.settingsStatus = 'Select a custom MP3 first.'; return; } if (this.previewAudio) this.previewAudio.pause(); this.previewAudio = new Audio(src); void this.previewAudio.play().then(() => this.settingsStatus = 'Playing preview…').catch(() => this.settingsStatus = 'Tap Preview again to allow audio.'); }
  async testVibration() { this.settingsStatus = 'Vibration test sent.'; try { await Haptics.vibrate({ duration: 700 }); } catch { if (navigator.vibrate) navigator.vibrate(700); } }
  async restoreDefaultSound() { if (this.customSoundUrl) URL.revokeObjectURL(this.customSoundUrl); if (Capacitor.isNativePlatform()) { try { await this.alarm.clearSound(); } catch { } } this.customSoundUrl = ''; this.customSoundName = ''; this.selectedSound = 'default'; this.settingsStatus = 'Default alarm sound restored.'; localStorage.removeItem('medialarm.sound.mode'); localStorage.removeItem('medialarm.sound.name'); }
}
