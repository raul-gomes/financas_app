import { useState } from 'react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { HelpCircle, ExternalLink, ShieldCheck, Upload, Key, CreditCard, ArrowRight } from 'lucide-react';

export function PluggyInfoDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
            Meu Pluggy — Open Finance
          </span>
        }
        description="Entenda por que usar o Pluggy e como configurar sua chave em poucos passos."
      >

        <div className="space-y-6 py-2">
          {/* ── Why Pluggy ── */}
          <section>
            <h3 className="flex items-center gap-2 font-semibold text-sm mb-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Por que usar o Pluggy?
            </h3>
            <div className="space-y-3 text-sm text-foreground/80 leading-relaxed">
              <p>
                <strong className="text-foreground">Open Finance</strong> é um sistema do Banco Central
                que permite que você compartilhe seus dados bancários de forma segura com aplicativos
                autorizados — sem precisar compartilhar sua senha bancária.
              </p>
              <p>
                O <strong className="text-foreground">Meu Pluggy</strong> é uma plataforma gratuita
                que funciona como uma "ponte" entre seus bancos e este aplicativo. Ele lida com toda
                a complexidade técnica do Open Finance (certificados, OAuth2, consentimento) e oferece
                uma API simples para consultar suas transações.
              </p>
              <div className="grid gap-2 pt-1">
                <div className="flex items-start gap-2">
                  <Upload className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span><strong>Automação:</strong> Transações importadas automaticamente, sem digitar nada.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span><strong>Precisão:</strong> Cada transação já vem com data, valor e descrição reais.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span><strong>Segurança:</strong> Seus dados bancários ficam criptografados no Meu Pluggy. O app só vê o que você autorizar via a chave de API.</span>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-border" />

          {/* ── Step by Step ── */}
          <section>
            <h3 className="flex items-center gap-2 font-semibold text-sm mb-3">
              <Key className="h-4 w-4 text-primary" />
              Passo a passo — Criar sua chave
            </h3>
            <ol className="space-y-4">
              {[
                {
                  title: 'Crie uma conta no Meu Pluggy',
                  description: (
                    <>
                      Acesse{' '}
                      <a
                        href="https://meu.pluggy.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        meu.pluggy.ai <ExternalLink className="inline h-3 w-3" />
                      </a>{' '}
                      e cadastre-se gratuitamente. O plano gratuito já permite conectar seus bancos
                      pessoais.
                    </>
                  ),
                },
                {
                  title: 'Conecte seus bancos',
                  description:
                    'No dashboard, clique em "Conectar Bancos". Escolha suas instituições financeiras e faça login com suas credenciais bancárias — tudo via Open Finance, diretamente com o banco.',
                },
                {
                  title: 'Gere sua API Key',
                  description:
                    'No menu, vá em "API Keys" e clique em "Criar nova chave". Copie a chave gerada (uma string longa que começa com "plk_").',
                },
                {
                  title: 'Cole a chave no Finanças App',
                  description:
                    'Volte para esta página de Configurações, cole a chave no campo "API Key do Meu Pluggy" e clique em "Validar". Se a chave for válida, você verá uma confirmação verde.',
                },
                {
                  title: 'Sincronize suas transações',
                  description:
                    'Com a chave salva, clique em "Sincronizar Transações". O app buscará suas transações dos últimos 90 dias e as importará automaticamente.',
                },
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <hr className="border-border" />

          {/* ── Call to action ── */}
          <section className="rounded-lg bg-primary/5 border border-primary/10 p-4">
            <div className="flex items-start gap-3">
              <ArrowRight className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Pronto para começar?</p>
                <p className="text-sm text-muted-foreground">
                  Crie sua conta gratuita no{' '}
                  <a
                    href="https://meu.pluggy.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Meu Pluggy
                  </a>
                  , conecte seus bancos e cole a chave abaixo. O processo todo leva menos de 5 minutos.
                </p>
              </div>
            </div>
          </section>
        </div>
      </ResponsiveModal>
    </>
  );
}
