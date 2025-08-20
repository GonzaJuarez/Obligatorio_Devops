import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';

type WSMessage =
  | { type: 'scores'; scores: Record<string, number> }
  | { type: 'click'; name: string; total: number };

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket?: WebSocket;
  private msg$ = new Subject<WSMessage>();
  private connected$ = new Subject<boolean>();
  private url = this.makeUrl('/ws');
  private shouldReconnect = true;

  constructor(private zone: NgZone) {
    this.connect();
  }

  private makeUrl(path: string) {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // si el backend está en otro host/puerto, reemplazá acá
    return `${protocol}//10.4.96.244:8000${path}`;
  }

  private connect(delayMs = 0) {
    timer(delayMs).subscribe(() => {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => this.zone.run(() => this.connected$.next(true));

      this.socket.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed?.type) this.zone.run(() => this.msg$.next(parsed));
        } catch {}
      };

      this.socket.onclose = () => {
        this.zone.run(() => this.connected$.next(false));
        // backoff simple (0.5s → 5s)
        if (this.shouldReconnect) this.connect(1000);
      };

      this.socket.onerror = () => {
        try { this.socket?.close(); } catch {}
      };
    });
  }

  messages(): Observable<WSMessage> {
    return this.msg$.asObservable();
  }

  connection(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  send(obj: unknown) {
    const s = this.socket;
    if (s && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(obj));
    }
  }

  close() {
    this.shouldReconnect = false;
    this.socket?.close();
  }
}
