import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TemplateService } from '../../services/template';
import { TemplateList } from '../../components/templates/template-list/template-list';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TemplateList],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {
  // Make router public so it can be used in template
  constructor(
    public templateService: TemplateService,
    public router: Router
  ) {}

  ngOnInit() {
    this.templateService.loadTemplates();
  }

  get totalPlaceholders(): number {
    return this.templateService.templates().reduce((sum, t) => sum + t.placeholder_count, 0);
  }
}