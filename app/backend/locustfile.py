"""
Load test do backend (Fase 4.2 — Observabilidade).

Cenários cobertos:
  - GET  /api/dashboard/statement      (tela principal / extrato agregado)
  - GET  /api/transacoes/             (listagem paginada de transações)
  - POST /api/transacoes/             (criação de transação)
  - POST /api/pluggy/sync             (sincronização Open Finance)

Alvo (plano): p95 < 500ms, erro < 1%.

Execução (fora do container, contra o nginx exposto):
  locust -f locustfile.py --headless -u 50 -r 10 -t 60s -H http://localhost:8087

Ou dentro da rede docker (alvo interno, sem nginx):
  locust -f locustfile.py --headless -u 50 -r 10 -t 60s -H http://financas-api:8000
"""
import random
from datetime import datetime

from locust import HttpUser, task, between

# IDs válidos presentes no banco de demonstração (evita 400 por FK/unique)
CATEGORY_ID = 5        # Alimentação
SUBCATEGORY_ID = 15


class FinancasUser(HttpUser):
    wait_time = between(0.5, 2.0)
    host = "http://localhost:8087"

    @task(5)
    def dashboard_statement(self):
        hoje = datetime.now()
        inicio = hoje.replace(day=1)
        params = {
            "start_date": inicio.strftime("%d/%m/%Y"),
            "end_date": hoje.strftime("%d/%m/%Y"),
            "entity_type": "individual",
        }
        self.client.get("/api/dashboard/statement", params=params, name="GET /dashboard/statement")

    @task(5)
    def list_transactions(self):
        params = {
            "limit": 20,
            "offset": random.choice([0, 20, 40]),
        }
        self.client.get("/api/transacoes/", params=params, name="GET /transacoes")

    @task(2)
    def create_transaction(self):
        payload = {
            "amount": round(random.uniform(10, 500), 2),
            "description": f"Load test {datetime.now().isoformat()}",
            "payment_method": "pix",
            "transaction_date": datetime.now().isoformat(),
            "type": "expense",
            "entity_type": "individual",
            "category_id": CATEGORY_ID,
            "subcategory_id": SUBCATEGORY_ID,
        }
        self.client.post("/api/transacoes/", json=payload, name="POST /transacoes")

    @task(1)
    def pluggy_sync(self):
        # Endpoint pesado (busca contas Pluggy + importa). Menor peso no mix.
        self.client.post("/api/pluggy/sync", name="POST /pluggy/sync", timeout=30)
