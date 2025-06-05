import { Component, OnInit, OnDestroy, HostListener, PLATFORM_ID, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/authService';
import { Subscription } from 'rxjs';
import { WorkerService, WorkerAddress } from '../services/worker.service';

@Component({
  selector: 'app-body',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './body.component.html',
  styleUrls: ['./body.component.css']
})
export class BodyComponent implements OnInit, OnDestroy {
  currentUser: any = null;
  private authSubscription: Subscription | null = null;
  isVisible = false;

  // Map-related
  workerLocations: { id: number; fullname: string; lat: number; lng: number; location: string }[] = [];
  showTunisiaMap = false;
  private leafletModule: any = null;
  private map: any = null;
  private circles: any[] = [];

  // Worker-specific data
  workerStats = {
    completedProjects: 12,
    rating: 4.8,
    earnings: 2500,
    activeProjects: 3
  };

  topWorkers = [
    { name: 'John Doe', rating: 4.9, projects: 45, image: 'assets/worker1.jpg' },
    { name: 'Jane Smith', rating: 4.8, projects: 38, image: 'assets/worker2.jpg' },
    { name: 'Mike Johnson', rating: 4.7, projects: 32, image: 'assets/worker3.jpg' }
  ];

  trendingProjects = [
    { title: 'Web Development', count: 156, icon: '💻' },
    { title: 'Mobile Apps', count: 98, icon: '📱' },
    { title: 'UI/UX Design', count: 87, icon: '🎨' },
    { title: 'Data Science', count: 76, icon: '📊' }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private workerService: WorkerService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.loadWorkerLocations();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  async loadWorkerLocations() {
    if (!isPlatformBrowser(this.platformId)) return;
    const addresses = await this.workerService.getWorkerAddresses().toPromise();
    this.workerLocations = [];
    if (!addresses) return;
    for (const worker of addresses) {
      // Try to parse coordinates from @lat,lng format
      const coords = this.parseCoordinates(worker.location);
      if (coords) {
        this.workerLocations.push({
          id: worker.id,
          fullname: worker.fullname,
          lat: coords.lat,
          lng: coords.lng,
          location: worker.location
        });
      } else {
        // fallback to geocoding if not in @lat,lng format
        const geo = await this.geocodeLocation(worker.location);
        if (geo) {
          this.workerLocations.push({
            id: worker.id,
            fullname: worker.fullname,
            lat: geo.lat,
            lng: geo.lng,
            location: worker.location
          });
        }
      }
    }
    this.showTunisiaMap = true;
    setTimeout(() => this.initMap(), 0);
  }

  parseCoordinates(location: string): { lat: number, lng: number } | null {
    if (!location) return null;
    const match = location.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2])
      };
    }
    return null;
  }

  async geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch {
      return null;
    }
  }

  async initMap() {
    if (!this.leafletModule) {
      this.leafletModule = await import('leaflet');
    }
    const L = this.leafletModule;

    // Define custom pin icon
    const workerIcon = L.icon({
      iconUrl: 'assets/pin.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.map = L.map('tunisia-map').setView([34.0, 9.0], 6.3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    this.circles = [];
    for (const worker of this.workerLocations) {
      const marker = L.marker([worker.lat, worker.lng], { icon: workerIcon }).addTo(this.map).bindPopup(worker.fullname + '<br>' + worker.location);
      const circle = L.circle([worker.lat, worker.lng], {
        radius: 10000,
        color: '#ff8500',
        fillColor: '#ff8500',
        fillOpacity: 0.18
      }).addTo(this.map);
      this.circles.push(circle);
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (isPlatformBrowser(this.platformId)) {
      const section = document.querySelector('.work-project-container');
      if (section) {
        const rect = section.getBoundingClientRect();
        this.isVisible = rect.top <= window.innerHeight - 100;
      }
    }
  }

  getRatingStars(rating: number): string[] {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push('★');
    }
    if (hasHalfStar) {
      stars.push('★');
    }
    while (stars.length < 5) {
      stars.push('☆');
    }
    return stars;
  }

  goToAuth() {
    this.router.navigate(['/auth']);
  }

  goToBuilding() {
    this.router.navigate(['/building']);  
  }

  goToPlumber() {
    this.router.navigate(['/plumber']);
  }

  goToCarpenter() {
    this.router.navigate(['/carpenter']);  
  }

  goToPainter() {
    this.router.navigate(['/painter']);
  }

  goToTilier() {
    this.router.navigate(['/tilier']);  
  }

  goToElectrician() {
    this.router.navigate(['/electrician']);
  }

  private async getDefaultProfilePictureBase64(): Promise<string> {
    const response = await fetch('assets/profile.jpg');
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
