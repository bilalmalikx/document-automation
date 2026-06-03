import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';
import { TemplatesPage } from './pages/templates-page/templates-page';
import { GeneratePage } from './pages/generate-page/generate-page';
import { TemplateDetail } from './components/templates/template-detail/template-detail';
import { HomeComponent } from './pages/home/home';
import { TemplateSets } from './pages/template-sets/template-sets';
import { TemplateSetDetailComponent } from './pages/template-set-detail/template-set-detail';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'templates', component: TemplatesPage },
  { path: 'templates/:id', component: TemplateDetail },
  { path: 'generate', component: GeneratePage },
  { path: 'rag', component: HomeComponent },
  { path: 'template-sets', component: TemplateSets },
  { path: 'template-sets/:id', component: TemplateSetDetailComponent },
  { path: '**', redirectTo: 'dashboard' },
];