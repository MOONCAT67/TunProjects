import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Message {
  id: number;
  sender_id: number;
  receiverId: number;
  message: string;
  timestamp: string;
  isRead: boolean;
}

export interface Conversation {
  other_user_id: number;
  other_user_name: string;
  other_user_picture: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  last_message_sender_id: number;
  isTemporaryStaticConversation?: boolean;
}

export interface CreateConversationResponseData {
  userId1: number;
  userId2: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class MessagerieService {
  private baseUrl = `${environment.apiUrl}/message`;

  constructor(private http: HttpClient) {}

  getConversation(receiverId: number, senderId: number): Observable<{ success: boolean; data: Message[] }> {
    return this.http.get<{ success: boolean; data: Message[] }>(`${this.baseUrl}/conversation/${receiverId}/${senderId}`);
  }

  sendMessage(senderId: number, receiverId: number, message: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/send`, { senderId, receiverId, message });
  }

  getUserConversations(userId: number): Observable<{ success: boolean; data: Conversation[] }> {
    return this.http.get<{ success: boolean; data: Conversation[] }>(`${this.baseUrl}/conversations/${userId}`);
  }

  markMessagesAsRead(senderId: number, receiverId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/read/${senderId}/${receiverId}`, {});
  }

  getUnreadMessagesCount(userId: number): Observable<{ success: boolean; data: number }> {
    return this.http.get<{ success: boolean; data: number }>(`${this.baseUrl}/unread-count/${userId}`);
  }

  createNewConversation(userId1: number, userId2: number): Observable<{ success: boolean; data: CreateConversationResponseData }> {
    return this.http.post<{ success: boolean; data: CreateConversationResponseData }>(`${this.baseUrl}/conversation`, {
      userId1,
      userId2
    });
  }
} 