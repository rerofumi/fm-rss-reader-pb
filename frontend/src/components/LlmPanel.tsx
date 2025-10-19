import { useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useLlmStore } from '@/stores/llmStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Loader2, Trash2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const LlmPanel = () => {
  const { llmPanel, closeLlmPanel, pushToast } = useUiStore();
  const { running, result, error, summarize, translate, ask, cancel, clearResult } = useLlmStore();
  
  const [targetLang, setTargetLang] = useState('ja');
  const [question, setQuestion] = useState('');
  const [composingQuestion, setComposingQuestion] = useState(false);

  const handleSummarize = async () => {
    if (!llmPanel.article) return;
    
    try {
      clearResult();
      await summarize(llmPanel.article);
      pushToast('success', '要約が完了しました');
    } catch (error) {
      pushToast('error', '要約に失敗しました');
    }
  };

  const handleTranslate = async () => {
    if (!llmPanel.article || !targetLang) return;
    
    try {
      clearResult();
      await translate(llmPanel.article, targetLang);
      pushToast('success', '翻訳が完了しました');
    } catch (error) {
      pushToast('error', '翻訳に失敗しました');
    }
  };

  const handleAsk = async () => {
    if (!llmPanel.article || !question.trim()) return;
    
    try {
      clearResult();
      await ask(llmPanel.article, question.trim());
      pushToast('success', '質問への回答が完了しました');
    } catch (error) {
      pushToast('error', '質問の処理に失敗しました');
    }
  };

  const handleCancel = () => {
    cancel();
    pushToast('warning', '処理をキャンセルしました');
  };

  const handleQuestionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleClearQuestion = () => {
    setQuestion('');
  };

  const handleClearResult = () => {
    clearResult();
    pushToast('info', '結果をクリアしました');
  };

  const handleComposeQuestion = async () => {
    if (!question.trim()) return;

    setComposingQuestion(true);
    try {
      // LLMサービスを使って質問を構成（モデルを固定）
      const response = await fetch('/api/llm/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('pb_jwt') || ''}`,
        },
        body: JSON.stringify({
          type: 'ask',
          payload: {
            question: `あなたは、ローマ字と英語が混在したテキストを自然な日本語に変換する高度な日本語入力システムです。以下のルールに厳密に従ってください。
1.  入力テキストに含まれるローマ字の部分を、文脈に最も適した日本語（ひらがな、カタカナ、漢字）に変換します。
2.  入力テキストに含まれる英単語や英文は、そのまま英語として残します。大文字・小文字も維持してください。
3.  ローマ字入力の多少のタイプミスやスペルミスは、文脈から正しい日本語を推測して自動で修正してください。
4.  タイプミスや誤字脱字については修正しますが、文章の内容や語尾、口調等は変更しないでください。
5.  変換結果以外の余計な説明、前置き、後書きは一切含めず、変換後の日本語の文章のみを出力してください。
6.  入力が空の場合は、何も出力しないでください。
7.  入力内容が日本語だった場合、誤字脱字のチェックをしてください。文脈に沿った修正を行います。

以下のテキストを変換してください：
${question}`,
            context: 'テキスト変換タスク'
          },
          model: 'google/gemini-2.5-flash-lite', // モデルを固定
        }),
      });

      if (!response.ok) {
        throw new Error('変換に失敗しました');
      }

      const data = await response.json();
      const composedText = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);
      
      // 余計な説明を除去して純粋な変換結果のみを使用
      const cleanText = composedText.trim();
      if (cleanText) {
        setQuestion(cleanText);
        pushToast('success', '文章を構成しました');
      }
    } catch (error) {
      pushToast('error', '文章構成に失敗しました');
    } finally {
      setComposingQuestion(false);
    }
  };

  return (
    <Sheet open={llmPanel.open} onOpenChange={closeLlmPanel}>
      <SheetContent className="w-[600px] sm:max-w-[600px] h-full flex flex-col">
        <SheetHeader>
          <SheetTitle>AI アシスタント</SheetTitle>
          <SheetDescription>
            記事に対して要約、翻訳、質問を実行できます
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mr-6 pr-6">
          {llmPanel.article && (
            <div className="mt-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-sm text-gray-900 mb-2">対象記事</h4>
                <p className="text-sm text-gray-700 line-clamp-2">
                {llmPanel.article.title}
              </p>
            </div>

            <Tabs defaultValue={llmPanel.activeTab || 'summarize'} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summarize">要約</TabsTrigger>
                <TabsTrigger value="translate">翻訳</TabsTrigger>
                <TabsTrigger value="ask">質問</TabsTrigger>
              </TabsList>

              <TabsContent value="summarize" className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    記事の内容を要約します
                  </p>
                  <Button 
                    onClick={handleSummarize} 
                    disabled={running}
                    className="w-full"
                  >
                    {running ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        要約中...
                      </>
                    ) : (
                      '要約を実行'
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="translate" className="space-y-4">
                <div>
                  <Label htmlFor="target-lang">翻訳先言語</Label>
                  <Select value={targetLang} onValueChange={setTargetLang}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="en">英語</SelectItem>
                      <SelectItem value="ko">韓国語</SelectItem>
                      <SelectItem value="zh">中国語</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleTranslate} 
                  disabled={running}
                  className="w-full"
                >
                  {running ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      翻訳中...
                    </>
                  ) : (
                    '翻訳を実行'
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="ask" className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="question">質問内容</Label>
                    <div className="flex space-x-1">
                      {question.trim() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleComposeQuestion}
                          disabled={composingQuestion}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                          title="文章構成"
                        >
                          {composingQuestion ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {question.trim() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearQuestion}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                          title="クリア"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Textarea
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleQuestionKeyDown}
                    placeholder="記事について質問を入力してください"
                    className="mt-1"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ctrl+Enter で送信できます
                  </p>
                </div>
                <Button 
                  onClick={handleAsk} 
                  disabled={running || !question.trim()}
                  className="w-full"
                >
                  {running ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      処理中...
                    </>
                  ) : (
                    '質問を送信'
                  )}
                </Button>
              </TabsContent>
            </Tabs>

            {running && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleCancel}>
                  キャンセル
                </Button>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {result && (
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm text-gray-900">結果</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearResult}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto prose prose-sm max-w-none">
                  <ReactMarkdown>
                    {typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)}
                  </ReactMarkdown>
                </div>
                {result.usage && (
                  <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                    <p>トークン使用量: {result.usage.totalTokens || 0}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </SheetContent>
    </Sheet>
  );
};