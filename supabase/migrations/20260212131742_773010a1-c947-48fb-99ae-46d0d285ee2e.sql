
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- has_role helper (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Agents table
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone_number TEXT,
  ward_number TEXT,
  ward_name TEXT,
  pin TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_amount NUMERIC DEFAULT 0,
  payment_reference TEXT,
  payment_sent_at TIMESTAMPTZ,
  last_report_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  operator_id UUID REFERENCES auth.users(id) NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('turnout_update', 'incident', 'material_shortage', 'emergency', 'other')),
  details TEXT NOT NULL,
  ward_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Broadcasts table
CREATE TABLE public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- user_roles: only admins can manage
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- profiles: users read own, admins read all
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "System creates profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- agents: admins full, operators read + update verification
CREATE POLICY "Admins manage agents" ON public.agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators read agents" ON public.agents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Operators verify agents" ON public.agents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'operator'));

-- reports: admins full, operators create + read
CREATE POLICY "Admins manage reports" ON public.reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators read reports" ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Operators create reports" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'operator') AND auth.uid() = operator_id);

-- broadcasts: admins create, all authenticated read
CREATE POLICY "Admins manage broadcasts" ON public.broadcasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators read broadcasts" ON public.broadcasts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator'));
