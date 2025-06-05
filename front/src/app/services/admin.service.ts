import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // Verification Requests
  getVerificationRequests(): Observable<any> {
    return this.http.get(`${this.apiUrl}/verification-requests`);
  }

  getRequestDetails(requestId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/verification-requests/${requestId}`);
  }

  processVerificationRequest(requestId: string, action: 'approved' | 'rejected', notes: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/verification-requests/${requestId}`, {
      action,
      notes,
      adminId: 1 // Hardcoded for now as per backend comment
    });
  }

  // User Management
  getAllWorkers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/workers`);
  }

  getAllClients(): Observable<any> {
    return this.http.get(`${this.apiUrl}/clients`);
  }

  // Project Management
  getAllProjects(categoryId?: number): Observable<any> {
    const url = categoryId 
      ? `${this.apiUrl}/projects?categoryId=${categoryId}`
      : `${this.apiUrl}/projects`;
    return this.http.get(url);
  }
} 