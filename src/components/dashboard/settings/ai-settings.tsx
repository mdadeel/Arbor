'use client'

import { useState } from 'react'
import {
  Bot,
  CheckCircle2,
  Key,
  Loader2,
  Lock,
  Save,
  Sparkles,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function AiSettings() {
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [saved, setSaved] = useState(false)

  const updateSettings = trpc.ai.updateSettings.useMutation({
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    updateSettings.mutate({
      openaiApiKey: openaiKey.trim() || undefined,
      anthropicApiKey: anthropicKey.trim() || undefined,
      aiModel: model,
    })
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Integrations & BYOK (Bring Your Own Key)
        </CardTitle>
        <CardDescription className="text-xs">
          Configure external LLM providers to enable AI doc assistant, AST finding explanations, and release note drafting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-primary" />
              Default Model Preference
            </label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">OpenAI GPT-4o (High Accuracy)</SelectItem>
                <SelectItem value="gpt-4o-mini">OpenAI GPT-4o Mini (Fast & Cheap)</SelectItem>
                <SelectItem value="claude-3-5-sonnet-20240620">Anthropic Claude 3.5 Sonnet</SelectItem>
                <SelectItem value="claude-3-haiku-20240307">Anthropic Claude 3 Haiku</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-emerald-400" />
              OpenAI API Key
            </label>
            <Input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="text-xs h-9 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-amber-400" />
              Anthropic API Key
            </label>
            <Input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="text-xs h-9 font-mono"
            />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 p-2.5 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0 text-primary" />
            <span>
              All API keys are encrypted at application layer using AES-256-GCM. Keys never leave the server unencrypted.
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            {saved ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                AI Preferences Saved
              </span>
            ) : (
              <span />
            )}

            <Button
              type="submit"
              size="sm"
              disabled={updateSettings.isPending}
              className="gap-1.5 text-xs"
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Preferences
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
