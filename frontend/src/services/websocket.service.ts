import { afterNextRender, inject, Injectable, NgZone } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';

type WSMessage = { type: 'scores'; scores: Record<string, number> } | { type: 'click'; name: string; total: number };

@Injectable({ providedIn: 'root' })
export class WebsocketService {

  public wsConnected: 'connecting' | 'connected' | 'fail' = 'fail';

  private socket?: WebSocket;
  private readonly msg$ = new Subject<WSMessage>();
  private readonly connected$ = new Subject<boolean>();

  private readonly url = this.makeUrl('/ws');

  private shouldReconnect = false;
  private readonly zone = inject(NgZone);

  constructor() {
    afterNextRender(() => {
      this.connect();
    });
  }

  private makeUrl(path: string) {
    const w = window as any;

    const cfgUrl = w?.APP_CFG?.wsUrl as string | undefined;
    if (cfgUrl) return cfgUrl;

    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${loc.host}${path}`;
  }

  public connect(delayMs = 0) {
    timer(delayMs).subscribe(() => {
      this.wsConnected = 'connecting';
      this.socket = new WebSocket(this.url);

      let timeout = setTimeout(() => {
        if (this.wsConnected === 'connecting') {
          this.wsConnected = 'fail';
          try { this.socket?.close(); } catch {}
        }
      }, 5000);

      this.socket.onopen = () => {
        clearTimeout(timeout);
        this.wsConnected = 'connected';
        this.zone.run(() => this.connected$.next(true));
      };

      this.socket.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed?.type) this.zone.run(() => this.msg$.next(parsed));
        } catch {}
      };

      this.socket.onclose = () => {
        clearTimeout(timeout);
        this.wsConnected = 'fail';
        this.zone.run(() => this.connected$.next(false));
        if (this.shouldReconnect) this.connect(5000);
      };

      this.socket.onerror = () => {
        clearTimeout(timeout);
        this.wsConnected = 'fail';
        try {
          this.socket?.close();
        } catch {}
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
