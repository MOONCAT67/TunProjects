import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './authService';

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  is_read: number;
  type: string;
  reference_id: number;
  created_at: string;
  extra: number | null;
  sender_name: string;
}

export interface NotificationResponse {
  statusCode: number;
  message: string;
  data: Notification[];
}

export interface UnreadCountResponse {
  statusCode: number;
  message: string;
  data: { unread_count: number };
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = `${environment.apiUrl}/notifications`;

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

  private getUserId(): number {
    const user = this.authService.getCurrentUser();
    if (!user || !user.id) {
      throw new Error('User not authenticated');
    }
    return user.id;
  }

  getUserNotifications(): Observable<NotificationResponse> {
    const headers = this.getHeaders();
    const userId = this.getUserId();
    return this.http.get<NotificationResponse>(`${this.baseUrl}/${userId}`, { headers });
  }

  getUnreadCount(): Observable<UnreadCountResponse> {
    const headers = this.getHeaders();
    const userId = this.getUserId();
    return this.http.get<UnreadCountResponse>(`${this.baseUrl}/${userId}/unread-count`, { headers });
  }

  markAsRead(notificationId: number): Observable<any> {
    const headers = this.getHeaders();
    const userId = this.getUserId();
    return this.http.put(`${this.baseUrl}/${userId}/${notificationId}/read`, {}, { headers });
  }

  deleteNotification(notificationId: number): Observable<any> {
    const headers = this.getHeaders();
    const userId = this.getUserId();
    return this.http.delete(`${this.baseUrl}/${userId}/${notificationId}`, { headers });
  }
} 