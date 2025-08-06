import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/authService';
import { AdminService } from '../services/admin.service';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';

interface VerificationRequest {
  id: number;
  user_id: number;
  fullname: string;
  email: string;
  status: string;
  created_at: string;
  submitted_at: string;
}

interface Client {
  id: number;
  fullname: string;
  email: string;
  created_at: string;
  projects_posted: number;
  profile_picture?: string;
  is_online: boolean;
  last_activity: string;
  role: string;
  phone_number: string;
  is_verified: boolean;
  profile_description: string;
  location: string;
  jobs_count: number;
}

interface Project {
  id: number;
  title: string;
  description: string;
  budget: string;
  status: string;
  current_phase: number;
  created_at: string;
  client_name: string;
  applications_count: number;
  categories: string[];
  contract: {
    id: number;
    status: string;
    created_at: string;
  } | null;
  current_task: {
    id: number;
    title: string;
    description: string;
    status: string;
    deadline: string;
  } | null;
  accepted_application: {
    labor_price: string | null;
    materials_price: string | null;
  };
  showDetails?: boolean;
}

interface TodayStats {
  newWorkers: number;
  newProjects: number;
  totalProjects: number;
  totalUsers: number;
}

interface UserDistribution {
  workers: number;
  clients: number;
}

interface WeeklyStats {
  week: string;
  users: number;
}

