import { Component, OnInit, AfterViewInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WorkerService } from '../services/worker.service';
import { Project } from '../models/project.model';
import type { Map, Icon } from 'leaflet';
import { AuthService } from '../services/authService';

@Component({
  selector: 'app-worker-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './worker-page.component.html',
  styleUrl: './worker-page.component.css'
})
export class WorkerPageComponent implements OnInit, AfterViewInit, OnDestroy {
  projects: any[] = [];
  loading = false;
  error: string | null = null;
  availableJobCategories: any[] = [];
  originalProjects: any[] = [];
  selectedFilterJobId: number | null = null;
  private maps: { [key: string]: Map } = {};
  private customIcon: Icon | null = null;
  private mapInitializationTimeout: any;
  private L: any;

  constructor(
    private workerService: WorkerService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      import('leaflet').then(L => {
        this.L = L;
        this.customIcon = L.icon({
          iconUrl: 'assets/pin.png',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });
      });
    }
  }

  ngOnInit() {
    this.loadAvailableProjects();
    this.loadJobCategories();
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.mapInitializationTimeout = setTimeout(() => {
        this.initializeMaps();
      }, 2000);
    }
  }

  ngOnDestroy() {
    if (this.mapInitializationTimeout) {
      clearTimeout(this.mapInitializationTimeout);
    }
    if (isPlatformBrowser(this.platformId)) {
      Object.values(this.maps).forEach(map => {
        if (map) {
          map.remove();
        }
      });
    }
  }

  loadAvailableProjects() {
    this.loading = true;
    this.error = null;

    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id) {
      this.workerService.getAvailableProjects(currentUser.id).subscribe({
      next: (response) => {
        console.log('API Response:', response);
        if (Array.isArray(response)) {
            this.originalProjects = response;
        } else if (response && response.data) {
            this.originalProjects = response.data;
        } else {
            this.originalProjects = [];
        }
          this.projects = [...this.originalProjects];
        console.log('Projects array:', this.projects);
        this.loading = false;
        
        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            this.initializeMaps();
          }, 2000);
        }
      },
      error: (error) => {
        console.error('Error loading projects:', error);
        this.error = 'Failed to load available projects. Please try again later.';
        this.loading = false;
      }
    });
    } else {
      this.error = 'User not logged in. Cannot load projects.';
      this.loading = false;
    }
  }

  private initializeMaps() {
    if (!this.L || !isPlatformBrowser(this.platformId)) return;

    console.log('Initializing maps for projects:', this.projects);
    this.projects.forEach(project => {
      console.log('Processing project:', project);
      if (project.address) {
        const coordinates = this.parseCoordinates(project.address);
        console.log('Parsed coordinates:', coordinates);
        if (coordinates) {
          this.createMap(project.id, coordinates.lat, coordinates.lng);
        }
      }
    });
  }

  private parseCoordinates(address: string): { lat: number; lng: number } | null {
    try {
      console.log('Parsing address:', address);
      const coords = address.replace('@', '').split(',');
      console.log('Split coordinates:', coords);
      if (coords.length === 2) {
        const result = {
          lat: parseFloat(coords[0]),
          lng: parseFloat(coords[1])
        };
        console.log('Parsed result:', result);
        return result;
      }
    } catch (error) {
      console.error('Error parsing coordinates:', error);
    }
    return null;
  }

  private createMap(projectId: number, lat: number, lng: number) {
    if (!this.L || !this.customIcon || !isPlatformBrowser(this.platformId)) return;

    const mapId = `map-${projectId}`;
    console.log('Creating map with ID:', mapId);
    if (this.maps[mapId]) {
      this.maps[mapId].remove();
      delete this.maps[mapId];
    }
    const mapElement = document.getElementById(mapId);
    
    if (mapElement && !this.maps[mapId]) {
      try {
        console.log('Map element found, creating map');
        const map = this.L.map(mapId, {
          center: [lat, lng],
          zoom: 13,
          zoomControl: false
        });
        
        this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        this.L.marker([lat, lng], { icon: this.customIcon }).addTo(map);

        this.maps[mapId] = map;
        setTimeout(() => {
          if (map) {
            map.invalidateSize();
          }
        }, 200);
        console.log('Map created successfully');
      } catch (error) {
        console.error('Error creating map:', error);
      }
    } else {
      console.log('Map element not found or map already exists');
    }
  }

  loadJobCategories() {
    this.workerService.getJobs().subscribe({
      next: (categories) => {
        this.availableJobCategories = categories;
      },
      error: (error) => {
        console.error('Failed to load job categories:', error);
      }
    });
  }

  onJobFilterChange(event: any) {
    const selectedId = event.target.value ? parseInt(event.target.value, 10) : null;

    this.selectedFilterJobId = selectedId;

    // Track the filter selection
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && selectedId !== null) { // Track if a specific job category is selected
      this.workerService.trackJobFilter(currentUser.id, selectedId).subscribe({
        next: () => console.log('Job filter tracked successfully'),
        error: (error) => console.error('Failed to track job filter:', error)
      });
    }

    // Apply the filter to projects
    this.applyProjectFilter();
  }

  applyProjectFilter() {
    if (this.selectedFilterJobId === null) {
      this.projects = [...this.originalProjects];
    } else {
      this.projects = this.originalProjects.filter(project =>
        project.required_jobs.some((job: any) => job.id === this.selectedFilterJobId)
      );
    }

    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.initializeMaps();
      }, 100);
    }
  }
}
