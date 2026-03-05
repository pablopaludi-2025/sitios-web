-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create enum for roles
create type app_role as enum ('admin', 'client');

-- Create tables
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  rubro text not null,
  email text not null,
  phone text,
  whatsapp text,
  plan text,
  enabled_products text[] default '{}',
  template_id uuid,
  chatbot_enabled boolean default false,
  ecommerce_enabled boolean default false,
  mercadopago_enabled boolean default false,
  status text default 'setup',
  setup_fee numeric default 0,
  monthly_fee numeric default 0,
  created_at timestamptz default now()
);

create table if not exists catalog_products (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  name text not null,
  description text,
  price numeric default 0,
  image_url text,
  category text,
  available boolean default true,
  created_at timestamptz default now(),
  unique(client_id, name)
);

create table if not exists content_posts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  day integer not null,
  photo_name text,
  photo_description text,
  copy text not null,
  image_url text,
  scheduled_date date,
  created_at timestamptz default now()
);

create table if not exists content_plan_jobs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  status text default 'pending',
  progress integer default 0,
  posts_count integer default 0,
  images_count integer default 0,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists templates (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  rubro text not null,
  description text,
  preview_color text,
  created_at timestamptz default now()
);

create table if not exists template_sections (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references templates(id) on delete cascade,
  type text not null,
  title text,
  content text,
  image_url text,
  visible boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique(template_id, type)
);

create table if not exists chatbot_conversations (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  messages jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  customer_address text,
  customer_notes text,
  items jsonb default '[]',
  total numeric default 0,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  full_name text,
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id, role)
);

-- Security functions
create or replace function has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function get_my_client_id()
returns uuid
language sql stable security definer
as $$
  select client_id from profiles where user_id = auth.uid()
$$;

-- RLS policies
alter table clients enable row level security;
alter table catalog_products enable row level security;
alter table content_posts enable row level security;
alter table content_plan_jobs enable row level security;
alter table templates enable row level security;
alter table template_sections enable row level security;
alter table chatbot_conversations enable row level security;
alter table orders enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;

-- Clients policies
create policy "Admins can do everything on clients" on clients
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "Clients can view their own client" on clients
  for select to authenticated
  using (id = get_my_client_id());

-- Catalog products policies
create policy "Admins can do everything on catalog_products" on catalog_products
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "Clients can manage their own products" on catalog_products
  for all to authenticated
  using (client_id = get_my_client_id())
  with check (client_id = get_my_client_id());

create policy "Public can view available products" on catalog_products
  for select to anon
  using (available = true);

-- Content posts policies
create policy "Admins can do everything on content_posts" on content_posts
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "Clients can manage their own posts" on content_posts
  for all to authenticated
  using (client_id = get_my_client_id())
  with check (client_id = get_my_client_id());

-- Content plan jobs policies
create policy "Admins can do everything on content_plan_jobs" on content_plan_jobs
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "Clients can view their own jobs" on content_plan_jobs
  for select to authenticated
  using (client_id = get_my_client_id());

-- Templates policies
create policy "Everyone can read templates" on templates
  for select using (true);

create policy "Admins can manage templates" on templates
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Template sections policies
create policy "Everyone can read template sections" on template_sections
  for select using (true);

create policy "Admins can manage template sections" on template_sections
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "Clients can update their own template sections" on template_sections
  for update to authenticated
  using (template_id = (select template_id from clients where id = get_my_client_id()))
  with check (template_id = (select template_id from clients where id = get_my_client_id()));

-- Chatbot conversations policies
create policy "Admins can manage all conversations" on chatbot_conversations
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "Clients can view their own conversations" on chatbot_conversations
  for select to authenticated
  using (client_id = get_my_client_id());

create policy "Public can create and update conversations" on chatbot_conversations
  for all to anon using (true) with check (true);

-- Orders policies
create policy "Admins can manage all orders" on orders
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "Clients can manage their own orders" on orders
  for all to authenticated
  using (client_id = get_my_client_id())
  with check (client_id = get_my_client_id());

create policy "Public can create orders" on orders
  for insert to anon with check (true);

-- Profiles policies
create policy "Users can view their own profile" on profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy "Admins can manage all profiles" on profiles
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- User roles policies
create policy "Users can view their own roles" on user_roles
  for select to authenticated
  using (user_id = auth.uid());

create policy "Admins can manage user roles" on user_roles
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Storage buckets (run these in Supabase dashboard)
-- insert into storage.buckets (id, name, public) values ('content-images', 'content-images', true);
-- insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);
