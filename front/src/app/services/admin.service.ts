import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
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

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Dashboard Statistics
  getTodayStats(): Observable<ApiResponse<TodayStats>> {
    return this.http.get<ApiResponse<TodayStats>>(`${this.apiUrl}/admin/stats/today`);
  }

  getUserDistribution(): Observable<ApiResponse<UserDistribution>> {
    return this.http.get<ApiResponse<UserDistribution>>(`${this.apiUrl}/admin/stats/distribution`);
  }

  getWeeklyStats(): Observable<ApiResponse<WeeklyStats[]>> {
    return this.http.get<ApiResponse<WeeklyStats[]>>(`${this.apiUrl}/admin/stats/weekly`);
  }

  // Verification Requests
  getVerificationRequests(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/admin/verification-requests`);
  }

  getRequestDetails(requestId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/admin/verification-requests/${requestId}`);
  }

  processVerificationRequest(requestId: string, action: string, notes: string): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/admin/verification-requests/${requestId}`, {
      action,
      notes
    });
  }

  // User Management
  getAllWorkers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/workers`);
  }

  getAllClients(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/admin/clients`);
  }

  deleteUser(userId: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/admin/users/${userId}`);
  }

  // Project Management
  getAllProjects(categoryId?: number): Observable<any> {
    const url = categoryId 
      ? `${this.apiUrl}/admin/projects?categoryId=${categoryId}`
      : `${this.apiUrl}/admin/projects`;
    return this.http.get(url);
  }

  // Job Categories
  getJobCategories() {
    return this.http.get<ApiResponse<JobCategory[]>>(`${this.apiUrl}/admin/job-categories`);
  }

  addJobCategory(jobCategory: {
    name: string;
    description: string;
    icon: string;
    is_active: number;
  }) {
    return this.http.post<ApiResponse<JobCategory>>(`${this.apiUrl}/admin/job-categories`, jobCategory);
  }

  updateJobCategory(id: string, jobCategory: Partial<JobCategory>) {
    return this.http.put<ApiResponse<JobCategory>>(`${this.apiUrl}/admin/job-categories/${id}`, jobCategory);
  }

  deleteJobCategory(id: string) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/admin/job-categories/${id}`);
  }
} 