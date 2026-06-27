import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LimitsTab } from '@/components/limits/LimitsTab'
import { RecorrentesTab } from '@/components/limits/RecorrentesTab'
import { MetasTab } from '@/components/limits/MetasTab'
import { ComprasTab } from '@/components/limits/ComprasTab'

// ===== Main Page =====
const Limits = () => (
    <div className="min-h-screen bg-gradient-subtle px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Configurações</h1>
                <p className="text-muted-foreground">Gerencie limites e contas recorrentes</p>
            </div>
            <Tabs defaultValue="limits" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                    <TabsTrigger value="limits">Limites</TabsTrigger>
                    <TabsTrigger value="recorrentes">Recorrentes</TabsTrigger>
                    <TabsTrigger value="metas">Metas</TabsTrigger>
                    <TabsTrigger value="compras">Compras</TabsTrigger>
                </TabsList>
                <TabsContent value="limits"><LimitsTab /></TabsContent>
                <TabsContent value="recorrentes"><RecorrentesTab /></TabsContent>
                <TabsContent value="metas"><MetasTab /></TabsContent>
                <TabsContent value="compras"><ComprasTab /></TabsContent>
            </Tabs>
        </div>
    </div>
)

export default Limits
