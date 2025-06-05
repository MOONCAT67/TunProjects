import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClientService } from '../services/client.service';
import { AuthService } from '../services/authService';
import { ContractService } from '../services/contract.service';
import { Subscription, forkJoin, of } from 'rxjs';
import { MessagerieService } from '../services/messagerie.service';
import { tap, switchMap, catchError } from 'rxjs/operators';

interface Project {
  id: number;
  title: string;
  description: string;
  budget: number;
  deadline: string;
  address: string;
  status: string;
  showApplications?: boolean;
  applications?: any[];
  hasContract?: boolean;
  contractId?: number;
  contractStatus?: string;
}

@Component({
  selector: 'app-client-projects',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-projects.component.html',
  styleUrls: ['./client-projects.component.css']
})
export class ClientProjectsComponent implements OnInit, OnDestroy {
  projects: Project[] = [];
  loading: boolean = true;
  error: string | null = null;
  private authSubscription: Subscription | null = null;
  openMessageAppId: number | null = null;
  messageInputs: { [appId: number]: string } = {};
  messageStatus: { [appId: number]: 'success' | 'error' | null } = {};
  isSendingMessage: { [appId: number]: boolean } = {};

  constructor(
    private clientService: ClientService,
    private authService: AuthService,
    private router: Router,
    private messagerieService: MessagerieService,
    private contractService: ContractService
  ) {}

