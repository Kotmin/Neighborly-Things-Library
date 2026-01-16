{{- define "nl.namespace" -}}
{{- .Release.Namespace -}}
{{- end -}}


{{- define "nl.backendName" -}}
{{- .Values.backend.name | default "rails-backend" -}}
{{- end -}}

{{- define "nl.frontendName" -}}
{{- .Values.frontend.name | default "frontend" -}}
{{- end -}}
