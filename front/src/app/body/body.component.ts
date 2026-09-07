import { Component, OnInit, OnDestroy, HostListener, PLATFORM_ID, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/authService';
import { Subscription, forkJoin } from 'rxjs';
import { WorkerService, WorkerAddress, WorkerListItem } from '../services/worker.service';
import { JobCategory } from '../models/verification.model';
import { JobNumbers } from '../models/jobs-numbers.model';
import { map } from 'rxjs/operators';

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
  jobCategories: JobCategory[] = [];
  currentIndex: number = 0;
  itemsPerPage: number = 3;
  workerCounts: Map<number, number> = new Map();
  workers: WorkerListItem[] = [];

  // Map-related
  workerLocations: { id: number; fullname: string; lat: number; lng: number; location: string; profile_picture?: string; is_verified: number }[] = [];
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
    { title: 'Data Science', count: 76, icon: '📊' },
  ];

  constructor(
    private router: Router,
    public authService: AuthService,
    private workerService: WorkerService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.loadAllWorkersAndLocations();
    this.loadCategories();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  loadCategories() {
    this.workerService.getJobs().subscribe({
      next: (jobCategoriesResponse: JobCategory[]) => {
        this.jobCategories = jobCategoriesResponse;
        console.log('Loaded Job Categories:', this.jobCategories);

        const workerCountObservables = this.jobCategories.map(category =>
          this.workerService.getWorkerCountForJobCategory(category.id).pipe(
            map(workerCountData => ({ categoryId: category.id, count: workerCountData.workerCount }))
          )
        );

        forkJoin(workerCountObservables).subscribe({
          next: (counts) => {
            counts.forEach(item => {
              this.workerCounts.set(item.categoryId, item.count);
            });
            console.log('Loaded Worker Counts:', this.workerCounts);
          },
          error: (error) => {
            console.error('Failed to load worker counts:', error);
          }
        });

      },
      error: (error) => {
        console.error('Failed to load job categories:', error);
      }
    });
  }

  async loadAllWorkersAndLocations() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Immediately render base map
    this.showTunisiaMap = true;
    setTimeout(() => this.initMap(), 50);

    try {
      const allWorkers = await this.workerService.getAllWorkers().toPromise();
      if (!allWorkers) return;
      this.workers = allWorkers;

      this.workerLocations = [];
      for (const worker of allWorkers) {
        if (worker.location) {
          const coords = this.parseCoordinates(worker.location);
          if (coords) {
            this.workerLocations.push({
              id: worker.id,
              fullname: worker.fullname,
              lat: coords.lat,
              lng: coords.lng,
              location: worker.location,
              profile_picture: worker.profile_picture || 'assets/profile.jpg',
              is_verified: worker.is_verified || 0
            });
          } else {
            const geo = await this.geocodeLocation(worker.location);
            if (geo) {
              this.workerLocations.push({
                id: worker.id,
                fullname: worker.fullname,
                lat: geo.lat,
                lng: geo.lng,
                location: worker.location,
                profile_picture: worker.profile_picture || 'assets/profile.jpg',
                is_verified: worker.is_verified || 0
              });
            }
          }
        }
      }
      // Refresh map with worker markers once loaded
      this.initMap();

    } catch (error) {
      console.error('Error loading all workers and locations:', error);
    }
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
    if (!isPlatformBrowser(this.platformId)) return;
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
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 200);
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

  goToCategory(categoryId: number) {
    this.router.navigate(['/worker-page'], { queryParams: { categoryId: categoryId } });
  }

  private async getDefaultProfilePictureBase64(): Promise<string> {
    // Implementation for default profile picture (if needed)
    return ''; // Placeholder
  }

  get displayedCategories(): JobCategory[] {
    const start = this.currentIndex;
    const end = this.currentIndex + this.itemsPerPage;
    if (end <= this.jobCategories.length) {
      return this.jobCategories.slice(start, end);
    } else if (this.jobCategories.length > 0) {
      const remaining = this.jobCategories.length - this.currentIndex;
      if (remaining > 0) {
        return this.jobCategories.slice(this.currentIndex, this.currentIndex + remaining);
      } else {
        this.currentIndex = 0;
        return this.jobCategories.slice(0, this.itemsPerPage);
      }
    }
    return [];
  }

  nextCategory() {
    if (this.currentIndex + this.itemsPerPage < this.jobCategories.length) {
      this.currentIndex += 1;
    } else {
      this.currentIndex = 0;
    }
  }

  prevCategory() {
    if (this.currentIndex > 0) {
      this.currentIndex -= 1;
    } else {
      this.currentIndex = this.jobCategories.length - this.itemsPerPage;
      if (this.currentIndex < 0) this.currentIndex = 0;
    }
  }

  navigateToWorkerMessage(workerId: number, workerName: string, workerPicture: string | null) {
    this.router.navigate(['/messagerie'], { 
      queryParams: { 
        clientId: workerId,
        clientName: workerName,
        clientPicture: workerPicture || null,
        startConversation: true 
      }
    });
  }
}
