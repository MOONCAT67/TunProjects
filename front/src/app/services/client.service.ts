import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
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

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

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
} 