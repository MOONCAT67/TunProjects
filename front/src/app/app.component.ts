import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';


// importe tes composants si nécessaire
import { NavbarComponent } from './navbar/navbar.component';
import { FooterComponent } from './footer/footer.component';
import { AuthComponent } from './auth/auth.component';
import { PainterComponent } from './painter/painter.component';
import { BodyComponent } from './body/body.component'; // ✅ ajoute ça en haut
import { BuildingComponent } from './building/building.component';
import { ElectricianComponent } from './electrician/electrician.component';
import { CarpenterComponent } from './carpenter/carpenter.component';
import { TilierComponent } from './tilier/tilier.component';
import { PostprojectComponent } from './postproject/postproject.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, AuthComponent, PainterComponent, BodyComponent, BuildingComponent, ElectricianComponent, CarpenterComponent, TilierComponent, PostprojectComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'pfe1';

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
