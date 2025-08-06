import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ContractService } from '../services/contract.service';
import { AuthService } from '../services/authService';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import SignaturePad from 'signature_pad';

// Define interfaces for contract data
interface ContractDetails {
  content: string;
  clientSignature?: string;
  projectId: number;
}

@Component({
  selector: 'app-worker-contract-sign',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './worker-contract-sign.component.html',
  styleUrl: './worker-contract-sign.component.css'
})
export class WorkerContractSignComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('workerSignatureCanvas') signaturePadElement!: ElementRef;
  signaturePad: SignaturePad | undefined;

  contractId: number | null = null;
  contractDetails: ContractDetails | null = null;
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private contractService: ContractService,
    private authService: AuthService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('contractId');
        if (id) {
          this.contractId = +id;
          return this.contractService.getContractDetails(this.contractId);
        } else {
          this.error = 'Contract ID not provided in route.';
          this.loading = false;
          return of(null);
        }
      })
    ).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.contractDetails = response.data;
          this.loading = false;
        } else if (response) {
          this.error = response.message || 'Failed to load contract details.';
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error fetching contract details:', err);
        this.error = 'Failed to load contract details. Please try again.';
        this.loading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeSignaturePad();
    }, 100);
  }

  private initializeSignaturePad(): void {
    const canvas = this.signaturePadElement.nativeElement;
    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)'
    });

    // Set canvas size
    this.resizeCanvas();
    }

  private resizeCanvas(): void {
    const canvas = this.signaturePadElement.nativeElement;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    this.signaturePad?.clear();
  }

  ngOnDestroy(): void {
    if (this.signaturePad) {
      this.signaturePad.off();
    }
  }

  clearSignature(): void {
    this.signaturePad?.clear();
  }

  submitWorkerSignature(): void {
    if (!this.signaturePad || this.signaturePad.isEmpty()) {
      alert('Please provide your signature before submitting.');
      return;
    }

    const signatureDataUrl = this.signaturePad.toDataURL();

    if (!this.contractId) {
      this.error = 'Cannot submit signature: Contract ID is missing.';
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      this.error = 'Cannot submit signature: User not authenticated.';
      return;
    }

    const payload = {
      workerId: currentUser.id,
      workerSignatureData: signatureDataUrl
    };

    this.contractService.addWorkerSignature(this.contractId, payload).subscribe({
      next: (response) => {
        console.log('Worker signature submitted successfully:', response);
        if (this.contractDetails?.projectId) {
          this.router.navigate(['/worker/create-tasks', this.contractDetails.projectId]);
        } else {
          this.router.navigate(['/worker/current-projects']);
        }
      },
      error: (err) => {
        console.error('Error submitting worker signature:', err);
        this.error = 'Failed to submit signature. Please try again.';
      }
    });
  }
}
