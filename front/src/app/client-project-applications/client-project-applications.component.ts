import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { ClientService } from '../services/client.service';
import { AuthService } from '../services/authService';
import { Subscription } from 'rxjs';

interface ProjectApplication {
  id: number;
  project_id: number;
  worker_id: number;
  job_category_id: number;
  status: string;
  fullname: string;
  profile_picture: string;
  profile_description: string;
  job_category_name: string;
  display_status: string;
}

@Component({
  selector: 'app-client-project-applications',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './client-project-applications.component.html',
  styleUrls: ['./client-project-applications.component.css']
})
export class ClientProjectApplicationsComponent implements OnInit, OnDestroy {
  applications: ProjectApplication[] = [];
  projectId: string = '';
  loading: boolean = true;
  error: string | null = null;
  private authSubscription: Subscription | null = null;

  constructor(
    private clientService: ClientService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Get project ID from route params
    this.route.params.subscribe(params => {
      this.projectId = params['projectId'];
      this.loadApplications();
    });

    // Subscribe to auth state changes
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      if (!user) {
        this.router.navigate(['/auth']);
        return;
      }
      
      if (user.role !== 'client') {
        this.error = 'Access denied. Client access only.';
        this.loading = false;
        return;
      }
    });
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  loadApplications() {
    const user = this.authService.getCurrentUser();
    if (!user || !user.id) {
      this.error = 'User not authenticated';
      this.loading = false;
      return;
    }

    this.clientService.getProjectApplications(this.projectId, user.id.toString()).subscribe({
      next: (response: any) => {
        if (response.data) {
          this.applications = response.data;
        } else {
          this.applications = [];
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load applications';
        this.loading = false;
      }
    });
  }

  acceptApplication(applicationId: string) {
    const user = this.authService.getCurrentUser();
    if (!user || !user.id) {
      this.error = 'User not authenticated';
      return;
    }

    this.clientService.acceptApplication(this.projectId, applicationId).subscribe({
      next: (response: any) => {
        // Reload applications after accepting
        this.loadApplications();
        // Reload the entire page
        window.location.reload();
      },
      error: (err) => {
        this.error = err.message || 'Failed to accept application';
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'accepted':
        return 'status-accepted';
      case 'pending':
        return 'status-pending';
      default:
        return 'status-rejected';
    }
  }

  getStatusText(status: string): string {
    switch (status.toLowerCase()) {
      case 'accepted':
        return 'Accepted';
      case 'pending':
        return 'Pending';
      default:
        return 'Rejected';
    }
  }
}
