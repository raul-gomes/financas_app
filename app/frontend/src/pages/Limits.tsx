import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LimitsTab } from '@/components/limits/LimitsTab'
import { RecorrentesTab } from '@/components/limits/RecorrentesTab'
import { MetasTab } from '@/components/limits/MetasTab'
import { ComprasTab } from '@/components/limits/ComprasTab'
import { cn } from '@/lib/utils'

type EntityTypeFilter = 'pf' | 'pj' | 'all'

// ===== Main Page =====
const Limits = () => {
    const [entityType, setEntityType] = useState<EntityTypeFilter>('pf')

    return (
        <div className="min-h-screen bg-gradient-subtle px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">Configurações</h1>
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
                    <TabsList className="grid w-full grid-cols-4 mb-8">
                        <TabsTrigger value="limits">Limites</TabsTrigger>
                        <TabsTrigger value="recorrentes">Recorrentes</TabsTrigger>
                        <TabsTrigger value="metas">Metas</TabsTrigger>
                        <TabsTrigger value="compras">Compras</TabsTrigger>
                    </TabsList>
                    <TabsContent value="limits"><LimitsTab entityTypeFilter={entityType} /></TabsContent>
                    <TabsContent value="recorrentes"><RecorrentesTab entityTypeFilter={entityType} /></TabsContent>
                    <TabsContent value="metas"><MetasTab entityTypeFilter={entityType} /></TabsContent>
                    <TabsContent value="compras"><ComprasTab entityTypeFilter={entityType} /></TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

export default Limits
