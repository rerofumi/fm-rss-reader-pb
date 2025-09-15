import { useEffect, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Settings } from 'lucide-react';

const DEFAULT_MODEL = 'openai/gpt-oss-20b:free';

const PRESET_MODELS = [
  { value: 'qwen/qwen3-235b-a22b-2507', label: 'Qwen Qwen3 235B A22B 2507' },
  { value: 'openai/gpt-oss-120b', label: 'OpenAI GPT-OSS 120B' },
  { value: 'google/gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
  { value: 'openai/gpt-5-mini', label: 'OpenAI GPT-5 Mini' },
  { value: 'nousresearch/hermes-4-405b', label: 'NousResearch Hermes 4 405B' },
  { value: 'switchpoint/router', label: 'SwitchPoint Router' },
];

export const LlmModelManager = () => {
  const { pushToast } = useUiStore();
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [customModel, setCustomModel] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    // localStorage から保存されたモデルを読み込み
    const savedModel = localStorage.getItem('llm_model');
    if (savedModel) {
      if (PRESET_MODELS.some(model => model.value === savedModel)) {
        setSelectedModel(savedModel);
        setIsCustom(false);
      } else {
        setCustomModel(savedModel);
        setIsCustom(true);
      }
    }
  }, []);

  const handleModelChange = (value: string) => {
    if (value === 'custom') {
      setIsCustom(true);
    } else {
      setSelectedModel(value);
      setIsCustom(false);
      localStorage.setItem('llm_model', value);
      pushToast('success', 'LLMモデルを保存しました');
    }
  };

  const handleCustomModelSave = () => {
    if (!customModel.trim()) {
      pushToast('error', 'モデル名を入力してください');
      return;
    }

    localStorage.setItem('llm_model', customModel.trim());
    pushToast('success', 'カスタムLLMモデルを保存しました');
  };

  const getCurrentModel = () => {
    if (isCustom) {
      return customModel || DEFAULT_MODEL;
    }
    return selectedModel;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>LLM モデル設定</span>
          </CardTitle>
          <CardDescription>
            LLM リクエストで使用するモデルを設定します。設定はブラウザに保存されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="model-select">モデル選択</Label>
              <Select value={isCustom ? 'custom' : selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">カスタムモデル...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCustom && (
              <div>
                <Label htmlFor="custom-model">カスタムモデル名</Label>
                <div className="flex space-x-2 mt-1">
                  <Input
                    id="custom-model"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="例: openai/gpt-4"
                    className="flex-1"
                  />
                  <Button onClick={handleCustomModelSave}>
                    保存
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  モデル名はプロバイダー/モデル名 の形式で入力してください
                </p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-900">現在の設定</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              使用モデル: <code className="bg-white px-2 py-1 rounded text-xs">{getCurrentModel()}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>利用可能なモデル</CardTitle>
          <CardDescription>
            よく使用されるLLMモデルの一覧です
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PRESET_MODELS.map((model) => (
              <div
                key={model.value}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedModel === model.value && !isCustom
                    ? 'bg-blue-50 border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleModelChange(model.value)}
              >
                <p className="text-sm font-medium">{model.label}</p>
                <p className="text-xs text-gray-500 mt-1">{model.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};