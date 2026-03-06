import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async function(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { messages, clientId, clientName, conversationId } = await req.json()

    const { data: clientData } = await supabase
      .from('clients')
      .select('name, rubro, email, phone, whatsapp')
      .eq('id', clientId)
      .single()

    const systemPrompt = `Sos el asistente virtual de ${clientData?.name ?? clientName}.
Respondés en español rioplatense (usás vos, hacés, tenés, etc.).
NO usás markdown en tus respuestas.
Tu objetivo es ayudar a los clientes, responder consultas sobre productos y servicios.
De forma natural, intentás capturar el nombre, email y teléfono del visitante cuando sea apropiado.
Rubro: ${clientData?.rubro ?? 'general'}.
Email del negocio: ${clientData?.email ?? 'no disponible'}.
Teléfono: ${clientData?.phone ?? 'no disponible'}.
WhatsApp: ${clientData?.whatsapp ?? 'no disponible'}.
Respondés en no más de 3 oraciones salvo que sea necesario.`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY') ?? ''}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vendemas.soynico.ai',
        'X-Title': 'Vendé más IA Chatbot',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    const aiData = await response.json()
    const content = aiData.choices?.[0]?.message?.content ?? 'Lo siento, no pude procesar tu consulta.'

    let convId = conversationId
    const updatedMessages = [...messages, { role: 'assistant', content }]

    if (convId) {
      await supabase.from('chatbot_conversations').update({
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      }).eq('id', convId)
    } else {
      const { data: conv } = await supabase.from('chatbot_conversations').insert({
        client_id: clientId,
        messages: updatedMessages,
      }).select().single()
      convId = conv?.id
    }

    return new Response(JSON.stringify({ content, conversationId: convId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
