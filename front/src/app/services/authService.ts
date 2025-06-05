import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

export interface User {
  id: number;
  fullname: string;
  email: string;
  phone_number: string;
  role: string;
  is_verified: boolean;
  profile_picture?: string;
  location?: string;
  is_online?: boolean;
  last_activity?: string;
}

interface AuthResponse {
  message: string;
  data: User;
  token: string;
  statusCode: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3004/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUserSubject.next(JSON.parse(storedUser));
      }
    }
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Client-side errors
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side errors
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      }
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  private setLocalStorage(key: string, value: string): void {
    if (this.isBrowser) {
      localStorage.setItem(key, value);
    }
  }

  private removeLocalStorage(key: string): void {
    if (this.isBrowser) {
      localStorage.removeItem(key);
    }
  }

  private getLocalStorage(key: string): string | null {
    if (this.isBrowser) {
      return localStorage.getItem(key);
    }
    return null;
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      map(response => {
        if (response.data && response.token) {
          this.setLocalStorage('currentUser', JSON.stringify(response.data));
          this.setLocalStorage('token', response.token);
          this.currentUserSubject.next(response.data);
          return response.data;
        }
        throw new Error('Invalid response format');
      }),
      catchError(this.handleError)
    );
  }

  register(fullname: string, email: string, password: string, phone_number: string, location: string, profile_picture?: string): Observable<User> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, {
      fullname,
      email,
      password,
      phone_number,
      location,
      profile_picture
    }).pipe(
      map(response => {
        if (response.data && response.token) {
          this.setLocalStorage('currentUser', JSON.stringify(response.data));
          this.setLocalStorage('token', response.token);
          this.currentUserSubject.next(response.data);
          return response.data;
        }
        throw new Error('Invalid response format');
      }),
      catchError(this.handleError)
    );
  }

  logoutUser(userId: number) {
    return this.http.post(`${this.apiUrl}/logout`, { userId });
  }

  logout(): void {
    const user = this.currentUserSubject.value;
    if (user && user.id) {
      this.logoutUser(user.id).subscribe({
        next: () => {
          this.removeLocalStorage('currentUser');
          this.removeLocalStorage('token');
          this.currentUserSubject.next(null);
          this.router.navigate(['/auth']);
        },
        error: () => {
          // Even if the backend call fails, clear local state
          this.removeLocalStorage('currentUser');
          this.removeLocalStorage('token');
          this.currentUserSubject.next(null);
          this.router.navigate(['/auth']);
        }
      });
    } else {
      this.removeLocalStorage('currentUser');
      this.removeLocalStorage('token');
      this.currentUserSubject.next(null);
      this.router.navigate(['/auth']);
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  getToken(): string | null {
    return this.getLocalStorage('token');
  }

  getUserId(): number | null {
    const user = this.getCurrentUser();
    return user ? user.id : null;
  }
} 