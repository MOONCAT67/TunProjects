import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { ContractService } from '../services/contract.service';
import { AuthService } from '../services/authService';
import SignaturePad from 'signature_pad';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-contract',
  standalone: true,
  imports: [CommonModule, FormsModule], // Add FormsModule here
  templateUrl: './contract.component.html',
  styleUrls: ['./contract.component.css']
})
export class ContractComponent implements OnInit, AfterViewInit {

  @ViewChild('signatureCanvas') signaturePadElement!: ElementRef;
  signaturePad: SignaturePad | undefined;

  // Contract data properties
  projectId: number = 0;
  content: string = '';
  contractType: string = 'project_acceptance'; // Example type, can be dynamic
  clientId: number = 0;
  isModifying: boolean = false;

  private isBrowser: boolean; // Add isBrowser property

  constructor(
    private contractService: ContractService,
    private authService: AuthService,
    private route: ActivatedRoute,
    public router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId); // Determine if running in browser
  }

  ngOnInit(): void {
    // Get project ID from route parameters
    this.route.params.subscribe(params => {
      this.projectId = +params['projectId'];
      if (!this.projectId) {
        console.error('No project ID provided');
        this.router.navigate(['/client-projects']);
        return;
      }
    });

    // Get user ID from AuthService
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.clientId = currentUser.id;
    } else {
      console.error('User not authenticated');
      this.router.navigate(['/auth']);
      return;
    }

    // Check if we're modifying an existing contract
    this.route.queryParams.subscribe(params => {
      this.isModifying = params['action'] === 'modify';
      if (this.isModifying) {
        // TODO: Fetch existing contract content if modifying
        // this.loadExistingContract();
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.isBrowser && this.signaturePadElement) { // Check if in browser
      this.signaturePad = new SignaturePad(this.signaturePadElement.nativeElement);
      // Adjust canvas size if needed for responsiveness
      window.addEventListener('resize', this.resizeCanvas.bind(this));
      this.resizeCanvas(); // Initial resize
    }
  }

  ngOnDestroy(): void {
    // Clean up event listener only if in browser and listener was added
    if (this.isBrowser) {
      window.removeEventListener('resize', this.resizeCanvas.bind(this));
    }
  }

  resizeCanvas(): void {
    if (this.isBrowser && this.signaturePadElement && this.signaturePad) { // Check if in browser
        const canvas = this.signaturePadElement.nativeElement;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d').scale(ratio, ratio);
        // No need to re-add the event listener here
        this.signaturePad.clear(); // Clear signature after resize
    }
  }

  clearSignature(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
    }
  }

  getSignatureImage(): string | null {
    if (this.signaturePad && !this.signaturePad.isEmpty()) {
      return this.signaturePad.toDataURL(); // Returns base64 encoded image
    } else {
      return null;
    }
  }

  submitContract(): void {
    const signatureData = this.getSignatureImage();

    if (!signatureData) {
      alert('Please provide a signature.');
      return;
    }

    if (!this.projectId || !this.clientId) {
      alert('Missing required information. Please try again.');
      return;
    }

    const payload = {
      projectId: this.projectId,
      content: this.content,
      contractType: this.contractType,
      clientId: this.clientId,
      clientSignatureData: signatureData
    };

    this.contractService.createAndSignContract(payload).subscribe({
      next: (response) => {
        console.log('Contract created and signed successfully:', response);
        alert('Contract submitted successfully!');
        this.router.navigate(['/client-projects']);
      },
      error: (error) => {
        console.error('Error submitting contract:', error);
        alert('Failed to submit contract.');
      }
    });
  }

  // Add method to handle contract modification
  updateContract(): void {
    if (!this.projectId || !this.clientId) {
      alert('Missing required information. Please try again.');
      return;
    }

    const payload = {
      content: this.content,
      userId: this.clientId
    };

    // Note: We'll need the contractId here - this should be fetched when loading the contract
    // For now, we'll need to implement a way to get the contractId
    this.contractService.updateContractContent(this.projectId, payload).subscribe({
      next: (response) => {
        console.log('Contract updated successfully:', response);
        alert('Contract updated successfully!');
        this.router.navigate(['/client-projects']);
      },
      error: (error) => {
        console.error('Error updating contract:', error);
        alert('Failed to update contract.');
      }
    });
  }
}
