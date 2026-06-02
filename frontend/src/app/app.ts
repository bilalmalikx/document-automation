import { Component, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './components/layout/sidebar/sidebar';
import { Header } from './components/layout/header/header';
import { Toast } from './components/shared/toast/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Header, Toast],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  constructor() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme !== 'light';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }
}