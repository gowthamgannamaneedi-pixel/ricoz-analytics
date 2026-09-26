-- ==============================================================================
-- RicozAnalytics Phase 12: AI Analytics Assistant & Conversation History Migration
-- Engine: Supabase PostgreSQL 15+
-- File: server/migrations/20260927_ai_conversations.sql
-- ==============================================================================

-- 1. Create AI Conversations Table
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'New AI Analytics Conversation',
  dataset_id INTEGER REFERENCES public.datasets(id) ON DELETE SET NULL,
  dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create AI Messages Table
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent VARCHAR(100),
  query_plan JSONB DEFAULT '{}'::jsonb,
  data JSONB DEFAULT '[]'::jsonb,
  visualization JSONB DEFAULT '{}'::jsonb,
  sources JSONB DEFAULT '[]'::jsonb,
  confidence VARCHAR(50) DEFAULT 'high',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes for High-Performance Tenant & Conversation Lookups
CREATE INDEX IF NOT EXISTS idx_ai_conversations_org_id ON public.ai_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON public.ai_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON public.ai_messages(created_at ASC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- 5. Multi-Tenant Organization Isolation Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_conversations' AND policyname = 'ai_conversations_org_isolation'
  ) THEN
    CREATE POLICY ai_conversations_org_isolation ON public.ai_conversations
      USING (organization_id = public.get_auth_org_id())
      WITH CHECK (organization_id = public.get_auth_org_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_messages' AND policyname = 'ai_messages_conversation_isolation'
  ) THEN
    CREATE POLICY ai_messages_conversation_isolation ON public.ai_messages
      USING (
        conversation_id IN (
          SELECT id FROM public.ai_conversations 
          WHERE organization_id = public.get_auth_org_id()
        )
      )
      WITH CHECK (
        conversation_id IN (
          SELECT id FROM public.ai_conversations 
          WHERE organization_id = public.get_auth_org_id()
        )
      );
  END IF;
END $$;
