import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkerService } from '../services/worker.service';
import { AuthService } from '../services/authService';
import { Project, ProjectApplication } from '../models/project.model';
import { TeamService } from '../services/team.service';
import type { Map, Icon } from 'leaflet';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';

interface JobCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.css']
})
export class ProjectDetailsComponent implements OnInit, OnDestroy {
  project: Project | null = null;
  applicationForm: FormGroup;
  loading = false;
  error: string | null = null;
  success = false;
  showApplicationForm = false;
  jobCategories: JobCategory[] = [];
  viewTimer: any;
  viewStartTime: number | null = null;
  isTeamLeader: boolean = false;
  teamId: number | null = null;
  private projectMap: Map | null = null;
  private projectMapIcon: Icon | null = null;
  private L: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workerService: WorkerService,
    private authService: AuthService,
    private teamService: TeamService,
    private fb: FormBuilder,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.applicationForm = this.fb.group({
      laborPrice: ['', [Validators.required, Validators.min(0)]],
      materialsPrice: ['', [Validators.required, Validators.min(0)]],
      estimatedDuration: ['', [Validators.required, Validators.min(1), Validators.max(999)]],
      workType: ['solo', Validators.required]
    });
    if (isPlatformBrowser(this.platformId)) {
      import('leaflet').then(L => {
        this.L = L;
        this.projectMapIcon = L.icon({
          iconUrl: 'assets/pin.png',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });
      });
    }
  }

  ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('id');
    if (projectId) {
      this.loadProjectDetails(projectId);
      this.viewStartTime = Date.now();
      this.loadJobCategories();
      this.checkLeadershipStatus();
    }
  }

  ngOnDestroy() {
    this.stopTimerAndSendViewData();
    if (this.projectMap) {
      this.projectMap.remove();
      this.projectMap = null;
    }
  }

  loadProjectDetails(projectId: string) {
    this.loading = true;
    this.error = null;

    this.workerService.getProjectDetails(projectId).subscribe({
      next: (project: Project) => {
        this.project = project;
        this.loading = false;
        if (isPlatformBrowser(this.platformId) && this.project.address) {
          setTimeout(() => {
            this.initializeProjectMap(this.project!.address);
          }, 100);
        }
      },
      error: (error: any) => {
        this.error = error.message || 'Failed to load project details. Please try again later.';
        this.loading = false;
        console.error('Error loading project:', error);
      }
    });
  }

  loadJobCategories() {
    this.workerService.getJobTitles().subscribe({
      next: (response) => {
        this.jobCategories = response.data;
      },
      error: (error: any) => {
        console.error('Error loading job categories:', error);
        this.error = 'Failed to load job categories. Please try again later.';
      }
    });
  }

  get formattedBudget(): string {
    if (!this.project) return '';
    return parseFloat(this.project.budget).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });
  }

  get formattedDeadline(): string {
    if (!this.project) return '';
    return new Date(this.project.deadline).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  get daysLeft(): number {
    if (!this.project) return 0;
    const deadline = new Date(this.project.deadline);
    const today = new Date();
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get projectStatus(): string {
    if (!this.project) return '';
    return this.project.status.charAt(0).toUpperCase() + this.project.status.slice(1);
  }

  get formattedCreatedAt(): string {
    if (!this.project) return '';
    return new Date(this.project.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  onSubmit() {
    if (this.applicationForm.valid && this.project) {
      this.stopTimerAndSendViewData();
      this.loading = true;
      this.error = null;
      this.success = false;

      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        this.error = 'You must be logged in to submit an application';
        this.loading = false;
        return;
      }

      const application: ProjectApplication = {
        workerId: currentUser.id,
        laborPrice: this.applicationForm.value.laborPrice,
        materialsPrice: this.applicationForm.value.materialsPrice,
        estimatedDuration: this.applicationForm.value.estimatedDuration,
        workType: this.applicationForm.value.workType,
        ...(this.isTeamLeader && this.applicationForm.value.workType === 'team' && this.teamId !== null && { teamId: this.teamId })
      };

      this.workerService.submitProjectApplication(this.project.id.toString(), application).subscribe({
        next: () => {
          this.loading = false;
          this.success = true;
          this.applicationForm.reset();
          this.applicationForm.get('workType')?.setValue('solo');
        },
        error: (error: any) => {
          this.loading = false;
          this.error = error.message || 'Failed to submit application. Please try again.';
        }
      });
    } else {
      this.markFormGroupTouched(this.applicationForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private stopTimerAndSendViewData() {
    if (this.viewTimer) {
      clearInterval(this.viewTimer);
    }

    const currentUser = this.authService.getCurrentUser();

    if (this.viewStartTime !== null && this.project && currentUser && currentUser.id && this.project.id) {
      const viewEndTime = Date.now();
      const viewDuration = Math.round((viewEndTime - this.viewStartTime) / 1000);
      
      // Extract required job category IDs
      const jobCategoryIds = this.project.required_jobs
        ? this.project.required_jobs.map(job => job.job_category_id)
        : [];

      this.workerService.trackProjectDetailView(currentUser.id, this.project.id, viewDuration, jobCategoryIds).subscribe({
        next: () => console.log('Project detail view tracked successfully'),
        error: (error) => console.error('Failed to track project detail view:', error)
      });
    }
  }

  private checkLeadershipStatus() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id) {
      this.teamService.checkIfWorkerIsLeader(currentUser.id).subscribe({
        next: (response) => {
          this.isTeamLeader = response.isLeader;
          if (response.isLeader && response.teams && response.teams.length > 0) {
            this.teamId = response.teams[0].id;
          } else if (!response.isLeader) {
            this.applicationForm.get('workType')?.setValue('solo');
            this.applicationForm.get('workType')?.disable();
          }
        },
        error: (error) => {
          console.error('Error checking leadership status:', error);
          this.isTeamLeader = false;
          this.teamId = null;
          this.applicationForm.get('workType')?.setValue('solo');
          this.applicationForm.get('workType')?.disable();
        }
      });
    }
  }

  toggleApplicationForm() {
    this.showApplicationForm = !this.showApplicationForm;
    if (!this.showApplicationForm) {
      this.applicationForm.reset();
      this.applicationForm.get('workType')?.setValue('solo');
      this.success = false;
    }
  }

  private initializeProjectMap(address: string) {
    if (!this.L || !this.projectMapIcon || !isPlatformBrowser(this.platformId)) return;

    const mapId = 'project-detail-map';
    const mapElement = document.getElementById(mapId);

    if (mapElement && !this.projectMap) {
      const coordinates = this.parseCoordinates(address);
      if (coordinates) {
        try {
          this.projectMap = this.L.map(mapId, {
            center: [coordinates.lat, coordinates.lng],
            zoom: 13,
            zoomControl: false
          });

          this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(this.projectMap);

          this.L.marker([coordinates.lat, coordinates.lng], { icon: this.projectMapIcon }).addTo(this.projectMap);
          setTimeout(() => {
            if (this.projectMap) {
              this.projectMap.invalidateSize();
            }
          }, 200);
        } catch (error) {
          console.error('Error initializing project map:', error);
        }
      }
    }
  }

  private parseCoordinates(address: string): { lat: number; lng: number } | null {
    try {
      const coords = address.replace('@', '').split(',');
      if (coords.length === 2) {
        return {
          lat: parseFloat(coords[0]),
          lng: parseFloat(coords[1])
        };
      }
    } catch (error) {
      console.error('Error parsing coordinates:', error);
    }
    return null;
  }
}
