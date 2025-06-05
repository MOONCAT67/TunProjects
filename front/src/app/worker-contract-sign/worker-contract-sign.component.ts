import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ContractService } from '../services/contract.service';
import { AuthService } from '../services/authService';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import SignaturePad from 'signature_pad';
import { isPlatformBrowser } from '@angular/common';
import { Inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';

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
  workerSignatureData: string | null = null;

  private isBrowser: boolean;

  constructor(
    private route: ActivatedRoute,
    private contractService: ContractService,
    private authService: AuthService,
    public router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

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
    if (this.isBrowser && this.signaturePadElement) {
      this.signaturePad = new SignaturePad(this.signaturePadElement.nativeElement);
      this.resizeCanvas();

      // Add event listener for signature pad
      this.signaturePad.addEventListener('endStroke', () => {
        this.updateSignatureData();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('resize', this.resizeCanvas.bind(this));
    }
  }

  resizeCanvas(): void {
    if (this.isBrowser && this.signaturePadElement && this.signaturePad) {
      const canvas = this.signaturePadElement.nativeElement;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      this.signaturePad.clear();
      this.workerSignatureData = null;
    }
  }

  clearSignature(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
      this.workerSignatureData = null;
    }
  }

  updateSignatureData(): void {
    if (this.signaturePad && !this.signaturePad.isEmpty()) {
      this.workerSignatureData = this.signaturePad.toDataURL();
      console.log('Signature data updated:', this.workerSignatureData ? 'Signature present' : 'No signature');
    } else {
      this.workerSignatureData = null;
    }
  }

  handleSignaturePadEnd(): void {
    this.updateSignatureData();
  }

  submitWorkerSignature(): void {
    if (!this.contractId) {
      this.error = 'Cannot submit signature: Contract ID is missing.';
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      this.error = 'Cannot submit signature: User not authenticated.';
      return;
    }

    if (!this.workerSignatureData) {
      this.error = 'Please provide your signature.';
      return;
    }

    const payload = {
      workerId: currentUser.id,
      workerSignatureData: this.workerSignatureData
    };

    this.contractService.addWorkerSignature(this.contractId, payload).subscribe({
      next: (response) => {
        console.log('Worker signature submitted successfully:', response);
        if (this.contractDetails?.projectId) {
          this.router.navigate(['/worker/create-tasks', this.contractDetails.projectId]);
        } else {
          console.error('Project ID not found in contract details');
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
