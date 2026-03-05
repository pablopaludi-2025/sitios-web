import type { Template, TemplateSection } from '@/types'

export const mockTemplates: (Template & { sections: TemplateSection[] })[] = [
  {
    id: 'tpl-pizzeria',
    name: 'Pizzería Clásica',
    rubro: 'pizzeria',
    description: 'Diseño cálido con tonos naranja y rojo, ideal para pizzerías y restaurantes de comida italiana.',
    preview_color: '#f97316',
    sections: [
      { id: 's1', template_id: 'tpl-pizzeria', type: 'hero', title: 'La mejor pizza del barrio', content: 'Masa artesanal, ingredientes frescos y el sabor de siempre. Hacé tu pedido ahora.', image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200', visible: true, sort_order: 0 },
      { id: 's2', template_id: 'tpl-pizzeria', type: 'about', title: 'Nuestra historia', content: 'Desde 2010 elaboramos pizzas con recetas familiares transmitidas de generación en generación. Usamos solo ingredientes frescos y de primera calidad.', image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800', visible: true, sort_order: 1 },
      { id: 's3', template_id: 'tpl-pizzeria', type: 'contact', title: 'Visitanos o pedí a domicilio', content: 'Estamos abiertos todos los días de 18:00 a 00:00. También hacemos envíos a domicilio.', image_url: '', visible: true, sort_order: 2 },
    ],
  },
  {
    id: 'tpl-veterinaria',
    name: 'Veterinaria Profesional',
    rubro: 'veterinaria',
    description: 'Diseño confiable en tonos verdes, transmite cuidado y profesionalismo para tu veterinaria.',
    preview_color: '#10b981',
    sections: [
      { id: 's4', template_id: 'tpl-veterinaria', type: 'hero', title: 'Tu mascota en las mejores manos', content: 'Atención veterinaria de calidad con el cariño que tu compañero merece. Turnos disponibles.', image_url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=1200', visible: true, sort_order: 0 },
      { id: 's5', template_id: 'tpl-veterinaria', type: 'services', title: 'Nuestros servicios', content: 'Consultas generales, vacunación, cirugías, estética canina, ecografías y mucho más. Contamos con equipamiento de última generación.', image_url: 'https://images.unsplash.com/photo-1559190394-df5a28aab5c5?w=800', visible: true, sort_order: 1 },
      { id: 's6', template_id: 'tpl-veterinaria', type: 'contact', title: 'Contactanos', content: 'Atendemos de lunes a sábado de 9:00 a 20:00. Emergencias las 24 horas.', image_url: '', visible: true, sort_order: 2 },
    ],
  },
  {
    id: 'tpl-bar',
    name: 'Bar Nocturno',
    rubro: 'bar',
    description: 'Diseño elegante y oscuro en tonos violeta, perfecto para bares y pubs.',
    preview_color: '#9333ea',
    sections: [
      { id: 's7', template_id: 'tpl-bar', type: 'hero', title: 'Donde la noche cobra vida', content: 'Tragos artesanales, música en vivo y el ambiente más cool de la ciudad. ¡Te esperamos!', image_url: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200', visible: true, sort_order: 0 },
      { id: 's8', template_id: 'tpl-bar', type: 'about', title: 'Nuestra propuesta', content: 'Más de 80 opciones de cocteles artesanales preparados por nuestros bartenders. Happy hour de 18 a 21hs.', image_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800', visible: true, sort_order: 1 },
      { id: 's9', template_id: 'tpl-bar', type: 'contact', title: 'Dónde encontrarnos', content: 'Abrimos de jueves a domingo desde las 19:00. Reservas por WhatsApp.', image_url: '', visible: true, sort_order: 2 },
    ],
  },
  {
    id: 'tpl-heladeria',
    name: 'Heladería Artesanal',
    rubro: 'heladeria',
    description: 'Diseño fresco y colorido en tonos rosa, ideal para heladerías y pastelerías.',
    preview_color: '#ec4899',
    sections: [
      { id: 's10', template_id: 'tpl-heladeria', type: 'hero', title: 'Helados que hacen feliz', content: 'Más de 40 sabores artesanales elaborados con ingredientes naturales. Abiertos todos los días.', image_url: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=1200', visible: true, sort_order: 0 },
      { id: 's11', template_id: 'tpl-heladeria', type: 'about', title: 'Helados artesanales', content: 'Elaboramos nuestros helados a diario con frutas frescas y productos naturales. Sin conservantes ni colorantes artificiales.', image_url: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=800', visible: true, sort_order: 1 },
      { id: 's12', template_id: 'tpl-heladeria', type: 'contact', title: 'Visitanos', content: 'Abiertos todos los días de 12:00 a 23:00. También hacemos tortas heladas para encargos.', image_url: '', visible: true, sort_order: 2 },
    ],
  },
  {
    id: 'tpl-restaurant',
    name: 'Restaurant Gourmet',
    rubro: 'restaurant',
    description: 'Diseño sofisticado en tonos ámbar, perfecto para restaurants y gastronomía.',
    preview_color: '#f59e0b',
    sections: [
      { id: 's13', template_id: 'tpl-restaurant', type: 'hero', title: 'Una experiencia gastronómica única', content: 'Cocina de autor con los mejores ingredientes locales. Reservá tu mesa para una noche especial.', image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200', visible: true, sort_order: 0 },
      { id: 's14', template_id: 'tpl-restaurant', type: 'about', title: 'Nuestra propuesta', content: 'Menú de temporada que cambia cada mes, vinos seleccionados y el mejor servicio para hacer de tu visita una experiencia memorable.', image_url: 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800', visible: true, sort_order: 1 },
      { id: 's15', template_id: 'tpl-restaurant', type: 'contact', title: 'Reservas', content: 'Abrimos de martes a domingo desde las 20:00. Reservas recomendadas con anticipación.', image_url: '', visible: true, sort_order: 2 },
    ],
  },
  {
    id: 'tpl-gym',
    name: 'Gimnasio Moderno',
    rubro: 'gym',
    description: 'Diseño dinámico en azul y cyan, motivador para gimnasios y centros de fitness.',
    preview_color: '#3b82f6',
    sections: [
      { id: 's16', template_id: 'tpl-gym', type: 'hero', title: 'Tu mejor versión empieza acá', content: 'Equipamiento de última generación, profesores especializados y la comunidad fitness que necesitás.', image_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200', visible: true, sort_order: 0 },
      { id: 's17', template_id: 'tpl-gym', type: 'services', title: 'Nuestras disciplinas', content: 'Musculación, cardio, crossfit, yoga, pilates, spinning y clases grupales. Instructores certificados y planes personalizados.', image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800', visible: true, sort_order: 1 },
      { id: 's18', template_id: 'tpl-gym', type: 'contact', title: 'Empezá hoy', content: 'Abierto de lunes a sábado de 6:00 a 23:00 y domingos de 8:00 a 20:00. Primera clase gratis.', image_url: '', visible: true, sort_order: 2 },
    ],
  },
  {
    id: 'tpl-peluqueria',
    name: 'Peluquería Estudio',
    rubro: 'peluqueria',
    description: 'Diseño moderno en fuchsia y rosa, elegante para peluquerías y centros de belleza.',
    preview_color: '#d946ef',
    sections: [
      { id: 's19', template_id: 'tpl-peluqueria', type: 'hero', title: 'Tu imagen, nuestra pasión', content: 'Cortes, coloraciones y tratamientos a cargo de profesionales. Reservá tu turno online.', image_url: 'https://images.unsplash.com/photo-1562322140-8baeababf0be?w=1200', visible: true, sort_order: 0 },
      { id: 's20', template_id: 'tpl-peluqueria', type: 'services', title: 'Nuestros servicios', content: 'Cortes para damas y caballeros, coloración, mechas, tratamientos capilares, alisados y más. Usamos productos de primera marca.', image_url: 'https://images.unsplash.com/photo-1560066984-138daaa0f8b5?w=800', visible: true, sort_order: 1 },
      { id: 's21', template_id: 'tpl-peluqueria', type: 'contact', title: 'Reservá tu turno', content: 'Atendemos con turno de lunes a sábado. Contactanos por WhatsApp para reservar.', image_url: '', visible: true, sort_order: 2 },
    ],
  },
  {
    id: 'tpl-otro',
    name: 'Negocio General',
    rubro: 'otro',
    description: 'Diseño versátil en gris y slate para cualquier tipo de negocio.',
    preview_color: '#6b7280',
    sections: [
      { id: 's22', template_id: 'tpl-otro', type: 'hero', title: 'Bienvenidos a nuestro negocio', content: 'Te ofrecemos los mejores productos y servicios con la atención personalizada que merecés.', image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200', visible: true, sort_order: 0 },
      { id: 's23', template_id: 'tpl-otro', type: 'about', title: 'Quiénes somos', content: 'Somos un equipo comprometido con la calidad y la satisfacción de nuestros clientes. Años de experiencia nos respaldan.', image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800', visible: true, sort_order: 1 },
      { id: 's24', template_id: 'tpl-otro', type: 'contact', title: 'Contactanos', content: 'Estamos disponibles para atenderte y responder todas tus consultas.', image_url: '', visible: true, sort_order: 2 },
    ],
  },
]

export const SECTION_TYPE_LABELS: Record<string, string> = {
  hero: 'Hero / Portada',
  about: 'Sobre nosotros',
  services: 'Servicios',
  gallery: 'Galería',
  contact: 'Contacto',
  products: 'Productos',
  testimonials: 'Testimonios',
}
