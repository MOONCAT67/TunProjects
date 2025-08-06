import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { WorkerService, CompletedProject } from '../services/worker.service';
import { AuthService } from '../services/authService';
import { ReviewService, Review, ReviewResponse } from '../services/review.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit, OnDestroy {
  profile: any = null;
  loading = true;
  error: string | null = null;
  currentUser: any = null;
  averageRating: number = 0;
  totalReviews: number = 0;
  reviews: Review[] = [];
  sortOrder: 'asc' | 'desc' = 'desc';
  protected readonly Math = Math;

  private leafletModule: any = null;
  private profileMap: any = null;

  completedProjects: CompletedProject[] = [];
  loadingProjects: boolean = false;
  projectsError: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private workerService: WorkerService,
    private authService: AuthService,
    private reviewService: ReviewService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    const workerId = this.route.snapshot.paramMap.get('workerId');
    
    if (workerId) {
      this.loadWorkerProfile(workerId);
      this.loadWorkerReviews(workerId);
      this.loadCompletedProjects();
    } else {
      this.error = 'Worker ID not provided';
      this.loading = false;
    }
  }

  ngOnDestroy() {
    if (this.profileMap) {
      this.profileMap.remove();
    }
  }

  loadWorkerProfile(workerId: string) {
    this.loading = true;
    this.error = null;

    this.workerService.getWorkerProfile(workerId).subscribe({
      next: (response) => {
        if (response.success) {
          this.profile = response.data;
          // Use raw icon string for category_icon (no sanitizer)
          if (this.profile.jobCategories) {
            this.profile.jobCategories = this.profile.jobCategories.map((cat: any) => {
              let icon = cat.category_icon;
              if (!icon) {
                icon = 'assets/default-icon.png';
              }
              return { ...cat, category_icon: icon };
            });
          }
          if (this.profile.location) {
            this.initMap(this.profile.location);
          }
        } else {
          this.error = response.message || 'Failed to load worker profile';
        }
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Failed to load worker profile';
        this.loading = false;
      }
    });
  }

  loadWorkerReviews(workerId: string) {
    this.reviewService.getWorkerReviews(parseInt(workerId)).subscribe({
      next: (response: ReviewResponse) => {
        if (response.statusCode === 200) {
          this.reviews = response.data;
          this.calculateRating();
        }
      },
      error: (error: any) => {
        console.error('Error loading reviews:', error);
      }
    });
  }

  calculateRating() {
    if (this.reviews.length > 0) {
      const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
      this.averageRating = totalRating / this.reviews.length;
      this.totalReviews = this.reviews.length;
    } else {
      this.averageRating = 0;
      this.totalReviews = 0;
    }
  }

  getVerificationStatus(): string {
    if (!this.profile) return '';
    return this.profile.is_verified ? 'Verified Worker' : 'Not Verified';
  }

  getVerificationDate(): string {
    if (!this.profile?.worker_verified_at) return '';
    return new Date(this.profile.worker_verified_at).toLocaleDateString();
  }

  getTeamInfo(): string {
    if (!this.profile) return '';
    return this.profile.teamInfo === 'solo worker' ? 'Solo Worker' : 'Team Member';
  }

  getRatingPercentage(rating: number): number {
    if (this.totalReviews === 0) return 0;
    const count = this.getRatingCount(rating);
    return (count / this.totalReviews) * 100;
  }

  getRatingCount(rating: number): number {
    return this.reviews.filter(review => review.rating === rating).length;
  }

  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    this.sortReviews();
  }

  sortReviews() {
    this.reviews.sort((a, b) => {
      if (this.sortOrder === 'desc') {
        return b.rating - a.rating;
      } else {
        return a.rating - b.rating;
      }
    });
  }

  getSortedReviews(): Review[] {
    return [...this.reviews].sort((a, b) => {
      if (this.sortOrder === 'desc') {
        return b.rating - a.rating;
      } else {
        return a.rating - b.rating;
      }
    });
  }

  async initMap(address: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.leafletModule) {
      this.leafletModule = await import('leaflet');
    }
    const L = this.leafletModule;
    const customPinIcon = L.icon({
      iconUrl: 'assets/pin.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
    let coords = this.parseCoordinates(address);
    if (!coords) {
      const geo = await this.geocodeLocation(address);
      if (!geo) return;
      coords = geo;
    }
    // Get the map container by id
    const mapContainer = document.getElementById('profile-map') || document.getElementById('profile-map-section');
    if (!mapContainer) return;
    // Remove existing map if it exists
    if (this.profileMap) {
      this.profileMap.remove();
      this.profileMap = null;
    }
    // Initialize new map
    this.profileMap = L.map(mapContainer).setView([coords.lat, coords.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.profileMap);
    const marker = L.marker([coords.lat, coords.lng], { icon: customPinIcon }).addTo(this.profileMap);
    const readableAddress = await this.reverseGeocodeLocation(coords.lat, coords.lng) || address;
    marker.bindPopup(readableAddress).openPopup();
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

  async reverseGeocodeLocation(lat: number, lng: number): Promise<string | null> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      }
      return null;
    } catch (error) {
      console.error('Error during reverse geocoding:', error);
      return null;
    }
  }

  loadCompletedProjects() {
    if (!this.profile?.id) return;
    
    this.loadingProjects = true;
    this.projectsError = null;

    this.workerService.getCompletedProjects(this.profile.id).subscribe({
      next: (response) => {
        this.completedProjects = response.data;
        this.loadingProjects = false;
      },
      error: (error) => {
        this.projectsError = 'Failed to load completed projects';
        this.loadingProjects = false;
        console.error('Error loading completed projects:', error);
      }
    });
  }
}
