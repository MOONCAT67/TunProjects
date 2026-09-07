import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClientService } from '../services/client.service';
import { WorkerService } from '../services/worker.service';
import { AuthService } from '../services/authService';
import { Router } from '@angular/router';

@Component({
  selector: 'app-postproject',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './postproject.component.html',
  styleUrls: ['./postproject.component.css']
})
export class PostprojectComponent implements OnInit, AfterViewInit {
  projectForm: FormGroup;
  availableJobs: any[] = [];
  selectedJobs: Array<{ id: number; name: string; workers_needed: number }> = [];
  isLoading = false;
  successMessageVisible = false;
  errorMessage = '';
  currentUser: any = null;
  showMapModal = false;
  selectedLocation: string = '';
  address_as_text: string = '';
  private map: any = null;
  private marker: any = null;
  private leafletModule: any = null;
  private lastLat: number | null = null;
  private lastLng: number | null = null;

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private workerService: WorkerService,
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.projectForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      budget: ['', [Validators.required, Validators.min(1)]],
      deadline: ['', [Validators.required]],
      address: ['', [Validators.required]],
      project_type: ['solo']
    });
  }

  ngOnInit() {
    this.loadJobs();
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.errorMessage = 'Please login to post a project';
      return;
    }
  }

  ngAfterViewInit() {
    // No-op: map is now initialized only when modal opens
  }

  loadJobs() {
    this.isLoading = true;
    this.workerService.getJobs().subscribe({
      next: (jobs) => {
        console.log('Jobs received:', jobs);
        this.availableJobs = jobs;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = `Failed to load jobs: ${error.message}`;
        this.isLoading = false;
      }
    });
  }

  addJob(jobName: string) {
    const jobToAdd = this.availableJobs.find(job => job.name === jobName);
    if (jobToAdd && !this.selectedJobs.some(j => j.id === jobToAdd.id)) {
      this.selectedJobs.push({
        id: jobToAdd.id,
        name: jobToAdd.name,
        workers_needed: 1
      });
      this.availableJobs = this.availableJobs.filter(job => job.id !== jobToAdd.id);
    }
  }

  removeJob(index: number) {
    const removedJob = this.selectedJobs[index];
    this.selectedJobs.splice(index, 1);
    this.workerService.getJobs().subscribe(originalJobs => {
      const jobToRestore = originalJobs.find(job => job.id === removedJob.id);
      if (jobToRestore) {
        if (!this.availableJobs.some(job => job.id === jobToRestore.id)) {
          this.availableJobs.push(jobToRestore);
        }
      }
    });
  }

  updateWorkersNeeded(index: number, count: number) {
    if (count > 0) {
      this.selectedJobs[index].workers_needed = count;
    }
  }

  onSubmit() {
    if (this.projectForm.invalid) {
      this.errorMessage = 'Please fill in all required fields correctly';
      return;
    }

    if (!this.currentUser || !this.currentUser.id) {
      this.errorMessage = 'Please login to post a project';
      return;
    }

    if (this.selectedJobs.length === 0) {
      this.errorMessage = 'Please select at least one job category';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const projectData = {
      ...this.projectForm.value,
      client_id: this.currentUser.id,
      requiredJobs: this.selectedJobs.map(job => ({ job_category_id: job.id, workers_needed: job.workers_needed }))
    };

    this.clientService.createProject(projectData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessageVisible = true;
        this.projectForm.reset();
        this.selectedJobs = [];
        this.loadJobs();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Failed to create project. Please try again.';
        console.error('Project creation error:', error);
      }
    });
  }

  async openMapModal() {
    if (isPlatformBrowser(this.platformId)) {
      this.showMapModal = true;
      await this.initMap();
    }
  }

  closeMapModal() {
    this.showMapModal = false;
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.marker = null;
    }
  }

  async initMap() {
    if (!this.leafletModule) {
      this.leafletModule = await import('leaflet');
    }
    const L = this.leafletModule;
    const pinIcon = L.icon({
      iconUrl: 'assets/pin.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
    setTimeout(() => {
      this.map = L.map('map-modal').setView([36.8065, 10.1815], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);
      this.map.on('click', (e: any) => {
        this.updateMarker(e.latlng, L, pinIcon);
      });
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 250);
    }, 50);
  }

  async selectCurrentLocation() {
    const L = this.leafletModule;
    const pinIcon = L.icon({
      iconUrl: 'assets/pin.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
    if (window.navigator && window.navigator.geolocation) {
      window.navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
          this.map?.setView(latlng, 15);
          this.updateMarker(latlng, L, pinIcon);
        },
        (error: GeolocationPositionError) => {
          alert('Could not get your location.');
        }
      );
    }
  }

  private updateMarker(latlng: any, L: any, pinIcon?: any) {
    if (this.marker) {
      this.marker.setLatLng(latlng);
    } else {
      this.marker = L.marker(latlng, { draggable: true, icon: pinIcon }).addTo(this.map!);
      this.marker.on('dragend', (e: any) => {
        const newLatLng = e.target.getLatLng();
        this.reverseGeocode(newLatLng.lat, newLatLng.lng);
      });
    }
    if (pinIcon && this.marker) {
      this.marker.setIcon(pinIcon);
    }
    this.reverseGeocode(latlng.lat, latlng.lng);
  }

  private reverseGeocode(lat: number, lng: number) {
    this.lastLat = lat;
    this.lastLng = lng;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then((response: Response) => response.json())
      .then((data: any) => {
        this.selectedLocation = data.display_name;
      })
      .catch((error: any) => {
        this.selectedLocation = `${lat}, ${lng}`;
      });
  }

  confirmLocation() {
    if (this.lastLat !== null && this.lastLng !== null) {
      const locationString = `@${this.lastLat},${this.lastLng}`;
      this.address_as_text = this.selectedLocation;
      this.projectForm.patchValue({ address: locationString });
    }
    this.closeMapModal();
  }

  goToMyProjects() {
    this.router.navigate(['/client/projects']);
  }
}
