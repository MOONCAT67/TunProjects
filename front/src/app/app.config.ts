import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';  // Import routes correctly
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),  // Provide the router and the routes
    provideClientHydration(),  // Only needed if you're doing SSR, can be omitted if not
    provideHttpClient(withFetch()),
    provideAnimations()
  ]
};
