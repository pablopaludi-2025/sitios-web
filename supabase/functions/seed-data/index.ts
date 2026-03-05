import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { data: adminUser } = await supabase.auth.admin.createUser({
      email: 'admin@vendemas.soynico.ai',
      password: '123456',
      email_confirm: true,
    })

    const adminId = adminUser?.user?.id
    if (adminId) {
      await supabase.from('user_roles').upsert({ user_id: adminId, role: 'admin' }, { onConflict: 'user_id,role' })
      await supabase.from('profiles').upsert({ user_id: adminId, full_name: 'Admin' }, { onConflict: 'user_id' })
    }

    const templates = [
      { name: 'Pizzería Clásica', rubro: 'pizzeria', description: 'Diseño cálido con tonos naranja y rojo', preview_color: '#f97316' },
      { name: 'Veterinaria Profesional', rubro: 'veterinaria', description: 'Diseño confiable en tonos verdes', preview_color: '#10b981' },
      { name: 'Bar Nocturno', rubro: 'bar', description: 'Diseño elegante en tonos violeta', preview_color: '#9333ea' },
      { name: 'Heladería Artesanal', rubro: 'heladeria', description: 'Diseño fresco en tonos rosa', preview_color: '#ec4899' },
      { name: 'Restaurant Gourmet', rubro: 'restaurant', description: 'Diseño sofisticado en tonos ámbar', preview_color: '#f59e0b' },
      { name: 'Gimnasio Moderno', rubro: 'gym', description: 'Diseño dinámico en azul y cyan', preview_color: '#3b82f6' },
      { name: 'Peluquería Estudio', rubro: 'peluqueria', description: 'Diseño moderno en fuchsia y rosa', preview_color: '#d946ef' },
      { name: 'Negocio General', rubro: 'otro', description: 'Diseño versátil en gris y slate', preview_color: '#6b7280' },
    ]

    const HERO_IMAGES: Record<string, string> = {
      pizzeria: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200',
      veterinaria: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=1200',
      bar: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200',
      heladeria: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=1200',
      restaurant: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200',
      gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200',
      peluqueria: 'https://images.unsplash.com/photo-1562322140-8baeababf0be?w=1200',
      otro: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
    }

    const ABOUT_IMAGES: Record<string, string> = {
      pizzeria: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
      veterinaria: 'https://images.unsplash.com/photo-1559190394-df5a28aab5c5?w=800',
      bar: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
      heladeria: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=800',
      restaurant: 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800',
      gym: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
      peluqueria: 'https://images.unsplash.com/photo-1560066984-138daaa0f8b5?w=800',
      otro: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
    }

    const insertedTemplates: Record<string, string> = {}
    for (const tpl of templates) {
      const { data: tplData } = await supabase
        .from('templates')
        .upsert(tpl, { onConflict: 'name' })
        .select()
        .single()

      if (tplData) {
        insertedTemplates[tpl.rubro] = tplData.id
        await supabase.from('template_sections').upsert([
          {
            template_id: tplData.id,
            type: 'hero',
            title: tpl.rubro === 'pizzeria' ? 'La mejor pizza del barrio' :
                   tpl.rubro === 'veterinaria' ? 'Tu mascota en las mejores manos' :
                   tpl.rubro === 'bar' ? 'Donde la noche cobra vida' :
                   tpl.rubro === 'heladeria' ? 'Helados que hacen feliz' :
                   tpl.rubro === 'restaurant' ? 'Una experiencia gastronómica única' :
                   tpl.rubro === 'gym' ? 'Tu mejor versión empieza acá' :
                   tpl.rubro === 'peluqueria' ? 'Tu imagen, nuestra pasión' : 'Bienvenidos a nuestro negocio',
            content: 'Los mejores productos y servicios para vos.',
            image_url: HERO_IMAGES[tpl.rubro],
            visible: true,
            sort_order: 0,
          },
          {
            template_id: tplData.id,
            type: 'about',
            title: 'Nuestra historia',
            content: 'Calidad y compromiso en cada servicio que ofrecemos.',
            image_url: ABOUT_IMAGES[tpl.rubro],
            visible: true,
            sort_order: 1,
          },
          {
            template_id: tplData.id,
            type: 'contact',
            title: 'Contactanos',
            content: 'Estamos disponibles para atenderte y responder todas tus consultas.',
            image_url: '',
            visible: true,
            sort_order: 2,
          },
        ], { onConflict: 'template_id,type' })
      }
    }

    const clientsData = [
      { name: 'Pizza al Paso', slug: 'pizza-al-paso', rubro: 'pizzeria', email: 'pizzaalpaso@cliente.com', whatsapp: '+5491112345678', setup_fee: 50000, monthly_fee: 15000 },
      { name: 'Patitas Felices', slug: 'patitas-felices', rubro: 'veterinaria', email: 'patitasfelices@cliente.com', whatsapp: '+5491123456789', setup_fee: 40000, monthly_fee: 12000 },
      { name: 'Bar Nocturno', slug: 'bar-nocturno', rubro: 'bar', email: 'barnocturno@cliente.com', whatsapp: '+5491134567890', setup_fee: 60000, monthly_fee: 18000 },
      { name: 'Helados Cremosos', slug: 'helados-cremosos', rubro: 'heladeria', email: 'heladoscremosos@cliente.com', whatsapp: '+5491145678901', setup_fee: 35000, monthly_fee: 10000 },
      { name: 'Sabores del Sur', slug: 'sabores-del-sur', rubro: 'restaurant', email: 'saboresdelsur@cliente.com', whatsapp: '+5491156789012', setup_fee: 55000, monthly_fee: 16000 },
      { name: 'Café de Barrio', slug: 'cafe-de-barrio', rubro: 'otro', email: 'cafedebarrio@cliente.com', whatsapp: '+5491167890123', setup_fee: 30000, monthly_fee: 9000 },
      { name: 'Fuerza Gym', slug: 'fuerza-gym', rubro: 'gym', email: 'fuerzagym@cliente.com', whatsapp: '+5491178901234', setup_fee: 45000, monthly_fee: 14000 },
      { name: 'Mercado Natural', slug: 'mercado-natural', rubro: 'otro', email: 'mercadonatural@cliente.com', whatsapp: '+5491189012345', setup_fee: 40000, monthly_fee: 12000 },
    ]

    for (const clientInfo of clientsData) {
      const { data: insertedClient } = await supabase
        .from('clients')
        .upsert({
          ...clientInfo,
          phone: clientInfo.whatsapp,
          enabled_products: ['landing', 'catalogo', 'plan_contenido', 'redes_sociales'],
          template_id: insertedTemplates[clientInfo.rubro],
          chatbot_enabled: true,
          ecommerce_enabled: true,
          mercadopago_enabled: false,
          status: 'active',
        }, { onConflict: 'slug' })
        .select()
        .single()

      if (insertedClient) {
        const { data: userData } = await supabase.auth.admin.createUser({
          email: clientInfo.email,
          password: '123456',
          email_confirm: true,
        })

        if (userData?.user) {
          await supabase.from('user_roles').upsert(
            { user_id: userData.user.id, role: 'client' },
            { onConflict: 'user_id,role' }
          )
          await supabase.from('profiles').upsert(
            { user_id: userData.user.id, full_name: clientInfo.name, client_id: insertedClient.id },
            { onConflict: 'user_id' }
          )
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
