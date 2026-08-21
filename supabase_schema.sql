-- ========================================================
-- ESQUEMA DE BASE DE DATOS Y STORAGE PARA EVIDENCE CHAT VIEWER
-- (VERSIÓN CON SINCRONIZACIÓN DE MENSAJES OCULTOS Y MULTI-DISPOSITIVO)
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- ========================================================

-- 1. Habilitar extensión para UUIDs si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE CHATS (Guardado de Sesiones de Chat)
-- Nota: 'id' y 'user_id' son TEXT porque generamos IDs personalizados (ej. 'case-12345')
-- y usamos el 'username' como user_id.
CREATE TABLE IF NOT EXISTS public.chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  export_file_name TEXT NOT NULL,
  parsed_date TIMESTAMPTZ DEFAULT NOW(),
  total_messages INT DEFAULT 0,
  total_media INT DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  timeline_json JSONB DEFAULT '[]'::jsonb,
  participants_json JSONB DEFAULT '[]'::jsonb,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA DE MENSAJES (Estructurados para búsquedas ultra rápidas)
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  msg_index INT NOT NULL,
  timestamp BIGINT NOT NULL,
  date_str TEXT NOT NULL,
  time_str TEXT NOT NULL,
  sender TEXT NOT NULL,
  is_me BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  text TEXT DEFAULT '',
  media_file_name TEXT,
  media_type TEXT,
  media_url TEXT,
  raw_line TEXT,
  hash TEXT NOT NULL DEFAULT '',
  bookmarked BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE CONFIGURACIÓN Y MENSAJES OCULTOS POR USUARIO (SINCRONIZACIÓN EN LA NUBE)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id TEXT PRIMARY KEY,
  hidden_ids JSONB DEFAULT '[]'::jsonb,
  config_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ÍNDICES DE RENDIMIENTO PARA SOPORTAR CHATS PESADOS (>100,000 MENSAJES)
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON public.chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(chat_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_messages_bookmarked ON public.messages(chat_id, bookmarked) WHERE bookmarked = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- 6. SEGURIDAD A NIVEL DE FILAS (ROW LEVEL SECURITY - RLS)
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para la tabla CHATS
DROP POLICY IF EXISTS "Acceso total chats" ON public.chats;
CREATE POLICY "Acceso total chats"
  ON public.chats FOR ALL
  USING (true)
  WITH CHECK (true);

-- Políticas para la tabla MENSAJES
DROP POLICY IF EXISTS "Acceso total mensajes" ON public.messages;
CREATE POLICY "Acceso total mensajes"
  ON public.messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Políticas para la tabla USER_SETTINGS (Mensajes ocultos multidispositivo)
DROP POLICY IF EXISTS "Acceso total user_settings" ON public.user_settings;
CREATE POLICY "Acceso total user_settings"
  ON public.user_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. BUCKETS DE ALMACENAMIENTO DE ARCHIVOS (STORAGE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true),
       ('chat-zips', 'chat-zips', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Seguridad para Storage (Bucket chat-media)
DROP POLICY IF EXISTS "Acceso total chat-media" ON storage.objects;
CREATE POLICY "Acceso total chat-media"
  ON storage.objects FOR ALL
  USING (bucket_id = 'chat-media')
  WITH CHECK (bucket_id = 'chat-media');
