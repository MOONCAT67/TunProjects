import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReviewPayload {
  clientId: number;
  workerId: number;
  projectId: number;
  rating: number;
  comment: string;
}

export interface Review {
  id: number;
  worker_id: number;
  client_id: number;
  project_id: number;
  job_category_id: number;
  rating: number;
  comment: string;
  created_at: string;
  client_name: string;
  client_picture: string | null;
  project_title: string;
}

export interface ReviewResponse {
  statusCode: number;
  data: Review[];
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private apiUrl = `${environment.apiUrl}/review`;

  constructor(private http: HttpClient) {}

  postReview(payload: ReviewPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/reviews`, payload);
  }

  getWorkerReviews(workerId: number): Observable<ReviewResponse> {
    return this.http.get<ReviewResponse>(`${this.apiUrl}/reviews/worker/${workerId}`);
  }
} 