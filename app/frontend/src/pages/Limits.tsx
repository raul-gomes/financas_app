import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LimitsTab } from '@/components/limits/LimitsTab'
import { RecorrentesTab } from '@/components/limits/RecorrentesTab'
import { MetasTab } from '@/components/limits/MetasTab'
import { ComprasTab } from '@/components/limits/ComprasTab'
import { cn } from '@/lib/utils'
import { useRole } from '@/contexts/RoleContext'
import { useIsMobile } from '@/hooks/use-mobile'
import { ChipGroup, type ChipOption } from '@/components/ui/chip-group'
import { SegmentedControl } from '@/components/ui/segmented-control'

type EntityTypeFilter = 'pf' | 'pj' | 'all'
type LimitsSection = 'limits' | 'recorrentes' | 'metas' | 'compras'

const SCOPE_OPTIONS = [
    { value: 'pf', label: 'PF' },
    { value: 'pj', label: 'PJ' },
] as const

/** Chips of the mobile page; Metas and Compras are admin only. */
const sectionOptions = (isAdmin: boolean): ChipOption<LimitsSection>[] => [
    { value: 'limits', label: 'Categorias' },
    { value: 'recorrentes', label: 'Recorrentes' },
    ...(isAdmin ? [{ value: 'metas' as const, label: 'Metas' }, { value: 'compras' as const, label: 'Compras' }] : []),
]

// ===== Main Page =====
const Limits = () => {
    const { isAdmin } = useRole();
    const isMobile = useIsMobile();
    const [entityType, setEntityType] = useState<EntityTypeFilter>('pf')
    const [section, setSection] = useState<LimitsSection>('limits')

    if (isMobile) {
        // The top bar already shows the page title; sections are chips, PF/PJ a segmented control
        const scope = entityType === 'pj' ? 'pj' : 'pf'
        return (
            <div className="min-h-screen bg-gradient-subtle px-4 py-4 space-y-3">
                <ChipGroup
                    aria-label="Seções de limites"
                    variant="tabs"
                    bleed
                    options={sectionOptions(isAdmin)}
                    value={section}
                    onChange={setSection}
                />
                <SegmentedControl aria-label="Tipo de conta" options={SCOPE_OPTIONS} value={scope} onChange={setEntityType} fill />
                {section === 'limits' && <LimitsTab entityTypeFilter={scope} />}
                {section === 'recorrentes' && <RecorrentesTab entityTypeFilter={scope} />}
                {isAdmin && section === 'metas' && <MetasTab entityTypeFilter={scope} />}
                {isAdmin && section === 'compras' && <ComprasTab entityTypeFilter={scope} />}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-subtle px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">Limites</h1>
                            <p className="text-muted-foreground">Gerencie limites e contas recorrentes</p>
                        </div>
                        {/* PF/PJ Toggle */}
                        <div className="flex items-center bg-muted rounded-lg p-1">
                            <button
                                onClick={() => setEntityType('pf')}
                                className={cn(
                                    'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                                    entityType === 'pf'
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                PF
                            </button>
                            <button
                                onClick={() => setEntityType('pj')}
                                className={cn(
                                    'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                                    entityType === 'pj'
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                PJ
                            </button>
                        </div>
                    </div>
                </div>
                <Tabs defaultValue="limits" className="w-full">
                    <TabsList className={cn("grid w-full mb-8", isAdmin ? "grid-cols-4" : "grid-cols-2")}>
                        <TabsTrigger value="limits">Limites</TabsTrigger>
                        <TabsTrigger value="recorrentes">Recorrentes</TabsTrigger>
                        {isAdmin && <TabsTrigger value="metas">Metas</TabsTrigger>}
                        {isAdmin && <TabsTrigger value="compras">Compras</TabsTrigger>}
                    </TabsList>
                    <TabsContent value="limits"><LimitsTab entityTypeFilter={entityType} /></TabsContent>
                    <TabsContent value="recorrentes"><RecorrentesTab entityTypeFilter={entityType} /></TabsContent>
                    {isAdmin && <TabsContent value="metas"><MetasTab entityTypeFilter={entityType} /></TabsContent>}
                    {isAdmin && <TabsContent value="compras"><ComprasTab entityTypeFilter={entityType} /></TabsContent>}
                </Tabs>
            </div>
        </div>
    )
}

export default Limits
