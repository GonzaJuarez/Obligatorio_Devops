import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class EnvironmentService {
  API_BASE = '' as const;
  ENDPOINTS = {
    list: () => `${this.API_BASE}/scores`,
    submit: () => `${this.API_BASE}/scores`,
  };
}