  ngOnInit() {
    // Subscribe to auth state changes
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      if (!user) {
        this.router.navigate(['/auth']);
        return;
      }
      this.loadProjects();
    });
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  loadProjects() {
    const user = this.authService.getCurrentUser();
    if (!user || !user.id) {
      this.error = 'User not authenticated';
      this.loading = false;
      return;
    }

    console.log('Loading projects for user:', user.id);

    this.clientService.getClientProjects(user.id.toString()).pipe(
        tap((response: any) => {
            console.log('Projects response:', response);
            if (response.data) {
              this.projects = response.data.map((project: Project) => ({
                ...project,
                showApplications: false,
                applications: [],
                hasContract: false,
                contractId: undefined,
                contractStatus: undefined
              }));
              console.log('Loaded projects:', this.projects);
            } else {
              this.projects = [];
            }
            this.loading = false;
        }),
        switchMap(() => {
            if (this.projects.length > 0) {
                const contractChecks = this.projects.map(project =>
                    this.contractService.checkContractExists(project.id).pipe(
                        tap(response => {
                            if (response.data?.hasContract) {
                                const localProject = this.projects.find(p => p.id === project.id);
                                if (localProject) {
                                    localProject.hasContract = true;
                                    localProject.contractId = response.data.contractId;
                                    localProject.contractStatus = response.data.status;
                                }
                            }
                        }),
                        catchError(err => {
                            console.error(`Error checking contract for project ${project.id}:`, err);
                            return of(null);
                        })
                    )
                );
                return forkJoin(contractChecks);
            } else {
                return of([]);
            }
        })
    ).subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading projects or checking contracts:', err);
        this.error = err.message || 'Failed to load projects or check contract status';
        this.loading = false;
      }
    });
  }

  toggleApplications(project: Project) {
    console.log('Toggling applications for project:', project);
    project.showApplications = !project.showApplications;
    if (project.showApplications && (!project.applications || project.applications.length === 0)) {
      this.loadProjectApplications(project);
    }
  }

  loadProjectApplications(project: Project) {
    const user = this.authService.getCurrentUser();
    if (!user || !user.id) return;

    this.clientService.getProjectApplications(project.id.toString(), user.id.toString()).subscribe({
      next: (response: any) => {
        if (response.data) {
          project.applications = [...response.data];
          console.log('Loaded applications for project:', project.applications);
        }
      },
      error: (err) => {
        console.error('Error loading applications:', err);
      }
    });
  }

  acceptApplication(projectId: number, applicationId: number) {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      this.error = 'You must be logged in to accept applications';
      return;
    }

    this.clientService.acceptApplication(projectId.toString(), applicationId.toString()).subscribe({
      next: (response) => {
        // Update the application status in the UI
        const project = this.projects.find(p => p.id === projectId);
        if (project && project.applications) {
          const application = project.applications.find(a => a.id === applicationId);
          if (application) {
            application.status = 'accepted';
            application.display_status = 'Accepted';
            // Update project status to in progress
            project.status = 'in progress';
          }
        }
      },
      error: (err) => {
        console.error('Error accepting application:', err);
        this.error = err.message || 'Failed to accept application. Please try again.';
      }
    });
  }

  openMessageModal(application: any) {
    this.openMessageAppId = application.id;
    if (!this.messageInputs[application.id]) {
      this.messageInputs[application.id] = '';
    }
    this.messageStatus[application.id] = null;
  }

  sendMessageToWorker(application: any) {
    const userStr = localStorage.getItem('currentUser');
    const senderId = userStr ? JSON.parse(userStr).id : null;
    const receiverId = application.worker_id;
    const message = this.messageInputs[application.id]?.trim();
    if (!senderId || !receiverId || !message) return;
    this.isSendingMessage[application.id] = true;
    this.messagerieService.sendMessage(senderId, receiverId, message).subscribe({
      next: () => {
        this.messageStatus[application.id] = 'success';
        this.messageInputs[application.id] = '';
        this.isSendingMessage[application.id] = false;
      },
      error: () => {
        this.messageStatus[application.id] = 'error';
        this.isSendingMessage[application.id] = false;
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'status-completed';
      case 'in_progress':
        return 'status-in-progress';
      case 'pending':
        return 'status-pending';
      default:
        return 'status-pending';
    }
  }

  getStatusText(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'Under Work';
      case 'pending':
        return 'Pending';
      default:
        return 'Pending';
    }
  }

  getApplicationStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'accepted':
        return 'status-completed';
      case 'rejected':
        return 'status-pending';
      default:
        return '';
    }
  }

  navigateToContract(projectId: number, action: 'create' | 'modify' | 'download'): void {
    switch (action) {
      case 'create':
        this.router.navigate(['/contract', projectId]);
        break;
      case 'modify':
        this.router.navigate(['/contract', projectId], { queryParams: { action: 'modify' } });
        break;
      case 'download':
        this.downloadContract(projectId);
        break;
    }
  }

  downloadContract(projectId: number): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      alert('You must be logged in to download the contract.');
      return;
    }

    const project = this.projects.find(p => p.id === projectId);
    if (!project?.contractId) {
      alert('Contract not found for this project.');
      return;
    }

    this.contractService.downloadContract(project.contractId, currentUser.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `contract-${projectId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading contract:', error);
        alert('Failed to download contract. Please try again.');
      }
    });
  }

  getTotalPrice(application: any): number {
    const labor = parseFloat(application.labor_price) || 0;
    const materials = parseFloat(application.materials_price) || 0;
    return labor + materials;
  }

  formatCurrency(value: any): string {
    const numericValue = parseFloat(value);
    return `$${!isNaN(numericValue) ? numericValue.toFixed(2) : '0.00'}`;
  }

  formatDuration(duration: string): string {
    const parts = duration.match(/(\d+)\s*days\s*(\d+)\s*hours/i);
    if (parts) {
      const days = parseInt(parts[1], 10);
      const hours = parseInt(parts[2], 10);
      let result = '';
      if (days > 0) {
        result += `${days} day${days > 1 ? 's' : ''}`;
      }
      if (hours > 0) {
        if (days > 0) result += ' and ';
        result += `${hours} hour${hours > 1 ? 's' : ''}`;
      }
      return result || duration;
    }
    return duration;
  }

  calculateDurationInDays(duration: string): string {
     const parts = duration.match(/(\d+)\s*days/i);
     if (parts && parts[1]) {
         return parts[1];
     }
     return '0';
  }

  navigateToWorkerProfile(workerId: number) {
    this.router.navigate(['/profile', workerId]);
  }
}
