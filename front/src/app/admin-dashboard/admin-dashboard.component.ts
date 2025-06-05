import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/authService';
import { AdminService } from '../services/admin.service';
import { FormsModule } from '@angular/forms';

interface VerificationRequest {
  id: number;
  user_id: number;
  fullname: string;
  email: string;
  status: string;
  created_at: string;
}

interface Client {
  id: number;
  fullname: string;
  email: string;
  created_at: string;
  projects_posted: number;
}

interface Project {
  id: number;
  title: string;
  client_name: string;
  applications: number;
  categories: string;
  created_at: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  activeTab: 'requests' | 'clients' | 'projects' = 'requests';
  verificationRequests: VerificationRequest[] = [];
  clients: Client[] = [];
  projects: Project[] = [];
  selectedRequest: any = null;
  processingNotes: string = '';
  loading: boolean = false;
  error: string | null = null;

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

  loadData() {
    this.loading = true;
    this.error = null;

    switch (this.activeTab) {
      case 'requests':
        this.loadVerificationRequests();
        break;
      case 'clients':
        this.loadClients();
        break;
      case 'projects':
        this.loadProjects();
        break;
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

  viewRequestDetails(requestId: number) {
    this.loading = true;
    this.adminService.getRequestDetails(requestId.toString()).subscribe({
      next: (response) => {
        this.selectedRequest = response.data;
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

  closeRequestDetails() {
    this.selectedRequest = null;
    this.processingNotes = '';
  }

  changeTab(tab: 'requests' | 'clients' | 'projects') {
    this.activeTab = tab;
    this.loadData();
  }
}
