import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClientService } from '../services/client.service';
import { AuthService } from '../services/authService';
import { ContractService } from '../services/contract.service';
import { Subscription, forkJoin, of } from 'rxjs';
import { MessagerieService } from '../services/messagerie.service';
import { tap, switchMap, catchError } from 'rxjs/operators';
import { ReviewService, ReviewPayload } from '../services/review.service';
import { PaymentService, PaymentDetails } from '../services/payment.service';

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
  coordinates?: { lat: number; lng: number };
  showReviewInput?: boolean;
  reviewComment?: string;
  reviewRating?: number;
  submittingReview?: boolean;
  reviewSuccess?: boolean;
  reviewError?: string | null;
  workerIdForReview?: number;
  deposit_paid?: number;
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
  private leafletModule: any = null;
  private maps: Map<number, any> = new Map();
  private lastPayments: { [key: number]: PaymentDetails } = {};

  constructor(
    private clientService: ClientService,
    private authService: AuthService,
    private router: Router,
    private messagerieService: MessagerieService,
    private contractService: ContractService,
    private reviewService: ReviewService,
    private paymentService: PaymentService,
    @Inject(PLATFORM_ID) private platformId: Object
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
    // Clean up maps
    this.maps.forEach(map => map.remove());
    this.maps.clear();
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
                contractStatus: undefined,
                showReviewInput: false,
                reviewComment: '',
                reviewRating: 0,
                submittingReview: false,
                reviewSuccess: false,
                reviewError: null,
                workerIdForReview: this.getWorkerIdForCompletedProject(project),
                deposit_paid: project.deposit_paid || 0
              }));
              console.log('Loaded projects:', this.projects);

              // Initialize maps for all projects after they are loaded
              this.projects.forEach(project => {
                if (project.address) {
                  this.initMap(project.id, project.address);
                }
              });

              // Fetch last payment for each project
              this.projects.forEach(project => {
                if (project.deposit_paid === 1) {
                  this.getLastPayment(project.id);
                }
              });
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
    switch (status.toLowerCase().replace(' ', '_')) {
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
    switch (status.toLowerCase().replace(' ', '_')) {
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

  getCurrentUserId(): number | null {
    const user = this.authService.getCurrentUser();
    return user ? user.id : null;
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

  async initMap(projectId: number, address: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (!this.leafletModule) {
      this.leafletModule = await import('leaflet');
    }
    const L = this.leafletModule;

    // Define custom pin icon
    const customPinIcon = L.icon({
      iconUrl: 'assets/pin.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    // Parse coordinates from address
    let coords = this.parseCoordinates(address);
    if (!coords) {
      // Try geocoding if not in @lat,lng format
      const geo = await this.geocodeLocation(address);
      if (!geo) return;
      coords = geo;
    }

    // Create map container if it doesn't exist
    const mapContainer = document.getElementById(`map-${projectId}`);
    if (!mapContainer) return;

    // Remove existing map if it exists
    if (this.maps.has(projectId)) {
      this.maps.get(projectId).remove();
      this.maps.delete(projectId);
    }

    // Initialize new map
    const map = L.map(`map-${projectId}`).setView([coords.lat, coords.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add marker with custom icon
    const marker = L.marker([coords.lat, coords.lng], { icon: customPinIcon }).addTo(map);
    
    // Reverse geocode coordinates to get a readable address for the popup
    const readableAddress = await this.reverseGeocodeLocation(coords.lat, coords.lng) || address;
    marker.bindPopup(readableAddress).openPopup();

    // Store map reference
    this.maps.set(projectId, map);
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

  getWorkerIdForCompletedProject(project: Project): number | undefined {
    if (project.status === 'completed' && project.applications) {
      const acceptedApplication = project.applications.find(app => app.status === 'accepted');
      return acceptedApplication?.worker_id;
    }
    return undefined;
  }

  toggleReviewSection(project: Project): void {
    project.showReviewInput = !project.showReviewInput;
    project.reviewComment = '';
    project.reviewRating = 0;
    project.reviewSuccess = false;
    project.reviewError = null;
  }

  setRating(project: Project, rating: number): void {
    project.reviewRating = rating;
  }

  submitReview(project: Project): void {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser?.id) {
      project.reviewError = 'Client not authenticated.';
      return;
    }

    if (!project.reviewRating || project.reviewRating === 0) {
      project.reviewError = 'Please provide a star rating.';
      return;
    }

    // Load applications if not already loaded
    if (!project.applications || project.applications.length === 0) {
      this.loadProjectApplications(project);
      project.reviewError = 'Please wait while we load the worker information...';
      return;
    }

    const workerId = this.getWorkerIdForCompletedProject(project);
    if (!workerId) {
      project.reviewError = 'Worker information not found. Please try again.';
      return;
    }

    project.submittingReview = true;
    project.reviewSuccess = false;
    project.reviewError = null;

    const payload: ReviewPayload = {
      clientId: currentUser.id,
      workerId: workerId,
      projectId: project.id,
      rating: project.reviewRating,
      comment: project.reviewComment || ''
    };

    this.reviewService.postReview(payload).subscribe({
      next: (response) => {
        console.log('Review submitted successfully:', response);
        project.reviewSuccess = true;
        project.submittingReview = false;
        project.showReviewInput = false;
        this.loadProjects();

        setTimeout(() => project.reviewSuccess = false, 3000);
      },
      error: (error) => {
        console.error('Error submitting review:', error);
        project.reviewError = error.error?.message || 'Failed to submit review.';
        project.submittingReview = false;
        setTimeout(() => project.reviewError = null, 5000);
      }
    });
  }

  payTheRest(project: Project): void {
    console.log('Pay the rest clicked for project:', project.id);
    alert(`Initiating payment for project: ${project.title}`);
  }

  getLastPayment(projectId: number): void {
    this.paymentService.getLastPayment(projectId).subscribe({
      next: (payment) => {
        if (payment.success) {
          this.lastPayments[projectId] = payment;
        }
      },
      error: (error) => {
        console.error('Error fetching payment details:', error);
      }
    });
  }

  downloadInvoice(projectId: number): void {
    const payment = this.lastPayments[projectId];
    if (!payment) {
      console.error('No payment found for this project');
      return;
    }

    this.paymentService.downloadInvoice(payment.paymentId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${projectId}-${payment.paymentId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading invoice:', error);
      }
    });
  }
}