interface JobCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
  is_active: number;
  workers_count: number;
  projects_count: number;
}

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  activeTab: 'dashboard' | 'requests' | 'clients' | 'projects' | 'jobs' = 'dashboard';
  verificationRequests: VerificationRequest[] = [];
  clients: Client[] = [];
  projects: Project[] = [];
  selectedRequest: any = null;
  processingNotes: string = '';
  loading: boolean = false;
  error: string | null = null;
  
  todayStats: TodayStats = {
    newWorkers: 0,
    newProjects: 0,
    totalProjects: 0,
    totalUsers: 0
  };

  userDistribution: UserDistribution = {
    workers: 0,
    clients: 0
  };

  weeklyStats: WeeklyStats[] = [];

  jobCategories: JobCategory[] = [];
  showAddJobForm: boolean = false;
  newJobCategory = {
    name: '',
    description: '',
    icon: '',
    is_active: 1
  };
  selectedIcon: File | null = null;
  iconPreview: string | null = null;

  @ViewChild('userDistributionChart') userDistributionChartRef!: ElementRef;
  @ViewChild('userGrowthChart') userGrowthChartRef!: ElementRef;
  @ViewChild('jobIconInput') jobIconInput!: ElementRef;

  private distributionChart: Chart | null = null;
  private growthChart: Chart | null = null;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router
  ) {}

  ngOnInit() {
    // Check if user is admin
    this.authService.currentUser$.subscribe(user => {
      if (!user || user.role !== 'admin') {
        this.router.navigate(['/auth']);
      } else {
        this.loadData();
      }
    });
  }

  ngAfterViewInit() {
    if (this.activeTab === 'dashboard') {
      this.initializeCharts();
    }
  }

  ngOnDestroy() {
    // Destroy charts when component is destroyed
    if (this.distributionChart) {
      this.distributionChart.destroy();
    }
    if (this.growthChart) {
      this.growthChart.destroy();
    }
  }

  loadData() {
    this.loading = true;
    this.error = null;

    switch (this.activeTab) {
      case 'dashboard':
        this.loadDashboardData();
        break;
      case 'requests':
        this.loadVerificationRequests();
        break;
      case 'clients':
        this.loadClients();
        break;
      case 'projects':
        this.loadProjects();
        break;
      case 'jobs':
        this.loadJobCategories();
        break;
    }
  }

  loadDashboardData() {
    this.loading = true;
    this.error = null;

    // Load today's statistics
    this.adminService.getTodayStats().subscribe({
      next: (response) => {
        this.todayStats = response.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load today\'s statistics';
        this.loading = false;
      }
    });

    // Load user distribution
    this.adminService.getUserDistribution().subscribe({
      next: (response) => {
        this.userDistribution = response.data;
        // Wait for the next tick to ensure DOM is ready
        setTimeout(() => {
          this.initializeCharts();
        });
      },
      error: (err) => {
        this.error = err.message || 'Failed to load user distribution';
      }
    });

    // Load weekly statistics
    this.adminService.getWeeklyStats().subscribe({
      next: (response) => {
        this.weeklyStats = response.data;
        // Wait for the next tick to ensure DOM is ready
        setTimeout(() => {
          this.initializeCharts();
        });
      },
      error: (err) => {
        this.error = err.message || 'Failed to load weekly statistics';
      }
    });
  }

  initializeCharts() {
    // Destroy existing charts before creating new ones
    if (this.distributionChart) {
      this.distributionChart.destroy();
    }
    if (this.growthChart) {
      this.growthChart.destroy();
    }

    // Initialize User Distribution Pie Chart
    if (this.userDistributionChartRef) {
      this.distributionChart = new Chart(this.userDistributionChartRef.nativeElement, {
        type: 'pie',
        data: {
          labels: ['Workers', 'Clients'],
          datasets: [{
            data: [this.userDistribution.workers, this.userDistribution.clients],
            backgroundColor: ['#FF8C00', '#FFD700'] /* Orange and Golden for slices */
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }

    // Initialize Weekly User Growth Line Chart
    if (this.userGrowthChartRef) {
      this.growthChart = new Chart(this.userGrowthChartRef.nativeElement, {
        type: 'line',
        data: {
          labels: this.weeklyStats.map(stat => stat.week),
          datasets: [{
            label: 'New Users',
            data: this.weeklyStats.map(stat => stat.users),
            borderColor: '#FF8C00', /* Orange for the line */
            tension: 0.1,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 50,
              ticks: {
                stepSize: 10
              }
            }
          }
        }
      });
    }
  }

  loadVerificationRequests() {
    this.adminService.getVerificationRequests().subscribe({
      next: (response) => {
        this.verificationRequests = response.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load verification requests';
        this.loading = false;
      }
    });
  }

  loadClients() {
    this.adminService.getAllClients().subscribe({
      next: (response) => {
        this.clients = response.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load clients';
        this.loading = false;
      }
    });
  }

  loadProjects() {
    this.adminService.getAllProjects().subscribe({
      next: (response) => {
        this.projects = response.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load projects';
        this.loading = false;
      }
    });
  }

  loadJobCategories() {
    this.adminService.getJobCategories().subscribe({
      next: (response: ApiResponse<JobCategory[]>) => {
        this.jobCategories = response.data;
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err.message || 'Failed to load job categories';
        this.loading = false;
      }
    });
  }

  viewRequestDetails(requestId: number, fullname: string, email: string) {
    this.loading = true;
    this.adminService.getRequestDetails(requestId.toString()).subscribe({
      next: (response) => {
        this.selectedRequest = {
          ...response.data,
          fullname: fullname,
          email: email
        };
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load request details';
        this.loading = false;
      }
    });
  }

  processRequest(requestId: number, action: 'approved' | 'rejected') {
    if (!this.processingNotes && action === 'rejected') {
      this.error = 'Please provide rejection notes';
      return;
    }

    this.loading = true;
    this.adminService.processVerificationRequest(
      requestId.toString(), 
      action, 
      this.processingNotes
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.selectedRequest = null;
          this.processingNotes = '';
          this.loadVerificationRequests();
          this.loading = false;
        } else {
          this.error = response.message || 'Failed to process request';
          this.loading = false;
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to process request';
        this.loading = false;
      }
    });
  }

  deleteClient(clientId: number) {
    if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      this.loading = true;
      this.adminService.deleteUser(clientId.toString()).subscribe({
        next: (response) => {
          if (response.success) {
            alert('Client deleted successfully!');
            this.loadClients(); // Reload the clients list
            this.loading = false;
          } else {
            this.error = response.message || 'Failed to delete client';
            this.loading = false;
          }
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to delete client';
          this.loading = false;
        }
      });
    }
  }

  closeRequestDetails() {
    this.selectedRequest = null;
    this.processingNotes = '';
  }

  changeTab(tab: 'dashboard' | 'requests' | 'clients' | 'projects' | 'jobs') {
    this.activeTab = tab;
    this.loadData();
  }

  getTotalProjects(): number {
    return this.clients.reduce((total, client) => total + client.projects_posted, 0);
  }

  viewClientDetails(client: Client) {
    // TODO: Implement client details view
    console.log('View client details:', client);
  }

  getInProgressCount(): number {
    return this.projects.filter(project => project.status === 'in progress').length;
  }

  getCompletedCount(): number {
    return this.projects.filter(project => project.status === 'completed').length;
  }

  toggleProjectDetails(project: Project) {
    project.showDetails = !project.showDetails;
  }

  toggleAddJobForm() {
    this.showAddJobForm = !this.showAddJobForm;
    if (!this.showAddJobForm) {
      this.resetJobForm();
    }
  }

  resetJobForm() {
    this.newJobCategory = {
      name: '',
      description: '',
      icon: '',
      is_active: 1
    };
    this.selectedIcon = null;
    this.iconPreview = null;
  }

  triggerFileInput() {
    this.jobIconInput.nativeElement.click();
  }

  onIconSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        this.error = 'File size should not exceed 2MB';
        return;
      }
      // Check file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        this.error = 'Please upload a valid image file (JPEG, JPG, PNG, SVG, GIF, or WebP)';
        return;
      }
      this.selectedIcon = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.iconPreview = e.target.result;
        this.newJobCategory.icon = e.target.result;
      };
      reader.onerror = () => {
        this.error = 'Error reading the file. Please try again.';
      };
      reader.readAsDataURL(this.selectedIcon);
    }
  }

  addJobCategory() {
    if (!this.newJobCategory.name || !this.newJobCategory.description || !this.newJobCategory.icon) {
      this.error = 'Please fill in all required fields';
      return;
    }

    this.loading = true;
    this.adminService.addJobCategory(this.newJobCategory).subscribe({
      next: (response: ApiResponse<JobCategory>) => {
        if (response.success) {
          this.loadJobCategories();
          this.toggleAddJobForm();
          this.resetJobForm();
        } else {
          this.error = response.message || 'Failed to add job category';
        }
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err.message || 'Failed to add job category';
        this.loading = false;
      }
    });
  }
}
