import { useEffect, useState, useCallback, useRef } from 'react';
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
  Search,
  Trash2,
  Plus,
  Check,
  X,
  Building2,
} from 'lucide-react';
import {
  SettingsService,
  Profile,
  UserBank,
  BrasilApiBank,
  PluggyAccount,
} from '@/services/settingsService';

const Settings = () => {
  const { toast } = useToast();

  // ── Profile state ──
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Banks state ──
  const [banks, setBanks] = useState<UserBank[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BrasilApiBank[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [addingBank, setAddingBank] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [logoErrors, setLogoErrors] = useState<Set<number>>(new Set());
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    const fmt = (d: Date) => d.toLocaleDateString('en-US');
    return `${fmt(first)} - ${fmt(last)}`;
  });

  // ── Bank logo helper ──
  const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png';
  const getBankLogoUrl = (code: string) => `${BANK_LOGO_CDN}/${code.padStart(3, '0')}.png`;

  // ── Load initial data ──
  const loadData = useCallback(async () => {
    try {
      const [profileData, banksData] = await Promise.all([
        SettingsService.getProfile(),
        SettingsService.listBanks(),
      ]);
      setProfile(profileData);
      setName(profileData.name);
      setEmail(profileData.email);
      setPluggyApiKey(profileData.pluggy_api_key || '');
      setBanks(banksData);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      toast({ title: 'Erro', description: 'Falha ao carregar configurações.', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Profile handlers ──
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const payload: Record<string, string> = {};
      if (name !== profile?.name) payload.name = name;
      if (email !== profile?.email) payload.email = email;
      if (password) payload.password = password;

      if (Object.keys(payload).length === 0) {
        toast({ title: 'Nada a salvar', description: 'Nenhuma alteração detectada.' });
        return;
      }

      const updated = await SettingsService.updateProfile(payload);
      setProfile(updated);
      setPassword('');
      toast({ title: 'Sucesso', description: 'Perfil atualizado!' });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao salvar perfil.', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const hasProfileChanges =
    name !== profile?.name || email !== profile?.email || password.length > 0;

  // ── Bank search ──
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await SettingsService.searchBrasilApi(searchQuery);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      setHighlightedIndex(results.length > 0 ? 0 : -1);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scroll highlighted item into view when navigating with keyboard
  useEffect(() => {
    if (highlightedIndex < 0 || !dropdownRef.current) return;
    const items = dropdownRef.current.querySelectorAll('button');
    if (items[highlightedIndex]) {
      items[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelectBank = async (bank: BrasilApiBank) => {
    setShowDropdown(false);
    setSearchQuery('');
    setAddingBank(true);
    try {
      const newBank = await SettingsService.addBank({
        bank_code: bank.code?.toString() || bank.ispb,
        bank_name: bank.fullName || bank.name,
      });
      setBanks((prev) => [...prev, newBank]);
      toast({ title: 'Banco adicionado', description: bank.fullName || bank.name });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao adicionar banco.', variant: 'destructive' });
    } finally {
      setAddingBank(false);
    }
  };

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
      setProfile((prev) => prev ? { ...prev, pluggy_api_key: pluggyApiKey } : prev);

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
      setProfile((prev) => prev ? { ...prev, pluggy_api_key: pluggyApiKey } : prev);
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
    const dataFinal = parts[1] || new Date().toLocaleDateString('en-US');

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
  const bankInitials = (name: string) => {
    const words = name.replace(/S\.A\.?$/i, '').trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0].slice(0, 2).toUpperCase();
  };

  const bankColors = [
    'bg-blue-500', 'bg-orange-500', 'bg-emerald-500', 'bg-purple-500',
    'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
    'bg-cyan-500', 'bg-amber-500', 'bg-lime-500', 'bg-rose-500',
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground">Gerencie seu perfil e bancos vinculados</p>
          </div>
        </div>

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
                Mínimo 6 caracteres. A senha é armazenada com hash (bcrypt).
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

        {/* ── Meus Bancos ── */}
        <Card className="shadow-card border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Banknote className="h-5 w-5 text-primary" />
              Meus Bancos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search input */}
            <div className="relative" ref={searchRef}>
              <Label className="text-sm font-medium mb-2 block">
                Adicionar banco
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (!showDropdown || searchResults.length === 0) return;

                    switch (e.key) {
                      case 'ArrowDown':
                        e.preventDefault();
                        setHighlightedIndex((prev) =>
                          prev < searchResults.length - 1 ? prev + 1 : prev
                        );
                        break;
                      case 'ArrowUp':
                        e.preventDefault();
                        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
                        break;
                      case 'Enter': {
                        e.preventDefault();
                        const idx =
                          highlightedIndex >= 0 && highlightedIndex < searchResults.length
                            ? highlightedIndex
                            : 0;
                        handleSelectBank(searchResults[idx]);
                        break;
                      }
                      case 'Escape':
                        e.preventDefault();
                        setShowDropdown(false);
                        setSearchQuery('');
                        break;
                    }
                  }}
                  placeholder="Digite o nome do banco... (Enter para adicionar)"
                  className="w-full pl-10 pr-4"
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Buscando...
                  </span>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {showDropdown && (
                <div
                  ref={dropdownRef}
                  className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden"
                >
                  {searchResults.map((bank, idx) => (
                    <button
                      key={bank.ispb}
                      onClick={() => handleSelectBank(bank)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      disabled={addingBank}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-b-0 disabled:opacity-50 ${
                        idx === highlightedIndex
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {bank.code || '--'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {bank.fullName || bank.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Código: {bank.code || 'N/A'} · ISPB: {bank.ispb}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
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
                        {logoErrors.has(bank.id) || !bank.bank_code ? (
                          <div
                            className={`w-10 h-10 rounded-xl ${bankColors[idx % bankColors.length]} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm`}
                          >
                            {bankInitials(bank.bank_name)}
                          </div>
                        ) : (
                          <img
                            src={getBankLogoUrl(bank.bank_code)}
                            alt={bank.bank_name}
                            className="w-10 h-10 rounded-xl object-contain bg-card border border-border/40 shrink-0 shadow-sm p-1"
                            onError={() => setLogoErrors((prev) => new Set(prev).add(bank.id))}
                          />
                        )}
                        <div>
                          <div className="font-medium text-sm text-foreground">
                            {bank.bank_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Código: {bank.bank_code}
                          </div>
                        </div>
                      </div>
                      <Button
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

        {/* ── Meu Pluggy ── */}
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
              <a href="https://meu.pluggy.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
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
                  placeholder="Cole sua API Key aqui..."
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
                <p className={`text-xs ${pluggyStatus.ok ? 'text-green-500' : 'text-red-500'}`}>
                  {pluggyStatus.message}
                </p>
              )}
            </div>

            {/* Save API Key */}
            <div className="flex gap-2">
              <Button onClick={handleSavePluggyKey} disabled={!pluggyApiKey || pluggyApiKey === profile?.pluggy_api_key}>
                Salvar Chave
              </Button>
              <Button
                variant="secondary"
                onClick={handleSyncPluggy}
                disabled={!profile?.pluggy_api_key || syncing}
              >
                {syncing ? 'Sincronizando...' : 'Sincronizar Transações'}
              </Button>
            </div>

            {syncResult && (
              <div className={`p-3 rounded-lg text-sm ${
                syncResult.imported > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-muted text-muted-foreground'
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
                            Saldo: R$ {acc.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

        {/* ── Exportar Dados ── */}
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
      </div>
    </div>
  );
};

export default Settings;
