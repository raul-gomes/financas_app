import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PluggyInfoDialog } from '@/components/dialogs/PluggyInfoDialog';
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Mail,
  Banknote,
  Trash2,
  Check,
  X,
  Building2,
} from 'lucide-react';
import {
  SettingsService,
  Profile,
  UserBank,
  PluggyAccount,
} from '@/services/settingsService';
import { useBanks, useProfile } from '@/hooks/queries/useSettingsQueries';
import { useErrorToast } from '@/hooks/queries/useErrorToast';
import { queryKeys } from '@/lib/queryKeys';
import { BankLogo, BankLogoFallback } from '@/components/ui/bank-logo';
import { BankSearchInput } from '@/components/ui/bank-search';
import { PageHeader } from '@/components/ui/page-header';
import { useRole } from '@/contexts/RoleContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';

const MIN_PASSWORD_LENGTH = 6;

const Settings = () => {
  const { toast } = useToast();
  const { isAdmin } = useRole();

  // ── Profile state ──
  const queryClient = useQueryClient();
  const { data: profile = null, isError: profileError } = useProfile();
  const { data: banks = [], isError: banksError } = useBanks();
  useErrorToast(profileError || banksError, 'Falha ao carregar configurações.');
  const setProfile = (update: Profile | ((prev: Profile | null) => Profile | null)) =>
    queryClient.setQueryData<Profile>(queryKeys.settings.profile(), (prev) =>
      (typeof update === 'function' ? update(prev ?? null) : update) ?? undefined,
    );
  const setBanks = (update: (prev: UserBank[]) => UserBank[]) =>
    queryClient.setQueryData<UserBank[]>(queryKeys.settings.banks(), (prev) => update(prev ?? []));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Pluggy state ──
  const [pluggyApiKey, setPluggyApiKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [pluggyStatus, setPluggyStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ message: string; imported: number } | null>(null);
  const [pluggyAccounts, setPluggyAccounts] = useState<PluggyAccount[]>([]);

  // ── Export state ──
  const [exportDateRange, setExportDateRange] = useState(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR');
    return `${fmt(first)} - ${fmt(last)}`;
  });

  // ── Bank logo helper ──

  // ── Fill the form from the server profile (only when the server values change) ──
  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setEmail(profile.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.name, profile?.email]);

  // ── Profile handlers ──
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const nameChanged = name !== profile?.name;
      const emailChanged = email !== profile?.email;
      if (!nameChanged && !emailChanged && !password) {
        toast({ title: 'Nada a salvar', description: 'Nenhuma alteração detectada.' });
        return;
      }
      if (password && password.length < MIN_PASSWORD_LENGTH) {
        toast({
          title: 'Senha curta',
          description: `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
          variant: 'destructive',
        });
        return;
      }

      // E-mail e senha são do Supabase Auth (é com eles que se faz login).
      if (emailChanged || password) {
        const { error } = await supabase.auth.updateUser({
          ...(emailChanged ? { email } : {}),
          ...(password ? { password } : {}),
        });
        if (error) throw error;
      }
      if (nameChanged) {
        setProfile(await SettingsService.updateProfile({ name }));
      }
      setPassword('');
      toast({
        title: 'Sucesso',
        description: emailChanged
          ? 'Perfil atualizado. Confirme o novo e-mail pelo link enviado.'
          : 'Perfil atualizado!',
      });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao salvar perfil.', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const hasProfileChanges =
    name !== profile?.name || email !== profile?.email || password.length > 0;

  const handleRemoveBank = async (bank: UserBank) => {
    try {
      await SettingsService.removeBank(bank.id);
      setBanks((prev) => prev.filter((b) => b.id !== bank.id));
      toast({ title: 'Banco removido', description: bank.bank_name });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao remover banco.', variant: 'destructive' });
    }
  };

  // ── Pluggy handlers ──
  const handleValidateKey = async () => {
    if (!pluggyApiKey) return;
    setValidating(true);
    setPluggyStatus(null);
    try {
      // Save key first, then validate
      await SettingsService.updateProfile({ pluggy_api_key: pluggyApiKey });
      setProfile((prev) => prev ? { ...prev, has_pluggy_key: true } : prev);
      setPluggyApiKey('');

      const result = await SettingsService.validatePluggyKey();
      setPluggyStatus({ ok: result.valid, message: result.message });
      if (result.valid) {
        const accounts = await SettingsService.listPluggyAccounts();
        setPluggyAccounts(accounts.accounts);
        toast({ title: 'Sucesso', description: 'API Key válida! Contas carregadas.' });
      }
    } catch {
      setPluggyStatus({ ok: false, message: 'Erro ao validar chave.' });
      toast({ title: 'Erro', description: 'Falha ao validar API Key.', variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  const handleSavePluggyKey = async () => {
    try {
      await SettingsService.updateProfile({ pluggy_api_key: pluggyApiKey });
      setProfile((prev) => prev ? { ...prev, has_pluggy_key: true } : prev);
      setPluggyApiKey('');
      toast({ title: 'Sucesso', description: 'API Key salva!' });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao salvar API Key.', variant: 'destructive' });
    }
  };

  const handleSyncPluggy = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await SettingsService.syncPluggy();
      setSyncResult(result);
      toast({ title: 'Sucesso', description: result.message });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao sincronizar.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  // ── Export handlers ──
  const handleExport = (format: 'csv' | 'ofx') => {
    const parts = exportDateRange.split('-').map((s) => s.trim());
    const dataInicio = parts[0] || '01/01/2000';
    const dataFinal = parts[1] || new Date().toLocaleDateString('pt-BR');

    // Validate format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(dataInicio) || !dateRegex.test(dataFinal)) {
      toast({
        title: 'Erro',
        description: 'Formato de data inválido. Use dd/mm/aaaa - dd/mm/aaaa.',
        variant: 'destructive',
      });
      return;
    }

    const url = format === 'csv'
      ? SettingsService.getExportCsvUrl(dataInicio, dataFinal)
      : SettingsService.getExportOfxUrl(dataInicio, dataFinal);

    const filename = `transacoes_${dataInicio.replace(/\//g, '')}_${dataFinal.replace(/\//g, '')}.${format}`;
    SettingsService.downloadExport(url, filename);
    toast({ title: 'Download iniciado', description: `Arquivo ${format.toUpperCase()} sendo baixado.` });
  };

  // ── Helpers ──
  return (
    <div className="min-h-screen bg-gradient-subtle px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <PageHeader
          icon={SettingsIcon}
          title="Configurações"
          description="Gerencie seu perfil e bancos vinculados"
          className="mb-8"
          hideTitleOnMobile
        />

        {/* ── Perfil ── */}
        <Card className="shadow-card border-none mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Nome
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email <span className="text-xs text-muted-foreground font-normal">(usado para login)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full"
              />
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nova senha (deixe em branco para manter)"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo {MIN_PASSWORD_LENGTH} caracteres. A senha é guardada pelo Supabase (login).
              </p>
            </div>

            {/* Save button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveProfile}
                disabled={!hasProfileChanges || savingProfile}
                className="gap-2"
              >
                {savingProfile ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Salvar alterações
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Meus Bancos ── (admin only) */}
        {isAdmin && (
        <Card className="shadow-card border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Banknote className="h-5 w-5 text-primary" />
              Meus Bancos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search input (busca na Brasil API + cria via API) */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Adicionar banco
              </Label>
              <BankSearchInput
                className="relative"
                onBankAdded={(bank) => setBanks((prev) => [...prev, bank])}
              />
            </div>

            {/* Banks list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Bancos adicionados
                  <span className="ml-2 text-muted-foreground font-normal">
                    ({banks.length})
                  </span>
                </Label>
              </div>

              {banks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Building2 className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Nenhum banco adicionado ainda</p>
                  <p className="text-xs">Busque acima para adicionar seus bancos</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {banks.map((bank, idx) => (
                    <div
                      key={bank.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/60 hover:border-border transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <BankLogo
                          code={bank.bank_code}
                          size="lg"
                          className="rounded-xl border border-border/40 p-1 shadow-sm"
                          alt={bank.bank_name}
                          fallback={<BankLogoFallback name={bank.bank_name} index={idx} size="lg" className="rounded-xl shadow-sm" />}
                        />
                        <div>
                          <div className="font-medium text-sm text-foreground">
                            {bank.bank_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Código: {bank.bank_code}
                          </div>
                        </div>
                      </div>
                      <Button aria-label="Excluir banco"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveBank(bank)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* ── Meu Pluggy ── (admin only) */}
        {isAdmin && (
        <Card className="shadow-card border-none mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
              Meu Pluggy — Open Finance
              <PluggyInfoDialog />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Conecte seus bancos via Open Finance. Crie uma conta grátis em{' '}
              <a href="https://meu.pluggy.ai" target="_blank" rel="noopener noreferrer" className="-my-3 inline-block py-3 text-primary hover:underline">
                meu.pluggy.ai
              </a>
              , conecte seus bancos lá e cole sua API Key abaixo.
            </p>

            {/* API Key */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">API Key do Meu Pluggy</Label>
              <div className="flex gap-2">
                <Input
                  value={pluggyApiKey}
                  onChange={(e) => setPluggyApiKey(e.target.value)}
                  placeholder={profile?.has_pluggy_key ? 'Chave configurada — cole outra para trocar' : 'Cole sua API Key aqui...'}
                  className="flex-1 font-mono text-sm"
                  type="password"
                />
                <Button
                  variant="outline"
                  onClick={handleValidateKey}
                  disabled={!pluggyApiKey || validating}
                >
                  {validating ? 'Validando...' : 'Validar'}
                </Button>
              </div>
              {pluggyStatus && (
                <p className={`text-xs ${pluggyStatus.ok ? 'text-success' : 'text-destructive'}`}>
                  {pluggyStatus.message}
                </p>
              )}
            </div>

            {/* Save API Key */}
            <div className="flex gap-2">
              <Button onClick={handleSavePluggyKey} disabled={!pluggyApiKey}>
                Salvar Chave
              </Button>
              <Button
                variant="secondary"
                onClick={handleSyncPluggy}
                disabled={!profile?.has_pluggy_key || syncing}
              >
                {syncing ? 'Sincronizando...' : 'Sincronizar Transações'}
              </Button>
            </div>

            {syncResult && (
              <div className={`p-3 rounded-lg text-sm ${
                syncResult.imported > 0 ? 'bg-success/10 text-success border border-success/30' : 'bg-muted text-muted-foreground'
              }`}>
                {syncResult.message}
              </div>
            )}

            {/* Connected accounts */}
            {pluggyAccounts.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Contas Conectadas ({pluggyAccounts.length})</Label>
                <div className="grid gap-2">
                  {pluggyAccounts.map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/60">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                          {acc.type === 'BANK' ? '🏦' : acc.type === 'CREDIT' ? '💳' : '📈'}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{acc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Saldo: {formatCurrency(acc.balance ?? 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* ── Exportar Dados ── (admin only) */}
        {isAdmin && (
        <Card className="shadow-card border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporte suas transações para backup ou para usar em outros aplicativos.
            </p>

            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Período:</Label>
              <Input
                type="text"
                value={exportDateRange}
                onChange={(e) => setExportDateRange(e.target.value)}
                placeholder="dd/mm/aaaa - dd/mm/aaaa"
                className="w-64 font-mono text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handleExport('csv')} className="gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Baixar CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport('ofx')} className="gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Baixar OFX
              </Button>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
};

export default Settings;
