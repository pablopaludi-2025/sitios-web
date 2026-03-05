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

  const { clientId } = await req.json()

  const { data: job } = await supabase.from('content_plan_jobs').insert({
    client_id: clientId,
    status: 'pending',
    progress: 0,
    posts_count: 0,
    images_count: 0,
  }).select().single()

  const jobId = job?.id

  // @ts-ignore - Deno EdgeRuntime
  EdgeRuntime.waitUntil(generatePlan(supabase, clientId, jobId))

  return new Response(JSON.stringify({ success: true, jobId }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

async function generatePlan(supabase: ReturnType<typeof createClient>, clientId: string, jobId: string) {
  const updateJob = async (updates: Record<string, unknown>) => {
    await supabase.from('content_plan_jobs').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', jobId)
  }

  try {
    const { data: client } = await supabase.from('clients').select('name, rubro').eq('id', clientId).single()
    const { data: products } = await supabase.from('catalog_products').select('name, price, description').eq('client_id', clientId).limit(10)

    await updateJob({ status: 'generating_text', progress: 5 })

    const productList = (products ?? []).map((p: { name: string; price: number; description?: string }) => `- ${p.name}: $${p.price}`).join('\n')

    const textResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY') ?? ''}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vendemas.soynico.ai',
        'X-Title': 'Vendé más IA Content Generator',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{
          role: 'user',
          content: `Creá un plan de contenido de 30 posts para Instagram para "${client?.name}" (rubro: ${client?.rubro}).

Productos:
${productList || 'Sin productos especificados'}

Para cada post:
- photo_name: nombre descriptivo de la foto
- photo_description: descripción detallada de la foto a tomar
- copy: texto para Instagram en español rioplatense, máx 150 chars, con emojis y hashtags

Respondé SOLO con JSON array válido, sin markdown:
[{"day":1,"photo_name":"...","photo_description":"...","copy":"..."},...]`
        }],
        max_tokens: 8000,
        temperature: 0.8,
      }),
    })

    const textData = await textResponse.json()
    const textContent = textData.choices?.[0]?.message?.content ?? '[]'

    let posts: Array<{ day: number; photo_name: string; photo_description: string; copy: string }> = []
    try {
      const cleaned = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      posts = JSON.parse(cleaned)
    } catch {
      for (let i = 1; i <= 30; i++) {
        posts.push({
          day: i,
          photo_name: `Foto del día ${i}`,
          photo_description: `Foto del negocio ${client?.name}`,
          copy: `¡Hola! Conocé nuestros productos y servicios. ✨ #${client?.rubro} #vendemas`,
        })
      }
    }

    await updateJob({ status: 'generating_text', progress: 30, posts_count: posts.length })

    await supabase.from('content_posts').delete().eq('client_id', clientId)

    for (const post of posts) {
      const scheduledDate = new Date()
      scheduledDate.setDate(scheduledDate.getDate() + post.day)
      await supabase.from('content_posts').insert({
        client_id: clientId,
        day: post.day,
        photo_name: post.photo_name,
        photo_description: post.photo_description,
        copy: post.copy,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        image_url: `https://picsum.photos/seed/${clientId}-${post.day}/1080/1350`,
      })
    }

    await updateJob({ status: 'generating_images', progress: 60 })

    // Simulate image generation progress
    for (let i = 0; i < posts.length; i++) {
      const progress = 60 + Math.round((i / posts.length) * 38)
      await updateJob({ progress, images_count: i + 1 })
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    await updateJob({ status: 'completed', progress: 100, images_count: posts.length })
  } catch (err) {
    await supabase.from('content_plan_jobs').update({
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown error',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
  }
}
