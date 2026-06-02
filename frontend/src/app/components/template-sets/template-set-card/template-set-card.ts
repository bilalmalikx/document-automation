import { Component, Input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TemplateSet } from '../../../models/template-set.model';

@Component({
  selector: 'app-template-set-card',
  imports: [CommonModule,RouterModule],
  templateUrl: './template-set-card.html',
  styleUrl: './template-set-card.css',
})
export class TemplateSetCard {
  @Input() templateSet!: TemplateSet;
  deleteEvent = output<string>(); 
}
