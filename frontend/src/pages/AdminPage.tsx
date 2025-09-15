import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GenreManager } from '@/components/GenreManager';
import { McpTokenManager } from '@/components/McpTokenManager';
import { LlmModelManager } from '@/components/LlmModelManager';

export const AdminPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">管理画面</h1>
        <p className="text-gray-600 mt-1">
          ジャンル、フィード、MCP トークン、LLM モデルを管理できます
        </p>
      </div>

      <Tabs defaultValue="genres" className="w-full">
        <TabsList>
          <TabsTrigger value="genres">ジャンル/フィード</TabsTrigger>
          <TabsTrigger value="tokens">MCP トークン</TabsTrigger>
          <TabsTrigger value="llm">LLM モデル</TabsTrigger>
        </TabsList>

        <TabsContent value="genres" className="mt-6">
          <GenreManager />
        </TabsContent>

        <TabsContent value="tokens" className="mt-6">
          <McpTokenManager />
        </TabsContent>

        <TabsContent value="llm" className="mt-6">
          <LlmModelManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};