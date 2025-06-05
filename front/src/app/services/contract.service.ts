import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/authService';

interface CreateContractPayload {
  projectId: number;
  content: string;
  contractType: string;
  clientId: number;
  clientSignatureData: string;
}

interface CheckContractResponse {
  statusCode: number;
  data: {
    hasContract: boolean;
    contractId?: number;
    status?: string;
  };
}

interface UpdateContractPayload {
  content: string;
  userId: number;
}

@Injectable({
  providedIn: 'root'
})
export class ContractService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient,
              private authService: AuthService) { }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Creates a new contract with a client signature.
   * @param payload The contract data and signature.
   */
  createAndSignContract(payload: CreateContractPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/contract/create-and-sign`, payload).pipe(
      catchError(error => {
        console.error('Error creating and signing contract:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Checks if a project has an associated contract.
   * @param projectId The ID of the project.
   */
  checkContractExists(projectId: number): Observable<CheckContractResponse> {
    return this.http.get<CheckContractResponse>(`${this.apiUrl}/contract/project/${projectId}/check`).pipe(
      catchError(error => {
        console.error(`Error checking contract for project ${projectId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Updates the content of an existing contract.
   * @param contractId The ID of the contract to update.
   * @param payload The update data including new content and user ID.
   */
  updateContractContent(contractId: number, payload: UpdateContractPayload): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/contract/${contractId}/content`, payload).pipe(
      catchError(error => {
        console.error(`Error updating contract ${contractId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Downloads the contract as a PDF.
   * @param contractId The ID of the contract to download.
   * @param userId The ID of the user requesting the download.
   */
  downloadContract(contractId: number, userId: number): Observable<Blob> {
    // Using responseType 'blob' to handle binary data like PDFs
    return this.http.get(`${this.apiUrl}/contract/${contractId}/download`, { 
      params: { userId: userId.toString() },
      responseType: 'blob' 
    }).pipe(
      catchError(error => {
        console.error(`Error downloading contract ${contractId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Gets the details of a specific contract.
   * @param contractId The ID of the contract.
   */
  getContractDetails(contractId: number): Observable<any> {
    const headers = this.getHeaders();
    return this.http.get<any>(`${this.apiUrl}/contract/${contractId}`, { headers }).pipe(
      catchError(error => {
        console.error(`Error fetching contract details for contract ${contractId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Adds the worker's signature to a contract.
   * @param contractId The ID of the contract.
   * @param payload The worker's signature data.
   */
  addWorkerSignature(contractId: number, payload: { workerId: number, workerSignatureData: string }): Observable<any> {
    const headers = this.getHeaders();
    return this.http.post<any>(`${this.apiUrl}/contract/${contractId}/add-worker-signature`, payload, { headers }).pipe(
      catchError(error => {
        console.error(`Error adding worker signature to contract ${contractId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Checks if a contract is signed by the worker
   * @param contractId The ID of the contract to check
   */
  checkWorkerSignature(contractId: number): Observable<any> {
    const headers = this.getHeaders();
    return this.http.get<any>(`${this.apiUrl}/contract/${contractId}/worker-signature`, { headers }).pipe(
      catchError(error => {
        console.error(`Error checking worker signature for contract ${contractId}:`, error);
        return throwError(() => error);
      })
    );
  }

}
 