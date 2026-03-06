import { useState } from 'react'
import { Eye, Edit2, Save, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { mockTemplates, SECTION_TYPE_LABELS } from '@/lib/mock-data'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RUBRO_ICONS, RUBRO_COLORS } from '@/types'
import type { TemplateSection } from '@/types'

type FullTemplate = typeof mockTemplates[0]

export default function TemplatesPage() {
  const [templates] = useState(mockTemplates)
  const [previewTemplate, setPreviewTemplate] = useState<FullTemplate | null>(null)
  const [editTemplate, setEditTemplate] = useState<FullTemplate | null>(null)
  const [editSections, setEditSections] = useState<TemplateSection[]>([])

  const handleEdit = (t: FullTemplate) => {
    setEditTemplate(t)
    setEditSections([...t.sections])
  }

  const handleSectionChange = (idx: number, field: keyof TemplateSection, value: string | boolean) => {
    setEditSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const handleSave = () => {
    toast.success('Template guardado correctamente')
    setEditTemplate(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Templates</h1>
        <p className="text-muted-foreground mt-1">Administrá los diseños de sitios web para tus clientes</p>
      </div>

      {editTemplate ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">{RUBRO_ICONS[editTemplate.rubro]} {editTemplate.name}</h2>
              <p className="text-sm text-muted-foreground">Editando secciones</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditTemplate(null)}>Cancelar</Button>
              <Button onClick={handleSave}><Save size={16} /> Guardar</Button>
            </div>
          </div>

          <div className="space-y-3">
            {editSections.map((section, idx) => (
              <Card key={section.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <GripVertical size={20} className="text-muted-foreground mt-1 cursor-grab shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{SECTION_TYPE_LABELS[section.type] ?? section.type}</Badge>
                        <Switch
                          checked={section.visible}
                          onCheckedChange={v => handleSectionChange(idx, 'visible', v)}
                        />
                        <span className="text-xs text-muted-foreground">{section.visible ? 'Visible' : 'Oculta'}</span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">Título</label>
                          <Input
                            value={section.title ?? ''}
                            onChange={e => handleSectionChange(idx, 'title', e.target.value)}
                            placeholder="Título de la sección"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">URL de imagen</label>
                          <Input
                            value={section.image_url ?? ''}
                            onChange={e => handleSectionChange(idx, 'image_url', e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Contenido</label>
                        <Textarea
                          value={section.content ?? ''}
                          onChange={e => handleSectionChange(idx, 'content', e.target.value)}
                          placeholder="Descripción, texto..."
                          rows={3}
                        />
                      </div>
                      {section.image_url && (
                        <img
                          src={section.image_url}
                          alt={section.title}
                          className="h-24 w-full object-cover rounded-lg"
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map(template => {
            const colors = RUBRO_COLORS[template.rubro]
            return (
              <Card key={template.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-2 bg-gradient-to-r ${colors.from} ${colors.to}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{RUBRO_ICONS[template.rubro]}</span>
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-xs">{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {template.sections.filter(s => s.visible).map(s => (
                      <Badge key={s.id} variant="secondary" className="text-xs">
                        {SECTION_TYPE_LABELS[s.type] ?? s.type}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreviewTemplate(template)}>
                      <Eye size={14} /> Vista previa
                    </Button>
                    <Button size="sm" className="flex-1" onClick={() => handleEdit(template)}>
                      <Edit2 size={14} /> Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewTemplate && `${RUBRO_ICONS[previewTemplate.rubro]} ${previewTemplate.name}`}
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              {previewTemplate.sections.map(section => (
                <div key={section.id} className="border border-border rounded-lg overflow-hidden">
                  {section.image_url && (
                    <img src={section.image_url} alt={section.title} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{SECTION_TYPE_LABELS[section.type]}</Badge>
                      {!section.visible && <Badge variant="destructive">Oculta</Badge>}
                    </div>
                    {section.title && <h3 className="font-bold text-foreground">{section.title}</h3>}
                    {section.content && <p className="text-sm text-muted-foreground mt-1">{section.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
