{{- define "nl.namespace" -}}
{{- .Values.namespace | default "library" -}}
{{- end -}}

{{- define "nl.backendName" -}}
{{- .Values.backend.name | default "rails-backend" -}}
{{- end -}}

{{- define "nl.frontendName" -}}
{{- .Values.frontend.name | default "frontend" -}}
{{- end -}}
