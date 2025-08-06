import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './authService';

interface Project {
  id: number;
  title: string;
  description: string;
  budget: number;
  client_id: number;
  deadline: string;
  address: string;
  project_type: string;
  application_count?: number;
  employer_name?: string;
}

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

interface CreateProjectParams {
  title: string;
  description: string;
  budget: number;
  deadline: string;
  address: string;
  project_type?: string;
  client_id?: number;
  requiredJobs?: Array<{
    job_category_id: number;
    workers_needed?: number;
  }>;
}

interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data?: T;
  projectId?: number;
}

export interface ClientProject {
  id: number;
  title: string;
  description: string;
  budget: string;
  status: string;
  created_at: string;
  completion_date: string | null;
  project_type: string;
  current_progress: number;
  current_phase: number;
  total_applications: number;
  total_contracts: number;
}

export interface ClientStatistics {
  totalProjects: number;
  completedProjects: number;
  activeProjects: number;
  totalSpent: number;
  averageRating: number;
  totalReceivedReviews: number;
  totalGivenReviews: number;
}

export interface ClientProfile {
  id: number;
  fullname: string;
  profile_picture: string | null;
  phone_number: string;
  email: string;
  created_at: string;
  role: string;
  profile_description: string | null;
  location: string;
  is_verified: number;
  is_online: number;
  last_activity: string;
  projects: ClientProject[];
  receivedReviews: any[];
  givenReviews: any[];
  statistics: ClientStatistics;
}

interface ClientProfileResponse {
  statusCode: number;
  data: ClientProfile;
}

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      errorMessage = error.error?.message || error.message || 'Server error occurred';
    }
    
    return throwError(() => ({ message: errorMessage, status: error.status }));
  }

  createProject(params: CreateProjectParams): Observable<{ projectId: number }> {
    if (!params.client_id) {
      return throwError(() => new Error('Client ID is required'));
    }

    // Restructure the data to match backend expectations
    const requestData = {
      ...params,
      user: {
        id: params.client_id
      }
    };
    // Remove the direct client_id as it will be set by the backend
    delete requestData.client_id;

    return this.http.post<ApiResponse<{ projectId: number }>>(`${this.apiUrl}/client/projects`, requestData).pipe(
      map(response => {
        if (response.projectId) {
          return { projectId: response.projectId };
        }
        throw new Error('Invalid response format');
      }),
      catchError(this.handleError)
    );
  }

  getClientProjects(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/client/projects?userId=${userId}`);
  }

  getProjectApplications(projectId: string, userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/client/projects/${projectId}/applications?userId=${userId}`);
  }

  acceptApplication(projectId: string, applicationId: string): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      return throwError(() => new Error('User not authenticated'));
    }

    const body = {
      user: {
        id: currentUser.id
      }
    };
    return this.http.put(`${this.apiUrl}/client/projects/${projectId}/applications/${applicationId}/accept`, body);
  }

  /**
   * Gets the client's profile information including projects and statistics
   * @param userId The ID of the client
   * @returns Observable with the client's profile data
   */
  getClientProfile(userId: number): Observable<ClientProfileResponse> {
    const headers = this.getHeaders();
    return this.http.get<ClientProfileResponse>(`${this.apiUrl}/client/${userId}/profile`, { headers }).pipe(
      catchError(error => {
        console.error(`Error fetching client profile for user ${userId}:`, error);
        return throwError(() => error);
      })
    );
  }

  updateProfilePicture(userId: number, profilePicture: string): Observable<any> {
    const headers = this.getHeaders();
    const body = { profilePicture };
    return this.http.put(`${this.apiUrl}/client/${userId}/profile-picture`, body, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  updateFullName(userId: number, fullname: string): Observable<any> {
    const headers = this.getHeaders();
    const body = { fullname };
    return this.http.put(`${this.apiUrl}/client/${userId}/fullname`, body, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  updatePhoneNumber(userId: number, phoneNumber: string): Observable<any> {
    const headers = this.getHeaders();
    const body = { phoneNumber };
    return this.http.put(`${this.apiUrl}/client/${userId}/phone`, body, { headers }).pipe(
      catchError(this.handleError)
    );
  }
} 