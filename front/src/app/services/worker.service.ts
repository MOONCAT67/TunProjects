import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Job, Certificate, PastProject, VerificationRequest, JobCategory } from '../models/verification.model';
import { Project, ProjectApplication } from '../models/project.model';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface WorkerProfile {
  id: number;
  fullname: string;
  email: string;
  phone_number: string;
  profile_description: string | null;
  skills: string | null;
  location: string | null;
  profile_picture: string | null;
  is_verified: number;
  worker_verified_at: string;
  jobCategories: {
    id: number;
    years_experience: number;
    category_name: string;
    category_description: string;
    category_icon: string;
  }[];
  certificates: {
    id: number;
    worker_id: number;
    certificate_name: string;
    issuing_organization: string;
    certificate_url: string;
    issue_date: string;
    expiration_date: string | null;
    verification_date: string | null;
    verified_by: string | null;
  }[];
  pastProjects: {
    id: number;
    worker_id: number;
    project_name: string;
    project_description: string;
    project_url: string | null;
    completion_date: string;
    client_reference_contact: string | null;
    verification_date: string | null;
    verified_by: string | null;
  }[];
  currentProjects: any[];
  completedProjects: any[];
  teamInfo: {
    id: number;
    name: string;
    description: string;
    leader_id: number;
    leader_name: string;
    leader_picture: string;
    team_role: string;
  } | "solo worker";
  reviews: any[];
}

export interface WorkerProject {
  id: number;
  title: string;
  description: string;
  status: string;
  progress_percentage: number;
  deadline: string;
  employer_id: number;
  employer_name: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerProjectsResponse {
  statusCode: number;
  message: string;
  data: WorkerProject[];
}

export interface WorkerAddress {
  id: number;
  fullname: string;
  location: string;
}

export interface WorkerListItem {
  id: number;
  fullname: string;
  email: string;
  phone_number: string;
  profile_description: string | null;
  skills: string | null;
  location: string | null;
  profile_picture: string | null;
  is_verified: number;
  is_online: number;
  last_activity: string;
  created_at: string;
  job_categories: string[];
  years_experience: string[];
}

// Interfaces for the response
export interface Subtask {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  subtasks: Subtask[];
}

export interface SoloProject {
  id: string;
  title: string;
  description: string;
  status: string;
  type: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  application_id: string;
  application_status: string;
  application_date: string;
  deposit_paid: number;
  tasks: Task[];
}

interface InProgressSoloProjectsResponse {
  statusCode: number;
  message: string;
  data: SoloProject[];
}

@Injectable({
  providedIn: 'root'
})
export class WorkerService {
  private apiUrl = `${environment.apiUrl}/worker`;
  private baseUrl = 'http://localhost:3004/worker';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService
  ) {}

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      errorMessage = error.error?.message || error.message || 'Server error occurred';
    }
    return throwError(() => ({ message: errorMessage, status: error.status }));
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getJobTitles(): Observable<{ success: boolean; message: string; data: JobCategory[] }> {
    return this.http.get<{ success: boolean; message: string; data: JobCategory[] }>(`${this.apiUrl}/job-titles`).pipe(
      catchError(this.handleError)
    );
  }

  submitVerificationRequest(request: VerificationRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verification-requests`, request).pipe(
      catchError(this.handleError)
    );
  }

  getJobs(): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/jobs`).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  getAvailableProjects(workerId: number | string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/projects/${workerId}`).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  getProjectDetails(projectId: string): Observable<Project> {
    return this.http.get<ApiResponse<Project>>(`${this.apiUrl}/project-details/${projectId}`).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  submitProjectApplication(projectId: string, application: ProjectApplication): Observable<any> {
    return this.http.post(`${this.apiUrl}/projects/${projectId}/applications`, application).pipe(
      catchError(this.handleError)
    );
  }

  getWorkerProfile(workerId: string): Observable<ApiResponse<WorkerProfile>> {
    return this.http.get<ApiResponse<WorkerProfile>>(`${this.apiUrl}/profile/${workerId}`).pipe(
      catchError(this.handleError)
    );
  }

  getActiveProjects(): Observable<WorkerProjectsResponse> {
    return this.http.get<WorkerProjectsResponse>(`${this.apiUrl}/active-projects`);
  }

  getWorkerAddresses(): Observable<WorkerAddress[]> {
    return this.http.get<{ success: boolean; data: WorkerAddress[] }>(`${this.apiUrl}/addresses`).pipe(
      map(res => res.data)
    );
  }

  getAllWorkers(): Observable<WorkerListItem[]> {
    return this.http.get<{ statusCode: number; message: string; data: WorkerListItem[] }>(`${this.apiUrl}/workers`).pipe(
      map(res => res.data),
      catchError(this.handleError)
    );
  }

  // Get worker's in-progress solo projects
  getInProgressSoloProjects(workerId: number): Observable<InProgressSoloProjectsResponse> {
    const headers = this.getHeaders();
    return this.http.get<InProgressSoloProjectsResponse>(`${this.baseUrl}/in-progress-solo-projects/${workerId}`, { headers });
  }

  trackJobFilter(workerId: number | string, jobCategoryId: number): Observable<any> {
    const body = { workerId: workerId, jobCategoryId: jobCategoryId };
    return this.http.post<any>(`${this.apiUrl}/track-filter`, body).pipe(
      catchError(this.handleError)
    );
  }

  trackProjectView(workerId: number | string, projectId: number | string, viewDuration: number): Observable<any> {
    const body = { workerId: workerId, projectId: projectId, viewDuration: viewDuration };
    return this.http.post<any>(`${this.apiUrl}/track-view`, body).pipe(
      catchError(this.handleError)
    );
  }

  trackProjectDetailView(workerId: number | string, projectId: number | string, viewDuration: number, jobCategoryIds: number[]): Observable<any> {
    const body = { workerId: workerId, projectId: projectId, viewDuration: viewDuration, jobCategories: jobCategoryIds };
    return this.http.post<any>(`${this.apiUrl}/track-detail-view`, body).pipe(
      catchError(this.handleError)
    );
  }
} 