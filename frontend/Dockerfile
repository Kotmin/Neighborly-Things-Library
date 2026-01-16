FROM nginx:1.27-alpine

# Static frontend
COPY ./index.html /usr/share/nginx/html/index.html
COPY ./app.js /usr/share/nginx/html/app.js
COPY ./styles.css /usr/share/nginx/html/styles.css

# Nginx reverse proxy config is mounted from Kubernetes ConfigMap in this project.
# If you want a self-contained image without ConfigMap, copy a default.conf here.
