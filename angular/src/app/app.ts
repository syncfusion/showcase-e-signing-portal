import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './state/theme.service';
import { AppLoadingComponent } from './shared/states';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppLoadingComponent],
  template: `
    <!-- Startup screen until the Syncfusion theme has loaded; the shell mounts underneath so page code downloads meanwhile. -->
    @if (!theme.ready()) { <app-loading variant="screen" label="Loading E-Signing Portal…" /> }
    <router-outlet />`,
  host: { style: 'display: block; height: 100%' },
})
export class App {
  protected readonly theme = inject(ThemeService);
}
