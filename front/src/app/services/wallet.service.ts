import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProjectEarning {
  project_id: number;
  project_title: string;
  labor_price: number;
  materials_price: number;
  total_price: number;
  deposit_paid: number;
  earned_amount: number;
}

export interface WalletData {
  total_earned: number;
  projects: ProjectEarning[];
}

export interface WalletResponse {
  statusCode: number;
  message: string;
  data: WalletData;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getWorkerWallet(workerId: number): Observable<WalletResponse> {
    return this.http.get<WalletResponse>(`${this.apiUrl}/worker/wallet/${workerId}`);
  }
} 