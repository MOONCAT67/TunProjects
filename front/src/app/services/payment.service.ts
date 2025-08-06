import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './authService';

export interface PaymentPayload {
  projectId: number;
  clientId: number;
  amount: number;
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvc: number;
  cardholderName: string;
}

export interface PaymentResponse {
  statusCode: number;
  message: string;
  transactionId?: string;
}

export interface PaymentAmountResponse {
  success: boolean;
  amount: string;
  paymentType: string;
  totalPrice: string;
  materialsPrice: string;
  laborPrice: string;
}

export interface PaymentDetails {
  success: boolean;
  paymentId: number;
  amount: string;
  status: string;
  invoiceId: number;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private handleError(error: HttpErrorResponse) {
    console.error('Payment Service Error:', error);
    let errorMessage = 'An unknown payment error occurred.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client-side error: ${error.error.message}`;
    } else {
      errorMessage = `Server-side error: ${error.status} - ${error.error?.message || error.message}`;
    }
    return throwError(() => new Error(errorMessage));
  }

  processPayment(payload: PaymentPayload): Observable<PaymentResponse> {
    const headers = this.getHeaders();
    return this.http.post<PaymentResponse>(`${this.apiUrl}/pay/create`, payload, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  getPaymentAmount(projectId: number): Observable<PaymentAmountResponse> {
    const headers = this.getHeaders();
    return this.http.get<PaymentAmountResponse>(`${this.apiUrl}/pay/amount/${projectId}`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  getLastPayment(projectId: number): Observable<PaymentDetails> {
    return this.http.get<PaymentDetails>(`${this.apiUrl}/pay/last/${projectId}`);
  }

  downloadInvoice(paymentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/pay/invoice/${paymentId}`, {
      responseType: 'blob'
    });
  }
} 