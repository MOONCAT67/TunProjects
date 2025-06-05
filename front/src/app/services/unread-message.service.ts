import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UnreadMessageService {
  private messageReadSource = new Subject<void>();

  // Observable that components can subscribe to
  messageRead$ = this.messageReadSource.asObservable();

  // Call this method when messages are read
  notifyMessagesRead() {
    this.messageReadSource.next();
  }
} 