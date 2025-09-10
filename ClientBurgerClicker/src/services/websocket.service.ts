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
    const w = window as any;

    const cfgUrl = w?.APP_CFG?.wsUrl as string | undefined;
    if (cfgUrl) return cfgUrl;

    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${loc.host}${path}`;
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
        if (this.shouldReconnect) this.connect(1000); // backoff simple
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
