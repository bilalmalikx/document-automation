import { Component } from '@angular/core';
import { ToastService } from '../../../services/toast';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.html',
  styleUrls: ['./toast.css']
})
export class Toast {
  constructor(public toastService: ToastService) {}
}