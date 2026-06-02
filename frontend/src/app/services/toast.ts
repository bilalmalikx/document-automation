import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<ToastMessage[]>([]);
  private nextId = 0;

  show(type: 'success' | 'error' | 'info', title: string, message: string): void {
    const id = this.nextId++;
    const toast = { id, type, title, message };
    this.toasts.update(t => [...t, toast]);
    setTimeout(() => {
      this.toasts.update(t => t.filter(tm => tm.id !== id));
    }, 4500);
  }

  success(title: string, message: string): void {
    this.show('success', title, message);
  }

  error(title: string, message: string): void {
    this.show('error', title, message);
  }

  info(title: string, message: string): void {
    this.show('info', title, message);
  }
}