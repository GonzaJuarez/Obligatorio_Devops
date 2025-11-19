import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EnvironmentService } from './environment.service';
import { ScoreRow } from '../models/scorerow';

@Injectable({
  providedIn: 'root'
})
export class ScoreService {

  constructor(
    private readonly http: HttpClient,
    private readonly environmentService: EnvironmentService
  ) {}
  
  
  list(): Observable<ScoreRow[]> {
    return this.http.get<ScoreRow[]>(this.environmentService.ENDPOINTS.list());
  }
  submit(name: string, score: number): Observable<any> {
    return this.http.post(this.environmentService.ENDPOINTS.submit(), { name, score });
  }
}