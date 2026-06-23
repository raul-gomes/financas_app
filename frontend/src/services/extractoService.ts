import {
  UploadResponse,
  ConfirmPayload,
  ConfirmResponse,
  SessionData,
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

  static async uploadMultiple(files: File[]): Promise<SessionData[]> {
    const sessions: SessionData[] = [];

    for (const file of files) {
      const response = await ExtractoService.upload(file);
      sessions.push({
        filename: file.name,
        bankCode: '',
        isConfirmed: false,
        transactions: response.transacoes.map(t => ({
          ...t,
          categoria_id: undefined,
          subcategoria_id: undefined,
          forma_pagamento: t.forma_pagamento || 'pix',
          natureza: t.natureza || 'pf',
        })),
      });
    }

    if (sessions.length === 0) throw new Error('Nenhum arquivo processado');
    return sessions;
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
