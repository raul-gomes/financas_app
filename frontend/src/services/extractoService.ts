import {
  UploadResponse,
  ConfirmPayload,
  ConfirmResponse,
} from '@/types/extracto';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8005';

export class ExtractoService {
  static async upload(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/extractos/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`Erro ${res.status} ao fazer upload do extrato`);
    return res.json();
  }

  static async uploadMultiple(files: File[]): Promise<{ result: UploadResponse; filenames: string[] }> {
    let merged: UploadResponse | null = null;
    const filenames: string[] = [];

    for (const file of files) {
      filenames.push(file.name);
      const response = await ExtractoService.upload(file);
      if (!merged) {
        merged = response;
      } else {
        merged = {
          total: merged.total + response.total,
          entradas: merged.entradas + response.entradas,
          saidas: merged.saidas + response.saidas,
          total_entradas: merged.total_entradas + response.total_entradas,
          total_saidas: merged.total_saidas + response.total_saidas,
          transacoes: [...merged.transacoes, ...response.transacoes],
        };
      }
    }

    if (!merged) throw new Error('Nenhum arquivo processado');
    return { result: merged, filenames };
  }

  static async confirm(payload: ConfirmPayload): Promise<ConfirmResponse> {
    const res = await fetch(`${API_BASE_URL}/extractos/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Erro ${res.status} ao confirmar extrato`);
    return res.json();
  }
}
